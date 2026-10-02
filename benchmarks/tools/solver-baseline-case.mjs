// One instance per fresh Node process. No production Solver code is patched.
import process from 'node:process';
import { classifyResult } from './solver-baseline-core.mjs';

function finite(value) { return Number.isFinite(value) ? value : null; }

let latestProgress = null;
let sampledFrontierPeak = null;
globalThis.self = {
    postMessage(message) {
        if (message?.type !== 'status' || !message.messageParams) return;
        const params = message.messageParams;
        latestProgress = {
            depth: finite(params.depth), statesExplored: finite(params.totalStates),
            candidatesGenerated: finite(params.generatedStates), frontierSize: finite(params.queueLength),
            internedShapes: finite(params.internedShapes), beamPruned: params.beamPruned === true,
            peakRssMiB: process.resourceUsage().maxRSS / 1024,
        };
        if (latestProgress.frontierSize !== null) sampledFrontierPeak = Math.max(sampledFrontierPeak ?? 0, latestProgress.frontierSize);
        if (typeof process.send === 'function') process.send({ type: 'progress', progress: latestProgress });
    },
};

async function main() {
    let text = '';
    for await (const chunk of process.stdin) text += chunk;
    const { input } = JSON.parse(text);
    const [{ shapeSolver }, { replaySolution }] = await Promise.all([
        import('../../shapeSolver.js'), import('../../tests/helpers/shapeSolverOracle.mjs'),
    ]);
    if (typeof global.gc === 'function') global.gc();
    const cpuStart = process.cpuUsage();
    const started = performance.now();
    const result = await shapeSolver(
        input.targetShapeCodes, input.startingShapeCodes, input.enabledOperations,
        input.maxLayers, input.maxStatesPerLevel, input.preventWaste,
        input.orientationSensitive, input.allowSplitting, input.cleanPainting,
    );
    const wallMs = performance.now() - started;
    const cpu = process.cpuUsage(cpuStart);
    const classified = classifyResult(result);
    const replay = Array.isArray(result?.solutionPath)
        ? replaySolution(input, result.solutionPath, result) : null;
    const status = replay && !replay.valid ? 'ERROR' : classified.status;
    const statesExplored = finite(result?.statesExplored);
    const candidatesGenerated = finite(result?.generatedStates);
    const depth = finite(result?.depth);
    const record = {
        status, solved: status === 'SOLVED',
        solverOutcome: result?.outcome ?? null,
        terminationReason: replay && !replay.valid ? 'invalid-solution-replay' : classified.terminationReason,
        limitReason: result?.limitReason ?? null,
        wallMs, cpuMs: (cpu.user + cpu.system) / 1000,
        cpuUserMs: cpu.user / 1000, cpuSystemMs: cpu.system / 1000,
        statesExplored, statesGenerated: null,
        statesRetained: null, sampledFrontierPeak,
        candidatesGenerated, candidatesEvaluated: null, candidatesPruned: null,
        maxSearchDepthReached: depth, searchIterations: null,
        peakRssMiB: process.resourceUsage().maxRSS / 1024,
        workerMemoryMiB: null,
        stateCapUsage: statesExplored === null ? null : statesExplored / 500000,
        candidateCapUsage: candidatesGenerated === null ? null : candidatesGenerated / 5000000,
        operationCount: replay ? result.solutionPath.length : null,
        solutionDepth: replay ? depth : null,
        replayValid: replay?.valid ?? null,
        targetVerified: replay?.valid ?? null,
        replayError: replay?.error ?? null,
        terminalSearchStage: depth,
        capHit: classified.status.endsWith('_CAP') ? result.limitReason : null,
        lastMeaningfulDepth: depth,
        lastFrontierSize: latestProgress?.frontierSize ?? null,
        dominantRejectionReason: null,
        beamPruned: result?.beamPruned ?? latestProgress?.beamPruned ?? null,
        exception: null,
        availability: {
            statesGenerated: 'unavailable: Solver reports accepted states and generated candidates only',
            statesRetained: 'unavailable: no final retained-state counter',
            sampledFrontierPeak: 'sampled progress; exact peak unavailable',
            candidatesEvaluated: 'unavailable: no distinct production counter',
            candidatesPruned: 'unavailable: production exposes only beamPruned boolean',
            searchIterations: 'unavailable: no production counter',
            peakRssMiB: 'fresh Node process high-water RSS including runtime overhead',
            workerMemoryMiB: 'unavailable: Node Worker memory is not separately measured',
            dominantRejectionReason: 'unavailable: no production rejection histogram',
        },
    };
    process.stdout.write(JSON.stringify(record));
}

try { await main(); }
catch (error) {
    process.stdout.write(JSON.stringify({
        status: 'ERROR', solved: false, terminationReason: 'worker-exception',
        exception: error?.stack ?? String(error), latestProgress,
    }));
}
