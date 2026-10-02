import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
    artifactContentHash, canonicalMultiset, deriveStructuralFingerprint, readJson,
    replayWitness, sha256, validateExpansionMetadata,
} from './benchmark-core.mjs';
import { ROOT } from './repository-policy.mjs';

const IDENTITIES = Object.freeze({
    baseline: {
        releaseId: 'hard-53x1-stage-v1',
        manifestRevisionId: 'hard-53x1-stage-v1-manifest-r2',
        artifactCanonicalSha256: '11005e04e359fff9d0d3a0fec66dd491ca8e441f5c5c880e1ff3441b9fc77da3',
        instancesSha256: '40c4ea586dfeafb5f5e37545101220451d2cc9a9ca2ab54eb9d00a94806c8375',
    },
    pilot: {
        releaseId: 'hard-53x3-diversity-pilot-v1',
        manifestRevisionId: 'hard-53x3-diversity-pilot-v1-manifest-r1',
        artifactCanonicalSha256: '9eaf8dc3a64cf68830ea0ec734b8ea6aba0fe67304d8033765125ce6fb6139f0',
        instancesSha256: '9ccffd150764176162ca759c4b9f414c3b308f60a967e6e33e322e0e1968f3a0',
    },
    rollout: {
        releaseId: 'hard-53x3-rollout-stage-v1',
        manifestRevisionId: 'hard-53x3-rollout-stage-v1-manifest-r1',
        artifactCanonicalSha256: null,
        instancesSha256: '874369d93095d0a4a69e130d15c36543d2072ff86870ec86106ab01501bf809e',
    },
});

function sumRows(rows) {
    return rows.reduce((sum, row) => sum + row.count, 0);
}

function percentile(values, fraction) {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)];
}

function distribution(values) {
    return {
        min: Math.min(...values),
        median: percentile(values, 0.5),
        p90: percentile(values, 0.9),
        max: Math.max(...values),
        mean: values.reduce((sum, value) => sum + value, 0) / values.length,
    };
}

function environmentStats(instances) {
    const available = instances.map(instance => sumRows(instance.availableInputs));
    const core = instances.map(instance => sumRows(instance.coreWitnessBasis));
    return {
        instanceCount: instances.length,
        availableOccurrences: distribution(available),
        coreOccurrences: distribution(core),
        availableToCoreRatio: distribution(available.map((value, index) => value / core[index])),
        expansionDelta: distribution(available.map((value, index) => value - core[index])),
        availableTypeCount: distribution(instances.map(instance => instance.availableInputs.length)),
        coreTypeCount: distribution(instances.map(instance => instance.coreWitnessBasis.length)),
    };
}

function complexityStats(instances) {
    return {
        witnessDepth: distribution(instances.map(instance => instance.difficulty.witnessDepth)),
        operationCount: distribution(instances.map(instance => instance.difficulty.operationCount)),
        terminalWaste: distribution(instances.map(instance => instance.difficulty.liveWasteCount)),
    };
}

function countBy(items, keyFor) {
    const counts = {};
    for (const item of items) {
        const key = keyFor(item);
        counts[key] = (counts[key] ?? 0) + 1;
    }
    return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
}

function operationPresence(instances, operation) {
    return instances.filter(instance => (instance.difficulty.operationCounts[operation] ?? 0) > 0).length;
}

function publicProjection(instances) {
    return {
        schemaVersion: 1,
        sourceComposition: 'hard-53x3-staged-composition-v1',
        suite: 'hard',
        instances: instances.map(instance => ({
            id: `h53-${sha256(instance.id).slice(0, 20)}`,
            track: instance.track,
            targetId: instance.targetId,
            target: instance.target,
            availableInputs: structuredClone(instance.availableInputs),
            rules: structuredClone(instance.rules),
        })),
    };
}

export async function auditHard53x3StagedComposition({ write = true } = {}) {
    const [catalog, official, expansionPolicy, baseline, pilot, rollout, pilotStatus, rolloutStatus, pilotLog, rolloutLog] = await Promise.all([
        readJson(path.join(ROOT, 'benchmarks/input_catalog.json')),
        readJson(path.join(ROOT, 'benchmarks/manifest.json')),
        readJson(path.join(ROOT, 'benchmarks/policy/input-environment-expansion.v1.json')),
        readJson(path.join(ROOT, 'benchmarks/hard-53x1/v1/instances.json')),
        readJson(path.join(ROOT, 'benchmarks/diversity-pilot/v1/instances.json')),
        readJson(path.join(ROOT, 'benchmarks/hard-53x3-rollout/v1/instances.json')),
        readJson(path.join(ROOT, 'benchmarks/diversity-pilot/v1/target-status.json')),
        readJson(path.join(ROOT, 'benchmarks/hard-53x3-rollout/v1/target-status.json')),
        readJson(path.join(ROOT, 'benchmarks/diversity-pilot/v1/candidate-log.json')),
        readJson(path.join(ROOT, 'benchmarks/hard-53x3-rollout/v1/candidate-log.json')),
    ]);
    const actualIdentities = {
        baseline: { artifactCanonicalSha256: artifactContentHash(baseline), instancesSha256: baseline.sha256 },
        pilot: { artifactCanonicalSha256: artifactContentHash(pilot), instancesSha256: pilot.sha256 },
        rollout: { artifactCanonicalSha256: artifactContentHash(rollout), instancesSha256: rollout.sha256 },
    };
    for (const role of ['baseline', 'pilot', 'rollout']) {
        const expected = IDENTITIES[role];
        if (expected.artifactCanonicalSha256 && actualIdentities[role].artifactCanonicalSha256 !== expected.artifactCanonicalSha256) {
            throw new Error(`${role} artifact canonical identity changed`);
        }
        if (actualIdentities[role].instancesSha256 !== expected.instancesSha256) {
            throw new Error(`${role} instances identity changed`);
        }
    }
    const officialTargets = official.cases.filter(item => item.suite === 'hard');
    const baselineByTarget = new Map(baseline.instances.map(instance => [instance.targetId, instance]));
    const overlayByTarget = new Map();
    for (const instance of [...pilot.instances, ...rollout.instances]) {
        const list = overlayByTarget.get(instance.targetId) ?? [];
        list.push(instance);
        overlayByTarget.set(instance.targetId, list);
    }
    const composed = [];
    const targetRows = [];
    const errors = [];
    for (const target of officialTargets) {
        const family1 = baselineByTarget.get(target.id);
        const additions = overlayByTarget.get(target.id) ?? [];
        const instances = [family1, ...additions].filter(Boolean);
        const signatures = new Set();
        for (const instance of instances) {
            const replay = replayWitness(instance, catalog);
            if (!replay.valid) errors.push(`${instance.id}: replay invalid: ${replay.errors.join('; ')}`);
            else {
                const expansion = validateExpansionMetadata(instance, catalog, replay, expansionPolicy);
                if (!expansion.valid) errors.push(`${instance.id}: expansion invalid: ${expansion.errors.join('; ')}`);
                const structural = deriveStructuralFingerprint(instance, replay);
                if (structural.signature !== instance.diversity.structureSignature) errors.push(`${instance.id}: structural signature mismatch`);
                signatures.add(structural.signature);
            }
        }
        if (instances.length !== 3) errors.push(`${target.id}: composed instance count ${instances.length} != 3`);
        if (signatures.size !== 3) errors.push(`${target.id}: composed structural family count ${signatures.size} != 3`);
        composed.push(...instances);
        targetRows.push({
            targetId: target.id,
            instanceIds: instances.map(instance => instance.id),
            instanceSha256: instances.map(instance => instance.instanceSha256),
            structuralSignatures: instances.map(instance => instance.diversity.structureSignature),
            familyOrigins: [
                IDENTITIES.baseline.releaseId,
                ...(pilot.targetIds.includes(target.id)
                    ? [IDENTITIES.pilot.releaseId, IDENTITIES.pilot.releaseId]
                    : [IDENTITIES.rollout.releaseId, IDENTITIES.rollout.releaseId]),
            ],
        });
    }
    const ids = composed.map(instance => instance.id);
    const hashes = composed.map(instance => instance.instanceSha256);
    if (composed.length !== 159) errors.push(`composed instance count ${composed.length} != 159`);
    if (new Set(ids).size !== ids.length) errors.push('duplicate composed instance ID');
    if (new Set(hashes).size !== hashes.length) errors.push('duplicate composed instance hash');

    const acceptedStatus = [...pilotStatus, ...rolloutStatus].flatMap(item => item.acceptedFamilies);
    const multiSourcePreprocessing = acceptedStatus.filter(item =>
        item.replacementTopology.some(replacement => replacement.presentedInputs.length > 1)).length;
    const baselineTypes = new Map(baseline.instances.map(instance => [
        instance.targetId, new Set(instance.availableInputs.map(row => row.shape)),
    ]));
    const newInstances = [...pilot.instances, ...rollout.instances];
    const newInputTypeExpansions = newInstances.filter(instance =>
        instance.availableInputs.some(row => !baselineTypes.get(instance.targetId).has(row.shape))).length;
    const logs = [...pilotLog, ...rolloutLog];
    const categoryCounts = countBy(logs.filter(item => !item.accepted), item => item.category);
    const coreStrategyByTarget = new Map(baseline.instances.map(instance => [instance.targetId, instance.construction.coreStrategy]));
    const statistics = {
        family: {
            targetsAt3of3: targetRows.filter(row => new Set(row.structuralSignatures).size === 3).length,
            candidatesSearched: logs.length,
            acceptedCandidates: logs.filter(item => item.accepted).length,
            structuralDuplicateRejects: categoryCounts['structural duplicate collapse'] ?? 0,
        },
        candidateFunnel: {
            searched: logs.length,
            replayInvalid: categoryCounts['rejected invalid replay'] ?? categoryCounts['replay invalid'] ?? 0,
            structuralDuplicates: categoryCounts['structural duplicate collapse'] ?? 0,
            expansionInvalid: (categoryCounts['rejected expansion'] ?? 0) + (categoryCounts['expansion invalid'] ?? 0),
            validButLowerRanked: (categoryCounts['environment diversity too narrow'] ?? 0) + (categoryCounts['valid but lower-ranked'] ?? 0),
            accepted: logs.filter(item => item.accepted).length,
        },
        expansion: {
            additive: composed.filter(instance => instance.expansion.kind === 'additive').length,
            transformative: composed.filter(instance => instance.expansion.kind === 'transformative').length,
            newInputTypeExpansions,
            multiplicityOnly: 0,
            multiSourcePreprocessing,
        },
        environment: {
            all159: environmentStats(composed),
            baselineFamily1: environmentStats(baseline.instances),
            newFamilies2and3: environmentStats(newInstances),
        },
        construction: {
            coreStrategyDistribution: countBy(composed, instance => coreStrategyByTarget.get(instance.targetId)),
            pin: operationPresence(composed, 'Pin Pusher'),
            crystal: operationPresence(composed, 'Crystal Generator'),
            mixedPinCrystal: composed.filter(instance =>
                (instance.difficulty.operationCounts['Pin Pusher'] ?? 0) > 0
                && (instance.difficulty.operationCounts['Crystal Generator'] ?? 0) > 0).length,
            swapper: operationPresence(composed, 'Swapper'),
            reuseStrategy: composed.filter(instance => coreStrategyByTarget.get(instance.targetId).includes('reuse')).length,
            stagedMask: composed.filter(instance => coreStrategyByTarget.get(instance.targetId).includes('staged-full-layer')).length,
            sparseMask: composed.filter(instance => coreStrategyByTarget.get(instance.targetId).includes('sparse-upper')).length,
            scaffold: composed.filter(instance => coreStrategyByTarget.get(instance.targetId).includes('scaffold')).length,
            quarterRouting: 0,
        },
        complexity: {
            all159: complexityStats(composed),
            baselineFamily1: complexityStats(baseline.instances),
            newFamilies2and3: complexityStats(newInstances),
        },
        diversityDepth: {
            sourceAncestryVariation: acceptedStatus.filter(item =>
                item.replacementTopology.length === 1
                && item.replacementTopology.every(replacement => replacement.presentedInputs.length === 1)).length,
            multiReplacementPreprocessingAncestry: acceptedStatus.filter(item =>
                item.replacementTopology.length > 1
                && item.replacementTopology.every(replacement => replacement.presentedInputs.length === 1)).length,
            multiSourcePreprocessingGraph: multiSourcePreprocessing,
            assemblyTopology: 0,
            supportOrScaffoldTopology: 0,
            mechanismRoutingDifference: 0,
        },
    };
    const projection = publicProjection(composed);
    projection.sha256 = sha256(JSON.stringify(projection.instances));
    const composition = {
        schemaVersion: 1,
        name: 'hard-53x3-staged-composition-v1',
        desiredArtifactReleaseId: 'hard-53x3-stage-v1',
        status: errors.length ? 'invalid' : 'complete-but-release-blocked',
        formalReleaseConstructed: false,
        blocker: 'Frozen v3 validation requires one artifact releaseId and one sourceArtifact for every inline instance; the immutable baseline, pilot and rollout instances intentionally retain three different release/source provenance chains.',
        instanceCount: composed.length,
        targetCount: targetRows.length,
        targetsAt3of3: targetRows.filter(row => new Set(row.structuralSignatures).size === 3).length,
        mechanicallyReplayed: errors.filter(error => error.includes('replay invalid')).length ? null : composed.length,
        expansionValidated: errors.filter(error => error.includes('expansion invalid')).length ? null : composed.length,
        sourceArtifacts: {
            baseline: { ...IDENTITIES.baseline, ...actualIdentities.baseline },
            pilot: { ...IDENTITIES.pilot, ...actualIdentities.pilot },
            rollout: { ...IDENTITIES.rollout, ...actualIdentities.rollout },
        },
        targetRows,
        errors,
    };
    if (write) {
        const directory = path.join(ROOT, 'benchmarks/hard-53x3-staged/v1');
        await mkdir(directory, { recursive: true });
        await Promise.all([
            writeFile(path.join(directory, 'composition-status.json'), `${JSON.stringify(composition, null, 2)}\n`),
            writeFile(path.join(directory, 'solver-inputs.json'), `${JSON.stringify(projection, null, 2)}\n`),
            writeFile(path.join(directory, 'statistics.json'), `${JSON.stringify(statistics, null, 2)}\n`),
        ]);
    }
    return { composition, projection, statistics };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const result = await auditHard53x3StagedComposition();
    console.log(JSON.stringify({
        status: result.composition.status,
        targetsAt3of3: result.composition.targetsAt3of3,
        instances: result.composition.instanceCount,
        replayed: result.composition.mechanicallyReplayed,
        expansionValidated: result.composition.expansionValidated,
        errors: result.composition.errors,
    }, null, 2));
}
