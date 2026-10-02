import process from 'node:process';

async function main() {
    let text = '';
    for await (const chunk of process.stdin) text += chunk;
    const request = JSON.parse(text);
    const [{ targetConditionedSolve }, { replaySolution }] = await Promise.all([
        import('../../targetConditionedSolver.js'),
        import('../../tests/helpers/shapeSolverOracle.mjs'),
    ]);
    const result = await targetConditionedSolve(request.input, request.configuration);
    const replay = Array.isArray(result.solutionPath)
        ? replaySolution(request.input, result.solutionPath, result)
        : null;
    const status = replay && !replay.valid
        ? 'ERROR'
        : result.outcome === 'solved'
            ? 'SOLVED'
            : result.architectureStatus === 'unsupported-domain'
                ? 'UNSUPPORTED_DOMAIN'
                : result.outcome === 'limit'
                    ? 'LIMIT'
                    : 'EXHAUSTED';
    process.stdout.write(JSON.stringify({
        status,
        solved: status === 'SOLVED',
        replayValid: replay?.valid ?? null,
        replayError: replay?.error ?? null,
        operationCount: result.solutionPath?.length ?? null,
        result,
    }));
}

try {
    await main();
} catch (error) {
    process.stdout.write(JSON.stringify({
        status: 'ERROR',
        solved: false,
        replayValid: null,
        replayError: null,
        exception: error?.stack ?? String(error),
    }));
}
