import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
    artifactInstancesHash, canonicalMultiset, deriveMetadata, deriveStructuralFingerprint,
    instanceContentHash, readJson, replayWitness, weightedJaccard,
} from './benchmark-core.mjs';
import { ROOT, fileSha256, loadRepositoryPolicy } from './repository-policy.mjs';

export const AUDITED_PILOT_RELEASE_ID = 'hard-pilot-audit-v2';

export async function auditPilot({ write = true } = {}) {
    const [legacy, catalog, manifest, policy] = await Promise.all([
        readJson(path.join(ROOT, 'benchmarks/pilot/v1/instances.json')),
        readJson(path.join(ROOT, 'benchmarks/input_catalog.json')),
        readJson(path.join(ROOT, 'benchmarks/manifest.json')),
        loadRepositoryPolicy(),
    ]);
    const byTargetFamily = new Map();
    const byTargetInstances = new Map();
    const auditLog = [];
    const instances = [];
    const auditSourceHash = await fileSha256('benchmarks/tools/audit-pilot.mjs');
    for (const legacyInstance of legacy.instances) {
        const official = manifest.cases.find(item => item.id === legacyInstance.targetId);
        const instance = structuredClone(legacyInstance);
        instance.schemaVersion = 2;
        instance.partition = 'pilot';
        instance.provenance = {
            releaseId: AUDITED_PILOT_RELEASE_ID,
            generatorVersion: 'pilot-v1-witness-audit-v2',
            generatorSourceSha256: auditSourceHash,
            targetSha256: official.sha256,
            officialTargetsSha256: policy.officialTargets.manifest.sha256,
            catalogVersion: policy.catalog.version,
            catalogSha256: policy.catalog.sha256,
            inputSeedIdentity: policy.inputSeed.identity,
            inputSeedSha256: policy.inputSeed.sha256,
            gameSemanticsId: policy.gameSemantics.id,
            gameSemanticsSha256: policy.gameSemantics.sha256,
        };
        const replay = replayWitness(instance, catalog);
        if (!replay.valid) throw new Error(`${instance.id}: replay failed: ${replay.phase}: ${replay.errors.join('; ')}`);
        instance.difficulty = deriveMetadata(instance, replay);
        const structural = deriveStructuralFingerprint(instance, replay);
        const targetFamilies = byTargetFamily.get(instance.targetId) ?? new Map();
        const representative = targetFamilies.get(structural.signature) ?? null;
        if (!representative) targetFamilies.set(structural.signature, instance.id);
        byTargetFamily.set(instance.targetId, targetFamilies);
        const priorInstances = byTargetInstances.get(instance.targetId) ?? [];
        const multiset = canonicalMultiset(instance.inputs);
        const similarities = priorInstances.map(other => weightedJaccard(multiset, canonicalMultiset(other.inputs)));
        instance.diversity = {
            inputMultisetSignature: multiset,
            structureVersion: structural.version,
            structureSignature: structural.signature,
            classification: representative ? 'structural-duplicate' : 'representative',
            duplicateOf: representative,
            maxPriorWeightedJaccard: similarities.length ? Math.max(...similarities) : 0,
        };
        instance.instanceSha256 = instanceContentHash(instance);
        priorInstances.push(instance);
        byTargetInstances.set(instance.targetId, priorInstances);
        instances.push(instance);
        auditLog.push({
            id: instance.id,
            sourceVersion: 'benchmarks/pilot/v1/instances.json',
            sourceInstanceSha256: legacyInstance.instanceSha256,
            newInstanceSha256: instance.instanceSha256,
            structureSignature: structural.signature,
            classification: instance.diversity.classification,
            duplicateOf: representative,
            reason: 'Recomputed repository-bound provenance and witness-DAG structural diversity; inputs and witness unchanged.',
        });
    }
    const artifact = {
        schemaVersion: 2,
        benchmarkInstanceSchemaVersion: 2,
        name: 'hard-pilot-audit-v2',
        releaseId: AUDITED_PILOT_RELEASE_ID,
        suite: 'hard',
        partition: 'pilot',
        targetIds: [...legacy.targetIds],
        candidateCount: instances.length,
        acceptedCount: instances.length,
        rejectedCount: 0,
        instances,
    };
    artifact.sha256 = artifactInstancesHash(artifact.instances);
    const familySummary = [...byTargetFamily].map(([targetId, families]) => ({
        targetId,
        instanceCount: byTargetInstances.get(targetId).length,
        distinctStructuralFamilies: families.size,
        representatives: [...families.values()],
        duplicateInstances: byTargetInstances.get(targetId).filter(instance => instance.diversity.classification === 'structural-duplicate').map(instance => instance.id),
    }));
    if (write) {
        const directory = path.join(ROOT, 'benchmarks/pilot/v2');
        await mkdir(directory, { recursive: true });
        await writeFile(path.join(directory, 'instances.json'), `${JSON.stringify(artifact, null, 2)}\n`);
        await writeFile(path.join(directory, 'audit-log.json'), `${JSON.stringify(auditLog, null, 2)}\n`);
        await writeFile(path.join(directory, 'structure-audit.json'), `${JSON.stringify(familySummary, null, 2)}\n`);
    }
    return { artifact, auditLog, familySummary };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const result = await auditPilot();
    console.log(JSON.stringify(result.familySummary, null, 2));
}
