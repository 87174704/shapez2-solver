import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
    Shape, ShapeOperationConfig, cut, halfCut, rotate90CW, rotate90CCW, rotate180, swapHalves,
} from '../../shapeOperations.js';
import {
    artifactContentHash, artifactInstancesHash, canonicalJson, canonicalMultiset,
    compileCatalog, deriveMetadata, deriveStructuralFingerprint, instanceContentHash,
    multisetDelta, multisetRows, parseParts, readJson, refinementBundleForTarget,
    replayWitness, validateExpansionMetadata, weightedJaccard,
} from './benchmark-core.mjs';
import { buildSolverEvaluationView, expandWitnessEnvironment } from './environment-expansion.mjs';
import { WitnessBuilder } from './generation-framework.mjs';
import { fileSha256, loadRepositoryPolicy, ROOT } from './repository-policy.mjs';

export const HARD_53X3_ROLLOUT_RELEASE_ID = 'hard-53x3-rollout-stage-v1';
export const HARD_53X3_ROLLOUT_VERSION = 'hard-53x3-rollout-stage-v1-preprocessing-topology';
export const HARD_53X3_ROLLOUT_PARTITION = 'expansion-pilot';
export const HARD_53X3_ROLLOUT_BATCH_SIZE = 8;

const BASELINE_RELEASE_ID = 'hard-53x1-stage-v1';
const BASELINE_MANIFEST_REVISION_ID = 'hard-53x1-stage-v1-manifest-r2';
const BASELINE_ARTIFACT_CANONICAL_SHA256 = '11005e04e359fff9d0d3a0fec66dd491ca8e441f5c5c880e1ff3441b9fc77da3';
const BASELINE_INSTANCES_SHA256 = '40c4ea586dfeafb5f5e37545101220451d2cc9a9ca2ab54eb9d00a94806c8375';
const PILOT_RELEASE_ID = 'hard-53x3-diversity-pilot-v1';
const PILOT_MANIFEST_REVISION_ID = 'hard-53x3-diversity-pilot-v1-manifest-r1';
const PILOT_ARTIFACT_CANONICAL_SHA256 = '9eaf8dc3a64cf68830ea0ec734b8ea6aba0fe67304d8033765125ce6fb6139f0';
const PILOT_INSTANCES_SHA256 = '9ccffd150764176162ca759c4b9f414c3b308f60a967e6e33e322e0e1968f3a0';
const CONFIG = new ShapeOperationConfig(4);
const UNARY_OPERATIONS = Object.freeze([
    ['Cutter', shape => cut(shape, CONFIG)],
    ['Half Destroyer', shape => halfCut(shape, CONFIG)],
    ['Rotator CW', shape => rotate90CW(shape, CONFIG)],
    ['Rotator CCW', shape => rotate90CCW(shape, CONFIG)],
    ['Rotator 180', shape => rotate180(shape, CONFIG)],
]);

function sumRows(rows) {
    return (rows ?? []).reduce((sum, row) => sum + row.count, 0);
}

function canonicalRows(counts) {
    return [...counts].filter(([, count]) => count > 0)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([shape, count]) => ({ shape, count }));
}

function takePoolToken(builder, pool, shape, context) {
    const index = pool.findIndex(id => builder.shape(id) === shape);
    if (index < 0) throw new Error(`${context}: preprocessing pool does not contain ${shape}`);
    return pool.splice(index, 1)[0];
}

function appendFrozenWitness(builder, witness, initialMapping) {
    const tokenMapping = new Map(initialMapping);
    for (const [stepIndex, step] of witness.steps.entries()) {
        const inputs = step.inputs.map(id => {
            if (!tokenMapping.has(id)) throw new Error(`core step ${stepIndex}: missing mapped token ${id}`);
            return tokenMapping.get(id);
        });
        const produced = builder.operate(step.operation, inputs, step.params);
        const unmatched = [...produced];
        for (const declared of step.outputs) {
            const index = unmatched.findIndex(id => builder.shape(id) === declared.shape);
            if (index < 0) throw new Error(`core step ${stepIndex}: regenerated outputs do not contain ${declared.shape}`);
            tokenMapping.set(declared.id, unmatched.splice(index, 1)[0]);
        }
        if (unmatched.length) throw new Error(`core step ${stepIndex}: regenerated outputs were not fully mapped`);
    }
    const resultId = tokenMapping.get(witness.resultId);
    if (resultId === undefined) throw new Error('core result token was not mapped');
    return resultId;
}

function expandGraphWitnessEnvironment(coreInstance, plan, { catalog, policy, policySha256 }) {
    const builder = new WitnessBuilder(coreInstance.rules.maxLayers);
    const replacements = [...(plan.replacements ?? [])];
    const replacementUse = new Map();
    const initialMapping = new Map();
    const bridgeTokenIds = [];
    for (const coreToken of coreInstance.witness.initial) {
        const candidates = replacements.filter(item => item.coreShape === coreToken.shape);
        const used = replacementUse.get(coreToken.shape) ?? 0;
        const replacement = candidates[used];
        let bridgeId;
        if (replacement?.derivationGraph) {
            replacementUse.set(coreToken.shape, used + 1);
            const pool = replacement.presentedInputs.map(shape => builder.input(shape));
            for (const [index, step] of replacement.derivationGraph.entries()) {
                const inputs = step.inputShapes.map(shape =>
                    takePoolToken(builder, pool, shape, `${plan.id}/graph derivation ${index}`));
                pool.push(...builder.operate(step.operation, inputs, step.params ?? {}));
            }
            bridgeId = takePoolToken(builder, pool, replacement.coreShape, `${plan.id}/graph result`);
        } else if (replacement) {
            throw new Error(`${plan.id}: graph expansion received a non-graph replacement`);
        } else bridgeId = builder.input(coreToken.shape);
        initialMapping.set(coreToken.id, bridgeId);
        bridgeTokenIds.push(bridgeId);
    }
    if ([...replacementUse.values()].reduce((sum, count) => sum + count, 0) !== replacements.length) {
        throw new Error(`${plan.id}: replacement does not match a core witness occurrence`);
    }
    const preprocessingStepCount = builder.steps.length;
    const resultId = appendFrozenWitness(builder, coreInstance.witness, initialMapping);
    const coreWitnessBasis = multisetRows(coreInstance.witness.initial.map(token => ({ shape: token.shape, count: 1 })));
    const availableCounts = new Map(coreWitnessBasis.map(row => [row.shape, row.count]));
    for (const replacement of replacements) {
        availableCounts.set(replacement.coreShape, availableCounts.get(replacement.coreShape) - 1);
        if (availableCounts.get(replacement.coreShape) === 0) availableCounts.delete(replacement.coreShape);
        for (const shape of replacement.presentedInputs) {
            availableCounts.set(shape, (availableCounts.get(shape) ?? 0) + 1);
        }
    }
    for (const { shape, count } of plan.additions ?? []) {
        availableCounts.set(shape, (availableCounts.get(shape) ?? 0) + count);
    }
    const availableInputs = canonicalRows(availableCounts);
    const delta = multisetDelta(coreWitnessBasis, availableInputs);
    const instance = {
        schemaVersion: 3,
        id: plan.instanceId,
        suite: coreInstance.suite,
        track: coreInstance.track,
        targetId: coreInstance.targetId,
        target: coreInstance.target,
        partition: HARD_53X3_ROLLOUT_PARTITION,
        coreWitnessBasis,
        availableInputs,
        expansion: {
            policyId: policy.policyId,
            policyVersion: policy.schemaVersion,
            policySha256,
            planId: plan.id,
            kind: 'transformative',
            preprocessingStepCount,
            bridgeTokenIds,
            basisRemoved: delta.removed,
            availableAdded: delta.added,
            sourceInstance: {
                releaseId: BASELINE_RELEASE_ID,
                id: coreInstance.id,
                instanceSha256: coreInstance.instanceSha256,
            },
        },
        rules: structuredClone(coreInstance.rules),
        construction: {
            strategy: 'core+transformative-swapper-graph-environment-expansion',
            coreStrategy: coreInstance.construction.strategy,
        },
        witness: builder.witness(resultId),
    };
    const replay = replayWitness(instance, catalog);
    if (!replay.valid) throw new Error(`${plan.id}: expanded forward replay failed: ${replay.phase}: ${replay.errors.join('; ')}`);
    const expansionValidation = validateExpansionMetadata(instance, catalog, replay, policy);
    if (!expansionValidation.valid) throw new Error(`expansion invalid: ${expansionValidation.errors.join('; ')}`);
    return { instance, replay };
}

function ordinaryCatalogShapes(catalog) {
    return ['full', 'partial', 'half'].flatMap(category => catalog.ordinary[category] ?? [])
        .filter(shape => shape !== 'WuWuWuWu')
        .sort();
}

function derivationsFrom(presentedShape, wantedShape, maxDepth = 3) {
    const queue = [{ shape: presentedShape, steps: [], lossy: false }];
    const bestDepth = new Map([[presentedShape, 0]]);
    const found = [];
    while (queue.length) {
        const current = queue.shift();
        if (current.steps.length >= maxDepth) continue;
        for (const [operation, apply] of UNARY_OPERATIONS) {
            const outputs = apply(Shape.fromShapeCode(current.shape))
                .filter(shape => !shape.isEmpty()).map(shape => shape.toShapeCode());
            for (const output of [...new Set(outputs)]) {
                const steps = [...current.steps, { operation, selectShape: output, params: {} }];
                const lossy = current.lossy || operation === 'Cutter' || operation === 'Half Destroyer';
                if (output === wantedShape && lossy) found.push({ presentedShape, coreShape: wantedShape, derivation: steps });
                const depth = steps.length;
                if (depth < maxDepth && depth <= (bestDepth.get(output) ?? Infinity)) {
                    bestDepth.set(output, depth);
                    queue.push({ shape: output, steps, lossy });
                }
            }
        }
    }
    const unique = new Map();
    for (const item of found) {
        const key = canonicalJson(item.derivation);
        if (!unique.has(key)) unique.set(key, item);
    }
    return [...unique.values()].sort((a, b) => a.derivation.length - b.derivation.length
        || a.presentedShape.localeCompare(b.presentedShape)
        || canonicalJson(a.derivation).localeCompare(canonicalJson(b.derivation)));
}

function replacementOptions(source, catalog) {
    const ordinary = new Set(ordinaryCatalogShapes(catalog));
    const coreShapes = [...new Set(source.witness.initial.map(token => token.shape))];
    const unique = new Map();
    for (const coreShape of coreShapes) {
        if (!ordinary.has(coreShape)) continue;
        for (const presentedShape of ordinary) {
            if (presentedShape === coreShape) continue;
            for (const option of derivationsFrom(presentedShape, coreShape)) {
                const key = `${option.coreShape}\0${option.presentedShape}\0${canonicalJson(option.derivation)}`;
                if (!unique.has(key)) unique.set(key, option);
            }
        }
    }
    return [...unique.values()];
}

function unaryClosure(presentedShape, maxDepth = 2) {
    const queue = [{ shape: presentedShape, steps: [] }];
    const bestDepth = new Map([[presentedShape, 0]]);
    for (let index = 0; index < queue.length; index++) {
        const current = queue[index];
        if (current.steps.length >= maxDepth) continue;
        for (const [operation, apply] of UNARY_OPERATIONS) {
            const outputs = apply(Shape.fromShapeCode(current.shape))
                .filter(shape => !shape.isEmpty()).map(shape => shape.toShapeCode());
            for (const output of [...new Set(outputs)]) {
                const steps = [...current.steps, { operation, selectShape: output, params: {} }];
                const depth = steps.length;
                if (depth <= (bestDepth.get(output) ?? Infinity)) {
                    bestDepth.set(output, depth);
                    queue.push({ shape: output, steps });
                }
            }
        }
    }
    return queue;
}

function graphStepsFor(sourceShape, closure) {
    const steps = [];
    let inputShape = sourceShape;
    for (const step of closure.steps) {
        steps.push({ operation: step.operation, inputShapes: [inputShape], params: {} });
        inputShape = step.selectShape;
    }
    return steps;
}

/**
 * Generic bounded fallback for a core resource that no single catalog source
 * can derive. Two independently prepared sources are recomposed by Swapper;
 * canonical replay remains the only acceptance authority.
 */
export function swapperGraphReplacementOptions(source, catalog, targetCase, bundle, cap = 80) {
    const coreShapes = [...new Set(source.witness.initial.map(token => token.shape))];
    const ordinarySet = new Set(ordinaryCatalogShapes(catalog));
    const presented = ordinaryCatalogShapes(catalog)
        .filter(shape => shape !== targetCase.target)
        .filter(shape => shape !== 'SuSuRuRu' || (targetCase.track === 'side' && !bundle.group));
    const closures = presented.map(shape => ({ sourceShape: shape, states: unaryClosure(shape) }));
    const unique = new Map();
    for (const wantedShape of coreShapes) {
        if (!ordinarySet.has(wantedShape)) continue;
        let wantedCount = 0;
        for (let left = 0; left < closures.length && wantedCount < cap; left++) {
            for (let right = left; right < closures.length && wantedCount < cap; right++) {
                if (closures[left].sourceShape === wantedShape || closures[right].sourceShape === wantedShape) continue;
                for (const a of closures[left].states) {
                    if (wantedCount >= cap) break;
                    for (const b of closures[right].states) {
                        if (wantedCount >= cap) break;
                        let outputCodes;
                        try {
                            outputCodes = swapHalves(
                                Shape.fromShapeCode(a.shape), Shape.fromShapeCode(b.shape), CONFIG,
                            ).filter(shape => !shape.isEmpty()).map(shape => shape.toShapeCode());
                        } catch {
                            continue;
                        }
                        if (!outputCodes.includes(wantedShape)) continue;
                        const option = {
                            coreShape: wantedShape,
                            presentedInputs: [closures[left].sourceShape, closures[right].sourceShape],
                            derivationGraph: [
                                ...graphStepsFor(closures[left].sourceShape, a),
                                ...graphStepsFor(closures[right].sourceShape, b),
                                { operation: 'Swapper', inputShapes: [a.shape, b.shape], params: {} },
                            ],
                        };
                        const key = canonicalJson(option);
                        if (!unique.has(key)) {
                            unique.set(key, option);
                            wantedCount += 1;
                        }
                    }
                }
            }
        }
    }
    return [...unique.values()];
}

function targetVocabulary(target, source) {
    const vocabulary = new Set(parseParts(target).flat()
        .map(part => part.shape).filter(shape => !['-', 'P', 'c', 'X', 'Y'].includes(shape)));
    if (!vocabulary.size) {
        for (const token of source.witness.initial) {
            for (const part of parseParts(token.shape).flat()) {
                if (!['-', 'P', 'c', 'X', 'Y'].includes(part.shape)) vocabulary.add(part.shape);
            }
        }
    }
    return vocabulary;
}

function candidateAdditions(source, targetCase, catalog, bundle, replacements, variant) {
    const coreRows = multisetRows(source.witness.initial.map(token => ({ shape: token.shape, count: 1 })));
    const counts = new Map(coreRows.map(row => [row.shape, row.count]));
    for (const replacement of replacements) {
        counts.set(replacement.coreShape, (counts.get(replacement.coreShape) ?? 0) - 1);
        for (const shape of replacement.presentedInputs ?? [replacement.presentedShape]) {
            counts.set(shape, (counts.get(shape) ?? 0) + 1);
        }
    }
    const additions = [];
    for (const required of bundle.inputs) {
        const missing = required.count - (counts.get(required.shape) ?? 0);
        if (missing > 0) {
            additions.push({ shape: required.shape, count: missing });
            counts.set(required.shape, (counts.get(required.shape) ?? 0) + missing);
        }
    }
    const vocabulary = targetVocabulary(targetCase.target, source);
    const baselineAvailable = new Set(source.availableInputs.map(row => row.shape));
    const replacedCoreShapes = new Set(replacements.map(replacement => replacement.coreShape));
    const ordinary = ordinaryCatalogShapes(catalog)
        .filter(shape => shape !== targetCase.target)
        .filter(shape => !replacedCoreShapes.has(shape))
        .filter(shape => shape !== 'SuSuRuRu' || (targetCase.track === 'side' && !bundle.group))
        .filter(shape => parseParts(shape).flat().some(part => vocabulary.has(part.shape)))
        .sort((a, b) => Number(baselineAvailable.has(a)) - Number(baselineAvailable.has(b)) || a.localeCompare(b));
    if (variant % 2) ordinary.reverse();
    const core = canonicalRows(new Map(coreRows.map(row => [row.shape, row.count])));
    const ordinarySet = new Set(ordinaryCatalogShapes(catalog));
    for (const shape of ordinary) {
        const ordinaryAdded = sumRows(multisetDelta(core, canonicalRows(counts)).added.filter(row => ordinarySet.has(row.shape)));
        if (ordinaryAdded >= 3) break;
        if ((counts.get(shape) ?? 0) >= 3) continue;
        const existing = additions.find(row => row.shape === shape);
        if (existing) existing.count += 1; else additions.push({ shape, count: 1 });
        counts.set(shape, (counts.get(shape) ?? 0) + 1);
        const nextAdded = sumRows(multisetDelta(core, canonicalRows(counts)).added.filter(row => ordinarySet.has(row.shape)));
        if (nextAdded > 3) {
            counts.set(shape, counts.get(shape) - 1);
            if (existing) existing.count -= 1; else additions.pop();
        }
    }
    return additions.filter(row => row.count > 0).sort((a, b) => a.shape.localeCompare(b.shape));
}

function planSpecs(options, cap = 160) {
    const specs = [];
    for (const option of options) specs.push([option]);
    for (let left = 0; left < options.length && specs.length < cap; left++) {
        for (let right = left + 1; right < options.length && specs.length < cap; right++) {
            if (options[left].coreShape === options[right].coreShape) continue;
            specs.push([options[left], options[right]]);
        }
    }
    return specs.slice(0, cap);
}

function environmentComparison(candidate, priorInstances) {
    const signature = canonicalMultiset(candidate.availableInputs);
    const similarities = priorInstances.map(instance => weightedJaccard(signature, canonicalMultiset(instance.availableInputs)));
    const priorTypes = new Set(priorInstances.flatMap(instance => instance.availableInputs.map(row => row.shape)));
    return {
        maxWeightedJaccard: similarities.length ? Math.max(...similarities) : 0,
        baselineWeightedJaccard: similarities[0] ?? 0,
        newInputTypeCount: candidate.availableInputs.filter(row => !priorTypes.has(row.shape)).length,
        availableOccurrenceCount: sumRows(candidate.availableInputs),
        coreOccurrenceCount: sumRows(candidate.coreWitnessBasis),
        expansionDelta: sumRows(candidate.availableInputs) - sumRows(candidate.coreWitnessBasis),
    };
}

function topologyDescriptor(replacements) {
    const routes = replacements.map(item => (item.derivationGraph ?? item.derivation).map(step => step.operation).join('>')).sort();
    const hasGraph = replacements.some(item => item.derivationGraph);
    return {
        diversityDepth: hasGraph || replacements.length > 1 ? 'preprocessing topology' : 'source-ancestry variation',
        causalSourceCount: replacements.reduce((sum, item) => sum + (item.presentedInputs?.length ?? 1), 0),
        preprocessingDepth: replacements.reduce((sum, item) => sum + (item.derivationGraph ?? item.derivation).length, 0),
        routeSignature: routes.join('|'),
    };
}

function selectWithinFamily(candidates) {
    return [...candidates].sort((a, b) =>
        b.topology.causalSourceCount - a.topology.causalSourceCount
        || a.environment.baselineWeightedJaccard - b.environment.baselineWeightedJaccard
        || b.environment.newInputTypeCount - a.environment.newInputTypeCount
        || a.instance.difficulty.operationCount - b.instance.difficulty.operationCount
        || a.topology.preprocessingDepth - b.topology.preprocessingDepth
        || a.candidate - b.candidate)[0];
}

function chooseFamilyPair(families) {
    const representatives = [...families.values()].map(selectWithinFamily);
    let best = null;
    for (let left = 0; left < representatives.length; left++) {
        for (let right = left + 1; right < representatives.length; right++) {
            const a = representatives[left]; const b = representatives[right];
            const pairSimilarity = weightedJaccard(
                canonicalMultiset(a.instance.availableInputs), canonicalMultiset(b.instance.availableInputs),
            );
            const topologyScore = a.topology.causalSourceCount + b.topology.causalSourceCount
                + Number(a.topology.routeSignature !== b.topology.routeSignature);
            const environmentScore = Math.max(
                a.environment.baselineWeightedJaccard, b.environment.baselineWeightedJaccard, pairSimilarity,
            ) - 0.02 * (a.environment.newInputTypeCount + b.environment.newInputTypeCount);
            const complexity = a.instance.difficulty.operationCount + b.instance.difficulty.operationCount;
            const candidate = { topologyScore, environmentScore, complexity, pairSimilarity, candidates: [a, b] };
            if (!best || candidate.topologyScore > best.topologyScore
                || (candidate.topologyScore === best.topologyScore && candidate.environmentScore < best.environmentScore)
                || (candidate.topologyScore === best.topologyScore && candidate.environmentScore === best.environmentScore
                    && candidate.complexity < best.complexity)) best = candidate;
        }
    }
    if (best) return best;
    if (representatives.length === 1) return { candidates: [representatives[0]], pairSimilarity: null };
    return { candidates: [], pairSimilarity: null };
}

async function provenance(repositoryPolicy, targetCase) {
    return {
        releaseId: HARD_53X3_ROLLOUT_RELEASE_ID,
        generatorVersion: HARD_53X3_ROLLOUT_VERSION,
        generatorSourceSha256: await fileSha256('benchmarks/tools/build-hard-53x3-rollout.mjs'),
        targetSha256: targetCase.sha256,
        officialTargetsSha256: repositoryPolicy.officialTargets.manifest.sha256,
        catalogVersion: repositoryPolicy.catalog.version,
        catalogSha256: repositoryPolicy.catalog.sha256,
        inputSeedIdentity: repositoryPolicy.inputSeed.identity,
        inputSeedSha256: repositoryPolicy.inputSeed.sha256,
        gameSemanticsId: repositoryPolicy.gameSemantics.id,
        gameSemanticsSha256: repositoryPolicy.gameSemantics.sha256,
    };
}

function checkpointSummary(batchNumber, targetIds, status, attempts) {
    const targetSet = new Set(targetIds);
    const batchStatus = status.filter(item => targetSet.has(item.targetId));
    const batchAttempts = attempts.filter(item => targetSet.has(item.targetId));
    const categoryCount = category => batchAttempts.filter(item => item.category === category).length;
    return {
        batchNumber,
        targetsAttempted: targetIds,
        achieved3of3: batchStatus.filter(item => item.familyCoverage === '3/3').map(item => item.targetId),
        achieved2of3Only: batchStatus.filter(item => item.familyCoverage === '2/3').map(item => item.targetId),
        duplicateFamilyRejectionCount: categoryCount('structural duplicate collapse'),
        replayInvalidCount: categoryCount('replay invalid'),
        expansionInvalidCount: categoryCount('expansion invalid'),
        capabilityGapTargets: batchStatus.filter(item => item.failureCategory).map(item => ({
            targetId: item.targetId, reason: item.failureCategory,
        })),
        candidateCount: batchAttempts.length,
        acceptedCount: batchAttempts.filter(item => item.accepted).length,
    };
}

async function writeState(directory, { acceptedInstances, attempts, status, checkpoints, remainingTargetIds, baseline, pilot }) {
    await mkdir(directory, { recursive: true });
    const artifact = {
        schemaVersion: 3,
        benchmarkInstanceSchemaVersion: 3,
        name: HARD_53X3_ROLLOUT_RELEASE_ID,
        releaseId: HARD_53X3_ROLLOUT_RELEASE_ID,
        suite: 'hard',
        partition: HARD_53X3_ROLLOUT_PARTITION,
        targetIds: status.map(item => item.targetId),
        candidateCount: attempts.length,
        acceptedCount: acceptedInstances.length,
        rejectedCount: attempts.filter(item => !item.accepted).length,
        instances: acceptedInstances,
    };
    artifact.sha256 = artifactInstancesHash(artifact.instances);
    const solverView = buildSolverEvaluationView(artifact);
    solverView.sha256 = artifactInstancesHash(solverView.instances);
    const resume = {
        releaseId: HARD_53X3_ROLLOUT_RELEASE_ID,
        batchSize: HARD_53X3_ROLLOUT_BATCH_SIZE,
        officialRemainingTargetIds: remainingTargetIds,
        completedTargetIds: status.map(item => item.targetId),
        nextTargetId: remainingTargetIds[status.length] ?? null,
        complete: status.length === remainingTargetIds.length,
        baselineIdentity: {
            artifactReleaseId: baseline.releaseId,
            manifestRevisionId: BASELINE_MANIFEST_REVISION_ID,
            artifactCanonicalSha256: artifactContentHash(baseline),
            instancesSha256: baseline.sha256,
        },
        pilotIdentity: {
            artifactReleaseId: pilot.releaseId,
            manifestRevisionId: PILOT_MANIFEST_REVISION_ID,
            artifactCanonicalSha256: artifactContentHash(pilot),
            instancesSha256: pilot.sha256,
        },
        checkpoints,
    };
    await Promise.all([
        writeFile(path.join(directory, 'instances.json'), `${JSON.stringify(artifact, null, 2)}\n`),
        writeFile(path.join(directory, 'solver-inputs.json'), `${JSON.stringify(solverView, null, 2)}\n`),
        writeFile(path.join(directory, 'candidate-log.json'), `${JSON.stringify(attempts, null, 2)}\n`),
        writeFile(path.join(directory, 'target-status.json'), `${JSON.stringify(status, null, 2)}\n`),
        writeFile(path.join(directory, 'resume-state.json'), `${JSON.stringify(resume, null, 2)}\n`),
        ...checkpoints.map(checkpoint => writeFile(
            path.join(directory, `checkpoint-${String(checkpoint.batchNumber).padStart(2, '0')}.json`),
            `${JSON.stringify(checkpoint, null, 2)}\n`,
        )),
    ]);
    return { artifact, solverView, resume };
}

export async function buildHard53x3Rollout({ write = true, batchSize = HARD_53X3_ROLLOUT_BATCH_SIZE } = {}) {
    const [catalog, officialManifest, repositoryPolicy, expansionPolicy, baseline, pilot] = await Promise.all([
        readJson(path.join(ROOT, 'benchmarks/input_catalog.json')),
        readJson(path.join(ROOT, 'benchmarks/manifest.json')),
        loadRepositoryPolicy(),
        readJson(path.join(ROOT, 'benchmarks/policy/input-environment-expansion.v1.json')),
        readJson(path.join(ROOT, 'benchmarks/hard-53x1/v1/instances.json')),
        readJson(path.join(ROOT, 'benchmarks/diversity-pilot/v1/instances.json')),
    ]);
    if (artifactContentHash(baseline) !== BASELINE_ARTIFACT_CANONICAL_SHA256 || baseline.sha256 !== BASELINE_INSTANCES_SHA256) {
        throw new Error('frozen Hard 53x1 baseline identity changed; full rollout stopped');
    }
    if (artifactContentHash(pilot) !== PILOT_ARTIFACT_CANONICAL_SHA256 || pilot.sha256 !== PILOT_INSTANCES_SHA256) {
        throw new Error('accepted diversity pilot identity changed; full rollout stopped');
    }
    const officialTargets = officialManifest.cases.filter(item => item.suite === 'hard');
    const pilotTargetIds = new Set(pilot.targetIds);
    const remainingTargets = officialTargets.filter(item => !pilotTargetIds.has(item.id));
    if (officialTargets.length !== 53 || pilotTargetIds.size !== 13 || remainingTargets.length !== 40) {
        throw new Error(`mechanical target subtraction mismatch: ${officialTargets.length} - ${pilotTargetIds.size} != ${remainingTargets.length}`);
    }
    const compiled = compileCatalog(catalog);
    const baselineByTarget = new Map(baseline.instances.map(instance => [instance.targetId, instance]));
    const expansionPolicySha256 = await fileSha256('benchmarks/policy/input-environment-expansion.v1.json');
    const acceptedInstances = [];
    const attempts = [];
    const status = [];
    const checkpoints = [];
    const directory = path.join(ROOT, 'benchmarks/hard-53x3-rollout/v1');

    for (let offset = 0; offset < remainingTargets.length; offset += batchSize) {
        const batch = remainingTargets.slice(offset, offset + batchSize);
        for (const targetCase of batch) {
            const source = baselineByTarget.get(targetCase.id);
            if (!source) throw new Error(`${targetCase.id}: missing frozen baseline instance`);
            const baselineReplay = replayWitness(source, catalog);
            if (!baselineReplay.valid) throw new Error(`${targetCase.id}: frozen baseline replay failed`);
            const baselineStructural = deriveStructuralFingerprint(source, baselineReplay);
            if (baselineStructural.signature !== source.diversity.structureSignature) {
                throw new Error(`${targetCase.id}: frozen baseline structural signature changed`);
            }
            const bundle = refinementBundleForTarget(targetCase.target, compiled);
            const unaryOptions = replacementOptions(source, catalog);
            const options = unaryOptions.length
                ? unaryOptions
                : swapperGraphReplacementOptions(source, catalog, targetCase, bundle);
            const families = new Map();
            const targetAttempts = [];
            let serial = 0;
            for (const replacements of planSpecs(options)) {
                serial += 1;
                const descriptor = replacements.map(item => ({
                    coreShape: item.coreShape,
                    presentedInputs: item.presentedInputs ?? [item.presentedShape],
                    derivation: item.derivationGraph
                        ? item.derivationGraph.map(step => `${step.operation}:${step.inputShapes.join('+')}`)
                        : item.derivation.map(step => `${step.operation}:${step.selectShape}`),
                }));
                try {
                    const plan = {
                        id: `${targetCase.id}-rollout-transform-${String(serial).padStart(3, '0')}`,
                        instanceId: `${targetCase.id}-53x3-rollout-candidate-${String(serial).padStart(3, '0')}`,
                        targetId: targetCase.id,
                        kind: 'transformative',
                        replacements,
                        additions: candidateAdditions(source, targetCase, catalog, bundle, replacements, serial),
                    };
                    const expansionContext = {
                        catalog, policy: expansionPolicy, policySha256: expansionPolicySha256,
                    };
                    const { instance, replay } = replacements.some(item => item.derivationGraph)
                        ? expandGraphWitnessEnvironment(source, plan, expansionContext)
                        : expandWitnessEnvironment(source, plan, expansionContext);
                    instance.partition = HARD_53X3_ROLLOUT_PARTITION;
                    instance.expansion.sourceInstance = {
                        releaseId: BASELINE_RELEASE_ID,
                        id: source.id,
                        instanceSha256: source.instanceSha256,
                    };
                    instance.provenance = await provenance(repositoryPolicy, targetCase);
                    instance.difficulty = deriveMetadata(instance, replay);
                    const structural = deriveStructuralFingerprint(instance, replay);
                    const environment = environmentComparison(instance, [source]);
                    instance.diversity = {
                        inputMultisetSignature: canonicalMultiset(instance.availableInputs),
                        structureVersion: structural.version,
                        structureSignature: structural.signature,
                        classification: 'representative',
                        duplicateOf: null,
                        maxPriorWeightedJaccard: environment.baselineWeightedJaccard,
                    };
                    instance.instanceSha256 = instanceContentHash(instance);
                    const expansionValidation = validateExpansionMetadata(instance, catalog, replay, expansionPolicy);
                    if (!expansionValidation.valid) throw new Error(`expansion invalid: ${expansionValidation.errors.join('; ')}`);
                    const record = {
                        targetId: targetCase.id,
                        candidate: serial,
                        accepted: false,
                        baselineFamilySignature: baselineStructural.signature,
                        candidateFamilySignature: structural.signature,
                        replacementTopology: descriptor,
                        topology: topologyDescriptor(replacements),
                        expansionKind: instance.expansion.kind,
                        environment,
                        witnessDepth: instance.difficulty.witnessDepth,
                        operationCount: instance.difficulty.operationCount,
                        instance,
                    };
                    if (structural.signature === baselineStructural.signature) {
                        record.category = 'structural duplicate collapse';
                        record.reason = 'candidate canonical family equals frozen baseline family';
                    } else {
                        const group = families.get(structural.signature) ?? [];
                        group.push(record);
                        families.set(structural.signature, group);
                    }
                    targetAttempts.push(record);
                } catch (error) {
                    const expansionInvalid = error.message.includes('expansion');
                    targetAttempts.push({
                        targetId: targetCase.id,
                        candidate: serial,
                        accepted: false,
                        baselineFamilySignature: baselineStructural.signature,
                        replacementTopology: descriptor,
                        category: expansionInvalid ? 'expansion invalid' : 'replay invalid',
                        reason: error.message,
                    });
                }
            }
            const accepted = chooseFamilyPair(families).candidates;
            for (const [index, candidate] of accepted.entries()) {
                const instance = candidate.instance;
                instance.id = `${targetCase.id}-53x3-rollout-${String(index + 2).padStart(2, '0')}`;
                const prior = [source, ...accepted.slice(0, index).map(item => item.instance)];
                candidate.environment = environmentComparison(instance, prior);
                instance.diversity.maxPriorWeightedJaccard = candidate.environment.maxWeightedJaccard;
                instance.instanceSha256 = instanceContentHash(instance);
                candidate.accepted = true;
                candidate.familyNumber = index + 2;
                acceptedInstances.push(instance);
            }
            for (const attempt of targetAttempts) {
                if (attempt.instance) delete attempt.instance;
                if (!attempt.accepted && !attempt.category) {
                    const sameSelectedFamily = accepted.some(item => item.candidateFamilySignature === attempt.candidateFamilySignature);
                    attempt.category = sameSelectedFamily ? 'structural duplicate collapse' : 'valid but lower-ranked';
                    attempt.reason = sameSelectedFamily
                        ? 'candidate canonical family duplicates the selected family representative'
                        : 'valid novel family was not selected by topology/environment/naturalness ranking';
                }
            }
            attempts.push(...targetAttempts);
            const familyCount = 1 + accepted.length;
            status.push({
                targetId: targetCase.id,
                baselineInstanceId: source.id,
                baselineFamilySignature: baselineStructural.signature,
                familyCoverage: `${familyCount}/3`,
                acceptedFamilies: accepted.map((candidate, index) => ({
                    familyNumber: index + 2,
                    structuralSignature: candidate.candidateFamilySignature,
                    strategy: candidate.topology.diversityDepth,
                    diversityDepth: candidate.topology.diversityDepth,
                    replacementTopology: candidate.replacementTopology,
                    environment: candidate.environment,
                    witnessDepth: candidate.witnessDepth,
                    operationCount: candidate.operationCount,
                })),
                candidateCount: targetAttempts.length,
                duplicateRejectionCount: targetAttempts.filter(item => item.category === 'structural duplicate collapse').length,
                replayInvalidCount: targetAttempts.filter(item => item.category === 'replay invalid').length,
                expansionInvalidCount: targetAttempts.filter(item => item.category === 'expansion invalid').length,
                failureCategory: familyCount === 3 ? null : familyCount === 2
                    ? 'planner composition gap: second found, third missing'
                    : 'planner composition gap: no second family found',
            });
        }
        const checkpoint = checkpointSummary(checkpoints.length + 1, batch.map(item => item.id), status, attempts);
        checkpoints.push(checkpoint);
        if (write) await writeState(directory, {
            acceptedInstances, attempts, status, checkpoints,
            remainingTargetIds: remainingTargets.map(item => item.id), baseline, pilot,
        });
    }
    const state = write
        ? await writeState(directory, {
            acceptedInstances, attempts, status, checkpoints,
            remainingTargetIds: remainingTargets.map(item => item.id), baseline, pilot,
        })
        : await (async () => {
            const artifact = {
                schemaVersion: 3, benchmarkInstanceSchemaVersion: 3,
                name: HARD_53X3_ROLLOUT_RELEASE_ID, releaseId: HARD_53X3_ROLLOUT_RELEASE_ID,
                suite: 'hard', partition: HARD_53X3_ROLLOUT_PARTITION,
                targetIds: status.map(item => item.targetId), candidateCount: attempts.length,
                acceptedCount: acceptedInstances.length, rejectedCount: attempts.filter(item => !item.accepted).length,
                instances: acceptedInstances,
            };
            artifact.sha256 = artifactInstancesHash(artifact.instances);
            return { artifact, solverView: buildSolverEvaluationView(artifact), resume: null };
        })();
    return {
        ...state, attempts, status, checkpoints,
        remainingTargetIds: remainingTargets.map(item => item.id),
        immutableInputs: {
            baseline: { releaseId: BASELINE_RELEASE_ID, manifestRevisionId: BASELINE_MANIFEST_REVISION_ID },
            pilot: { releaseId: PILOT_RELEASE_ID, manifestRevisionId: PILOT_MANIFEST_REVISION_ID },
        },
    };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const result = await buildHard53x3Rollout();
    console.log(JSON.stringify({
        remainingTargets: result.remainingTargetIds.length,
        targetsAt3of3: result.status.filter(item => item.familyCoverage === '3/3').length,
        acceptedNewInstances: result.artifact.acceptedCount,
        candidateCount: result.artifact.candidateCount,
        checkpoints: result.checkpoints.length,
    }, null, 2));
}
