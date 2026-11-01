import {
    Shape, ShapeOperationConfig, InvalidOperationInputs,
    cut, halfCut, rotate90CW, rotate90CCW, rotate180, stack, topPaint, pushPin,
} from './shapeOperations.js';
import { PART_CODES, UNCOLORED_CODE, UNPAINTABLE_PARTS } from './shapeConstants.js';
import { goalDecomposedSolve } from './goalDecomposedSolver.js';

const ARCHITECTURE = 'pin-goal-decomposed-constructive-synthesis-v1';
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
        throw new Error('Pin goal-decomposed configuration must be an object');
    }
    for (const key of Object.keys(value)) {
        if (!CONFIG_KEYS.includes(key)) throw new Error(`Unknown Pin goal-decomposed configuration key: ${key}`);
    }
    if (typeof value.id !== 'string' || value.id.length === 0) {
        throw new Error('Pin goal-decomposed id must be a non-empty string');
    }
    for (const key of CONFIG_KEYS.filter(key => key !== 'id' && key !== 'maxWallMs')) {
        if (!Number.isInteger(value[key]) || value[key] < 1) {
            throw new Error(`Pin goal-decomposed ${key} must be a positive integer`);
        }
    }
    if (!Number.isFinite(value.maxWallMs) || value.maxWallMs <= 0) {
        throw new Error('Pin goal-decomposed maxWallMs must be positive and finite');
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

function hasPart(shape, code) {
    return occupiedCells(shape).some(({ part }) => part.shape === code);
}

function canFinishCell(part, targetPart, painterEnabled, cleanPainting) {
    if (part.shape !== targetPart.shape) return false;
    if (UNPAINTABLE_PARTS.includes(part.shape)) return part.color === targetPart.color;
    if (targetPart.color === UNCOLORED_CODE) return part.color === UNCOLORED_CODE;
    return part.color === targetPart.color
        || (painterEnabled && (!cleanPainting || part.color === UNCOLORED_CODE));
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

function findExtractionRecipe(sourceCode, predicate, enabled, config, limits, counters, timedOut) {
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
        const cells = occupiedCells(Shape.fromShapeCode(current.code));
        if (cells.length === 1 && predicate(cells[0].part)) {
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
                    steps: [...current.steps, { operation, inputCode: current.code, outputCodes: outputs, selectedOutput }],
                });
            }
        }
    }
    return null;
}

function operationNode(operation, inputs, inputCodes, outputCodes, selectedOutput = 0, color = null) {
    return Object.freeze({ kind: 'operation', operation, inputs, inputCodes, outputCodes, selectedOutput, color });
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
    if (clockwise === 0) choices.push([]);
    if (enabled.has('Rotator CW')) choices.push(Array(clockwise).fill('Rotator CW'));
    if (enabled.has('Rotator CCW')) choices.push(Array(counterclockwise).fill('Rotator CCW'));
    if (numParts === 4 && clockwise === 2 && enabled.has('Rotator 180')) choices.push(['Rotator 180']);
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

function finishAtom(planAndCode, demand, enabled, operationConfig, cleanPainting) {
    let result = rotateAtom(planAndCode, demand.quadrant, enabled, operationConfig);
    if (!result) return null;
    const cell = occupiedCells(Shape.fromShapeCode(result.code))[0];
    if (cell.part.shape !== demand.part.shape) return null;
    if (cell.part.color !== demand.part.color) {
        if (UNPAINTABLE_PARTS.includes(cell.part.shape)
            || demand.part.color === UNCOLORED_CODE
            || !enabled.has('Painter')
            || (cleanPainting && (cell.part.color !== UNCOLORED_CODE
                || Shape.fromShapeCode(result.code).numLayers !== 1))) return null;
        const outputs = topPaint(Shape.fromShapeCode(result.code), demand.part.color, operationConfig)
            .map(shape => shape.toShapeCode());
        result = {
            plan: operationNode('Painter', [result.plan], [result.code], outputs, 0, demand.part.color),
            code: outputs[0],
        };
    }
    const cells = occupiedCells(Shape.fromShapeCode(result.code));
    return cells.length === 1
        && cells[0].quadrant === demand.quadrant
        && cells[0].part.shape === demand.part.shape
        && cells[0].part.color === demand.part.color ? result : null;
}

function stackPlans(bottom, top, enabled, operationConfig) {
    if (!bottom) return top;
    if (!top) return bottom;
    if (!enabled.has('Stacker')) return null;
    let outputs;
    try {
        outputs = stack(Shape.fromShapeCode(bottom.code), Shape.fromShapeCode(top.code), operationConfig)
            .map(shape => shape.toShapeCode());
    } catch (error) {
        if (error instanceof InvalidOperationInputs) return null;
        throw error;
    }
    return { plan: operationNode('Stacker', [bottom.plan, top.plan], [bottom.code, top.code], outputs), code: outputs[0] };
}

function pushPlan(value, enabled, operationConfig) {
    if (!enabled.has('Pin Pusher')) return null;
    const outputs = pushPin(Shape.fromShapeCode(value.code), operationConfig).map(shape => shape.toShapeCode());
    return { plan: operationNode('Pin Pusher', [value.plan], [value.code], outputs), code: outputs[0] };
}

function partCode(part) {
    return `${part.shape}${part.color}`;
}

function layerCode(parts) {
    return parts.map(partCode).join('');
}

function emptyPart() {
    return { shape: PART_CODES.NOTHING, color: PART_CODES.NOTHING };
}

function trimUpperEmpty(parts) {
    let length = parts.length;
    while (length && parts[length - 1].shape === PART_CODES.NOTHING) length -= 1;
    return parts.slice(0, length);
}

function columnCode(parts, quadrant) {
    return parts.map(part => Array.from({ length: 4 }, (_, index) => (
        index === quadrant ? partCode(part) : '--'
    )).join('')).join(':');
}

function constructibleColumn(parts) {
    const trimmed = trimUpperEmpty(parts);
    if (trimmed.length === 0) return true;
    return trimmed[0].shape !== PART_CODES.NOTHING
        && !trimmed.some(part => part.shape === PART_CODES.NOTHING || part.shape === PART_CODES.CRYSTAL);
}

function stackCodes(bottom, top, operationConfig) {
    if (!bottom) return top;
    if (!top) return bottom;
    return stack(Shape.fromShapeCode(bottom), Shape.fromShapeCode(top), operationConfig)[0].toShapeCode();
}

function planBaseColumns(layers, upperQuadrants, splitLayer, operationConfig) {
    const columns = [];
    for (let quadrant = 0; quadrant < 4; quadrant += 1) {
        const end = upperQuadrants.has(quadrant) ? splitLayer : layers.length;
        const parts = trimUpperEmpty(layers.slice(0, end).map(layer => layer[quadrant]));
        if (!constructibleColumn(parts)) return null;
        if (parts.length) columns.push({ quadrant, parts, shape: columnCode(parts, quadrant) });
    }
    let shape = null;
    for (const column of columns) shape = stackCodes(shape, column.shape, operationConfig);
    return { columns, shape };
}

function planSolidUpper(layers, quadrants, splitLayer, operationConfig) {
    const shiftedLayers = layers.slice(splitLayer).map(layer => layer.map((part, quadrant) => (
        quadrants.has(quadrant) ? part : emptyPart()
    )));
    if (shiftedLayers.some(layer => layer.every(part => part.shape === PART_CODES.NOTHING))) return null;
    if (shiftedLayers.flat().some(part => [PART_CODES.PIN, PART_CODES.CRYSTAL].includes(part.shape))) return null;
    const codes = shiftedLayers.map(layerCode);
    let shape = null;
    for (const code of codes) shape = stackCodes(shape, code, operationConfig);
    if (shape !== codes.join(':')) return null;
    return { layers: shiftedLayers, shape };
}

function planPinLayout(target, operationConfig) {
    const layers = target.layers;
    const direct = planBaseColumns(layers, new Set(), layers.length, operationConfig);
    if (direct?.shape === target.toShapeCode()) return { kind: 'pin-column-sequence', ...direct, upper: null };

    const candidates = [];
    for (let splitLayer = 1; splitLayer < layers.length; splitLayer += 1) {
        for (let mask = 1; mask < 16; mask += 1) {
            const quadrants = new Set(Array.from({ length: 4 }, (_, quadrant) => quadrant)
                .filter(quadrant => mask & (1 << quadrant)));
            const base = planBaseColumns(layers, quadrants, splitLayer, operationConfig);
            if (!base?.shape) continue;
            const upper = planSolidUpper(layers, quadrants, splitLayer, operationConfig);
            if (!upper || stackCodes(base.shape, upper.shape, operationConfig) !== target.toShapeCode()) continue;
            const upperPartCount = upper.layers.flat().filter(part => part.shape !== PART_CODES.NOTHING).length;
            candidates.push({
                kind: 'pin-supported-upper-region', ...base, upper, splitLayer,
                upperQuadrants: [...quadrants], upperPartCount,
            });
        }
    }
    candidates.sort((a, b) => a.upperPartCount - b.upperPartCount || b.splitLayer - a.splitLayer
        || a.upperQuadrants.join('').localeCompare(b.upperQuadrants.join('')));
    return candidates[0] ?? null;
}

function terminalOverflowSacrifices(parts, maxLayers, useOverflow = parts.length === maxLayers) {
    const firstPin = parts.findIndex(part => part.shape === PART_CODES.PIN);
    if (firstPin < 0) return 0;
    let afterPins = firstPin;
    while (afterPins < parts.length && parts[afterPins].shape === PART_CODES.PIN) afterPins += 1;
    const upper = parts.slice(afterPins);
    if (upper.length) return terminalOverflowSacrifices(upper, maxLayers, useOverflow);
    return useOverflow ? 1 : Number.POSITIVE_INFINITY;
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
export async function pinGoalDecomposedSolve(instance, experimentConfig) {
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
    if (target.numParts !== 4 || hasPart(target, PART_CODES.CRYSTAL)) {
        return resultBase(limits, started, counters, {
            solutionPath: null, depth: 0, statesExplored: 0, generatedStates: 0,
            outcome: 'exhausted', beamPruned: false, architectureStatus: 'unsupported-domain',
        });
    }
    if (!hasPart(target, PART_CODES.PIN)) {
        const ordinary = await goalDecomposedSolve(instance, limits);
        return { ...ordinary, architecture: ARCHITECTURE, architectureConfig: limits.id, component: 'ordinary-gdcs-v1' };
    }
    if (!enabled.has('Pin Pusher') || !enabled.has('Stacker')) {
        return resultBase(limits, started, counters, {
            solutionPath: null, depth: 0, statesExplored: 0, generatedStates: 0,
            outcome: 'exhausted', beamPruned: false, architectureStatus: 'unsupported-domain',
        });
    }

    const layout = planPinLayout(target, operationConfig);
    if (!layout) {
        return resultBase(limits, started, counters, {
            solutionPath: null, depth: 0, statesExplored: 0, generatedStates: 0,
            outcome: 'exhausted', beamPruned: false, architectureStatus: 'unsupported-pin-layout',
        });
    }
    const sacrificeCount = layout.columns.reduce((sum, column) => (
        sum + terminalOverflowSacrifices(column.parts, operationConfig.maxShapeLayers)
    ), 0);
    if (!Number.isFinite(sacrificeCount)) {
        return resultBase(limits, started, counters, {
            solutionPath: null, depth: 0, statesExplored: 0, generatedStates: 0,
            outcome: 'exhausted', beamPruned: false, architectureStatus: 'unsupported-isolated-pin',
        });
    }

    const ordinaryDemands = occupiedCells(target)
        .filter(({ part }) => part.shape !== PART_CODES.PIN)
        .map((cell, id) => ({ ...cell, id: `target-${id}`, kind: 'target' }));
    const demandByCell = new Map(ordinaryDemands.map(demand => [`${demand.layer}:${demand.quadrant}`, demand]));
    const sacrificeDemands = Array.from({ length: sacrificeCount }, (_, index) => ({
        id: `sacrifice-${index}`, kind: 'sacrifice', quadrant: null, part: null,
    }));
    const demands = [...ordinaryDemands, ...sacrificeDemands];
    const recipeCache = new Map();
    function recipeFor(sourceIndex, demand) {
        const sourceCode = startingShapeCodes[sourceIndex];
        const signature = demand.kind === 'target'
            ? `${demand.part.shape}\u0000${demand.part.color}` : '*ordinary*';
        const key = `${sourceCode}\u0000${signature}`;
        if (!recipeCache.has(key)) {
            const localCounters = { extractionStates: 0 };
            const predicate = demand.kind === 'target'
                ? part => canFinishCell(part, demand.part, enabled.has('Painter'), instance.cleanPainting)
                : part => !UNPAINTABLE_PARTS.includes(part.shape) && part.shape !== PART_CODES.NOTHING;
            const recipe = findExtractionRecipe(
                sourceCode, predicate, enabled, operationConfig, limits, localCounters, timedOut,
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
        || (a.kind === 'target' ? -1 : 1) - (b.kind === 'target' ? -1 : 1)
        || a.id.localeCompare(b.id)
    ));
    const sourceMatch = new Array(startingShapeCodes.length).fill(null);
    function augment(demandId, seen) {
        for (const sourceIndex of candidates.get(demandId)) {
            counters.matchingTransitions += 1;
            if (counters.matchingTransitions > limits.maxMatchingTransitions || timedOut()) return false;
            if (seen.has(sourceIndex)) continue;
            seen.add(sourceIndex);
            if (sourceMatch[sourceIndex] === null || augment(sourceMatch[sourceIndex], seen)) {
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
            generatedStates: counters.matchingTransitions, outcome: 'exhausted', beamPruned: false,
            architectureStatus: 'resource-mismatch',
        });
    }

    const demandSource = new Map();
    sourceMatch.forEach((demandId, sourceIndex) => {
        if (demandId !== null) demandSource.set(demandId, sourceIndex);
    });
    function atomForDemand(demand, quadrant) {
        const sourceIndex = demandSource.get(demand.id);
        const recipe = recipeFor(sourceIndex, demand);
        const leaf = Object.freeze({ kind: 'leaf', inputId: sourceIndex, code: startingShapeCodes[sourceIndex] });
        const wrapped = wrapRecipe(leaf, recipe);
        return demand.kind === 'target'
            ? finishAtom(wrapped, { ...demand, quadrant }, enabled, operationConfig, instance.cleanPainting)
            : rotateAtom(wrapped, quadrant, enabled, operationConfig);
    }
    let sacrificeCursor = 0;
    function takeSacrifice(quadrant) {
        return atomForDemand(sacrificeDemands[sacrificeCursor++], quadrant);
    }
    function targetAtom(layer, quadrant) {
        const demand = demandByCell.get(`${layer}:${quadrant}`);
        return demand ? atomForDemand(demand, quadrant) : null;
    }

    function buildColumn(parts, quadrant, startLayer, fullColumnLength) {
        const firstPin = parts.findIndex(part => part.shape === PART_CODES.PIN);
        if (firstPin < 0) {
            let result = null;
            for (let index = 0; index < parts.length; index += 1) {
                result = stackPlans(result, targetAtom(startLayer + index, quadrant), enabled, operationConfig);
                if (!result) return null;
            }
            return result;
        }
        let afterPins = firstPin;
        while (afterPins < parts.length && parts[afterPins].shape === PART_CODES.PIN) afterPins += 1;
        const upper = parts.slice(afterPins);
        let pinnedUpper;
        if (upper.length) {
            pinnedUpper = buildColumn(upper, quadrant, startLayer + afterPins, fullColumnLength);
        } else if (fullColumnLength === operationConfig.maxShapeLayers) {
            pinnedUpper = takeSacrifice(quadrant);
        } else {
            return null;
        }
        if (!pinnedUpper) return null;
        for (let index = firstPin; index < afterPins; index += 1) {
            pinnedUpper = pushPlan(pinnedUpper, enabled, operationConfig);
            if (!pinnedUpper) return null;
        }
        if (firstPin === 0) return pinnedUpper;
        let lower = null;
        for (let index = 0; index < firstPin; index += 1) {
            lower = stackPlans(lower, targetAtom(startLayer + index, quadrant), enabled, operationConfig);
            if (!lower) return null;
        }
        return stackPlans(lower, pinnedUpper, enabled, operationConfig);
    }

    let base = null;
    for (const column of layout.columns) {
        const columnPlan = buildColumn(column.parts, column.quadrant, 0, column.parts.length);
        if (!columnPlan || columnPlan.code !== column.shape) {
            return resultBase(limits, started, counters, {
                solutionPath: null, depth: 0, statesExplored: counters.extractionStates,
                generatedStates: counters.matchingTransitions, outcome: 'exhausted', beamPruned: false,
                architectureStatus: 'construction-failed',
            });
        }
        base = stackPlans(base, columnPlan, enabled, operationConfig);
    }

    let goalPlan = base;
    if (layout.upper) {
        let upper = null;
        for (let relativeLayer = 0; relativeLayer < layout.upper.layers.length; relativeLayer += 1) {
            let layerPlan = null;
            const sourceLayer = layout.splitLayer + relativeLayer;
            for (let quadrant = 0; quadrant < 4; quadrant += 1) {
                if (layout.upper.layers[relativeLayer][quadrant].shape === PART_CODES.NOTHING) continue;
                layerPlan = stackPlans(layerPlan, targetAtom(sourceLayer, quadrant), enabled, operationConfig);
            }
            upper = stackPlans(upper, layerPlan, enabled, operationConfig);
        }
        goalPlan = stackPlans(base, upper, enabled, operationConfig);
    }
    if (!goalPlan || goalPlan.code !== target.toShapeCode()) {
        return resultBase(limits, started, counters, {
            solutionPath: null, depth: 0, statesExplored: counters.extractionStates,
            generatedStates: counters.matchingTransitions, outcome: 'exhausted', beamPruned: false,
            architectureStatus: 'construction-failed',
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
        solutionPath, depth: solutionPath.length,
        statesExplored: counters.extractionStates, generatedStates: counters.matchingTransitions,
        outcome: 'solved', beamPruned: false, architectureStatus: 'solved',
        pinLayout: layout.kind,
    });
}

export const pinGoalDecomposedTestOnly = Object.freeze({
    planPinLayout,
    terminalOverflowSacrifices,
    validateConfig,
});
