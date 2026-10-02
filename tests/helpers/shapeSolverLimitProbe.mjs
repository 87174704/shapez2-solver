globalThis.self = { postMessage() {} };

const { shapeSolverTestOnly } = await import('../../shapeSolver.js');

const depthTwoRotation = {
    targetShapeCodes: ['SuWuCuRu'],
    startingShapeCodes: ['CuRuSuWu'],
    enabledOperations: ['Rotator CW'],
    maxLayers: 4,
    maxStatesPerLevel: 10,
    preventWaste: false,
    orientationSensitive: true,
    allowSplitting: false,
    cleanPainting: false,
};

const incompatiblePair = {
    targetShapeCodes: ['RuRuRuRu'],
    startingShapeCodes: ['CuCuCuCu', 'HuHuHuHuHuHu'],
    enabledOperations: ['Swapper'],
    maxLayers: 4,
    maxStatesPerLevel: 10,
    preventWaste: false,
    orientationSensitive: true,
    allowSplitting: false,
    cleanPainting: false,
};

function summarize(result) {
    return {
        outcome: result.outcome,
        limitReached: result.limitReached ?? false,
        limitReason: result.limitReason ?? null,
        beamPruned: result.beamPruned,
        depth: result.depth,
        statesExplored: result.statesExplored,
        generatedStates: result.generatedStates,
        operations: result.solutionPath?.map(step => step.operation) ?? null,
        operationAttempts: result.diagnostics?.operationAttempts ?? null,
    };
}

async function solveDepthTwo(limits) {
    return summarize(await shapeSolverTestOnly(depthTwoRotation, { diagnostics: true, limits }));
}

function clockAtFirstOperation(elapsedMs) {
    let calls = 0;
    return () => calls++ < 3 ? 0 : elapsedMs;
}

async function solveInvalidPairAt(elapsedMs, operationTimeCheckInterval = 1) {
    return summarize(await shapeSolverTestOnly(incompatiblePair, {
        diagnostics: true,
        limits: { maxSearchTimeMs: 10, operationTimeCheckInterval },
        now: clockAtFirstOperation(elapsedMs),
    }));
}

async function captureError(options) {
    try {
        await shapeSolverTestOnly(depthTwoRotation, options);
        return null;
    } catch (error) {
        return error.message;
    }
}

const report = {
    generated: {
        before: await solveDepthTwo({ maxGeneratedStates: 1 }),
        equal: await solveDepthTwo({ maxGeneratedStates: 2 }),
        over: await solveDepthTwo({ maxGeneratedStates: 3 }),
    },
    visited: {
        before: await solveDepthTwo({ maxTotalStates: 1 }),
        equal: await solveDepthTwo({ maxTotalStates: 2 }),
        over: await solveDepthTwo({ maxTotalStates: 3 }),
    },
    shapes: {
        initializationOver: await solveDepthTwo({ maxInternedShapes: 1 }),
        before: await solveDepthTwo({ maxInternedShapes: 2 }),
        equal: await solveDepthTwo({ maxInternedShapes: 3 }),
        over: await solveDepthTwo({ maxInternedShapes: 4 }),
    },
    time: {
        before: await solveInvalidPairAt(9),
        equal: await solveInvalidPairAt(10),
        over: await solveInvalidPairAt(11),
        stateTailEqual: await solveInvalidPairAt(10, 2048),
    },
    validation: {
        zero: await captureError({ limits: { maxGeneratedStates: 0 } }),
        aboveDefault: await captureError({ limits: { maxGeneratedStates: 5000001 } }),
        unknown: await captureError({ limits: { candidateBudget: 1 } }),
        clock: await captureError({ now: 42 }),
    },
};

process.stdout.write(JSON.stringify(report));
