import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { canonicalJson, readJson, sha256 } from './benchmark-core.mjs';
import {
    COMPOSITE_CANONICALIZATION, COMPOSITE_MANIFEST_REVISION_ID, COMPOSITE_RELEASE_ID,
    COMPOSITE_SCHEMA_VERSION, FROZEN_FINAL_SELECTION_SHA256, compositeManifestIdentity,
    memberReferenceFromSelection,
} from './composite-release-core.mjs';
import { COMPOSITE_VALIDATOR_VERSION } from './validate-composite-release.mjs';

export const COMPOSITE_GENERATOR_VERSION = 'hard-53x3-composite-manifest-v1';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUTPUT_PATH = 'benchmarks/releases/hard-53x3-stage-v1.release.json';
const REGISTRY_PATH = 'benchmarks/policy/composite-releases.v1.json';
const FINAL_SELECTION_PATH = 'benchmarks/final-targeted-acceptance/v1/final-selection.json';

const SOURCE_DEFINITIONS = [
    {
        sourceId: 'baseline', path: 'benchmarks/hard-53x1/v1/instances.json',
        contentType: 'benchmark-artifact', manifestRevisionId: 'hard-53x1-stage-v1-manifest-r2',
    },
    {
        sourceId: 'diversity-pilot', path: 'benchmarks/diversity-pilot/v1/instances.json',
        contentType: 'benchmark-artifact', manifestRevisionId: 'hard-53x3-diversity-pilot-v1-manifest-r1',
    },
    {
        sourceId: 'rollout', path: 'benchmarks/hard-53x3-rollout/v1/instances.json',
        contentType: 'benchmark-artifact', manifestRevisionId: 'hard-53x3-rollout-stage-v1-manifest-r1',
    },
    {
        sourceId: 'deep-pass', path: 'benchmarks/hard-53x3-deep-diversity/v1/instances.json',
        contentType: 'benchmark-artifact',
    },
    {
        sourceId: 'optional-promotions', path: 'benchmarks/hard-53x3-deep-diversity/v1/optional-candidates.json',
        contentType: 'instance-array',
    },
    {
        sourceId: 'final-reselection', path: 'benchmarks/final-depth-reselection/v1/instances.json',
        contentType: 'benchmark-artifact',
    },
];

function absolute(relativePath) {
    return path.join(ROOT, relativePath);
}

async function rawBinding(relativePath, version) {
    const binding = { path: relativePath, sha256: sha256(await readFile(absolute(relativePath))) };
    if (version !== undefined) binding.version = version;
    return binding;
}

async function canonicalBinding(relativePath) {
    const document = await readJson(absolute(relativePath));
    return { path: relativePath, canonicalSha256: sha256(canonicalJson(document)), document };
}

export async function buildHard53x3CompositeRelease({ status = 'audit-candidate', write = true } = {}) {
    if (!['audit-candidate', 'released'].includes(status)) throw new Error(`unsupported composite status ${status}`);
    const finalSelection = await readJson(absolute(FINAL_SELECTION_PATH));
    const selectionCanonicalSha256 = sha256(canonicalJson(finalSelection.slots));
    if (selectionCanonicalSha256 !== FROZEN_FINAL_SELECTION_SHA256
        || finalSelection.selectionCanonicalSha256 !== FROZEN_FINAL_SELECTION_SHA256) {
        throw new Error('frozen final-selection identity mismatch');
    }

    const sourceRegistry = [];
    const sourceIdByPath = new Map();
    for (const definition of SOURCE_DEFINITIONS) {
        const document = await readJson(absolute(definition.path));
        const selected = finalSelection.slots.filter(slot => slot.sourceArtifact === definition.path);
        if (!selected.length) throw new Error(`unused source definition ${definition.sourceId}`);
        const releaseIds = new Set(selected.map(slot => slot.sourceReleaseId));
        if (releaseIds.size !== 1) throw new Error(`${definition.sourceId} has ambiguous release identity`);
        const releaseId = [...releaseIds][0];
        if (definition.contentType === 'benchmark-artifact' && document.releaseId !== releaseId) {
            throw new Error(`${definition.sourceId} top-level release identity mismatch`);
        }
        const canonicalSha256 = sha256(canonicalJson(document));
        if (selected.some(slot => slot.sourceArtifactCanonicalSha256 !== canonicalSha256)) {
            throw new Error(`${definition.sourceId} differs from final-selection source binding`);
        }
        sourceRegistry.push({
            sourceId: definition.sourceId,
            path: definition.path,
            contentType: definition.contentType,
            releaseId,
            canonicalSha256,
            ...(definition.manifestRevisionId ? { manifestRevisionId: definition.manifestRevisionId } : {}),
        });
        sourceIdByPath.set(definition.path, definition.sourceId);
    }
    const unregistered = [...new Set(finalSelection.slots.map(slot => slot.sourceArtifact))]
        .filter(sourcePath => !sourceIdByPath.has(sourcePath));
    if (unregistered.length) throw new Error(`unregistered final-selection sources: ${unregistered.join(', ')}`);

    const policy = await canonicalBinding('benchmarks/policy/official-policy.v1.json');
    const expansionPolicy = await canonicalBinding('benchmarks/policy/input-environment-expansion.v1.json');
    const officialTargets = await canonicalBinding('benchmarks/manifest.json');
    const inputCatalog = await canonicalBinding('benchmarks/input_catalog.json');
    const manifest = {
        schemaVersion: COMPOSITE_SCHEMA_VERSION,
        manifestKind: 'composite-benchmark-release',
        manifestRevisionId: COMPOSITE_MANIFEST_REVISION_ID,
        compositeReleaseId: COMPOSITE_RELEASE_ID,
        status,
        suite: 'hard',
        profileId: COMPOSITE_RELEASE_ID,
        createdAt: '2026-09-23T23:30:00+08:00',
        hashCanonicalization: COMPOSITE_CANONICALIZATION,
        compositeCanonicalSha256: '0'.repeat(64),
        bindings: {
            finalSelection: {
                path: FINAL_SELECTION_PATH,
                selectionId: finalSelection.selectionId,
                selectionCanonicalSha256,
                documentCanonicalSha256: sha256(canonicalJson(finalSelection)),
            },
            repositoryPolicy: {
                path: policy.path,
                identity: policy.document.policyId,
                version: policy.document.schemaVersion,
                canonicalSha256: policy.canonicalSha256,
            },
            userRules: await rawBinding('docs/benchmark/USER_RULES.md'),
            benchmarkRules: await rawBinding('docs/benchmark/BENCHMARK_RULES.md'),
            officialTargets: { path: officialTargets.path, canonicalSha256: officialTargets.canonicalSha256 },
            inputCatalog: { path: inputCatalog.path, canonicalSha256: inputCatalog.canonicalSha256 },
            inputEnvironmentExpansion: {
                path: expansionPolicy.path,
                identity: expansionPolicy.document.policyId,
                version: expansionPolicy.document.schemaVersion,
                canonicalSha256: expansionPolicy.canonicalSha256,
            },
            schema: await rawBinding('benchmarks/schema/composite-release-manifest.v4.schema.json', COMPOSITE_SCHEMA_VERSION),
            generator: await rawBinding('benchmarks/tools/build-hard-53x3-composite-release.mjs', COMPOSITE_GENERATOR_VERSION),
            validator: await rawBinding('benchmarks/tools/validate-composite-release.mjs', COMPOSITE_VALIDATOR_VERSION),
        },
        sourceRegistry,
        members: finalSelection.slots.map(slot => memberReferenceFromSelection(slot, sourceIdByPath.get(slot.sourceArtifact))),
    };
    manifest.compositeCanonicalSha256 = compositeManifestIdentity(manifest);

    const registry = {
        schemaVersion: 1,
        registryId: 'official-composite-releases-v1',
        hashCanonicalization: COMPOSITE_CANONICALIZATION,
        releases: {
            [COMPOSITE_RELEASE_ID]: {
                manifestRevisionId: COMPOSITE_MANIFEST_REVISION_ID,
                manifestPath: OUTPUT_PATH,
                schemaVersion: COMPOSITE_SCHEMA_VERSION,
                status,
                compositeCanonicalSha256: manifest.compositeCanonicalSha256,
            },
        },
    };

    if (write) {
        await mkdir(path.dirname(absolute(OUTPUT_PATH)), { recursive: true });
        await mkdir(path.dirname(absolute(REGISTRY_PATH)), { recursive: true });
        await writeFile(absolute(OUTPUT_PATH), `${JSON.stringify(manifest, null, 2)}\n`);
        await writeFile(absolute(REGISTRY_PATH), `${JSON.stringify(registry, null, 2)}\n`);
    }
    return { manifest, registry };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const statusIndex = process.argv.indexOf('--status');
    const status = statusIndex >= 0 ? process.argv[statusIndex + 1] : 'audit-candidate';
    const { manifest } = await buildHard53x3CompositeRelease({ status });
    console.log(JSON.stringify({
        releaseId: manifest.compositeReleaseId,
        status: manifest.status,
        schemaVersion: manifest.schemaVersion,
        sources: manifest.sourceRegistry.length,
        members: manifest.members.length,
        compositeCanonicalSha256: manifest.compositeCanonicalSha256,
    }, null, 2));
}
