#!/usr/bin/env node
import process from 'node:process';

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => { input += chunk; });
process.stdin.on('end', async () => {
    try {
        const request = JSON.parse(input);
        const [{ unsupportedCrystalResourcePoolSolve }, { replaySolution }] = await Promise.all([
            import('../../unsupportedCrystalResourcePoolSolver.js'),
            import('../../tests/helpers/shapeSolverOracle.mjs'),
        ]);
        const result = await unsupportedCrystalResourcePoolSolve(request.input, request.configuration);
        const replay = Array.isArray(result.solutionPath)
            ? replaySolution(request.input, result.solutionPath, result) : null;
        const status = replay && !replay.valid
            ? 'INVALID_REPLAY'
            : Array.isArray(result.solutionPath)
                ? 'SOLVED'
                : ['unsupported-domain', 'unsupported-mixed-layout',
                    'unsupported-terminal-isolated-pin', 'unsupported-isolated-pin',
                    'unsupported-isolated-pin-layout', 'unsupported-crystal-layout']
                    .includes(result.architectureStatus)
                    ? 'UNSUPPORTED_DOMAIN'
                    : result.outcome === 'limit' ? 'LIMIT' : 'EXHAUSTED';
        process.stdout.write(`${JSON.stringify({
            status,
            solved: status === 'SOLVED',
            replayValid: replay?.valid ?? null,
            replayError: replay?.error ?? null,
            operationCount: result.solutionPath?.length ?? null,
            result,
        })}\n`);
    } catch (error) {
        process.stdout.write(`${JSON.stringify({
            status: 'ERROR', solved: false, replayValid: null, replayError: null,
            exception: error.stack ?? String(error),
        })}\n`);
    }
});


