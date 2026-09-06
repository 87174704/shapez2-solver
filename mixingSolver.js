import { COLOR_CODES, BASE_COLORS, MIX_COMBINATIONS } from './shapeConstants.js';

const SEARCH_INPUT_LIMIT = 20;
const MAX_SOLUTIONS = 40;
const DFS_TIME_LIMIT_MS = 2000;
const EXTRA_DEPTH_STEPS = 1;

const ALL_COLOR_CODES = Object.values(COLOR_CODES).map((code) => code.toUpperCase());

const COLOR_NAME_TO_CODE = Object.freeze(
    Object.fromEntries(
        Object.entries(COLOR_CODES).map(([name, code]) => [name.toLowerCase(), code.toUpperCase()])
    )
);

const MIX_PAIRS = ALL_COLOR_CODES.flatMap((a, index) =>
    ALL_COLOR_CODES.slice(index).map((b) => [a, b])
);

function zeroCounts() {
    return Object.fromEntries(ALL_COLOR_CODES.map((code) => [code, 0]));
}

function stateKey(state) {
    return ALL_COLOR_CODES.map((code) => state[code]).join(',');
}

function isGoal(state, want) {
    return ALL_COLOR_CODES.every((code) => state[code] >= want[code]);
}

function canMix(a, b, state) {
    if (a === b) return a === 'W' && state[a] >= 2;
    return state[a] > 0 && state[b] > 0;
}

function applyMix(state, a, b) {
    const next = { ...state };
    next[a] -= 1;
    next[b] -= 1;
    next[MIX_COMBINATIONS[a][b]] += 2;
    return next;
}

function findShortestSolution(have, want) {
    const queue = [{ state: { ...have }, steps: [] }];
    const visited = new Set();
    let head = 0;

    while (head < queue.length) {
        const { state, steps } = queue[head++];

        if (isGoal(state, want)) return steps;

        const key = stateKey(state);
        if (visited.has(key)) continue;
        visited.add(key);

        for (const [a, b] of MIX_PAIRS) {
            if (!canMix(a, b, state)) continue;
            queue.push({
                state: applyMix(state, a, b),
                steps: [...steps, { c1: a, c2: b, mixed: MIX_COMBINATIONS[a][b] }],
            });
        }
    }

    return null;
}

function findAllSolutions(have, want, maxSolutions = MAX_SOLUTIONS) {
    const shortest = findShortestSolution(have, want);
    if (!shortest) return [];

    const depthLimit = shortest.length + EXTRA_DEPTH_STEPS;
    const deadline = Date.now() + DFS_TIME_LIMIT_MS;
    const solutions = [];
    const seenKeys = new Set();

    function dfs(state, steps) {
        if (solutions.length >= maxSolutions || Date.now() > deadline) return;

        if (isGoal(state, want)) {
            const key = steps.map(({ c1, c2, mixed }) => `${c1}${c2}${mixed}`).sort().join('|');
            if (!seenKeys.has(key)) {
                seenKeys.add(key);
                solutions.push([...steps]);
            }
            return;
        }

        if (steps.length >= depthLimit) return;

        for (const [a, b] of MIX_PAIRS) {
            if (!canMix(a, b, state)) continue;
            const mixed = MIX_COMBINATIONS[a][b];
            steps.push({ c1: a, c2: b, mixed });
            dfs(applyMix(state, a, b), steps);
            steps.pop();
        }
    }

    dfs({ ...have }, []);
    solutions.sort((a, b) => a.length - b.length);
    return solutions;
}

function generateRgbCombinations(total) {
    const results = [];

    function distribute(position, remaining, current) {
        if (position === BASE_COLORS.length - 1) {
            results.push([...current, remaining]);
            return;
        }

        for (let amount = remaining; amount >= 0; amount--) {
            current.push(amount);
            distribute(position + 1, remaining - amount, current);
            current.pop();
        }
    }

    distribute(0, total, []);
    return results;
}

function countsFromCombo(combo) {
    const counts = zeroCounts();
    BASE_COLORS.forEach((color, index) => { counts[color] = combo[index]; });
    return counts;
}

export function readColorCounts(inputClass) {
    const counts = zeroCounts();

    document.querySelectorAll('.mix-color-row').forEach((row) => {
        const code = COLOR_NAME_TO_CODE[row.dataset.color];
        if (!code) return;
        counts[code] = Math.max(0, Number.parseInt(row.querySelector(`.${inputClass}`)?.value, 10) || 0);
    });

    return counts;
}

function solveManual(have, want, setStatus) {
    setStatus('mix.status.solving', {}, 'running');

    const solutions = findAllSolutions(have, want);
    if (!solutions.length) {
        setStatus('mix.status.noManualSolution', {}, 'error');
        return { errorKey: 'mix.alert.noManualSolution' };
    }

    solutions.forEach((steps) => { steps.have = { ...have }; });
    setStatus('mix.status.solved', { solutionCount: solutions.length }, 'done');
    return { solutions, have };
}

function solveOptimized(want, setStatus) {
    const minInputs = Math.max(Object.values(want).reduce((sum, count) => sum + count, 0), 1);
    let totalInputs = minInputs;

    setStatus('mix.status.optimizing', {}, 'running');

    while (totalInputs <= SEARCH_INPUT_LIMIT) {
        setStatus('mix.status.optimizingTryingInputs', { inputCount: totalInputs }, 'running');

        const allSolutions = [];

        for (const combo of generateRgbCombinations(totalInputs)) {
            const inputCounts = countsFromCombo(combo);
            const solutions = findAllSolutions(inputCounts, want);
            solutions.forEach((steps) => { steps.have = { ...inputCounts }; });
            allSolutions.push(...solutions);
        }

        if (allSolutions.length) {
            allSolutions.sort((a, b) => a.length - b.length);
            setStatus('mix.status.optimized', {
                solutionCount: allSolutions.length,
                inputCount: totalInputs,
            }, 'done');
            return { solutions: allSolutions, have: null };
        }

        totalInputs++;
    }

    setStatus('mix.status.noSolutionWithinLimit', {}, 'error');
    return { errorKey: 'mix.alert.noSolutionWithinLimit' };
}

export function solveMixAll(have, want, manualInputs, setStatus = () => {}) {
    return manualInputs
        ? solveManual(have, want, setStatus)
        : solveOptimized(want, setStatus);
}

let cancelled = false;

self.onmessage = ({ data: { action, data } }) => {
    if (action === 'cancel') {
        cancelled = true;
        return;
    }

    if (action !== 'solve') return;

    cancelled = false;
    const { have, want, manualInputs } = data;

    const setStatus = (messageKey, messageParams = {}, status = 'running') => {
        if (cancelled) return;
        self.postMessage({ type: 'status', messageKey, messageParams, status });
    };

    const result = solveMixAll(have, want, manualInputs, setStatus);
    if (!cancelled) self.postMessage({ type: 'result', result });
};
