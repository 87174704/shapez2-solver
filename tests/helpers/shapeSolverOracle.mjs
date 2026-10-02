import {
    Shape, ShapeOperationConfig, InvalidOperationInputs,
    cut, halfCut, rotate90CW, rotate90CCW, rotate180, swapHalves, stack,
    topPaint, pushPin, genCrystal,
} from '../../shapeOperations.js';
import { COLOR_CODES, UNCOLORED_CODE, UNPAINTABLE_PARTS } from '../../shapeConstants.js';

export const Q = 4096;
export const DEFAULT_LIMITS = Object.freeze({ maxStates: 20_000, maxTransitions: 200_000 });

const OPERATIONS = Object.freeze({
    'Rotator CW': { fn: rotate90CW, inputCount: 1 },
    'Rotator CCW': { fn: rotate90CCW, inputCount: 1 },
    'Rotator 180': { fn: rotate180, inputCount: 1 },
    'Half Destroyer': { fn: halfCut, inputCount: 1 },
    Cutter: { fn: cut, inputCount: 1 },
    Swapper: { fn: swapHalves, inputCount: 2, commutative: true },
    Stacker: { fn: stack, inputCount: 2 },
});

const VALID_COLORS = new Set(Object.values(COLOR_CODES));
const REPLAY_OPERATIONS = Object.freeze({
    ...OPERATIONS,
    Painter: { fn: topPaint, inputCount: 1, needsColor: true },
    'Pin Pusher': { fn: pushPin, inputCount: 1 },
    'Crystal Generator': { fn: genCrystal, inputCount: 1, needsColor: true },
});

function tokenKey(shape, units) {
    return `${shape}\u0000${units}`;
}

function parseToken(key) {
    const delimiter = key.lastIndexOf('\u0000');
    return { shape: key.slice(0, delimiter), units: Number(key.slice(delimiter + 1)) };
}

function cloneState(state) {
    return new Map(state);
}

function adjust(state, token, delta) {
    const count = (state.get(token) ?? 0) + delta;
    if (count <= 0) state.delete(token);
    else state.set(token, count);
}

export function stateFromTokens(tokens) {
    const state = new Map();
    for (const { shape, units = Q, count = 1 } of tokens) {
        if (!Number.isInteger(units) || units < 1 || !Number.isInteger(count) || count < 1) {
            throw new Error('Oracle tokens require positive integer units and counts');
        }
        adjust(state, tokenKey(shape, units), count);
    }
    return state;
}

export function canonicalState(state) {
    return [...state]
        .map(([key, count]) => ({ ...parseToken(key), count }))
        .sort((a, b) => a.shape.localeCompare(b.shape) || a.units - b.units || a.count - b.count)
        .map(({ shape, units, count }) => `${shape}@${units}#${count}`)
        .join('|');
}

function groupsFor(state) {
    return [...state]
        .map(([key, count]) => ({ key, count, ...parseToken(key) }))
        .sort((a, b) => a.shape.localeCompare(b.shape) || a.units - b.units);
}

function acceptableSets(problem) {
    const config = new ShapeOperationConfig(problem.maxLayers ?? 2);
    return problem.targetShapeCodes.map(target => {
        if (problem.orientationSensitive !== false) return new Set([target]);
        const rotations = new Set();
        let shape = Shape.fromShapeCode(target);
        for (let index = 0; index < shape.numParts; index += 1) {
            rotations.add(shape.toShapeCode());
            shape = rotate90CW(shape, config)[0];
        }
        return rotations;
    });
}

// This allocation is intentionally independent from the solver's token/goal loop.
// It is the bounded parity allocator for this oracle's equal or disjoint rotation
// orbits; it does not claim completeness for arbitrary overlapping acceptable sets.
export function allocateGoal(state, problem) {
    const sets = acceptableSets(problem);
    const supply = new Map();
    for (const [key, count] of state) {
        const { shape, units } = parseToken(key);
        supply.set(shape, (supply.get(shape) ?? 0) + units * count);
    }
    const ordered = sets
        .map((set, index) => ({ set, index }))
        .sort((a, b) => a.set.size - b.set.size || a.index - b.index);
    const shapes = [...supply.keys()].sort();

    function assign(targetIndex, remaining) {
        if (targetIndex === ordered.length) return remaining;
        const choices = shapes.filter(shape => ordered[targetIndex].set.has(shape) && (remaining.get(shape) ?? 0) > 0);
        function take(choiceIndex, needed, next) {
            if (needed === 0) return assign(targetIndex + 1, next);
            for (let index = choiceIndex; index < choices.length; index += 1) {
                const shape = choices[index];
                const available = next.get(shape) ?? 0;
                if (available === 0) continue;
                const used = Math.min(available, needed);
                const after = new Map(next);
                after.set(shape, available - used);
                const result = take(index + 1, needed - used, after);
                if (result) return result;
            }
            return null;
        }
        return take(0, Q, remaining);
    }

    const remaining = assign(0, supply);
    if (!remaining) return { satisfied: false, remaining: supply, unacceptableWaste: 0, acceptableSurplus: 0 };
    const targetUniverse = new Set(sets.flatMap(set => [...set]));
    let unacceptableWaste = 0;
    let acceptableSurplus = 0;
    for (const [shape, units] of remaining) {
        if (targetUniverse.has(shape)) acceptableSurplus += units;
        else unacceptableWaste += units;
    }
    return {
        satisfied: !problem.preventWaste || unacceptableWaste === 0,
        remaining,
        unacceptableWaste,
        acceptableSurplus,
    };
}

export function enumerateActions(state, problem, restrictions = {}) {
    const config = new ShapeOperationConfig(problem.maxLayers ?? 2);
    const groups = groupsFor(state);
    const actions = [];
    const append = (operation, inputs, outputShapes) => {
        const outputUnits = operation === 'Splitter'
            ? inputs[0].units / 2
            : inputs.length === 2 ? Math.min(inputs[0].units, inputs[1].units) : inputs[0].units;
        const outputs = outputShapes.map(shape => ({ shape, units: outputUnits }));
        const next = cloneState(state);
        for (const input of inputs) adjust(next, input.key, -1);
        for (const output of outputs) adjust(next, tokenKey(output.shape, output.units), 1);
        actions.push({ operation, inputs: inputs.map(({ shape, units }) => ({ shape, units })), outputs, next });
    };

    if (problem.allowSplitting) {
        for (const group of groups) {
            if (restrictions.noNestedSplitting && group.units < Q) continue;
            if (group.units >= 2) append('Splitter', [group], [group.shape, group.shape]);
        }
    }

    for (const operation of problem.enabledOperations ?? []) {
        const definition = OPERATIONS[operation];
        if (!definition) continue;
        if (definition.inputCount === 1) {
            for (const group of groups) {
                let outputs;
                try {
                    outputs = definition.fn(Shape.fromShapeCode(group.shape), config)
                        .filter(shape => !shape.isEmpty())
                        .map(shape => shape.toShapeCode());
                } catch (error) {
                    if (error instanceof InvalidOperationInputs) continue;
                    throw error;
                }
                if (outputs.length === 0 && !problem.preventWaste) continue;
                if (outputs.length === 1 && outputs[0] === group.shape) continue;
                append(operation, [group], outputs);
            }
        } else {
            for (let a = 0; a < groups.length; a += 1) {
                const start = definition.commutative ? a : 0;
                for (let b = start; b < groups.length; b += 1) {
                    const inputA = groups[a];
                    const inputB = groups[b];
                    if (a === b && inputA.count < 2) continue;
                    let outputs;
                    try {
                        outputs = definition.fn(Shape.fromShapeCode(inputA.shape), Shape.fromShapeCode(inputB.shape), config)
                            .filter(shape => !shape.isEmpty())
                            .map(shape => shape.toShapeCode());
                    } catch (error) {
                        if (error instanceof InvalidOperationInputs) continue;
                        throw error;
                    }
                    if (outputs.length === 0 && !problem.preventWaste) continue;
                    append(operation, [inputA, inputB], outputs);
                }
            }
        }
    }
    return actions;
}

export function referenceSolve(problem, limits = DEFAULT_LIMITS) {
    const initial = stateFromTokens((problem.startingShapeCodes ?? []).map(shape => ({ shape })));
    const maxDepth = problem.maxDepth ?? 5;
    const maxSplitterSteps = problem.maxSplitterSteps;
    const noNestedSplitting = problem.noNestedSplitting === true;
    if (maxSplitterSteps !== undefined && (!Number.isInteger(maxSplitterSteps) || maxSplitterSteps < 0)) {
        throw new Error('maxSplitterSteps must be a non-negative integer');
    }
    let frontier = [{ state: initial, path: [], splitterSteps: 0 }];
    const visitedKey = (state, splitterSteps) => maxSplitterSteps === undefined
        ? canonicalState(state)
        : `${canonicalState(state)}|splitterSteps=${splitterSteps}`;
    const visited = new Set([visitedKey(initial, 0)]);
    let generatedTransitions = 0;
    let maxLayerWidth = frontier.length;

    for (let depth = 0; depth <= maxDepth; depth += 1) {
        for (const entry of frontier) {
            if (allocateGoal(entry.state, problem).satisfied) {
                return { kind: 'found', depth, path: entry.path, states: visited.size, generatedTransitions, maxLayerWidth };
            }
        }
        if (depth === maxDepth) {
            return { kind: 'not-found-within-depth', depth, states: visited.size, generatedTransitions, maxLayerWidth };
        }
        const next = [];
        for (const entry of frontier) {
            for (const action of enumerateActions(entry.state, problem, { noNestedSplitting })) {
                const nextSplitterSteps = entry.splitterSteps + Number(action.operation === 'Splitter');
                if (maxSplitterSteps !== undefined && nextSplitterSteps > maxSplitterSteps) continue;
                if (generatedTransitions >= limits.maxTransitions) {
                    const generatedGoal = next.find(candidate => allocateGoal(candidate.state, problem).satisfied);
                    if (generatedGoal) {
                        return {
                            kind: 'found', depth: depth + 1, path: generatedGoal.path, states: visited.size,
                            generatedTransitions, maxLayerWidth: Math.max(maxLayerWidth, next.length),
                        };
                    }
                    return { kind: 'oracle-limit', limit: 'transitions', states: visited.size, generatedTransitions, maxLayerWidth };
                }
                generatedTransitions += 1;
                const key = visitedKey(action.next, nextSplitterSteps);
                if (visited.has(key)) continue;
                if (visited.size >= limits.maxStates) {
                    return { kind: 'oracle-limit', limit: 'states', states: visited.size, generatedTransitions, maxLayerWidth };
                }
                visited.add(key);
                next.push({ state: action.next, path: [...entry.path, action], splitterSteps: nextSplitterSteps });
            }
        }
        if (next.length === 0) {
            return { kind: 'exhausted-no-solution', depth, states: visited.size, generatedTransitions, maxLayerWidth };
        }
        frontier = next;
        maxLayerWidth = Math.max(maxLayerWidth, frontier.length);
    }
    throw new Error('Unreachable oracle loop exit');
}

function validateStepParams(operation, params, inputs, cleanPainting) {
    const definition = REPLAY_OPERATIONS[operation];
    if (!definition) throw new Error(`Operation '${operation}' is not replayable`);
    if (params !== undefined && (params === null || typeof params !== 'object' || Array.isArray(params))) {
        throw new Error(`${operation} params must be an object`);
    }
    const keys = params === undefined ? [] : Reflect.ownKeys(params);
    if (definition.needsColor) {
        if (keys.length !== 1 || keys[0] !== 'color' || !VALID_COLORS.has(params.color)) {
            throw new Error(`${operation} requires exactly one valid color parameter`);
        }
    } else if (keys.length !== 0) {
        throw new Error(`${operation} does not accept parameters`);
    }
    if (cleanPainting && operation === 'Painter') {
        const shape = Shape.fromShapeCode(inputs[0].shape);
        if (shape.layers.length !== 1 || !shape.layers[0].every(part =>
            UNPAINTABLE_PARTS.includes(part.shape) || part.color === UNCOLORED_CODE
        )) {
            throw new Error('Painter input violates cleanPainting');
        }
    }
}

function physicalOutputs(operation, inputs, maxLayers, params) {
    const definition = REPLAY_OPERATIONS[operation];
    if (!definition) throw new Error(`Operation '${operation}' is not replayable`);
    if (inputs.length !== definition.inputCount) throw new Error(`${operation} needs ${definition.inputCount} inputs`);
    try {
        const shapes = inputs.map(input => Shape.fromShapeCode(input.shape));
        const args = definition.needsColor
            ? [...shapes, params.color, new ShapeOperationConfig(maxLayers ?? 2)]
            : [...shapes, new ShapeOperationConfig(maxLayers ?? 2)];
        return definition.fn(...args)
            .filter(shape => !shape.isEmpty())
            .map(shape => shape.toShapeCode());
    } catch (error) {
        if (error instanceof InvalidOperationInputs) throw new Error(`${operation} has invalid inputs`);
        throw error;
    }
}

export function replaySolution(problem, solutionPath, result = null) {
    if (!Array.isArray(solutionPath)) return { valid: false, error: 'solutionPath must be an array' };
    if (result && result.depth !== solutionPath.length) return { valid: false, error: 'result depth differs from path length' };
    const live = new Map();
    const usedIds = new Set();
    for (const [id, shape] of (problem.startingShapeCodes ?? []).entries()) {
        live.set(id, { shape, units: Q });
        usedIds.add(id);
    }
    const diagnostics = { splitterSteps: 0, minimumUnits: Q, implicitBinaryDiscardUnits: 0, emptyOutputConsumedUnits: 0 };
    for (const [stepIndex, step] of solutionPath.entries()) {
        try {
            if (!step || !Array.isArray(step.inputs) || !Array.isArray(step.outputs)) throw new Error('malformed step');
            const inputIds = new Set();
            const inputs = step.inputs.map(input => {
                if (!Number.isInteger(input.id) || inputIds.has(input.id)) throw new Error('input consumed twice');
                inputIds.add(input.id);
                const liveToken = live.get(input.id);
                if (!liveToken) throw new Error(`input ${input.id} is not live`);
                if (input.shape !== liveToken.shape) throw new Error(`input ${input.id} shape mismatch`);
                return liveToken;
            });
            let expected;
            let outputUnits;
            if (step.operation === 'Splitter') {
                if (!problem.allowSplitting || inputs.length !== 1 || inputs[0].units < 2) throw new Error('illegal splitter');
                if (step.params !== undefined && (step.params === null || typeof step.params !== 'object' || Array.isArray(step.params) || Reflect.ownKeys(step.params).length !== 0)) {
                    throw new Error('Splitter does not accept parameters');
                }
                expected = [inputs[0].shape, inputs[0].shape];
                outputUnits = inputs[0].units / 2;
                diagnostics.splitterSteps += 1;
            } else {
                if (!(problem.enabledOperations ?? []).includes(step.operation)) throw new Error(`disabled operation ${step.operation}`);
                validateStepParams(step.operation, step.params, inputs, problem.cleanPainting === true);
                expected = physicalOutputs(step.operation, inputs, problem.maxLayers, step.params);
                outputUnits = inputs.length === 2 ? Math.min(inputs[0].units, inputs[1].units) : inputs[0].units;
                // Parity semantics discard only the throughput surplus of the larger
                // binary input. A normal equal-throughput 2-to-1 Stacker is not loss.
                if (inputs.length === 2) diagnostics.implicitBinaryDiscardUnits += Math.abs(inputs[0].units - inputs[1].units);
            }
            const outputShapesMatch = step.operation === 'Swapper'
                ? expected.length === step.outputs.length && expected.every(shape => {
                    const expectedCount = expected.filter(candidate => candidate === shape).length;
                    const declaredCount = step.outputs.filter(output => output?.shape === shape).length;
                    return expectedCount === declaredCount;
                })
                : expected.length === step.outputs.length && expected.every((shape, index) => step.outputs[index]?.shape === shape);
            if (!outputShapesMatch) {
                throw new Error('output shapes or order mismatch');
            }
            if (expected.length === 0) diagnostics.emptyOutputConsumedUnits += inputs.reduce((total, input) => total + input.units, 0);
            for (const input of step.inputs) live.delete(input.id);
            for (const output of step.outputs) {
                if (!Number.isInteger(output.id) || usedIds.has(output.id) || live.has(output.id)) throw new Error(`output ${output.id} is not a new id`);
                usedIds.add(output.id);
                live.set(output.id, { shape: output.shape, units: outputUnits });
                diagnostics.minimumUnits = Math.min(diagnostics.minimumUnits, outputUnits);
            }
        } catch (error) {
            return { valid: false, error: `step ${stepIndex}: ${error.message}`, diagnostics };
        }
    }
    const terminal = stateFromTokens([...live.values()].map(token => ({ ...token })));
    const goal = allocateGoal(terminal, problem);
    return {
        valid: goal.satisfied,
        error: goal.satisfied ? null : 'terminal goal not satisfied',
        diagnostics: { ...diagnostics, unacceptableTerminalWaste: goal.unacceptableWaste, acceptableTerminalSurplus: goal.acceptableSurplus },
        terminal,
    };
}

export function compareWithOracle(problem, productionResult, referenceResult) {
    if (referenceResult.kind === 'oracle-limit') return { classification: 'oracle-limit' };
    if (productionResult?.limitReached) return { classification: 'production-limit' };
    if (productionResult?.solutionPath) {
        const replay = replaySolution(problem, productionResult.solutionPath, productionResult);
        if (!replay.valid) return { classification: 'invalid-solution', replay };
        if (referenceResult.kind === 'found') {
            const depthGap = productionResult.depth - referenceResult.depth;
            if (depthGap < 0) return { classification: 'oracle-semantic-mismatch', replay, depthGap };
            return { classification: depthGap === 0 ? 'optimal-within-domain' : 'solved-suboptimal', replay, depthGap };
        }
        return { classification: 'production-solved-reference-missed', replay };
    }
    if (referenceResult.kind === 'found') return { classification: 'false-negative-within-domain' };
    return { classification: 'both-unsolved' };
}
