// Diagnostic child process. The runner gives each mode a fresh Node process.
import process from 'node:process';
import { createHash } from 'node:crypto';

globalThis.self = { postMessage() {} };

function intersectionStats(births, used, descriptors) {
    let count = 0;
    let payloadUtf16Bytes = 0;
    for (const id of births) {
        if (!used.has(id)) continue;
        count += 1;
        payloadUtf16Bytes += descriptors[id].payloadUtf16Bytes;
    }
    return { count, payloadUtf16Bytes };
}

try {
    let inputText = '';
    for await (const chunk of process.stdin) inputText += chunk;
    const { input, mode } = JSON.parse(inputText);
    if (mode !== 'plain' && mode !== 'observer') throw new Error('Expected plain or observer mode');
    const { shapeSolver, shapeSolverTestOnly } = await import('../../shapeSolver.js');
    const observer = mode === 'observer' ? {} : null; // No event array or callback in large runs.
    const started = performance.now();
    const result = observer
        ? await shapeSolverTestOnly(input, { observer })
        : await shapeSolver(input.targetShapeCodes, input.startingShapeCodes,
            input.enabledOperations, input.maxLayers, input.maxStatesPerLevel,
            input.preventWaste, input.orientationSensitive, input.allowSplitting, input.cleanPainting);
    const wallMs = performance.now() - started;
    const solutionSignature = Array.isArray(result.solutionPath)
        ? createHash('sha256').update(JSON.stringify(result.solutionPath)).digest('hex') : null;
    let observation = null;
    if (observer) {
        const data = observer.data;
        const births = data.operationOutputBirthIds;
        const descriptors = data.descriptors;
        const materialized = intersectionStats(births, data.candidateMaterializedIds, descriptors);
        let deferredPayloadUtf16Bytes = 0;
        for (const id of births) {
            if (!data.candidateMaterializedIds.has(id)) {
                deferredPayloadUtf16Bytes += descriptors[id].payloadUtf16Bytes;
            }
        }
        observation = {
            operationOutputBirths: births.size,
            candidateMaterialized: materialized,
            goalMaterialized: intersectionStats(births, data.goalMaterializedIds, descriptors),
            admitted: intersectionStats(births, data.admittedIds, descriptors),
            finalRetained: intersectionStats(births, data.finalRetainedIds, descriptors),
            expanded: intersectionStats(births, data.expandedIds, descriptors),
            unmaterializedAtOriginalCap: { count: births.size - materialized.count,
                payloadUtf16Bytes: deferredPayloadUtf16Bytes },
            d024ShapeSlots: data.d024ShapeSlots,
            d024OverflowAttempts: data.d024OverflowAttempts,
            descriptorCount: descriptors.length,
            descriptorPayloadUtf16Bytes: data.descriptorPayloadUtf16Bytes,
            descriptorMetadataRows: descriptors.length,
            candidateMaterializations: data.candidateMaterializations,
            collectorLazyRejects: data.collectorLazyRejects,
            operationAttempts: data.operationAttempts,
        };
    }
    process.stdout.write(JSON.stringify({ mode, outcome: result.outcome,
        limitReason: result.limitReason ?? null, depth: result.depth,
        statesExplored: result.statesExplored, generatedStates: result.generatedStates,
        beamPruned: result.beamPruned, solutionSignature, wallMs,
        peakRssMiB: process.resourceUsage().maxRSS / 1024,
        observation }));
} catch (error) {
    process.stdout.write(JSON.stringify({ error: error?.stack ?? String(error) }));
    process.exitCode = 1;
}
