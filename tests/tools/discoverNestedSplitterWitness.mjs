// P5-07 bounded, deterministic discovery only. This is deliberately not a
// regression test: any positive result must be copied into a fixed fixture.
import { fork } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

const MAX_WALL_MS = 10_000;
const IS_DISCOVERY_CHILD = process.argv.includes('--discovery-child');

if (!IS_DISCOVERY_CHILD) {
    const child = fork(fileURLToPath(import.meta.url), ['--discovery-child'], { silent: true });
    let stdout = '';
    let stderr = '';
    let latestProgress = null;
    let timedOut = false;
    child.stdout.on('data', chunk => { stdout += chunk; });
    child.stderr.on('data', chunk => { stderr += chunk; });
    child.on('message', message => {
        if (message?.type === 'progress') latestProgress = message.progress;
    });
    const timer = setTimeout(() => {
        timedOut = true;
        child.kill();
    }, MAX_WALL_MS);
    const exitCode = await new Promise(resolve => child.on('close', resolve));
    clearTimeout(timer);
    if (stdout.trim()) {
        process.stdout.write(stdout);
    } else if (timedOut) {
        console.log(JSON.stringify({
            status: 'watchdog-timeout',
            elapsedMs: MAX_WALL_MS,
            latestProgress,
        }));
    }
    if (stderr) process.stderr.write(stderr);
    if (!timedOut && exitCode !== 0) process.exitCode = exitCode ?? 1;
} else {

globalThis.self = { postMessage() {} };

const { shapeSolverTestOnly } = await import('../../shapeSolver.js');
const {
    Q, canonicalState, enumerateActions, referenceSolve, replaySolution, stateFromTokens,
} = await import('../helpers/shapeSolverOracle.mjs');

const PER_ORACLE_LIMITS = Object.freeze({ maxStates: 20_000, maxTransitions: 200_000 });
const MAX_DEPTH = 7;
const MAX_TOTAL_TRANSITIONS = 1_000_000;
const CAPS = [1, 2, 3, 5, 8, 13];
const OPERATION_SETS = [
    ['Rotator CW', 'Swapper'],
    ['Rotator CW', 'Swapper', 'Rotator 180'],
    ['Rotator CW', 'Swapper', 'Rotator 180', 'Cutter'],
    ['Rotator CW', 'Swapper', 'Rotator 180', 'Cutter', 'Stacker'],
];
const STARTING_INVENTORIES = [
    ['----RuCu'],
    ['CuCuCuCu'],
    ['CuRu----'],
    ['RuRuRuRu'],
    ['----RuCu', 'CuRu----'],
    ['CuCuCuCu', 'RuRuRuRu'],
    ['CuRuCuRu'],
].sort((a, b) => a.join('|').localeCompare(b.join('|')));

const startedAt = performance.now();
let totalTransitions = 0;
const coverage = {
    completedOperationSets: [],
    currentOperationSet: null,
    completedStartingInventories: [],
};

function sendProgress() {
    process.send?.({
        type: 'progress',
        progress: {
            totalTransitions,
            elapsedMs: performance.now() - startedAt,
            coverage,
        },
    });
}

function exhaustedBudget() {
    return totalTransitions >= MAX_TOTAL_TRANSITIONS || performance.now() - startedAt >= MAX_WALL_MS;
}

function baseProblem(startingShapeCodes, enabledOperations, targetShapeCodes) {
    return {
        targetShapeCodes,
        startingShapeCodes,
        enabledOperations,
        maxLayers: 2,
        maxDepth: MAX_DEPTH,
        preventWaste: false,
        orientationSensitive: true,
        allowSplitting: true,
    };
}

function reachableTargetShapes(state) {
    const supply = new Map();
    for (const [key, count] of state) {
        const split = key.lastIndexOf('\u0000');
        const shape = key.slice(0, split);
        const units = Number(key.slice(split + 1));
        supply.set(shape, (supply.get(shape) ?? 0) + units * count);
    }
    return [...supply]
        .filter(([, units]) => units >= Q)
        .map(([shape]) => shape)
        .sort();
}

function hasRetainedDivergence(on, off) {
    const byDepth = new Map(off.diagnostics.retainedSemanticKeysByDepth.map(layer => [layer.depth, layer.keys]));
    return on.diagnostics.retainedSemanticKeysByDepth.some(layer => {
        const other = byDepth.get(layer.depth);
        return other && JSON.stringify(layer.keys) !== JSON.stringify(other);
    });
}

function runReference(problem) {
    const remaining = MAX_TOTAL_TRANSITIONS - totalTransitions;
    if (remaining <= 0) {
        return { kind: 'oracle-limit', limit: 'global-transitions', generatedTransitions: 0 };
    }
    const result = referenceSolve(problem, {
        ...PER_ORACLE_LIMITS,
        maxTransitions: Math.min(PER_ORACLE_LIMITS.maxTransitions, remaining),
    });
    totalTransitions += result.generatedTransitions;
    return result;
}

async function tryCandidate(problem) {
    const unrestricted = runReference(problem);
    if (unrestricted.kind !== 'found' || unrestricted.path.filter(step => step.operation === 'Splitter').length < 2) return null;
    if (!unrestricted.path.some(step => step.outputs.some(output => output.units <= Q / 4))) return null;
    if (exhaustedBudget()) return null;

    const noNested = runReference({ ...problem, noNestedSplitting: true });
    if (exhaustedBudget()) return null;
    const maxOne = runReference({ ...problem, maxSplitterSteps: 1 });
    if (exhaustedBudget()) return null;
    const noSplit = runReference({ ...problem, allowSplitting: false });
    if ([noNested, maxOne, noSplit].some(result => result.kind !== 'exhausted-no-solution')) return null;

    for (const cap of CAPS) {
        if (exhaustedBudget()) return null;
        const instance = { ...problem, maxStatesPerLevel: cap };
        const on = await shapeSolverTestOnly(instance, { useCoarseness: true, diagnostics: true });
        const off = await shapeSolverTestOnly(instance, { useCoarseness: false, diagnostics: true });
        const pruned = on.diagnostics.uniqueBeamRejected + on.diagnostics.uniqueBeamEvicted
            + off.diagnostics.uniqueBeamRejected + off.diagnostics.uniqueBeamEvicted > 0;
        if (pruned && hasRetainedDivergence(on, off)) {
            const onReplay = Array.isArray(on.solutionPath) ? replaySolution(problem, on.solutionPath, on) : null;
            const offReplay = Array.isArray(off.solutionPath) ? replaySolution(problem, off.solutionPath, off) : null;
            if (onReplay?.valid === false || offReplay?.valid === false) {
                throw new Error(`Discovery produced an invalid path: ${JSON.stringify({ onReplay, offReplay })}`);
            }
            return { cap, problem, unrestricted, noNested, maxOne, noSplit, on, off, onReplay, offReplay };
        }
    }
    return null;
}

for (const enabledOperations of OPERATION_SETS) {
    coverage.currentOperationSet = enabledOperations.join('+');
    coverage.completedStartingInventories = [];
    for (const startingShapeCodes of STARTING_INVENTORIES) {
        sendProgress();
        if (exhaustedBudget()) break;
        const seed = baseProblem(startingShapeCodes, enabledOperations, []);
        const initial = stateFromTokens(startingShapeCodes.map(shape => ({ shape })));
        let frontier = [initial];
        const visited = new Set([canonicalState(initial)]);
        const targetCandidates = new Set();
        let forwardTransitions = 0;
        for (let depth = 0; depth <= MAX_DEPTH && !exhaustedBudget(); depth += 1) {
            const next = [];
            for (const state of frontier) {
                for (const target of reachableTargetShapes(state)) {
                    targetCandidates.add(target);
                }
                if (exhaustedBudget() || depth === MAX_DEPTH || forwardTransitions >= PER_ORACLE_LIMITS.maxTransitions) continue;
                for (const action of enumerateActions(state, seed)) {
                    totalTransitions += 1;
                    forwardTransitions += 1;
                    if (exhaustedBudget() || forwardTransitions >= PER_ORACLE_LIMITS.maxTransitions) break;
                    const key = canonicalState(action.next);
                    if (!visited.has(key) && visited.size < PER_ORACLE_LIMITS.maxStates) {
                        visited.add(key);
                        next.push(action.next);
                    }
                }
            }
            frontier = next;
        }
        for (const target of [...targetCandidates].sort()) {
            if (exhaustedBudget()) break;
            const candidate = baseProblem(startingShapeCodes, enabledOperations, [target]);
            const witness = await tryCandidate(candidate);
            if (witness) {
                console.log(JSON.stringify({ status: 'found', totalTransitions, elapsedMs: performance.now() - startedAt, coverage, witness }));
                process.exit(0);
            }
        }
        if (!exhaustedBudget()) coverage.completedStartingInventories.push(startingShapeCodes.join('|'));
    }
    if (!exhaustedBudget()) coverage.completedOperationSets.push(enabledOperations.join('+'));
    if (exhaustedBudget()) break;
}

console.log(JSON.stringify({
    status: 'inconclusive-no-witness-within-fixed-budget',
    totalTransitions,
    elapsedMs: performance.now() - startedAt,
    coverage,
    limits: { maxDepth: MAX_DEPTH, perOracle: PER_ORACLE_LIMITS, maxTransitions: MAX_TOTAL_TRANSITIONS, maxWallMs: MAX_WALL_MS },
}));
}
