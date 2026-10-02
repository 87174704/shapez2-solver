import {
    canonicalMultiset, instanceContentHash, multisetDelta, multisetRows,
    replayWitness, validateExpansionMetadata,
} from './benchmark-core.mjs';
import { WitnessBuilder } from './generation-framework.mjs';

export const ENVIRONMENT_EXPANSION_GENERATOR_VERSION = 'environment-expansion-v1';

function takeMatchingOutput(builder, outputIds, shape, context) {
    const id = outputIds.find(candidate => builder.shape(candidate) === shape);
    if (id === undefined) throw new Error(`${context}: derivation did not produce ${shape}`);
    return id;
}

function appendCoreWitness(builder, coreWitness, initialMapping) {
    const tokenMapping = new Map(initialMapping);
    for (const [stepIndex, step] of coreWitness.steps.entries()) {
        const mappedInputs = step.inputs.map(id => {
            if (!tokenMapping.has(id)) throw new Error(`core step ${stepIndex}: missing mapped token ${id}`);
            return tokenMapping.get(id);
        });
        const produced = builder.operate(step.operation, mappedInputs, step.params);
        const unmatched = [...produced];
        for (const declared of step.outputs) {
            const matchIndex = unmatched.findIndex(id => builder.shape(id) === declared.shape);
            if (matchIndex < 0) throw new Error(`core step ${stepIndex}: regenerated outputs do not contain ${declared.shape}`);
            tokenMapping.set(declared.id, unmatched.splice(matchIndex, 1)[0]);
        }
        if (unmatched.length) throw new Error(`core step ${stepIndex}: regenerated outputs were not fully mapped`);
    }
    const resultId = tokenMapping.get(coreWitness.resultId);
    if (resultId === undefined) throw new Error('core result token was not mapped');
    return resultId;
}

function addRows(counts, rows, direction = 1) {
    for (const { shape, count } of rows ?? []) {
        const next = (counts.get(shape) ?? 0) + direction * count;
        if (next < 0) throw new Error(`expansion removes unavailable core resource ${shape}`);
        if (next === 0) counts.delete(shape); else counts.set(shape, next);
    }
}

/**
 * Expands any already-constructed forward witness.  The expansion layer knows
 * nothing about the construction strategy: it rebuilds a declared bridge and
 * then mechanically appends the source witness through canonical adapters.
 */
export function expandWitnessEnvironment(coreInstance, plan, { catalog, policy, policySha256 }) {
    const coreReplay = replayWitness(coreInstance, catalog);
    if (!coreReplay.valid) throw new Error(`source core witness does not replay: ${coreReplay.phase}: ${coreReplay.errors.join('; ')}`);

    const builder = new WitnessBuilder(coreInstance.rules.maxLayers);
    const replacements = [...(plan.replacements ?? [])];
    const replacementUse = new Map();
    const bridgeMapping = new Map();
    const bridgeTokenIds = [];

    for (const coreToken of coreInstance.witness.initial) {
        const candidates = replacements.filter(item => item.coreShape === coreToken.shape);
        const used = replacementUse.get(coreToken.shape) ?? 0;
        const replacement = candidates[used];
        let bridgeId;
        if (replacement) {
            replacementUse.set(coreToken.shape, used + 1);
            let current = builder.input(replacement.presentedShape);
            for (const [index, step] of replacement.derivation.entries()) {
                const outputs = builder.operate(step.operation, [current], step.params ?? {});
                current = takeMatchingOutput(builder, outputs, step.selectShape, `${plan.id}/derivation ${index}`);
            }
            if (builder.shape(current) !== coreToken.shape) throw new Error(`${plan.id}: preprocessing bridge ${builder.shape(current)} != ${coreToken.shape}`);
            bridgeId = current;
        } else bridgeId = builder.input(coreToken.shape);
        bridgeMapping.set(coreToken.id, bridgeId);
        bridgeTokenIds.push(bridgeId);
    }
    if ([...replacementUse.values()].reduce((sum, count) => sum + count, 0) !== replacements.length) throw new Error(`${plan.id}: replacement does not match a core witness occurrence`);

    const preprocessingStepCount = builder.steps.length;
    const resultId = appendCoreWitness(builder, coreInstance.witness, bridgeMapping);
    if (builder.shape(resultId) !== coreInstance.target) throw new Error(`${plan.id}: expanded result differs from target`);

    const coreWitnessBasis = multisetRows(coreInstance.witness.initial.map(token => ({ shape: token.shape, count: 1 })));
    const availableCounts = new Map(coreWitnessBasis.map(input => [input.shape, input.count]));
    for (const replacement of replacements) {
        addRows(availableCounts, [{ shape: replacement.coreShape, count: 1 }], -1);
        addRows(availableCounts, [{ shape: replacement.presentedShape, count: 1 }]);
    }
    addRows(availableCounts, plan.additions);
    const availableInputs = [...availableCounts].sort(([a], [b]) => a.localeCompare(b)).map(([shape, count]) => ({ shape, count }));
    const delta = multisetDelta(coreWitnessBasis, availableInputs);
    const kind = replacements.length ? 'transformative' : 'additive';
    if (kind !== plan.kind) throw new Error(`${plan.id}: declared ${plan.kind} but mechanics are ${kind}`);

    const instance = {
        schemaVersion: 3,
        id: plan.instanceId,
        suite: coreInstance.suite,
        track: coreInstance.track,
        targetId: coreInstance.targetId,
        target: coreInstance.target,
        partition: 'expansion-pilot',
        coreWitnessBasis,
        availableInputs,
        expansion: {
            policyId: policy.policyId,
            policyVersion: policy.schemaVersion,
            policySha256,
            planId: plan.id,
            kind,
            preprocessingStepCount,
            bridgeTokenIds,
            basisRemoved: delta.removed,
            availableAdded: delta.added,
            sourceInstance: {
                releaseId: coreInstance.provenance.releaseId,
                id: coreInstance.id,
                instanceSha256: coreInstance.instanceSha256,
            },
        },
        rules: structuredClone(coreInstance.rules),
        construction: {
            strategy: `core+${kind}-environment-expansion`,
            coreStrategy: coreInstance.construction.strategy,
        },
        witness: builder.witness(resultId),
    };
    const replay = replayWitness(instance, catalog);
    if (!replay.valid) throw new Error(`${plan.id}: expanded forward replay failed: ${replay.phase}: ${replay.errors.join('; ')}`);
    const expansionValidation = validateExpansionMetadata(instance, catalog, replay, policy);
    if (!expansionValidation.valid) throw new Error(`${plan.id}: expansion metadata invalid: ${expansionValidation.errors.join('; ')}`);
    instance.instanceSha256 = instanceContentHash(instance);
    return { instance, replay };
}

export function buildSolverEvaluationView(artifact) {
    return {
        schemaVersion: 1,
        sourceReleaseId: artifact.releaseId,
        suite: artifact.suite,
        partition: artifact.partition,
        instances: artifact.instances.map(instance => ({
            id: instance.id,
            track: instance.track,
            targetId: instance.targetId,
            target: instance.target,
            availableInputs: structuredClone(instance.availableInputs),
            rules: structuredClone(instance.rules),
        })),
    };
}

export function assertDifferentPresentedEnvironments(instances) {
    const seen = new Set();
    for (const instance of instances) {
        const key = `${instance.targetId}\0${canonicalMultiset(instance.availableInputs)}`;
        if (seen.has(key)) throw new Error(`${instance.targetId}: input order cannot create environment diversity`);
        seen.add(key);
    }
}
