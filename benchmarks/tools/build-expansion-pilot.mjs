import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
    artifactInstancesHash, canonicalMultiset, deriveMetadata, deriveStructuralFingerprint, instanceContentHash,
    readJson, replayWitness, weightedJaccard,
} from './benchmark-core.mjs';
import {
    assertDifferentPresentedEnvironments, buildSolverEvaluationView,
    ENVIRONMENT_EXPANSION_GENERATOR_VERSION, expandWitnessEnvironment,
} from './environment-expansion.mjs';
import { ROOT, fileSha256, loadRepositoryPolicy } from './repository-policy.mjs';

export const EXPANSION_RELEASE_ID = 'hard-expansion-pilot-v1';
export const EXPANSION_TARGET_IDS = Object.freeze(['hard-main-004', 'hard-main-010', 'hard-side-021']);

const PLANS = Object.freeze([
    {
        id: 'main004-additive-catalog-neighborhood-a',
        instanceId: 'hard-main-004-expansion-01',
        targetId: 'hard-main-004',
        kind: 'additive',
        additions: [{ shape: 'CuWuSuCu', count: 1 }, { shape: 'RuCuWuCu', count: 1 }],
    },
    {
        id: 'main004-full-source-substitution-b',
        instanceId: 'hard-main-004-expansion-02',
        targetId: 'hard-main-004',
        kind: 'transformative',
        replacements: [{
            coreShape: '----SuCu',
            presentedShape: 'CuWuSuCu',
            derivation: [{ operation: 'Cutter', selectShape: '----SuCu' }],
        }],
        additions: [{ shape: 'RuWu--Su', count: 1 }, { shape: 'RuCuWuCu', count: 1 }],
    },
    {
        id: 'main010-additive-crystal-neighborhood-a',
        instanceId: 'hard-main-010-expansion-01',
        targetId: 'hard-main-010',
        kind: 'additive',
        additions: [{ shape: 'RuWu--Su', count: 1 }, { shape: 'RuCuWuCu', count: 1 }],
    },
    {
        id: 'main010-additive-crystal-neighborhood-b',
        instanceId: 'hard-main-010-expansion-02',
        targetId: 'hard-main-010',
        kind: 'additive',
        additions: [{ shape: 'CuWuSuCu', count: 1 }, { shape: 'WuCu----', count: 1 }, { shape: 'RuWu--Su', count: 1 }],
    },
    {
        id: 'side021-additive-pin-neighborhood-a',
        instanceId: 'hard-side-021-expansion-01',
        targetId: 'hard-side-021',
        kind: 'additive',
        additions: [{ shape: 'RuWu--Su', count: 1 }, { shape: 'CuSu--Cu', count: 1 }],
    },
    {
        id: 'side021-full-source-substitution-b',
        instanceId: 'hard-side-021-expansion-02',
        targetId: 'hard-side-021',
        kind: 'transformative',
        replacements: [{
            coreShape: '----SuCu',
            presentedShape: 'SuSuSuCu',
            derivation: [{ operation: 'Cutter', selectShape: '----SuCu' }],
        }],
        additions: [{ shape: 'RuWu--Su', count: 1 }, { shape: 'WuCu----', count: 1 }],
    },
]);

async function provenance(policy, targetCase) {
    return {
        releaseId: EXPANSION_RELEASE_ID,
        generatorVersion: ENVIRONMENT_EXPANSION_GENERATOR_VERSION,
        generatorSourceSha256: await fileSha256('benchmarks/tools/build-expansion-pilot.mjs'),
        targetSha256: targetCase.sha256,
        officialTargetsSha256: policy.officialTargets.manifest.sha256,
        catalogVersion: policy.catalog.version,
        catalogSha256: policy.catalog.sha256,
        inputSeedIdentity: policy.inputSeed.identity,
        inputSeedSha256: policy.inputSeed.sha256,
        gameSemanticsId: policy.gameSemantics.id,
        gameSemanticsSha256: policy.gameSemantics.sha256,
    };
}

export async function buildExpansionPilot({ write = true } = {}) {
    const [catalog, manifest, sourceArtifact, expansionPolicy, repositoryPolicy] = await Promise.all([
        readJson(path.join(ROOT, 'benchmarks/input_catalog.json')),
        readJson(path.join(ROOT, 'benchmarks/manifest.json')),
        readJson(path.join(ROOT, 'benchmarks/coverage-pilot/v1/instances.json')),
        readJson(path.join(ROOT, 'benchmarks/policy/input-environment-expansion.v1.json')),
        loadRepositoryPolicy(),
    ]);
    const policySha256 = await fileSha256('benchmarks/policy/input-environment-expansion.v1.json');
    const instances = [];
    const candidateLog = [];
    const families = new Map();
    const priorByTarget = new Map();

    for (const plan of PLANS) {
        const core = sourceArtifact.instances.find(instance => instance.targetId === plan.targetId);
        const targetCase = manifest.cases.find(item => item.id === plan.targetId);
        try {
            const { instance, replay } = expandWitnessEnvironment(core, plan, { catalog, policy: expansionPolicy, policySha256 });
            instance.provenance = await provenance(repositoryPolicy, targetCase);
            instance.difficulty = deriveMetadata(instance, replay);
            const structural = deriveStructuralFingerprint(instance, replay);
            const targetFamilies = families.get(instance.targetId) ?? new Map();
            const representative = targetFamilies.get(structural.signature) ?? null;
            if (!representative) targetFamilies.set(structural.signature, instance.id);
            families.set(instance.targetId, targetFamilies);
            const prior = priorByTarget.get(instance.targetId) ?? [];
            const signature = canonicalMultiset(instance.availableInputs);
            const similarities = prior.map(other => weightedJaccard(signature, canonicalMultiset(other.availableInputs)));
            instance.diversity = {
                inputMultisetSignature: signature,
                structureVersion: structural.version,
                structureSignature: structural.signature,
                classification: representative ? 'structural-duplicate' : 'representative',
                duplicateOf: representative,
                maxPriorWeightedJaccard: similarities.length ? Math.max(...similarities) : 0,
            };
            instance.instanceSha256 = instanceContentHash(instance);
            prior.push(instance);
            priorByTarget.set(instance.targetId, prior);
            instances.push(instance);
            candidateLog.push({
                targetId: plan.targetId,
                planId: plan.id,
                expansionKind: plan.kind,
                accepted: true,
                instanceId: instance.id,
                preprocessingStepCount: instance.expansion.preprocessingStepCount,
                coreInputMultiplicity: instance.difficulty.coreInputMultiplicity,
                availableInputMultiplicity: instance.difficulty.inputMultiplicity,
            });
        } catch (error) {
            candidateLog.push({ targetId: plan.targetId, planId: plan.id, expansionKind: plan.kind, accepted: false, reason: error.message });
        }
    }
    candidateLog.push(
        { targetId: null, planId: 'arbitrary-shape-substitution', expansionKind: 'transformative', accepted: false, unsupported: true, reason: 'No general forward derivation planner exists for arbitrary catalog replacements.' },
        { targetId: null, planId: 'multi-input-preprocessing-bridge', expansionKind: 'transformative', accepted: false, unsupported: true, reason: 'The v1 pilot adapter supports replayed unary derivation chains; general multi-input preprocessing planning remains unsupported.' },
    );
    if (instances.length !== PLANS.length) throw new Error(`expansion pilot constructed ${instances.length}/${PLANS.length}; inspect candidate log`);
    assertDifferentPresentedEnvironments(instances);

    const artifact = {
        schemaVersion: 3,
        benchmarkInstanceSchemaVersion: 3,
        name: EXPANSION_RELEASE_ID,
        releaseId: EXPANSION_RELEASE_ID,
        suite: 'hard',
        partition: 'expansion-pilot',
        targetIds: [...EXPANSION_TARGET_IDS],
        candidateCount: candidateLog.length,
        acceptedCount: instances.length,
        rejectedCount: candidateLog.filter(entry => entry.accepted === false).length,
        instances,
    };
    artifact.sha256 = artifactInstancesHash(artifact.instances);
    const solverView = buildSolverEvaluationView(artifact);
    solverView.sha256 = artifactInstancesHash(solverView.instances);
    if (write) {
        const directory = path.join(ROOT, 'benchmarks/expansion-pilot/v1');
        await mkdir(directory, { recursive: true });
        await writeFile(path.join(directory, 'instances.json'), `${JSON.stringify(artifact, null, 2)}\n`);
        await writeFile(path.join(directory, 'solver-inputs.json'), `${JSON.stringify(solverView, null, 2)}\n`);
        await writeFile(path.join(directory, 'candidate-log.json'), `${JSON.stringify(candidateLog, null, 2)}\n`);
    }
    return { artifact, solverView, candidateLog };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const result = await buildExpansionPilot();
    console.log(`expansion pilot: ${result.artifact.acceptedCount}/${PLANS.length} mechanically constructed`);
}
