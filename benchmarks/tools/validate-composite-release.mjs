import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import {
    artifactInstancesHash, canonicalJson, deriveStructuralFingerprint, instanceContentHash, readJson,
    replayWitness, sha256, validateExpansionMetadata,
} from './benchmark-core.mjs';
import {
    COMPOSITE_CANONICALIZATION, COMPOSITE_MANIFEST_REVISION_ID, COMPOSITE_RELEASE_ID,
    COMPOSITE_SCHEMA_VERSION, FROZEN_FINAL_SELECTION_SHA256, compositeManifestIdentity,
    sourceMembers,
} from './composite-release-core.mjs';
import {
    rebuildOfficialHardTargets, verifyFileBinding, verifyFileSet,
} from './repository-policy.mjs';

export const COMPOSITE_VALIDATOR_VERSION = 'provenance-composite-release-v1';
export const DEFAULT_COMPOSITE_MANIFEST = 'benchmarks/releases/hard-53x3-stage-v1.release.json';
export const DEFAULT_COMPOSITE_REGISTRY = 'benchmarks/policy/composite-releases.v1.json';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function repositoryPath(filePath) {
    return path.isAbsolute(filePath) ? filePath : path.join(ROOT, filePath);
}

function addMismatch(errors, condition, message) {
    if (!condition) errors.push(message);
    return condition;
}

async function rawHash(filePath) {
    return sha256(await readFile(repositoryPath(filePath)));
}

async function canonicalDocumentHash(filePath) {
    return sha256(canonicalJson(await readJson(repositoryPath(filePath))));
}

async function createCompositeSchemaValidator() {
    const schema = await readJson(path.join(ROOT, 'benchmarks/schema/composite-release-manifest.v4.schema.json'));
    const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true, formats: { 'date-time': true } });
    return { validate: ajv.compile(schema), ajv };
}

function schemaErrors(validate) {
    return (validate.errors ?? []).map(error => `composite manifest schema ${error.instancePath || '/'} ${error.message}`);
}

function sourceOverridePath(source, overrides) {
    return overrides?.[source.sourceId] ?? overrides?.[source.path] ?? source.path;
}

export async function validateCompositeRelease({
    manifestPath = DEFAULT_COMPOSITE_MANIFEST,
    registryPath = DEFAULT_COMPOSITE_REGISTRY,
    validateTrust = true,
    sourcePathOverrides = {},
} = {}) {
    const errors = [];
    const manifest = await readJson(repositoryPath(manifestPath));
    const { validate } = await createCompositeSchemaValidator();
    if (!validate(manifest)) errors.push(...schemaErrors(validate));

    addMismatch(errors, manifest.schemaVersion === COMPOSITE_SCHEMA_VERSION, `schemaVersion must be ${COMPOSITE_SCHEMA_VERSION}`);
    addMismatch(errors, manifest.manifestRevisionId === COMPOSITE_MANIFEST_REVISION_ID, 'unexpected composite manifest revision identity');
    addMismatch(errors, manifest.compositeReleaseId === COMPOSITE_RELEASE_ID, 'unexpected composite release identity');
    addMismatch(errors, manifest.hashCanonicalization === COMPOSITE_CANONICALIZATION, 'unsupported composite canonicalization');

    const computedCompositeIdentity = compositeManifestIdentity(manifest);
    addMismatch(errors, manifest.compositeCanonicalSha256 === computedCompositeIdentity, 'composite canonical identity mismatch');
    if (validateTrust) {
        const registry = await readJson(repositoryPath(registryPath));
        const trusted = registry.releases?.[manifest.compositeReleaseId];
        addMismatch(errors, registry.schemaVersion === 1 && registry.registryId === 'official-composite-releases-v1', 'invalid composite release trust registry');
        addMismatch(errors, trusted?.manifestRevisionId === manifest.manifestRevisionId, 'composite manifest revision is not trusted');
        addMismatch(errors, trusted?.schemaVersion === manifest.schemaVersion, 'composite schema version is not trusted');
        addMismatch(errors, trusted?.compositeCanonicalSha256 === computedCompositeIdentity, 'composite canonical identity differs from trusted registry');
    }

    const bindings = manifest.bindings ?? {};
    const fileBindings = ['userRules', 'benchmarkRules', 'schema', 'generator', 'validator'];
    for (const name of fileBindings) {
        const binding = bindings[name];
        if (!binding) continue;
        try {
            addMismatch(errors, await rawHash(binding.path) === binding.sha256, `${name} file identity mismatch`);
        } catch (error) {
            errors.push(`${name} binding cannot be resolved: ${error.message}`);
        }
    }

    let finalSelection = null;
    let frozenBindingsValidated = 0;
    try {
        finalSelection = await readJson(repositoryPath(bindings.finalSelection.path));
        const selectionHash = sha256(canonicalJson(finalSelection.slots));
        addMismatch(errors, bindings.finalSelection.selectionId === finalSelection.selectionId, 'final-selection identity mismatch');
        addMismatch(errors, bindings.finalSelection.documentCanonicalSha256 === sha256(canonicalJson(finalSelection)), 'final-selection document identity mismatch');
        addMismatch(errors, bindings.finalSelection.selectionCanonicalSha256 === FROZEN_FINAL_SELECTION_SHA256, 'manifest final-selection hash differs from frozen identity');
        addMismatch(errors, finalSelection.selectionCanonicalSha256 === FROZEN_FINAL_SELECTION_SHA256, 'final-selection declaration differs from frozen identity');
        addMismatch(errors, selectionHash === FROZEN_FINAL_SELECTION_SHA256, 'final-selection slots canonical hash differs from frozen identity');
    } catch (error) {
        errors.push(`final-selection binding cannot be resolved: ${error.message}`);
    }

    for (const [chainName, chain] of [
        ['sourceIdentityChain', finalSelection?.sourceIdentityChain],
        ['decisionIdentityChain', finalSelection?.decisionIdentityChain],
    ]) {
        for (const [name, binding] of Object.entries(chain ?? {})) {
            let valid = true;
            try {
                const bytes = await readFile(repositoryPath(binding.path));
                const document = JSON.parse(bytes);
                if (binding.artifactCanonicalSha256
                    && sha256(canonicalJson(document)) !== binding.artifactCanonicalSha256) {
                    errors.push(`${chainName}.${name}: canonical identity changed`); valid = false;
                }
                if (binding.canonicalSha256 && sha256(canonicalJson(document)) !== binding.canonicalSha256) {
                    errors.push(`${chainName}.${name}: canonical identity changed`); valid = false;
                }
                if (binding.fileSha256 && sha256(bytes) !== binding.fileSha256) {
                    errors.push(`${chainName}.${name}: file identity changed`); valid = false;
                }
                if (binding.instancesSha256
                    && (document.sha256 !== binding.instancesSha256
                        || artifactInstancesHash(document.instances) !== binding.instancesSha256)) {
                    errors.push(`${chainName}.${name}: instances identity changed`); valid = false;
                }
                if (binding.releaseId && document.releaseId !== undefined && document.releaseId !== binding.releaseId) {
                    errors.push(`${chainName}.${name}: release identity changed`); valid = false;
                }
                if (binding.selectionCanonicalSha256) {
                    const { optionalPromotionSelectionHash, ...selectionBinding } = document;
                    const calculated = sha256(canonicalJson(selectionBinding));
                    if (calculated !== binding.selectionCanonicalSha256
                        || optionalPromotionSelectionHash !== binding.selectionCanonicalSha256) {
                        errors.push(`${chainName}.${name}: selection identity changed`); valid = false;
                    }
                }
                if (valid) frozenBindingsValidated += 1;
            } catch (error) {
                errors.push(`${chainName}.${name}: binding cannot be resolved: ${error.message}`);
            }
        }
    }

    let policy = null;
    let catalog = null;
    let expansionPolicy = null;
    let officialManifest = null;
    for (const [name, identityKey] of [
        ['repositoryPolicy', 'policyId'], ['inputEnvironmentExpansion', 'policyId'],
    ]) {
        const binding = bindings[name];
        if (!binding) continue;
        try {
            const document = await readJson(repositoryPath(binding.path));
            addMismatch(errors, sha256(canonicalJson(document)) === binding.canonicalSha256, `${name} canonical identity mismatch`);
            addMismatch(errors, document[identityKey] === binding.identity && document.schemaVersion === binding.version, `${name} declared identity/version mismatch`);
            if (name === 'repositoryPolicy') policy = document;
            else expansionPolicy = document;
        } catch (error) {
            errors.push(`${name} binding cannot be resolved: ${error.message}`);
        }
    }
    for (const name of ['officialTargets', 'inputCatalog']) {
        const binding = bindings[name];
        if (!binding) continue;
        try {
            const document = await readJson(repositoryPath(binding.path));
            addMismatch(errors, sha256(canonicalJson(document)) === binding.canonicalSha256, `${name} canonical identity mismatch`);
            if (name === 'officialTargets') officialManifest = document;
            else catalog = document;
        } catch (error) {
            errors.push(`${name} binding cannot be resolved: ${error.message}`);
        }
    }

    let authorityBindingsValidated = 0;
    let officialTargets = new Map((officialManifest?.cases ?? []).filter(item => item.suite === 'hard').map(item => [item.id, item]));
    if (policy && officialManifest) {
        const authorityChecks = [
            ['input seed', await verifyFileBinding(policy.inputSeed)],
            ['input catalog', await verifyFileBinding(policy.catalog)],
            ['input environment expansion', await verifyFileBinding(policy.inputEnvironmentExpansion)],
            ['official target manifest', await verifyFileBinding(policy.officialTargets.manifest)],
        ];
        for (const source of policy.officialTargets.sources) {
            authorityChecks.push([`official target source ${source.path}`, await verifyFileBinding(source)]);
        }
        for (const [name, error] of authorityChecks) {
            if (error) errors.push(`${name}: ${error}`);
            else authorityBindingsValidated += 1;
        }
        const semanticsErrors = await verifyFileSet(policy.gameSemantics);
        if (semanticsErrors.length) errors.push(...semanticsErrors.map(error => `canonical semantics: ${error}`));
        else authorityBindingsValidated += policy.gameSemantics.files.length + 1;
        const rebuilt = await rebuildOfficialHardTargets(policy, officialManifest);
        errors.push(...rebuilt.errors.map(error => `official target authority: ${error}`));
        if (!rebuilt.errors.length) {
            officialTargets = rebuilt.byId;
            authorityBindingsValidated += 1;
        }
    }
    const sources = new Map();
    const sourceIds = new Set();
    const sourcePaths = new Set();
    for (const source of manifest.sourceRegistry ?? []) {
        if (sourceIds.has(source.sourceId)) errors.push(`duplicate source registry id ${source.sourceId}`);
        if (sourcePaths.has(source.path)) errors.push(`duplicate source registry path ${source.path}`);
        sourceIds.add(source.sourceId);
        sourcePaths.add(source.path);
        try {
            const sourceDocument = await readJson(repositoryPath(sourceOverridePath(source, sourcePathOverrides)));
            const actualCanonicalSha256 = sha256(canonicalJson(sourceDocument));
            addMismatch(errors, actualCanonicalSha256 === source.canonicalSha256, `${source.sourceId}: source canonical identity mismatch`);
            if (source.contentType === 'benchmark-artifact') {
                addMismatch(errors, sourceDocument.releaseId === source.releaseId, `${source.sourceId}: source artifact release identity mismatch`);
            }
            if (source.manifestRevisionId) {
                const profile = policy?.profiles?.[source.manifestRevisionId];
                addMismatch(errors, profile?.manifestRevisionId === source.manifestRevisionId, `${source.sourceId}: source manifest revision is not registered`);
                addMismatch(errors, profile?.artifactReleaseId === source.releaseId && profile?.artifactPath === source.path,
                    `${source.sourceId}: source manifest revision binds a different artifact`);
                if (profile?.releaseManifestPath) {
                    const releaseBytes = await readFile(repositoryPath(profile.releaseManifestPath));
                    const release = JSON.parse(releaseBytes);
                    addMismatch(errors, sha256(releaseBytes) === profile.releaseManifestSha256,
                        `${source.sourceId}: source manifest file identity mismatch`);
                    addMismatch(errors, release.manifestRevisionId === source.manifestRevisionId
                        && release.artifactReleaseId === source.releaseId
                        && release.bindings?.artifactContent?.sha256 === source.canonicalSha256,
                    `${source.sourceId}: source manifest identity/content binding mismatch`);
                }
                if (profile?.sourceArtifact) {
                    const sourceArtifactError = await verifyFileBinding(profile.sourceArtifact);
                    if (sourceArtifactError) errors.push(`${source.sourceId}: source profile ancestry: ${sourceArtifactError}`);
                    else authorityBindingsValidated += 1;
                }
            }
            const collection = sourceMembers(sourceDocument, source.contentType);
            if (!Array.isArray(collection)) errors.push(`${source.sourceId}: source member collection is not resolvable`);
            const byId = new Map();
            for (const instance of collection ?? []) {
                if (byId.has(instance.id)) errors.push(`${source.sourceId}: duplicate source instance id ${instance.id}`);
                byId.set(instance.id, instance);
            }
            sources.set(source.sourceId, { source, sourceDocument, byId });
        } catch (error) {
            errors.push(`${source.sourceId}: source cannot be resolved: ${error.message}`);
        }
    }

    const expectedSlots = finalSelection?.slots ?? [];
    const resolvedSelectionSlots = [];
    const memberKeys = new Set();
    const targetSlots = new Map();
    const targetFamilies = new Map();
    let provenanceResolved = 0;
    let replayed = 0;
    let expansionValidated = 0;
    let fingerprintsValidated = 0;

    for (const [index, member] of (manifest.members ?? []).entries()) {
        const prefix = `member ${index}/${member?.targetId ?? '?'}:${member?.slot ?? '?'}`;
        let memberValid = true;
        const referenceKey = `${member.sourceId}\0${member.sourceInstanceId}`;
        if (memberKeys.has(referenceKey)) { errors.push(`${prefix}: duplicate member reference`); memberValid = false; }
        memberKeys.add(referenceKey);

        const expectedSlot = expectedSlots[index];
        if (!expectedSlot) { errors.push(`${prefix}: no corresponding final-selection entry`); memberValid = false; }
        else {
            const expectedEntryHash = sha256(canonicalJson(expectedSlot));
            for (const [key, expected] of [
                ['targetId', expectedSlot.targetId], ['slot', expectedSlot.slot],
                ['familyIdentity', expectedSlot.familyIdentity], ['sourceInstanceId', expectedSlot.selectedInstanceId],
                ['sourceInstanceSha256', expectedSlot.selectedInstanceSha256], ['structuralSignature', expectedSlot.structuralSignature],
                ['selectionEntrySha256', expectedEntryHash],
            ]) {
                if (member[key] !== expected) { errors.push(`${prefix}: ${key} differs from frozen final selection`); memberValid = false; }
            }
        }

        const resolvedSource = sources.get(member.sourceId);
        if (!resolvedSource) { errors.push(`${prefix}: missing source registry reference ${member.sourceId}`); memberValid = false; }
        else if (expectedSlot) {
            if (resolvedSource.source.path !== expectedSlot.sourceArtifact
                || resolvedSource.source.releaseId !== expectedSlot.sourceReleaseId
                || resolvedSource.source.canonicalSha256 !== expectedSlot.sourceArtifactCanonicalSha256) {
                errors.push(`${prefix}: source registry binding differs from frozen final selection`);
                memberValid = false;
            }
        }

        const instance = resolvedSource?.byId.get(member.sourceInstanceId);
        if (!instance) { errors.push(`${prefix}: source instance does not exist`); memberValid = false; }
        if (instance) {
            if (instance.id !== member.sourceInstanceId || instance.targetId !== member.targetId) {
                errors.push(`${prefix}: incorrect source instance identity/target`); memberValid = false;
            }
            if (instance.instanceSha256 !== member.sourceInstanceSha256 || instanceContentHash(instance) !== member.sourceInstanceSha256) {
                errors.push(`${prefix}: source instance content identity mismatch`); memberValid = false;
            }
            if (instance.provenance?.releaseId !== resolvedSource.source.releaseId) {
                errors.push(`${prefix}: source instance provenance release identity mismatch`); memberValid = false;
            }
            if (expectedSlot && canonicalJson(instance.provenance) !== canonicalJson(expectedSlot.sourceInstanceReference?.sourceInstanceProvenance)) {
                errors.push(`${prefix}: provenance continuity to final selection is broken`); memberValid = false;
            }
            const official = officialTargets.get(member.targetId);
            const expectedProvenance = policy && official ? {
                targetSha256: official.sha256,
                officialTargetsSha256: policy.officialTargets.manifest.sha256,
                catalogVersion: policy.catalog.version,
                catalogSha256: policy.catalog.sha256,
                inputSeedIdentity: policy.inputSeed.identity,
                inputSeedSha256: policy.inputSeed.sha256,
                gameSemanticsId: policy.gameSemantics.id,
                gameSemanticsSha256: policy.gameSemantics.sha256,
            } : null;
            if (!official || official.target !== instance.target) {
                errors.push(`${prefix}: target is not the bound official target`); memberValid = false;
            }
            for (const [key, value] of Object.entries(expectedProvenance ?? {})) {
                if (instance.provenance?.[key] !== value) { errors.push(`${prefix}: provenance ${key} differs from bound policy`); memberValid = false; }
            }

            if (catalog) {
                const replay = replayWitness(instance, catalog);
                if (!replay.valid) { errors.push(`${prefix}: canonical replay failed at ${replay.phase}`); memberValid = false; }
                else {
                    replayed += 1;
                    const fingerprint = deriveStructuralFingerprint(instance, replay);
                    if (fingerprint.signature !== member.structuralSignature
                        || fingerprint.signature !== instance.diversity?.structureSignature) {
                        errors.push(`${prefix}: source member structural signature mismatch`); memberValid = false;
                    } else fingerprintsValidated += 1;
                    if (expansionPolicy) {
                        const expansion = validateExpansionMetadata(instance, catalog, replay, expansionPolicy);
                        if (!expansion.valid) { errors.push(...expansion.errors.map(error => `${prefix}: ${error}`)); memberValid = false; }
                        else expansionValidated += 1;
                    }
                }
            }
        }

        const slots = targetSlots.get(member.targetId) ?? new Set();
        if (slots.has(member.slot)) { errors.push(`${prefix}: duplicate target slot`); memberValid = false; }
        slots.add(member.slot);
        targetSlots.set(member.targetId, slots);
        const families = targetFamilies.get(member.targetId) ?? new Set();
        families.add(member.structuralSignature);
        targetFamilies.set(member.targetId, families);

        if (memberValid && expectedSlot) {
            resolvedSelectionSlots.push(expectedSlot);
            provenanceResolved += 1;
        }
    }

    addMismatch(errors, (manifest.members ?? []).length === 159, 'composite membership must contain exactly 159 references');
    addMismatch(errors, expectedSlots.length === 159, 'bound final selection must contain exactly 159 entries');
    addMismatch(errors, targetSlots.size === 53, 'composite membership must contain exactly 53 targets');
    for (const [targetId, slots] of targetSlots) {
        if (slots.size !== 3 || !['F1', 'F2', 'F3'].every(slot => slots.has(slot))) errors.push(`${targetId}: target does not contain exactly F1/F2/F3`);
        if (targetFamilies.get(targetId)?.size !== 3) errors.push(`${targetId}: target does not contain three unique structural families`);
    }
    const reconstructedSelectionHash = sha256(canonicalJson(resolvedSelectionSlots));
    addMismatch(errors, reconstructedSelectionHash === FROZEN_FINAL_SELECTION_SHA256, 'member references do not reconstruct the frozen final-selection hash');

    return {
        valid: errors.length === 0,
        errors,
        manifest,
        summary: {
            compositeReleaseId: manifest.compositeReleaseId,
            manifestRevisionId: manifest.manifestRevisionId,
            schemaVersion: manifest.schemaVersion,
            status: manifest.status,
            compositeCanonicalSha256: computedCompositeIdentity,
            finalSelectionCanonicalSha256: bindings.finalSelection?.selectionCanonicalSha256 ?? null,
            sourceArtifactCount: manifest.sourceRegistry?.length ?? 0,
            targetCount: targetSlots.size,
            memberCount: manifest.members?.length ?? 0,
            provenanceResolved,
            mechanicallyReplayed: replayed,
            expansionValidated,
            fingerprintsValidated,
            reconstructedSelectionHash,
            frozenBindingsValidated,
            authorityBindingsValidated,
            trustValidationPerformed: validateTrust,
        },
    };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const manifestIndex = process.argv.indexOf('--manifest');
    const result = await validateCompositeRelease({
        manifestPath: manifestIndex >= 0 ? process.argv[manifestIndex + 1] : DEFAULT_COMPOSITE_MANIFEST,
    });
    if (!result.valid) {
        console.error(result.errors.join('\n'));
        process.exitCode = 1;
    } else console.log(JSON.stringify(result.summary, null, 2));
}
