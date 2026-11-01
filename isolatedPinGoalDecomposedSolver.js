import {
    Shape, ShapeOperationConfig, InvalidOperationInputs,
    cut, halfCut, rotate90CW, rotate90CCW, rotate180, stack, swapHalves,
    topPaint, pushPin, genCrystal,
} from './shapeOperations.js';
import { PART_CODES, UNCOLORED_CODE, UNPAINTABLE_PARTS } from './shapeConstants.js';
import { mixedPinCrystalGoalDecomposedSolve } from './mixedPinCrystalGoalDecomposedSolver.js';
import { pinGoalDecomposedTestOnly } from './pinGoalDecomposedSolver.js';
import {
    buildPinSubassembly, planPinSubassembly,
} from './constructive/pin-construction-planner.js';
import {
    buildMixedPinCrystalSubassembly, planMixedPinCrystalSubassembly,
} from './constructive/mixed-pin-crystal-construction-planner.js';

const ARCHITECTURE = 'isolated-pin-goal-decomposed-constructive-synthesis-v1';
const EXTRACTION_OPERATIONS = Object.freeze([
    ['Cutter', cut],
    ['Half Destroyer', halfCut],
    ['Rotator CW', rotate90CW],
    ['Rotator CCW', rotate90CCW],
    ['Rotator 180', rotate180],
]);
const CONSTRUCTION_OPERATIONS = Object.freeze({
    Cutter: (inputs, params, config) => cut(inputs[0], config),
    'Rotator CW': (inputs, params, config) => rotate90CW(inputs[0], config),
    'Rotator CCW': (inputs, params, config) => rotate90CCW(inputs[0], config),
    'Rotator 180': (inputs, params, config) => rotate180(inputs[0], config),
    Stacker: (inputs, params, config) => stack(inputs[0], inputs[1], config),
    Swapper: (inputs, params, config) => swapHalves(inputs[0], inputs[1], config),
    Painter: (inputs, params, config) => topPaint(inputs[0], params.color, config),
    'Pin Pusher': (inputs, params, config) => pushPin(inputs[0], config),
    'Crystal Generator': (inputs, params, config) => genCrystal(inputs[0], params.color, config),
});
const ALL_CONSTRUCTION_OPERATIONS = new Set(Object.keys(CONSTRUCTION_OPERATIONS));

function partCode(part) {
    return `${part.shape}${part.color}`;
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
                const outputCode = outputs[selectedOutput];
                if (outputCode === current.code || visited.has(outputCode)) continue;
                visited.add(outputCode);
                queue.push({
                    code: outputCode,
                    steps: [...current.steps, {
                        operation, inputCode: current.code, outputCodes: outputs, selectedOutput,
                    }],
                });
            }
        }
    }
    return null;
}

function rotationSequence(numParts, from, to, enabled) {
    const clockwise = (to - from + numParts) % numParts;
    const counterclockwise = (from - to + numParts) % numParts;
    const choices = [];
    if (clockwise === 0) choices.push([]);
    if (enabled.has('Rotator CW')) choices.push(Array(clockwise).fill('Rotator CW'));
    if (enabled.has('Rotator CCW')) choices.push(Array(counterclockwise).fill('Rotator CCW'));
    if (numParts === 4 && clockwise === 2 && enabled.has('Rotator 180')) choices.push(['Rotator 180']);
    choices.sort((a, b) => a.length - b.length || a.join().localeCompare(b.join()));
    return choices[0] ?? null;
}

function singleCellCode(part, quadrant) {
    return Array.from({ length: 4 }, (_, index) => index === quadrant ? partCode(part) : '--').join('');
}

class PhysicalPlanBuilder {
    constructor(enabled, maxLayers, startingShapeCodes = []) {
        this.enabled = enabled;
        this.config = new ShapeOperationConfig(maxLayers);
        this.live = new Map();
        this.nextId = 0;
        this.operationCount = 0;
        this.inputIds = startingShapeCodes.map((code, inputId) => this.addToken({
            kind: 'leaf', inputId, code,
        }));
    }

    addToken(token) {
        const id = this.nextId++;
        this.live.set(id, token);
        return id;
    }

    virtual(code) {
        return this.addToken({ kind: 'virtual', code });
    }

    shape(id) {
        const token = this.live.get(id);
        if (!token) throw new Error(`Token ${id} is not live`);
        return token.code;
    }

    operate(operation, inputIds, params = {}) {
        if (!this.enabled.has(operation)) throw new Error(`Required operation disabled: ${operation}`);
        if (new Set(inputIds).size !== inputIds.length) throw new Error('Construction attempted to reuse one live token');
        const inputTokens = inputIds.map(id => {
            const token = this.live.get(id);
            if (!token) throw new Error(`Construction token ${id} was already consumed`);
            return token;
        });
        const implementation = CONSTRUCTION_OPERATIONS[operation];
        if (!implementation) throw new Error(`Unsupported construction operation ${operation}`);
        let outputs;
        try {
            outputs = implementation(
                inputTokens.map(token => Shape.fromShapeCode(token.code)), params, this.config,
            ).filter(shape => !shape.isEmpty()).map(shape => shape.toShapeCode());
        } catch (error) {
            if (error instanceof InvalidOperationInputs) outputs = [];
            else throw error;
        }
        for (const id of inputIds) this.live.delete(id);
        const node = { kind: 'operation', operation, inputs: inputTokens, outputCodes: outputs, params };
        this.operationCount += 1;
        return outputs.map((code, outputIndex) => this.addToken({
            kind: 'output', code, node, outputIndex,
        }));
    }

    materialize(resultId, startingShapeCodes) {
        const resultToken = this.live.get(resultId);
        if (!resultToken) throw new Error('Final construction token is not live');
        let nextId = startingShapeCodes.length;
        const steps = [];
        const operationOutputs = new Map();
        const usedLeaves = new Set();
        const execute = token => {
            if (token.kind === 'leaf') {
                if (usedLeaves.has(token.inputId)) throw new Error(`Starting token ${token.inputId} reused`);
                usedLeaves.add(token.inputId);
                return token.inputId;
            }
            if (token.kind === 'virtual') throw new Error('Virtual planning token reached materialization');
            if (!operationOutputs.has(token.node)) {
                const inputIds = token.node.inputs.map(execute);
                const outputIds = token.node.outputCodes.map(() => nextId++);
                steps.push({
                    operation: token.node.operation,
                    inputs: inputIds.map((id, index) => ({ id, shape: token.node.inputs[index].code })),
                    outputs: outputIds.map((id, index) => ({ id, shape: token.node.outputCodes[index] })),
                    params: token.node.params,
                });
                operationOutputs.set(token.node, outputIds);
            }
            return operationOutputs.get(token.node)[token.outputIndex];
        };
        execute(resultToken);
        return steps;
    }
}

function enumerateDemands(mode, targetCode, maxLayers) {
    const builder = new PhysicalPlanBuilder(ALL_CONSTRUCTION_OPERATIONS, maxLayers);
    const demands = [];
    const buildPart = (part, quadrant) => {
        demands.push({
            id: `demand-${demands.length}`, kind: 'exact', quadrant,
            part: { shape: part.shape, color: part.color },
        });
        return builder.virtual(singleCellCode(part, quadrant));
    };
    const buildSacrificialPart = quadrant => {
        demands.push({ id: `demand-${demands.length}`, kind: 'sacrifice', quadrant, part: null });
        return builder.virtual(singleCellCode({ shape: 'R', color: UNCOLORED_CODE }, quadrant));
    };
    const options = { buildPart, buildSacrificialPart };
    let built;
    if (mode === 'pin') {
        planPinSubassembly(targetCode, maxLayers);
        built = buildPinSubassembly(builder, targetCode, options);
    } else {
        planMixedPinCrystalSubassembly(targetCode, maxLayers);
        built = buildMixedPinCrystalSubassembly(builder, targetCode, options);
    }
    if (builder.shape(built.resultId) !== targetCode) throw new Error('Demand enumeration did not reproduce target');
    return { demands, planKind: built.plan.kind };
}

function applyRecipe(builder, sourceIndex, recipe) {
    let id = builder.inputIds[sourceIndex];
    for (const step of recipe.steps) {
        const outputs = builder.operate(step.operation, [id]);
        id = outputs[step.selectedOutput];
        if (id === undefined || builder.shape(id) !== step.outputCodes[step.selectedOutput]) {
            throw new Error('Extraction recipe drifted from its frozen output');
        }
    }
    return id;
}

function rotateAtom(builder, id, targetQuadrant) {
    const shape = Shape.fromShapeCode(builder.shape(id));
    const cells = occupiedCells(shape);
    if (cells.length !== 1) return null;
    const sequence = rotationSequence(shape.numParts, cells[0].quadrant, targetQuadrant, builder.enabled);
    if (!sequence) return null;
    for (const operation of sequence) {
        const outputs = builder.operate(operation, [id]);
        if (outputs.length !== 1) return null;
        [id] = outputs;
    }
    return id;
}

function finishAtom(builder, id, demand, cleanPainting) {
    id = rotateAtom(builder, id, demand.quadrant);
    if (id === null) return null;
    let cell = occupiedCells(Shape.fromShapeCode(builder.shape(id)))[0];
    if (cell.part.shape !== demand.part.shape) return null;
    if (cell.part.color !== demand.part.color) {
        if (UNPAINTABLE_PARTS.includes(cell.part.shape)
            || demand.part.color === UNCOLORED_CODE || !builder.enabled.has('Painter')
            || (cleanPainting && (cell.part.color !== UNCOLORED_CODE
                || Shape.fromShapeCode(builder.shape(id)).numLayers !== 1))) return null;
        const outputs = builder.operate('Painter', [id], { color: demand.part.color });
        if (outputs.length !== 1) return null;
        [id] = outputs;
        cell = occupiedCells(Shape.fromShapeCode(builder.shape(id)))[0];
    }
    return cell.quadrant === demand.quadrant && partCode(cell.part) === partCode(demand.part) ? id : null;
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
export async function isolatedPinGoalDecomposedSolve(instance, experimentConfig) {
    const limits = pinGoalDecomposedTestOnly.validateConfig(experimentConfig);
    const started = performance.now();
    const counters = { extractionStates: 0, matchingTransitions: 0 };
    const timedOut = () => performance.now() - started >= limits.maxWallMs;
    const delegated = await mixedPinCrystalGoalDecomposedSolve(instance, limits);
    const mode = delegated.architectureStatus === 'unsupported-isolated-pin' ? 'pin'
        : delegated.architectureStatus === 'unsupported-terminal-isolated-pin' ? 'mixed' : null;
    if (!mode) {
        return {
            ...delegated,
            architecture: ARCHITECTURE,
            architectureConfig: limits.id,
            isolationStage: 'delegated-e010',
            delegatedArchitecture: delegated.architecture,
        };
    }

    const targetCodes = instance.targetShapeCodes ?? [];
    const startingShapeCodes = instance.startingShapeCodes ?? [];
    const enabled = new Set(instance.enabledOperations ?? []);
    const maxLayers = instance.maxLayers ?? 4;
    if (targetCodes.length !== 1 || instance.allowSplitting || instance.preventWaste) {
        return resultBase(limits, started, counters, {
            solutionPath: null, depth: 0, statesExplored: 0, generatedStates: 0,
            outcome: 'exhausted', beamPruned: false, architectureStatus: 'unsupported-domain',
        });
    }
    const targetCode = Shape.fromShapeCode(targetCodes[0]).toShapeCode();
    let demandPlan;
    try {
        demandPlan = enumerateDemands(mode, targetCode, maxLayers);
    } catch (error) {
        return resultBase(limits, started, counters, {
            solutionPath: null, depth: 0, statesExplored: 0, generatedStates: 0,
            outcome: 'exhausted', beamPruned: false, architectureStatus: 'unsupported-isolated-pin-layout',
            constructionError: error.message,
        });
    }
    const { demands, planKind } = demandPlan;
    const operationConfig = new ShapeOperationConfig(maxLayers);
    const recipeCache = new Map();
    function recipeFor(sourceIndex, demand) {
        const sourceCode = startingShapeCodes[sourceIndex];
        const signature = demand.kind === 'exact'
            ? `${demand.part.shape}\u0000${demand.part.color}` : '*ordinary-sacrifice*';
        const key = `${sourceCode}\u0000${signature}`;
        if (!recipeCache.has(key)) {
            const localCounters = { extractionStates: 0 };
            const predicate = demand.kind === 'exact'
                ? part => canFinishCell(part, demand.part, enabled.has('Painter'), instance.cleanPainting)
                : part => part.shape !== PART_CODES.NOTHING
                    && !UNPAINTABLE_PARTS.includes(part.shape);
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
        || (a.kind === 'exact' ? -1 : 1) - (b.kind === 'exact' ? -1 : 1)
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
            architectureStatus: 'resource-mismatch', isolatedDemandCount: demands.length,
        });
    }

    const demandSource = new Map();
    sourceMatch.forEach((demandId, sourceIndex) => {
        if (demandId !== null) demandSource.set(demandId, sourceIndex);
    });
    const builder = new PhysicalPlanBuilder(enabled, maxLayers, startingShapeCodes);
    let demandCursor = 0;
    function takeDemand(kind, part, quadrant) {
        const demand = demands[demandCursor++];
        if (!demand || demand.kind !== kind || demand.quadrant !== quadrant
            || (kind === 'exact' && partCode(demand.part) !== partCode(part))) {
            throw new Error('Isolated-Pin demand traversal drifted from frozen allocation');
        }
        const sourceIndex = demandSource.get(demand.id);
        let id = applyRecipe(builder, sourceIndex, recipeFor(sourceIndex, demand));
        id = kind === 'exact' ? finishAtom(builder, id, demand, instance.cleanPainting) : rotateAtom(builder, id, quadrant);
        if (id === null) throw new Error(`Unable to materialize ${demand.id}`);
        return id;
    }
    const options = {
        buildPart: (part, quadrant) => takeDemand('exact', part, quadrant),
        buildSacrificialPart: quadrant => takeDemand('sacrifice', null, quadrant),
    };
    let built;
    try {
        built = mode === 'pin'
            ? buildPinSubassembly(builder, targetCode, options)
            : buildMixedPinCrystalSubassembly(builder, targetCode, options);
        if (demandCursor !== demands.length) throw new Error('Not all isolated-Pin demands were consumed');
        if (builder.shape(built.resultId) !== targetCode) throw new Error('Final isolated-Pin result mismatch');
    } catch (error) {
        return resultBase(limits, started, counters, {
            solutionPath: null, depth: 0, statesExplored: counters.extractionStates,
            generatedStates: counters.matchingTransitions, outcome: 'exhausted', beamPruned: false,
            architectureStatus: error.message.startsWith('Required operation disabled:')
                ? 'unsupported-domain' : 'construction-failed',
            constructionError: error.message, isolatedDemandCount: demands.length,
        });
    }
    const solutionPath = builder.materialize(built.resultId, startingShapeCodes);
    if (solutionPath.length > limits.maxOperations) {
        return resultBase(limits, started, counters, {
            solutionPath: null, depth: solutionPath.length, statesExplored: counters.extractionStates,
            generatedStates: counters.matchingTransitions, outcome: 'limit', limitReached: true,
            limitReason: 'operations', beamPruned: false, architectureStatus: 'limited',
            isolatedDemandCount: demands.length,
        });
    }
    return resultBase(limits, started, counters, {
        solutionPath, depth: solutionPath.length,
        statesExplored: counters.extractionStates, generatedStates: counters.matchingTransitions,
        outcome: 'solved', beamPruned: false, architectureStatus: 'solved',
        component: 'resource-accounted-isolated-pin-v1', isolationMode: mode,
        isolatedDemandCount: demands.length, isolatedPlanKind: planKind,
    });
}

export const isolatedPinGoalDecomposedTestOnly = Object.freeze({
    enumerateDemands,
});
