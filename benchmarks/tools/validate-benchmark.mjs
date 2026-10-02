import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
    artifactContentHash, artifactInstancesHash, availableInputsFor, canonicalJson,
    canonicalMultiset, deriveMetadata, deriveStructuralFingerprint,
    instanceContentHash, readJson, replayWitness, sha256, validateExpansionMetadata,
    weightedJaccard,
} from './benchmark-core.mjs';
import { buildSolverEvaluationView } from './environment-expansion.mjs';
import { createBenchmarkSchemaValidator } from './schema-validation.mjs';
import {
    ROOT, aggregateBindings, loadRepositoryPolicy, rebuildOfficialHardTargets,
    verifyFileBinding, verifyFileSet,
} from './repository-policy.mjs';

export const VALIDATOR_VERSION = 'repository-boundary-v5-manifest-revisions';
const DEFAULT_MANIFEST_REVISION_ID = 'hard-pilot-audit-v2-manifest-r2';

function repositoryPath(filePath) {
    return path.isAbsolute(filePath) ? filePath : path.join(ROOT, filePath);
}

function sameMembers(actual, expected) {
    return Array.isArray(actual) && actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

function schemaErrors(schemaRuntime, validator, prefix) {
    return schemaRuntime.formatErrors(validator).map(error => `${prefix}: schema ${error}`);
}

function expectedClassification(priorFamilyRepresentative, signature) {
    const representative = priorFamilyRepresentative.get(signature) ?? null;
    return representative
        ? { classification: 'structural-duplicate', duplicateOf: representative }
        : { classification: 'representative', duplicateOf: null };
}

async function validateRepositoryAuthority(policy, catalog, manifest, { catalogPath, manifestPath }) {
    const errors = [];
    const [seedError, catalogPolicyError, manifestPolicyError, expansionPolicyError, semanticsErrors, sourceErrors] = await Promise.all([
        verifyFileBinding(policy.inputSeed),
        readFile(catalogPath).then(content => sha256(content) === policy.catalog.sha256 ? null : `content hash differs from policy ${policy.catalog.sha256}`),
        readFile(manifestPath).then(content => sha256(content) === policy.officialTargets.manifest.sha256 ? null : `content hash differs from policy ${policy.officialTargets.manifest.sha256}`),
        verifyFileBinding(policy.inputEnvironmentExpansion),
        verifyFileSet(policy.gameSemantics),
        Promise.all(policy.officialTargets.sources.map(verifyFileBinding)).then(items => items.filter(Boolean)),
    ]);
    if (seedError) errors.push(seedError);
    if (catalogPolicyError) errors.push(`catalog: ${catalogPolicyError}`);
    if (manifestPolicyError) errors.push(`official targets: ${manifestPolicyError}`);
    if (expansionPolicyError) errors.push(`input environment expansion policy: ${expansionPolicyError}`);
    errors.push(...semanticsErrors.map(error => `canonical semantics: ${error}`));
    errors.push(...sourceErrors.map(error => `official target source: ${error}`));

    const seedText = await readFile(path.join(ROOT, policy.inputSeed.path), 'utf8');
    const seed = JSON.parse(seedText);
    if (catalog.schemaVersion !== policy.catalog.schemaVersion) errors.push(`catalog schemaVersion ${catalog.schemaVersion} is not repository-supported ${policy.catalog.schemaVersion}`);
    if (catalog.version !== policy.catalog.version) errors.push(`catalog version ${catalog.version} is not repository-supported ${policy.catalog.version}`);
    if (catalog.provenance?.seedSha256 !== policy.inputSeed.sha256) errors.push('catalog seed hash metadata differs from repository policy');
    for (const key of ['ordinary', 'special', 'refinement']) {
        if (canonicalJson(catalog[key]) !== canonicalJson(seed[key])) errors.push(`catalog ${key} differs from the human input seed`);
    }
    const expansionPolicy = await readJson(path.join(ROOT, policy.inputEnvironmentExpansion.path));
    if (expansionPolicy.policyId !== policy.inputEnvironmentExpansion.identity || expansionPolicy.schemaVersion !== policy.inputEnvironmentExpansion.version) {
        errors.push('input environment expansion policy identity/version differs from repository policy');
    }
    const official = await rebuildOfficialHardTargets(policy, manifest);
    errors.push(...official.errors);
    return { errors, official, expansionPolicy };
}

export async function validateBenchmarkRelease({ policy, profile, artifact, schemaRuntime }) {
    const errors = [];
    if (!profile.releaseManifestSha256) return { valid: false, errors: ['repository profile does not pin a release manifest hash'] };
    const releasePath = repositoryPath(profile.releaseManifestPath);
    const releaseText = await readFile(releasePath, 'utf8');
    const actualReleaseHash = sha256(releaseText);
    if (actualReleaseHash !== profile.releaseManifestSha256) errors.push('release manifest hash differs from repository policy');
    const release = JSON.parse(releaseText);
    const releaseValidator = schemaRuntime.releaseValidator(release.schemaVersion);
    if (!policy.supportedVersions.releaseManifest.includes(release.schemaVersion) || !releaseValidator) {
        errors.push(`unsupported release manifest schemaVersion ${release.schemaVersion}`);
    } else if (!releaseValidator(release)) errors.push(...schemaErrors(schemaRuntime, releaseValidator, 'release'));
    if (release.schemaVersion === 1) {
        const artifactReleaseId = profile.artifactReleaseId ?? profile.releaseId;
        const profileId = profile.profileId ?? artifactReleaseId;
        if (release.releaseId !== artifactReleaseId || release.releaseId !== artifact.releaseId) errors.push('legacy releaseId differs across policy, release manifest, and artifact');
        if (release.suite !== profile.suite || release.partition !== profile.partition || release.profile !== profileId) errors.push('legacy release suite/partition/profile differs from repository policy');
    } else if (release.schemaVersion === 2) {
        if (release.manifestRevisionId !== profile.manifestRevisionId) errors.push('manifestRevisionId differs between repository policy and release manifest');
        if (release.artifactReleaseId !== profile.artifactReleaseId || release.artifactReleaseId !== artifact.releaseId) errors.push('artifactReleaseId differs across policy, release manifest, and artifact');
        if (release.suite !== profile.suite || release.partition !== profile.partition || release.profileId !== profile.profileId) errors.push('release suite/partition/profileId differs from repository policy');
        if (release.policyIdentity?.policyId !== policy.policyId || release.policyIdentity?.schemaVersion !== policy.schemaVersion) errors.push('release policy identity differs from repository policy');
    }

    const artifactBinding = release.bindings?.artifactContent;
    if (artifactBinding?.canonicalization !== 'canonical-json-v1') errors.push('release artifact content binding uses an unsupported canonicalization');
    if (artifactBinding?.path !== profile.artifactPath) errors.push('release artifact content path differs from policy profile');
    if (artifactBinding) {
        const repositoryArtifact = await readJson(repositoryPath(artifactBinding.path));
        if (artifactContentHash(repositoryArtifact) !== artifactBinding.sha256) errors.push('release repository artifact canonical content differs from manifest');
        if (artifactContentHash(artifact) !== artifactBinding.sha256) errors.push('actual artifact canonical content differs from trusted release');
    }

    const singleBindings = ['userRules', 'benchmarkRules', 'inputSeed', 'inputCatalog', 'inputEnvironmentExpansion', 'instances', 'generationLog'];
    for (const name of singleBindings) {
        const binding = release.bindings?.[name];
        if (binding) {
            const error = await verifyFileBinding(binding);
            if (error) errors.push(`release ${name}: ${error}`);
        }
    }
    for (const name of ['officialTargets', 'canonicalSemantics', 'schemas', 'generator', 'validator']) {
        const binding = release.bindings?.[name];
        if (binding) errors.push(...(await verifyFileSet(binding)).map(error => `release ${name}: ${error}`));
    }
    if (release.bindings?.inputSeed?.sha256 !== policy.inputSeed.sha256) errors.push('release input seed is not the policy seed');
    if (release.bindings?.inputCatalog?.sha256 !== policy.catalog.sha256 || release.bindings?.inputCatalog?.version !== policy.catalog.version) errors.push('release catalog is not the policy catalog');
    if (artifact.schemaVersion === 3 && (release.bindings?.inputEnvironmentExpansion?.sha256 !== policy.inputEnvironmentExpansion.sha256
        || release.bindings?.inputEnvironmentExpansion?.path !== policy.inputEnvironmentExpansion.path)) errors.push('release input environment expansion binding differs from policy');
    if (release.bindings?.officialTargets?.sha256 !== aggregateBindings([policy.officialTargets.manifest, ...policy.officialTargets.sources])) errors.push('release official targets binding differs from policy');
    if (release.bindings?.canonicalSemantics?.sha256 !== policy.gameSemantics.sha256 || release.bindings?.canonicalSemantics?.version !== policy.gameSemantics.id) errors.push('release canonical semantics binding differs from policy');
    if (release.bindings?.instances?.path !== profile.artifactPath) errors.push('release instances path differs from policy profile');
    if (profile.sourceArtifact && (release.bindings?.sourceArtifact?.path !== profile.sourceArtifact.path
        || release.bindings?.sourceArtifact?.sha256 !== profile.sourceArtifact.sha256)) errors.push('release source artifact binding differs from policy profile');
    const witnessHash = sha256(canonicalJson(artifact.instances.map(instance => instance.witness)));
    if (release.bindings?.witnesses?.container !== profile.artifactPath
        || release.bindings?.witnesses?.jsonPointer !== '/instances/*/witness'
        || release.bindings?.witnesses?.sha256 !== witnessHash) errors.push('release witness binding mismatch');
    const log = await readJson(path.join(ROOT, release.bindings?.generationLog?.path ?? profile.artifactPath));
    const rejected = Array.isArray(log) ? log.filter(entry => entry.accepted === false) : [];
    if (release.bindings?.rejectionLog?.container !== release.bindings?.generationLog?.path
        || release.bindings?.rejectionLog?.jsonPointer !== '/*[accepted=false]'
        || release.bindings?.rejectionLog?.sha256 !== sha256(canonicalJson(rejected))) errors.push('release rejection-log binding mismatch');

    const projectionBinding = release.bindings?.solverProjection;
    if (profile.solverProjectionPath) {
        if (!projectionBinding) errors.push('release omits the required public solver projection binding');
        else {
            if (projectionBinding.path !== profile.solverProjectionPath) errors.push('release solver projection path differs from policy profile');
            if (projectionBinding.canonicalization !== 'canonical-json-v1') errors.push('release solver projection uses an unsupported canonicalization');
            const releasedProjection = await readJson(path.join(ROOT, projectionBinding.path));
            if (artifactContentHash(releasedProjection) !== projectionBinding.sha256) errors.push('released solver projection canonical content differs from manifest');
            const expectedProjection = buildSolverEvaluationView(artifact);
            expectedProjection.sha256 = artifactInstancesHash(expectedProjection.instances);
            if (canonicalJson(releasedProjection) !== canonicalJson(expectedProjection)) errors.push('released solver projection is not the exact public projection of the actual artifact');
        }
    } else if (projectionBinding) errors.push('release declares a solver projection not authorized by the repository profile');
    return { valid: errors.length === 0, errors, release };
}

export async function validateBenchmarkArtifact({
    releaseId = DEFAULT_MANIFEST_REVISION_ID,
    artifactPath,
    catalogPath,
    manifestPath,
    validateRelease = true,
} = {}) {
    const policy = await loadRepositoryPolicy();
    const requestedProfile = policy.profiles[releaseId]
        ?? (!validateRelease ? Object.values(policy.profiles).find(profile => profile.artifactReleaseId === releaseId) : null);
    const errors = [];
    if (!requestedProfile) return { valid: false, errors: [`unknown repository release profile/manifest revision ${releaseId}`], summary: { artifact: null, targetCount: 0, instanceCount: 0, mechanicallyReplayed: 0, sha256: null } };
    if (requestedProfile.manifestRevisionId !== releaseId && validateRelease) errors.push(`repository profile key does not match requested manifest revision ${releaseId}`);
    artifactPath ??= path.join(ROOT, requestedProfile.artifactPath);
    catalogPath ??= path.join(ROOT, policy.catalog.path);
    manifestPath ??= path.join(ROOT, policy.officialTargets.manifest.path);
    const [catalog, artifact, manifest, schemaRuntime] = await Promise.all([
        readJson(catalogPath), readJson(artifactPath), readJson(manifestPath), createBenchmarkSchemaValidator(),
    ]);

    if (!schemaRuntime.validatePolicy(policy)) errors.push(...schemaErrors(schemaRuntime, schemaRuntime.validatePolicy, 'repository policy'));
    if (!policy.supportedVersions.artifact.includes(artifact.schemaVersion)) errors.push(`unsupported artifact schemaVersion ${artifact.schemaVersion}`);
    if (!policy.supportedVersions.instance.includes(artifact.benchmarkInstanceSchemaVersion)) errors.push(`unsupported benchmark instance schemaVersion ${artifact.benchmarkInstanceSchemaVersion}`);
    if (!policy.supportedVersions.catalogSchema.includes(catalog.schemaVersion)) errors.push(`unsupported catalog schemaVersion ${catalog.schemaVersion}`);
    if (!policy.supportedVersions.catalog.includes(catalog.version)) errors.push(`unsupported catalog version ${catalog.version}`);
    if (!errors.length) {
        if (!schemaRuntime.validateCatalog(catalog)) errors.push(...schemaErrors(schemaRuntime, schemaRuntime.validateCatalog, 'catalog'));
        const artifactSchema = schemaRuntime.artifactValidator(artifact.schemaVersion);
        if (!artifactSchema) errors.push(`no executable artifact schema for version ${artifact.schemaVersion}`);
        else if (!artifactSchema(artifact)) errors.push(...schemaErrors(schemaRuntime, artifactSchema, 'artifact'));
    }

    const activeProfile = requestedProfile;
    if (artifact.releaseId !== activeProfile.artifactReleaseId) errors.push(`artifact releaseId ${artifact.releaseId} differs from profile artifactReleaseId ${activeProfile.artifactReleaseId}`);
    if (artifact.suite !== activeProfile.suite) errors.push(`artifact suite ${artifact.suite} differs from policy ${activeProfile.suite}`);
    if (artifact.partition !== activeProfile.partition) errors.push(`artifact partition ${artifact.partition} differs from policy ${activeProfile.partition}`);
    if (!sameMembers(artifact.targetIds, activeProfile.targetIds)) errors.push('artifact targetIds are not the complete ordered membership required by the repository profile');

    const authority = await validateRepositoryAuthority(policy, catalog, manifest, { catalogPath, manifestPath });
    errors.push(...authority.errors);
    let sourceArtifact = null;
    if (activeProfile.sourceArtifact) {
        const sourcePath = path.join(ROOT, activeProfile.sourceArtifact.path);
        const sourceText = await readFile(sourcePath, 'utf8');
        if (sha256(sourceText) !== activeProfile.sourceArtifact.sha256) errors.push('profile source artifact hash differs from repository policy');
        else sourceArtifact = JSON.parse(sourceText);
        if (sourceArtifact?.releaseId !== activeProfile.sourceArtifact.releaseId) errors.push('profile source artifact releaseId differs from repository policy');
    }
    const ids = new Set();
    const hashes = new Set();
    const byTarget = new Map();
    const familyRepresentatives = new Map();
    let replayed = 0;
    for (const [index, instance] of (artifact.instances ?? []).entries()) {
        const prefix = `instance ${index}/${instance?.id ?? '?'}`;
        if (instance?.schemaVersion !== artifact.benchmarkInstanceSchemaVersion) errors.push(`${prefix}: schema version mismatch`);
        if (typeof instance?.id !== 'string' || ids.has(instance.id)) errors.push(`${prefix}: missing/duplicate id`); else ids.add(instance.id);
        if (instance?.suite !== activeProfile.suite || instance?.partition !== activeProfile.partition) errors.push(`${prefix}: suite/partition differs from repository profile`);
        if (instance?.rules?.maxLayers !== 4 || instance?.rules?.cleanPainting !== activeProfile.cleanPainting || instance?.rules?.allowSplitting !== activeProfile.allowSplitting) errors.push(`${prefix}: rules differ from repository profile`);
        const presentedInputs = availableInputsFor(instance);
        if (presentedInputs.length !== new Set(presentedInputs.map(input => input.shape)).size) errors.push(`${prefix}: duplicate input rows in the presented environment must be consolidated`);
        if (instance.schemaVersion === 3 && instance.coreWitnessBasis.length !== new Set(instance.coreWitnessBasis.map(input => input.shape)).size) errors.push(`${prefix}: duplicate core basis rows must be consolidated`);
        const official = authority.official.byId.get(instance?.targetId);
        if (!official || !activeProfile.targetIds.includes(instance.targetId)) errors.push(`${prefix}: targetId is not in the repository profile's complete official membership`);
        else {
            if (official.target !== instance.target || official.track !== instance.track) errors.push(`${prefix}: target/track differs from official source`);
            if (['development', 'validation', 'holdout'].includes(activeProfile.partition) && official.partition !== activeProfile.partition) errors.push(`${prefix}: target belongs to official partition ${official.partition}`);
            const expectedProvenance = {
                releaseId: activeProfile.artifactReleaseId,
                targetSha256: official.sha256,
                officialTargetsSha256: policy.officialTargets.manifest.sha256,
                catalogVersion: policy.catalog.version,
                catalogSha256: policy.catalog.sha256,
                inputSeedIdentity: policy.inputSeed.identity,
                inputSeedSha256: policy.inputSeed.sha256,
                gameSemanticsId: policy.gameSemantics.id,
                gameSemanticsSha256: policy.gameSemantics.sha256,
            };
            for (const [key, value] of Object.entries(expectedProvenance)) if (instance.provenance?.[key] !== value) errors.push(`${prefix}: provenance ${key} differs from repository policy`);
        }
        const replay = replayWitness(instance, catalog);
        if (!replay.valid) errors.push(`${prefix}: replay failed at ${replay.phase}: ${(replay.errors ?? []).join('; ')}`);
        else {
            replayed += 1;
            const expansionValidation = validateExpansionMetadata(instance, catalog, replay, authority.expansionPolicy);
            if (!expansionValidation.valid) errors.push(...expansionValidation.errors.map(error => `${prefix}: ${error}`));
            if (instance.schemaVersion === 3) {
                if (instance.expansion.policyId !== policy.inputEnvironmentExpansion.identity
                    || instance.expansion.policyVersion !== policy.inputEnvironmentExpansion.version
                    || instance.expansion.policySha256 !== policy.inputEnvironmentExpansion.sha256) errors.push(`${prefix}: expansion policy provenance differs from repository policy`);
                if (instance.difficulty?.environmentExpansionCount < authority.expansionPolicy.pilotBounds.minimumAvailableMultiplicityIncrease) errors.push(`${prefix}: presented environment does not satisfy the expansion policy minimum increase`);
                const claimedSource = instance.expansion.sourceInstance;
                const actualSource = sourceArtifact?.instances?.find(candidate => candidate.id === claimedSource.id);
                if (!actualSource || claimedSource.releaseId !== activeProfile.sourceArtifact?.releaseId
                    || claimedSource.instanceSha256 !== actualSource?.instanceSha256
                    || actualSource?.targetId !== instance.targetId || actualSource?.target !== instance.target) {
                    errors.push(`${prefix}: expansion source instance provenance is not bound to the repository source artifact`);
                }
            }
            const metadata = deriveMetadata(instance, replay);
            if (canonicalJson(metadata) !== canonicalJson(instance.difficulty)) errors.push(`${prefix}: difficulty metadata is not mechanically derived`);
            if (metadata.operationCount < activeProfile.minimumWitnessOperations) errors.push(`${prefix}: witness is below repository operation floor`);
            if (metadata.witnessDepth < activeProfile.minimumWitnessDepth) errors.push(`${prefix}: witness is below repository depth floor`);
            if (metadata.splitCount !== 0) errors.push(`${prefix}: Splitter is disabled for formal Benchmark releases`);
        }
        const multiset = canonicalMultiset(presentedInputs);
        if (multiset !== instance.diversity?.inputMultisetSignature) errors.push(`${prefix}: input multiset signature mismatch`);
        if (replay.valid) {
            const structural = deriveStructuralFingerprint(instance, replay);
            if (structural.version !== instance.diversity?.structureVersion || structural.signature !== instance.diversity?.structureSignature) errors.push(`${prefix}: structural fingerprint is not independently derived from canonical replay provenance`);
            const targetFamilies = familyRepresentatives.get(instance.targetId) ?? new Map();
            const classification = expectedClassification(targetFamilies, structural.signature);
            if (instance.diversity?.classification !== classification.classification || instance.diversity?.duplicateOf !== classification.duplicateOf) errors.push(`${prefix}: structural-family classification mismatch`);
            if (!targetFamilies.has(structural.signature)) targetFamilies.set(structural.signature, instance.id);
            familyRepresentatives.set(instance.targetId, targetFamilies);
            if (activeProfile.requireDistinctStructuralFamilies && classification.duplicateOf) errors.push(`${prefix}: duplicate structural family is forbidden by profile`);
        }
        if (hashes.has(instance.instanceSha256)) errors.push(`${prefix}: duplicate instance hash`); else hashes.add(instance.instanceSha256);
        const expectedInstanceHash = instanceContentHash(instance);
        if (expectedInstanceHash !== instance.instanceSha256) errors.push(`${prefix}: instance sha256 mismatch`);
        if (!activeProfile.allowPureInputs && presentedInputs.some(input => ['RuRuRuRu', 'CuCuCuCu', 'SuSuSuSu'].includes(input.shape))) errors.push(`${prefix}: pure input violates repository profile`);
        if (presentedInputs.some(input => input.shape === instance.target)) errors.push(`${prefix}: target itself appears as input`);
        const targetInstances = byTarget.get(instance.targetId) ?? [];
        for (const other of targetInstances) {
            if (other.diversity?.inputMultisetSignature === multiset) errors.push(`${prefix}: duplicate input multiset for target`);
            const similarity = weightedJaccard(multiset, canonicalMultiset(availableInputsFor(other)));
            if (similarity > activeProfile.maxPairwiseInputWeightedJaccard + Number.EPSILON) errors.push(`${prefix}: pairwise input similarity ${similarity} exceeds repository policy`);
        }
        targetInstances.push(instance);
        byTarget.set(instance.targetId, targetInstances);
    }
    if ((artifact.instances ?? []).length !== artifact.acceptedCount) errors.push('acceptedCount mismatch');
    if (artifact.candidateCount !== artifact.acceptedCount + artifact.rejectedCount) errors.push('candidate/accepted/rejected counts are inconsistent');
    if (artifact.acceptedCount !== activeProfile.targetIds.length * activeProfile.instancesPerTarget) errors.push('artifact cardinality does not equal repository profile');
    if (byTarget.size !== activeProfile.targetIds.length) errors.push('artifact target membership is incomplete');
    for (const targetId of activeProfile.targetIds) if ((byTarget.get(targetId) ?? []).length !== activeProfile.instancesPerTarget) errors.push(`${targetId}: wrong instance count for repository profile`);
    if (artifactInstancesHash(artifact.instances) !== artifact.sha256) errors.push('artifact sha256 mismatch');
    if (validateRelease) {
        const releaseValidation = await validateBenchmarkRelease({ policy, profile: requestedProfile, artifact, schemaRuntime });
        errors.push(...releaseValidation.errors);
    }
    return {
        valid: errors.length === 0,
        errors,
        summary: {
            artifact: artifact.name,
            releaseId: artifact.releaseId,
            manifestRevisionId: activeProfile.manifestRevisionId,
            targetCount: byTarget.size,
            instanceCount: artifact.instances?.length ?? 0,
            mechanicallyReplayed: replayed,
            structuralFamilies: [...familyRepresentatives.values()].reduce((sum, families) => sum + families.size, 0),
            sha256: artifact.sha256,
            releaseValidationPerformed: validateRelease,
            releaseAcceptance: validateRelease && errors.length === 0,
        },
    };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const releaseIndex = process.argv.indexOf('--release');
    const releaseId = releaseIndex >= 0 ? process.argv[releaseIndex + 1] : DEFAULT_MANIFEST_REVISION_ID;
    const result = await validateBenchmarkArtifact({ releaseId });
    if (!result.valid) {
        console.error(result.errors.join('\n'));
        process.exitCode = 1;
    } else console.log(JSON.stringify(result.summary, null, 2));
}
