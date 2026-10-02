import {
    Shape, ShapeOperationConfig, InvalidOperationInputs,
    cut, halfCut, rotate90CW, rotate90CCW, rotate180, stack, topPaint,
} from './shapeOperations.js';
import { PART_CODES, UNCOLORED_CODE, UNPAINTABLE_PARTS } from './shapeConstants.js';

const ARCHITECTURE = 'goal-decomposed-constructive-synthesis-v1';
const CONFIG_KEYS = Object.freeze([
    'id', 'maxExtractionOperations', 'maxExtractionStates',
    'maxMatchingTransitions', 'maxOperations', 'maxWallMs',
]);
const EXTRACTION_OPERATIONS = Object.freeze([
    ['Cutter', cut],
    ['Half Destroyer', halfCut],
    ['Rotator CW', rotate90CW],
    ['Rotator CCW', rotate90CCW],
    ['Rotator 180', rotate180],
]);

function validateConfig(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Goal-decomposed configuration must be an object');
    }
    for (const key of Object.keys(value)) {
        if (!CONFIG_KEYS.includes(key)) throw new Error(`Unknown goal-decomposed configuration key: ${key}`);
    }
    if (typeof value.id !== 'string' || value.id.length === 0) {
        throw new Error('Goal-decomposed id must be a non-empty string');
    }
    for (const key of CONFIG_KEYS.filter(key => key !== 'id' && key !== 'maxWallMs')) {
        if (!Number.isInteger(value[key]) || value[key] < 1) {
            throw new Error(`Goal-decomposed ${key} must be a positive integer`);
        }
    }
    if (!Number.isFinite(value.maxWallMs) || value.maxWallMs <= 0) {
        throw new Error('Goal-decomposed maxWallMs must be positive and finite');
    }
    return Object.freeze({ ...value });
}

function occupiedCells(shape) {
    const cells = [];
    for (let layer = 0; layer < shape.layers.length; layer += 1) {
        for (let quadrant = 0; quadrant < shape.layers[layer].length; quadrant += 1) {
            const part = shape.layers[layer][quadrant];
            if (part.shape !== PART_CODES.NOTHING) cells.push({ layer, quadrant, part });
        }
    }
    return cells;
}

function isOrdinaryTarget(shape) {
    return occupiedCells(shape).every(({ part }) => (
        part.shape !== PART_CODES.PIN && part.shape !== PART_CODES.CRYSTAL
    ));
}

function canFinishCell(part, targetPart) {
    if (part.shape !== targetPart.shape) return false;
    if (UNPAINTABLE_PARTS.includes(part.shape)) return part.color === targetPart.color;
    if (targetPart.color === UNCOLORED_CODE) return part.color === UNCOLORED_CODE;
    return true;
}

function physicalUnary(fn, code, config) {
    try {
        return fn(Shape.fromShapeCode(code), config)
            .filter(shape => !shape.isEmpty())
            .map(shape => shape.toShapeCode());
    } catch (error) {
        if (error instanceof InvalidOperationInputs) return [];
        throw error;
    }
}

function findExtractionRecipe(sourceCode, targetPart, enabled, config, limits, counters, timedOut) {
    const queue = [{ code: sourceCode, steps: [] }];
    const visited = new Set([sourceCode]);
    let cursor = 0;
    while (cursor < queue.length) {
        if (timedOut()) return { limitReason: 'time' };
        if (counters.extractionStates >= limits.maxExtractionStates) {
            return { limitReason: 'extraction-states' };
        }
        const current = queue[cursor++];
        counters.extractionStates += 1;
        const shape = Shape.fromShapeCode(current.code);
        const cells = occupiedCells(shape);
        if (cells.length === 1 && canFinishCell(cells[0].part, targetPart)) {
            return { code: current.code, steps: current.steps };
        }
        if (current.steps.length >= limits.maxExtractionOperations) continue;
        for (const [operation, fn] of EXTRACTION_OPERATIONS) {
            if (!enabled.has(operation)) continue;
            const outputs = physicalUnary(fn, current.code, config);
            for (let selectedOutput = 0; selectedOutput < outputs.length; selectedOutput += 1) {
                const code = outputs[selectedOutput];
                if (code === current.code || visited.has(code)) continue;
                visited.add(code);
                queue.push({
                    code,
                    steps: [...current.steps, {
                        operation,
                        inputCode: current.code,
                        outputCodes: outputs,
                        selectedOutput,
                    }],
                });
            }
        }
    }
    return null;
}

function operationNode(operation, inputs, inputCodes, outputCodes, selectedOutput = 0, color = null) {
    return Object.freeze({
        kind: 'operation', operation, inputs, inputCodes, outputCodes, selectedOutput, color,
    });
}

function wrapRecipe(leaf, recipe) {
    let plan = leaf;
    let code = leaf.code;
    for (const step of recipe.steps) {
        plan = operationNode(step.operation, [plan], [code], step.outputCodes, step.selectedOutput);
        code = step.outputCodes[step.selectedOutput];
    }
    return { plan, code };
}

function rotationSequences(numParts, from, to, enabled) {
    const clockwise = (to - from + numParts) % numParts;
    const counterclockwise = (from - to + numParts) % numParts;
    const choices = [];
    if (enabled.has('Rotator CW')) choices.push(Array(clockwise).fill('Rotator CW'));
    if (enabled.has('Rotator CCW')) choices.push(Array(counterclockwise).fill('Rotator CCW'));
    if (numParts === 4 && clockwise === 2 && enabled.has('Rotator 180')) choices.push(['Rotator 180']);
    if (clockwise === 0) choices.push([]);
    choices.sort((a, b) => a.length - b.length || a.join().localeCompare(b.join()));
    return choices;
}

function rotateAtom(planAndCode, targetQuadrant, enabled, operationConfig) {
    let { plan, code } = planAndCode;
    const shape = Shape.fromShapeCode(code);
    const cells = occupiedCells(shape);
    if (cells.length !== 1) return null;
    const sequences = rotationSequences(shape.numParts, cells[0].quadrant, targetQuadrant, enabled);
    if (sequences.length === 0) return null;
    for (const operation of sequences[0]) {
        const fn = operation === 'Rotator CW' ? rotate90CW
            : operation === 'Rotator CCW' ? rotate90CCW : rotate180;
        const outputs = physicalUnary(fn, code, operationConfig);
        if (outputs.length !== 1) return null;
        plan = operationNode(operation, [plan], [code], outputs);
        code = outputs[0];
    }
    return { plan, code };
}

function finishAtom(planAndCode, demand, enabled, operationConfig) {
    let result = rotateAtom(planAndCode, demand.quadrant, enabled, operationConfig);
    if (!result) return null;
    const cell = occupiedCells(Shape.fromShapeCode(result.code))[0];
    if (cell.part.shape !== demand.part.shape) return null;
    if (cell.part.color !== demand.part.color) {
        if (UNPAINTABLE_PARTS.includes(cell.part.shape)
            || demand.part.color === UNCOLORED_CODE
            || !enabled.has('Painter')) return null;
        const outputs = topPaint(
            Shape.fromShapeCode(result.code), demand.part.color, operationConfig,
        ).map(shape => shape.toShapeCode());
        result = {
            plan: operationNode('Painter', [result.plan], [result.code], outputs, 0, demand.part.color),
            code: outputs[0],
        };
    }
    const finalCell = occupiedCells(Shape.fromShapeCode(result.code));
    return finalCell.length === 1
        && finalCell[0].quadrant === demand.quadrant
        && finalCell[0].part.shape === demand.part.shape
        && finalCell[0].part.color === demand.part.color
        ? result : null;
}

function stackPlans(bottom, top, enabled, operationConfig) {
    if (!enabled.has('Stacker')) return null;
    let outputs;
    try {
        outputs = stack(
            Shape.fromShapeCode(bottom.code), Shape.fromShapeCode(top.code), operationConfig,
        ).map(shape => shape.toShapeCode());
    } catch (error) {
        if (error instanceof InvalidOperationInputs) return null;
        throw error;
    }
    return {
        plan: operationNode('Stacker', [bottom.plan, top.plan], [bottom.code, top.code], outputs),
        code: outputs[0],
    };
}

function assembleLayerFirst(atomPlans, target, enabled, operationConfig) {
    const layerPlans = [];
    for (let layer = 0; layer < target.numLayers; layer += 1) {
        const atoms = atomPlans.filter(row => row.demand.layer === layer)
            .sort((a, b) => a.demand.quadrant - b.demand.quadrant);
        if (atoms.length === 0) return null;
        let combined = atoms[0].atom;
        for (const row of atoms.slice(1)) {
            combined = stackPlans(combined, row.atom, enabled, operationConfig);
            if (!combined) return null;
        }
        const expected = target.layers[layer].map(part => `${part.shape}${part.color}`).join('');
        if (combined.code !== expected) return null;
        layerPlans.push(combined);
    }
    let result = layerPlans[0];
    for (const layer of layerPlans.slice(1)) {
        result = stackPlans(result, layer, enabled, operationConfig);
        if (!result) return null;
    }
    return result?.code === target.toShapeCode() ? result : null;
}

function assembleColumnFirst(atomPlans, target, enabled, operationConfig) {
    const columnPlans = [];
    for (let quadrant = 0; quadrant < target.numParts; quadrant += 1) {
        const atoms = atomPlans.filter(row => row.demand.quadrant === quadrant)
            .sort((a, b) => a.demand.layer - b.demand.layer);
        if (atoms.length === 0) continue;
        const layers = atoms.map(row => row.demand.layer);
        if (layers.some((layer, index) => layer !== index)) return null;
        let combined = atoms[0].atom;
        for (const row of atoms.slice(1)) {
            combined = stackPlans(combined, row.atom, enabled, operationConfig);
            if (!combined) return null;
        }
        columnPlans.push(combined);
    }
    if (columnPlans.length === 0) return null;
    let result = columnPlans[0];
    for (const column of columnPlans.slice(1)) {
        result = stackPlans(result, column, enabled, operationConfig);
        if (!result) return null;
    }
    return result.code === target.toShapeCode() ? result : null;
}

function materializePlan(plan, startingShapeCodes) {
    let nextId = startingShapeCodes.length;
    const steps = [];
    const consumedLeaves = new Set();
    function execute(node) {
        if (node.kind === 'leaf') {
            if (consumedLeaves.has(node.inputId)) throw new Error(`Starting token ${node.inputId} reused`);
            consumedLeaves.add(node.inputId);
            return node.inputId;
        }
        const inputIds = node.inputs.map(execute);
        const outputIds = node.outputCodes.map(() => nextId++);
        steps.push({
            operation: node.operation,
            inputs: inputIds.map((id, index) => ({ id, shape: node.inputCodes[index] })),
            outputs: outputIds.map((id, index) => ({ id, shape: node.outputCodes[index] })),
            params: node.color === null ? {} : { color: node.color },
        });
        return outputIds[node.selectedOutput];
    }
    execute(plan);
    return steps;
}

function resultBase(config, started, counters, extra = {}) {
    return {
        architecture: ARCHITECTURE,
        architectureConfig: config.id,
        extractionStates: counters.extractionStates,
        matchingTransitions: counters.matchingTransitions,
        wallMs: performance.now() - started,
        ...extra,
    };
}

/** Experimental architecture; it deliberately accepts only public Solver input. */
export async function goalDecomposedSolve(instance, experimentConfig) {
    const limits = validateConfig(experimentConfig);
    const started = performance.now();
    const counters = { extractionStates: 0, matchingTransitions: 0 };
    const timedOut = () => performance.now() - started >= limits.maxWallMs;
    const targetCodes = instance.targetShapeCodes ?? [];
    const startingShapeCodes = instance.startingShapeCodes ?? [];
    const enabled = new Set(instance.enabledOperations ?? []);
    const operationConfig = new ShapeOperationConfig(instance.maxLayers ?? 4);

    if (targetCodes.length !== 1 || instance.allowSplitting || instance.preventWaste) {
        return resultBase(limits, started, counters, {
            solutionPath: null, depth: 0, statesExplored: 0, generatedStates: 0,
            outcome: 'exhausted', beamPruned: false, architectureStatus: 'unsupported-domain',
        });
    }
    const target = Shape.fromShapeCode(targetCodes[0]);
    if (target.numParts !== 4 || !isOrdinaryTarget(target)) {
        return resultBase(limits, started, counters, {
            solutionPath: null, depth: 0, statesExplored: 0, generatedStates: 0,
            outcome: 'exhausted', beamPruned: false, architectureStatus: 'unsupported-domain',
        });
    }

    const demands = occupiedCells(target).map(({ layer, quadrant, part }, id) => ({
        id, layer, quadrant, part,
    }));
    const recipeCache = new Map();
    function recipeFor(sourceIndex, demand) {
        const sourceCode = startingShapeCodes[sourceIndex];
        const key = `${sourceCode}\u0000${demand.part.shape}\u0000${demand.part.color}`;
        if (!recipeCache.has(key)) {
            const localCounters = { extractionStates: 0 };
            const recipe = findExtractionRecipe(
                sourceCode, demand.part, enabled, operationConfig, limits, localCounters, timedOut,
            );
            counters.extractionStates += localCounters.extractionStates;
            recipeCache.set(key, recipe);
        }
        return recipeCache.get(key);
    }

    const candidates = new Map();
    let planningLimit = null;
    for (const demand of demands) {
        const sourceIds = [];
        for (let sourceIndex = 0; sourceIndex < startingShapeCodes.length; sourceIndex += 1) {
            const recipe = recipeFor(sourceIndex, demand);
            if (recipe?.limitReason) planningLimit ??= recipe.limitReason;
            else if (recipe) sourceIds.push(sourceIndex);
        }
        candidates.set(demand.id, sourceIds);
    }
    if (planningLimit === 'time') {
        return resultBase(limits, started, counters, {
            solutionPath: null, depth: 0, statesExplored: counters.extractionStates,
            generatedStates: counters.matchingTransitions, outcome: 'limit', limitReached: true,
            limitReason: planningLimit, beamPruned: false, architectureStatus: 'limited',
        });
    }

    const orderedDemands = [...demands].sort((a, b) => (
        candidates.get(a.id).length - candidates.get(b.id).length
        || (UNPAINTABLE_PARTS.includes(a.part.shape) ? -1 : 1)
        - (UNPAINTABLE_PARTS.includes(b.part.shape) ? -1 : 1)
        || a.id - b.id
    ));
    const sourceMatch = new Array(startingShapeCodes.length).fill(-1);
    function augment(demandId, seen) {
        for (const sourceIndex of candidates.get(demandId)) {
            counters.matchingTransitions += 1;
            if (counters.matchingTransitions > limits.maxMatchingTransitions || timedOut()) return false;
            if (seen.has(sourceIndex)) continue;
            seen.add(sourceIndex);
            if (sourceMatch[sourceIndex] === -1 || augment(sourceMatch[sourceIndex], seen)) {
                sourceMatch[sourceIndex] = demandId;
                return true;
            }
        }
        return false;
    }
    let matched = true;
    for (const demand of orderedDemands) {
        if (!augment(demand.id, new Set())) { matched = false; break; }
    }
    if (counters.matchingTransitions > limits.maxMatchingTransitions || timedOut()) {
        const reason = timedOut() ? 'time' : 'matching-transitions';
        return resultBase(limits, started, counters, {
            solutionPath: null, depth: 0, statesExplored: counters.extractionStates,
            generatedStates: counters.matchingTransitions, outcome: 'limit', limitReached: true,
            limitReason: reason, beamPruned: false, architectureStatus: 'limited',
        });
    }
    if (!matched) {
        return resultBase(limits, started, counters, {
            solutionPath: null, depth: 0, statesExplored: counters.extractionStates,
            generatedStates: counters.matchingTransitions, outcome: 'exhausted',
            beamPruned: false, architectureStatus: 'resource-mismatch',
        });
    }

    const demandSource = new Map();
    sourceMatch.forEach((demandId, sourceIndex) => {
        if (demandId !== -1) demandSource.set(demandId, sourceIndex);
    });
    const atomPlans = [];
    for (const demand of demands) {
        const sourceIndex = demandSource.get(demand.id);
        const recipe = recipeFor(sourceIndex, demand);
        const leaf = Object.freeze({
            kind: 'leaf', inputId: sourceIndex, code: startingShapeCodes[sourceIndex],
        });
        const atom = finishAtom(wrapRecipe(leaf, recipe), demand, enabled, operationConfig);
        if (!atom) {
            return resultBase(limits, started, counters, {
                solutionPath: null, depth: 0, statesExplored: counters.extractionStates,
                generatedStates: counters.matchingTransitions, outcome: 'exhausted',
                beamPruned: false, architectureStatus: 'construction-failed',
            });
        }
        atomPlans.push({ demand, atom });
    }

    const goalPlan = assembleLayerFirst(atomPlans, target, enabled, operationConfig)
        ?? assembleColumnFirst(atomPlans, target, enabled, operationConfig);
    if (!goalPlan) {
        return resultBase(limits, started, counters, {
            solutionPath: null, depth: 0, statesExplored: counters.extractionStates,
            generatedStates: counters.matchingTransitions, outcome: 'exhausted',
            beamPruned: false, architectureStatus: 'construction-failed',
        });
    }
    const solutionPath = materializePlan(goalPlan.plan, startingShapeCodes);
    if (solutionPath.length > limits.maxOperations) {
        return resultBase(limits, started, counters, {
            solutionPath: null, depth: solutionPath.length, statesExplored: counters.extractionStates,
            generatedStates: counters.matchingTransitions, outcome: 'limit', limitReached: true,
            limitReason: 'operations', beamPruned: false, architectureStatus: 'limited',
        });
    }
    return resultBase(limits, started, counters, {
        solutionPath,
        depth: solutionPath.length,
        statesExplored: counters.extractionStates,
        generatedStates: counters.matchingTransitions,
        outcome: 'solved',
        beamPruned: false,
        architectureStatus: 'solved',
    });
}

export const goalDecomposedTestOnly = Object.freeze({
    assembleColumnFirst,
    assembleLayerFirst,
    canFinishCell,
    findExtractionRecipe,
    occupiedCells,
    validateConfig,
});
