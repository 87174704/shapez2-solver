#!/usr/bin/env node
import process from 'node:process';

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', async () => {
    try {
        globalThis.self = { postMessage() {} };
        const [{ shapeSolver }, { replaySolution }] = await Promise.all([
            import('../../shapeSolver.js'),
            import('../../tests/helpers/shapeSolverOracle.mjs'),
        ]);
        const request = JSON.parse(input);
        const instance = request.input;
        const result = await shapeSolver(
            instance.targetShapeCodes,
            instance.startingShapeCodes,
            instance.enabledOperations,
            instance.maxLayers,
            instance.maxStatesPerLevel,
            instance.preventWaste,
            instance.orientationSensitive,
            instance.allowSplitting,
            instance.cleanPainting,
        );
        const replay = Array.isArray(result?.solutionPath)
            ? replaySolution(instance, result.solutionPath, result) : null;
        const status = replay && !replay.valid
            ? 'INVALID_REPLAY'
            : Array.isArray(result?.solutionPath)
                ? 'SOLVED'
                : result?.outcome === 'limit' ? 'LIMIT' : 'EXHAUSTED';
        process.stdout.write(`${JSON.stringify({
            status,
            solved: status === 'SOLVED',
            replayValid: replay?.valid ?? null,
            replayError: replay?.error ?? null,
            operationCount: result?.solutionPath?.length ?? null,
            solverRoute: result?.solverRoute ?? null,
            result,
        })}\n`);
    } catch (error) {
        process.stdout.write(`${JSON.stringify({
            status: 'ERROR', solved: false, replayValid: null, replayError: null,
            exception: error.stack ?? String(error),
        })}\n`);
    }
});
