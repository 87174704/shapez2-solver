import path from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { artifactContentHash, canonicalJson, readJson, sha256 } from './benchmark-core.mjs';
import { ROOT, aggregateBindings, fileSha256, loadRepositoryPolicy } from './repository-policy.mjs';
import { VALIDATOR_VERSION } from './validate-benchmark.mjs';

async function binding(relativePath) {
    return { path: relativePath, sha256: await fileSha256(relativePath) };
}

async function fileSet(paths, version = null) {
    const files = await Promise.all(paths.map(binding));
    const result = { sha256: aggregateBindings(files), files };
    if (version !== null) result.version = version;
    return result;
}

async function canonicalContentBinding(relativePath) {
    return { path: relativePath, canonicalization: 'canonical-json-v1', sha256: artifactContentHash(await readJson(path.join(ROOT, relativePath))) };
}

async function buildOne({ manifestRevisionId, artifactReleaseId, status, partition, predecessorManifestRevisionId, changeReason, artifactPath, generationLogPath, generatorVersion, generatorFiles, history, sourceArtifactPath = null, solverProjectionPath = null, createdAt = '2026-09-22T16:30:00+08:00' }) {
    const policy = await loadRepositoryPolicy();
    const artifact = await readJson(path.join(ROOT, artifactPath));
    const log = await readJson(path.join(ROOT, generationLogPath));
    const rejected = log.filter(entry => entry.accepted === false);
    const manifest = {
        schemaVersion: 2,
        manifestRevisionId,
        artifactReleaseId,
        status,
        suite: 'hard',
        partition,
        profileId: artifactReleaseId,
        createdAt,
        predecessorManifestRevisionId,
        changeReason,
        policyIdentity: {
            policyId: policy.policyId,
            schemaVersion: policy.schemaVersion,
        },
        bindings: {
            userRules: await binding('docs/benchmark/USER_RULES.md'),
            benchmarkRules: await binding('docs/benchmark/BENCHMARK_RULES.md'),
            inputSeed: await binding(policy.inputSeed.path),
            inputCatalog: { ...(await binding(policy.catalog.path)), version: policy.catalog.version },
            inputEnvironmentExpansion: { ...(await binding(policy.inputEnvironmentExpansion.path)), version: policy.inputEnvironmentExpansion.version },
            officialTargets: await fileSet([policy.officialTargets.manifest.path, ...policy.officialTargets.sources.map(source => source.path)]),
            canonicalSemantics: await fileSet(policy.gameSemantics.files.map(file => file.path), policy.gameSemantics.id),
            schemas: await fileSet([
                'benchmarks/schema/input-catalog.v2.schema.json',
                'benchmarks/schema/benchmark-instance.v2.schema.json',
                'benchmarks/schema/benchmark-artifact.v2.schema.json',
                'benchmarks/schema/benchmark-instance.v3.schema.json',
                'benchmarks/schema/benchmark-artifact.v3.schema.json',
                'benchmarks/schema/release-manifest.v1.schema.json',
                'benchmarks/schema/release-manifest.v2.schema.json',
                'benchmarks/schema/official-policy.v1.schema.json',
            ]),
            generator: await fileSet(generatorFiles, generatorVersion),
            validator: await fileSet([
                'benchmarks/tools/validate-benchmark.mjs',
                'benchmarks/tools/benchmark-core.mjs',
                'benchmarks/tools/environment-expansion.mjs',
                'benchmarks/tools/schema-validation.mjs',
                'benchmarks/tools/repository-policy.mjs',
            ], VALIDATOR_VERSION),
            artifactContent: await canonicalContentBinding(artifactPath),
            instances: await binding(artifactPath),
            witnesses: {
                container: artifactPath,
                jsonPointer: '/instances/*/witness',
                sha256: sha256(canonicalJson(artifact.instances.map(instance => instance.witness))),
            },
            generationLog: await binding(generationLogPath),
            rejectionLog: {
                container: generationLogPath,
                jsonPointer: '/*[accepted=false]',
                sha256: sha256(canonicalJson(rejected)),
            },
        },
        history: await Promise.all(history.map(async entry => ({
            ...entry,
            sha256: await fileSha256(entry.artifact),
        }))),
    };
    if (sourceArtifactPath) manifest.bindings.sourceArtifact = await binding(sourceArtifactPath);
    if (solverProjectionPath) manifest.bindings.solverProjection = await canonicalContentBinding(solverProjectionPath);
    return manifest;
}

export async function buildReleaseManifests({ write = true } = {}) {
    const correctionReason = 'Release manifest revision created solely because trusted BENCHMARK_RULES.md received a historical documentation correction. Benchmark instances, witnesses, public solver inputs, mechanics and normative rules were unchanged.';
    const pilot = await buildOne({
        manifestRevisionId: 'hard-pilot-audit-v2-manifest-r2',
        artifactReleaseId: 'hard-pilot-audit-v2',
        status: 'audit-candidate',
        partition: 'pilot',
        predecessorManifestRevisionId: 'hard-pilot-audit-v2',
        changeReason: correctionReason,
        artifactPath: 'benchmarks/pilot/v2/instances.json',
        generationLogPath: 'benchmarks/pilot/v2/audit-log.json',
        generatorVersion: 'pilot-v1-witness-audit-v2',
        generatorFiles: ['benchmarks/tools/build-pilot.mjs', 'benchmarks/tools/audit-pilot.mjs', 'benchmarks/tools/benchmark-core.mjs'],
        history: [
            { version: 'hard-pilot-v1', artifact: 'benchmarks/pilot/v1/instances.json', reason: 'Original immutable Pilot artifact.' },
            { version: 'hard-pilot-audit-v2', artifact: 'benchmarks/pilot/v2/instances.json', reason: 'Repository-bound audit artifact; inputs/witnesses unchanged, diversity reclassified.' },
            { version: 'hard-pilot-audit-v2-manifest-r2', artifact: 'benchmarks/pilot/v2/instances.json', reason: correctionReason },
        ],
    });
    const coverage = await buildOne({
        manifestRevisionId: 'hard-coverage-pilot-v1-manifest-r2',
        artifactReleaseId: 'hard-coverage-pilot-v1',
        status: 'audit-candidate',
        partition: 'coverage-pilot',
        predecessorManifestRevisionId: 'hard-coverage-pilot-v1',
        changeReason: correctionReason,
        artifactPath: 'benchmarks/coverage-pilot/v1/instances.json',
        generationLogPath: 'benchmarks/coverage-pilot/v1/candidate-log.json',
        generatorVersion: 'multi-strategy-v2',
        generatorFiles: ['benchmarks/tools/build-coverage-pilot.mjs', 'benchmarks/tools/generation-framework.mjs', 'benchmarks/tools/benchmark-core.mjs'],
        history: [
            { version: 'hard-coverage-pilot-v1', artifact: 'benchmarks/coverage-pilot/v1/instances.json', reason: 'Initial five-instance capability validation artifact.' },
            { version: 'hard-coverage-pilot-v1-manifest-r2', artifact: 'benchmarks/coverage-pilot/v1/instances.json', reason: correctionReason },
        ],
    });
    const expansion = await buildOne({
        manifestRevisionId: 'hard-expansion-pilot-v1-manifest-r2',
        artifactReleaseId: 'hard-expansion-pilot-v1',
        status: 'audit-candidate',
        partition: 'expansion-pilot',
        predecessorManifestRevisionId: 'hard-expansion-pilot-v1',
        changeReason: correctionReason,
        artifactPath: 'benchmarks/expansion-pilot/v1/instances.json',
        generationLogPath: 'benchmarks/expansion-pilot/v1/candidate-log.json',
        generatorVersion: 'environment-expansion-v1',
        generatorFiles: [
            'benchmarks/tools/build-expansion-pilot.mjs',
            'benchmarks/tools/environment-expansion.mjs',
            'benchmarks/tools/generation-framework.mjs',
            'benchmarks/tools/benchmark-core.mjs',
            'benchmarks/policy/input-environment-expansion.v1.json'
        ],
        sourceArtifactPath: 'benchmarks/coverage-pilot/v1/instances.json',
        solverProjectionPath: 'benchmarks/expansion-pilot/v1/solver-inputs.json',
        history: [
            { version: 'hard-expansion-pilot-v1', artifact: 'benchmarks/expansion-pilot/v1/instances.json', reason: 'Initial six-instance environment-expansion audit candidate.' },
            { version: 'hard-expansion-pilot-v1-manifest-r2', artifact: 'benchmarks/expansion-pilot/v1/instances.json', reason: correctionReason },
        ],
    });
    const hard53x1 = await buildOne({
        manifestRevisionId: 'hard-53x1-stage-v1-manifest-r2',
        artifactReleaseId: 'hard-53x1-stage-v1',
        status: 'audit-candidate',
        partition: 'expansion-pilot',
        predecessorManifestRevisionId: 'hard-53x1-stage-v1',
        changeReason: correctionReason,
        artifactPath: 'benchmarks/hard-53x1/v1/instances.json',
        generationLogPath: 'benchmarks/hard-53x1/v1/generation-log.json',
        generatorVersion: 'multi-strategy-v2+generic-pin-construction-v1+generic-crystal-construction-v3+mixed-pin-crystal-interaction-v1+environment-expansion-v1+hard-53x1-stage-v1',
        generatorFiles: [
            'benchmarks/tools/build-hard-53x1.mjs',
            'benchmarks/tools/environment-expansion.mjs',
            'benchmarks/tools/generation-framework.mjs',
            'benchmarks/tools/pin-construction-planner.mjs',
            'benchmarks/tools/crystal-construction-planner.mjs',
            'benchmarks/tools/mixed-pin-crystal-construction-planner.mjs',
            'benchmarks/tools/benchmark-core.mjs',
            'benchmarks/policy/input-environment-expansion.v1.json'
        ],
        sourceArtifactPath: 'benchmarks/hard-53x1/v1/core-instances.json',
        solverProjectionPath: 'benchmarks/hard-53x1/v1/solver-inputs.json',
        history: [
            { version: 'hard-53x1-stage-v1', artifact: 'benchmarks/hard-53x1/v1/instances.json', reason: 'Complete 53-target staged release with generic Pin/Crystal construction, mixed state transitions, and dense-Crystal composition fallback.' },
            { version: 'hard-53x1-stage-v1-manifest-r2', artifact: 'benchmarks/hard-53x1/v1/instances.json', reason: correctionReason },
        ],
    });
    const diversityPilot = await buildOne({
        manifestRevisionId: 'hard-53x3-diversity-pilot-v1-manifest-r1',
        artifactReleaseId: 'hard-53x3-diversity-pilot-v1',
        status: 'audit-candidate',
        partition: 'expansion-pilot',
        predecessorManifestRevisionId: 'hard-53x1-stage-v1-manifest-r2',
        changeReason: 'Development overlay containing two new, structurally distinct families for each selected target; the frozen Hard 53x1 artifact remains the immutable family-1 baseline.',
        artifactPath: 'benchmarks/diversity-pilot/v1/instances.json',
        generationLogPath: 'benchmarks/diversity-pilot/v1/candidate-log.json',
        generatorVersion: 'hard-53x3-diversity-pilot-v1-transformative-source-ancestry',
        generatorFiles: [
            'benchmarks/tools/build-hard-53x3-diversity-pilot.mjs',
            'benchmarks/tools/environment-expansion.mjs',
            'benchmarks/tools/generation-framework.mjs',
            'benchmarks/tools/benchmark-core.mjs',
            'benchmarks/policy/input-environment-expansion.v1.json',
        ],
        sourceArtifactPath: 'benchmarks/hard-53x1/v1/instances.json',
        solverProjectionPath: 'benchmarks/diversity-pilot/v1/solver-inputs.json',
        history: [
            { version: 'hard-53x1-stage-v1', artifact: 'benchmarks/hard-53x1/v1/instances.json', reason: 'Frozen immutable family-1 baseline; referenced without copying or modification.' },
            { version: 'hard-53x3-diversity-pilot-v1', artifact: 'benchmarks/diversity-pilot/v1/instances.json', reason: 'Development overlay with two new causal families for each of thirteen representative targets.' },
        ],
    });
    const hard53x3Rollout = await buildOne({
        manifestRevisionId: 'hard-53x3-rollout-stage-v1-manifest-r1',
        artifactReleaseId: 'hard-53x3-rollout-stage-v1',
        status: 'audit-candidate',
        partition: 'expansion-pilot',
        predecessorManifestRevisionId: 'hard-53x3-diversity-pilot-v1-manifest-r1',
        changeReason: 'Staged overlay containing two new canonical structural families for each of the forty official Hard targets outside the immutable diversity pilot.',
        artifactPath: 'benchmarks/hard-53x3-rollout/v1/instances.json',
        generationLogPath: 'benchmarks/hard-53x3-rollout/v1/candidate-log.json',
        generatorVersion: 'hard-53x3-rollout-stage-v1-preprocessing-topology',
        generatorFiles: [
            'benchmarks/tools/build-hard-53x3-rollout.mjs',
            'benchmarks/tools/environment-expansion.mjs',
            'benchmarks/tools/generation-framework.mjs',
            'benchmarks/tools/benchmark-core.mjs',
            'benchmarks/policy/input-environment-expansion.v1.json',
        ],
        sourceArtifactPath: 'benchmarks/hard-53x1/v1/instances.json',
        solverProjectionPath: 'benchmarks/hard-53x3-rollout/v1/solver-inputs.json',
        createdAt: '2026-09-23T00:30:00+08:00',
        history: [
            { version: 'hard-53x1-stage-v1', artifact: 'benchmarks/hard-53x1/v1/instances.json', reason: 'Frozen immutable family-1 baseline; referenced without copying or modification.' },
            { version: 'hard-53x3-diversity-pilot-v1', artifact: 'benchmarks/diversity-pilot/v1/instances.json', reason: 'Immutable accepted pilot overlay for thirteen official targets; referenced without copying or modification.' },
            { version: 'hard-53x3-rollout-stage-v1', artifact: 'benchmarks/hard-53x3-rollout/v1/instances.json', reason: 'Staged two-family overlay for the mechanically derived remaining forty official targets.' },
        ],
    });
    if (write) {
        const directory = path.join(ROOT, 'benchmarks/releases');
        await mkdir(directory, { recursive: true });
        await writeFile(path.join(directory, 'hard-pilot-audit-v2-manifest-r2.release.json'), `${JSON.stringify(pilot, null, 2)}\n`);
        await writeFile(path.join(directory, 'hard-coverage-pilot-v1-manifest-r2.release.json'), `${JSON.stringify(coverage, null, 2)}\n`);
        await writeFile(path.join(directory, 'hard-expansion-pilot-v1-manifest-r2.release.json'), `${JSON.stringify(expansion, null, 2)}\n`);
        await writeFile(path.join(directory, 'hard-53x1-stage-v1-manifest-r2.release.json'), `${JSON.stringify(hard53x1, null, 2)}\n`);
        await writeFile(path.join(directory, 'hard-53x3-diversity-pilot-v1-manifest-r1.release.json'), `${JSON.stringify(diversityPilot, null, 2)}\n`);
        await writeFile(path.join(directory, 'hard-53x3-rollout-stage-v1-manifest-r1.release.json'), `${JSON.stringify(hard53x3Rollout, null, 2)}\n`);
    }
    return { pilot, coverage, expansion, hard53x1, diversityPilot, hard53x3Rollout };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    await buildReleaseManifests();
    for (const file of ['hard-pilot-audit-v2-manifest-r2.release.json', 'hard-coverage-pilot-v1-manifest-r2.release.json', 'hard-expansion-pilot-v1-manifest-r2.release.json', 'hard-53x1-stage-v1-manifest-r2.release.json', 'hard-53x3-diversity-pilot-v1-manifest-r1.release.json', 'hard-53x3-rollout-stage-v1-manifest-r1.release.json']) {
        const text = await readFile(path.join(ROOT, 'benchmarks/releases', file));
        console.log(`${file} ${sha256(text)}`);
    }
}
