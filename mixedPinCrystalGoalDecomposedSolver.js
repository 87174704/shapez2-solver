import {
    Shape, ShapeOperationConfig, InvalidOperationInputs,
    cut, halfCut, rotate90CW, rotate90CCW, rotate180, stack, swapHalves,
    topPaint, pushPin, genCrystal,
} from './shapeOperations.js';
import { PART_CODES, UNCOLORED_CODE, UNPAINTABLE_PARTS } from './shapeConstants.js';
import { crystalScaffoldGoalDecomposedSolve } from './crystalScaffoldGoalDecomposedSolver.js';
import { pinGoalDecomposedTestOnly } from './pinGoalDecomposedSolver.js';
import { planMixedPinCrystalSubassembly } from './constructive/mixed-pin-crystal-construction-planner.js';

const ARCHITECTURE = 'mixed-pin-crystal-goal-decomposed-constructive-synthesis-v1';
const EXTRACTION_OPERATIONS = Object.freeze([
    ['Cutter', cut],
    ['Half Destroyer', halfCut],
    ['Rotator CW', rotate90CW],
    ['Rotator CCW', rotate90CCW],
    ['Rotator 180', rotate180],
]);

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

function hasPart(shape, code) {
    return occupiedCells(shape).some(({ part }) => part.shape === code);
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
    const sequence = rotationSequences(shape.numParts, cells[0].quadrant, targetQuadrant, enabled)[0];
    if (!sequence) return null;
    for (const operation of sequence) {
        const fn = operation === 'Rotator CW' ? rotate90CW
            : operation === 'Rotator CCW' ? rotate90CCW : rotate180;
        const outputs = physicalUnary(fn, code, operationConfig);
        if (outputs.length !== 1) return null;
        plan = operationNode(operation, [plan], [code], outputs);
        [code] = outputs;
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
        && partCode(cells[0].part) === partCode(demand.part) ? result : null;
}

function requiresTerminalIsolatedPin(plan) {
    if (!plan || typeof plan !== 'object') return false;
    if (plan.kind === 'crystal-pin-column-transition' && !plan.upper) return true;
    return [plan.prerequisite?.left, plan.prerequisite?.right, plan.left, plan.right,
        plan.base, plan.upper, ...(plan.columns ?? [])]
        .some(requiresTerminalIsolatedPin);
}

function collectDemands(plan, demands) {
    if (!plan) return;
    if (['solid-component', 'solid-upper-component'].includes(plan.kind)) {
        const shape = Shape.fromShapeCode(plan.target);
        for (const { quadrant, part } of occupiedCells(shape)) {
            demands.push({
                id: `demand-${demands.length}`, kind: 'exact', quadrant,
                part: { shape: part.shape, color: part.color },
            });
        }
        return;
    }
    if (plan.kind === 'protected-spatial-crystal-staging') {
        const shape = Shape.fromShapeCode(plan.target);
        for (const layer of shape.layers) {
            for (let quadrant = 0; quadrant < layer.length; quadrant += 1) {
                const part = layer[quadrant];
                if (part.shape === PART_CODES.CRYSTAL) continue;
                demands.push(part.shape === PART_CODES.NOTHING
                    ? { id: `demand-${demands.length}`, kind: 'sacrifice', quadrant, part: null }
                    : {
                        id: `demand-${demands.length}`, kind: 'exact', quadrant,
                        part: { shape: part.shape, color: part.color },
                    });
            }
        }
        return;
    }
    if (plan.kind === 'delegated-crystal-component') {
        throw new Error('delegated-crystal-component is outside the frozen E-010 stage');
    }
    if (plan.kind === 'crystal-pin-column-transition' && !plan.upper) {
        throw new Error('terminal isolated Pin is outside the frozen E-010 stage');
    }
    if (plan.kind === 'mixed-pin-crystal-state-transition') {
        collectDemands(plan.prerequisite.left, demands);
        collectDemands(plan.prerequisite.right, demands);
        collectDemands(plan.upper, demands);
        return;
    }
    if (plan.kind === 'support-safe-column-composition'
        || plan.kind === 'quarter-column-recomposition') {
        for (const column of plan.columns) collectDemands(column, demands);
        return;
    }
    if (plan.kind === 'crystal-to-pin-support-transition') {
        collectDemands(plan.upper, demands);
        return;
    }
    if (plan.kind === 'crystal-pin-column-transition') {
        collectDemands(plan.lower, demands);
        collectDemands(plan.upper, demands);
        return;
    }
    if (plan.kind === 'mixed-base-upper-transition') {
        collectDemands(plan.base, demands);
        collectDemands(plan.upper, demands);
        return;
    }
    throw new Error(`Unsupported mixed plan node ${plan.kind}`);
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

class PhysicalPlanBuilder {
    constructor(enabled, operationConfig, atomForDemand, demands) {
        this.enabled = enabled;
        this.operationConfig = operationConfig;
        this.atomForDemand = atomForDemand;
        this.demands = demands;
        this.demandCursor = 0;
    }

    takeDemand(kind, part, quadrant) {
        const demand = this.demands[this.demandCursor++];
        if (!demand || demand.kind !== kind || demand.quadrant !== quadrant
            || (kind === 'exact' && partCode(demand.part) !== partCode(part))) {
            throw new Error('Mixed construction demand traversal drifted from its frozen allocation');
        }
        const atom = this.atomForDemand(demand);
        if (!atom) throw new Error(`Unable to materialize ${demand.id}`);
        return atom;
    }

    outputs(operation, inputs, color = null) {
        if (!this.enabled.has(operation)) throw new Error(`Required operation disabled: ${operation}`);
        const shapes = inputs.map(value => Shape.fromShapeCode(value.code));
        let outputShapes;
        try {
            if (operation === 'Cutter') outputShapes = cut(shapes[0], this.operationConfig);
            else if (operation === 'Rotator CW') outputShapes = rotate90CW(shapes[0], this.operationConfig);
            else if (operation === 'Rotator CCW') outputShapes = rotate90CCW(shapes[0], this.operationConfig);
            else if (operation === 'Stacker') outputShapes = stack(shapes[0], shapes[1], this.operationConfig);
            else if (operation === 'Swapper') outputShapes = swapHalves(shapes[0], shapes[1], this.operationConfig);
            else if (operation === 'Pin Pusher') outputShapes = pushPin(shapes[0], this.operationConfig);
            else if (operation === 'Crystal Generator') outputShapes = genCrystal(shapes[0], color, this.operationConfig);
            else throw new Error(`Unsupported construction operation ${operation}`);
        } catch (error) {
            if (error instanceof InvalidOperationInputs) return [];
            throw error;
        }
        const outputCodes = outputShapes.filter(shape => !shape.isEmpty()).map(shape => shape.toShapeCode());
        return outputCodes.map((code, selectedOutput) => ({
            code,
            plan: operationNode(
                operation, inputs.map(value => value.plan), inputs.map(value => value.code),
                outputCodes, selectedOutput, color,
            ),
        }));
    }

    select(operation, inputs, expected, color = null) {
        return this.outputs(operation, inputs, color).find(value => value.code === expected) ?? null;
    }

    first(operation, inputs, color = null) {
        return this.outputs(operation, inputs, color)[0] ?? null;
    }

    combineDisjoint(values) {
        if (!values.length) throw new Error('Cannot combine an empty component list');
        let result = values[0];
        for (const value of values.slice(1)) {
            result = this.first('Stacker', [result, value]);
            if (!result) throw new Error('Disjoint Stacker composition failed');
        }
        return result;
    }

    stackLayers(values) {
        return this.combineDisjoint(values);
    }

    rotateToCode(value, expected) {
        if (value.code === expected) return value;
        let current = value;
        for (let turns = 0; turns < 3; turns += 1) {
            current = this.first('Rotator CW', [current]);
            if (!current) return null;
            if (current.code === expected) return current;
        }
        return null;
    }

    partitionIntoColumns(value) {
        const pending = [value];
        const result = [];
        while (pending.length) {
            let current = pending.pop();
            const quadrants = new Set(occupiedCells(Shape.fromShapeCode(current.code))
                .map(cell => cell.quadrant));
            if (quadrants.size <= 1) {
                result.push(current);
                continue;
            }
            let split = null;
            for (let turns = 0; turns < 4 && !split; turns += 1) {
                const beforeCount = occupiedCells(Shape.fromShapeCode(current.code)).length;
                const preview = cut(Shape.fromShapeCode(current.code), this.operationConfig)
                    .filter(shape => !shape.isEmpty());
                const afterCount = preview.reduce((sum, shape) => sum + occupiedCells(shape).length, 0);
                if (preview.length === 2 && beforeCount === afterCount) {
                    split = this.outputs('Cutter', [current]);
                    break;
                }
                current = this.first('Rotator CW', [current]);
            }
            if (!split) throw new Error(`Cannot partition ${current.code} into columns`);
            pending.push(...split);
        }
        return result;
    }
}

function buildPlanNode(builder, plan) {
    if (['solid-component', 'solid-upper-component'].includes(plan.kind)) {
        const shape = Shape.fromShapeCode(plan.target);
        const layerPlans = shape.layers.map(layer => builder.combineDisjoint(layer
            .map((part, quadrant) => part.shape === PART_CODES.NOTHING
                ? null : builder.takeDemand('exact', part, quadrant))
            .filter(Boolean)));
        const result = builder.stackLayers(layerPlans);
        if (result.code !== plan.target) throw new Error(`Solid construction ${result.code} != ${plan.target}`);
        return result;
    }
    if (plan.kind === 'protected-spatial-crystal-staging') {
        const shape = Shape.fromShapeCode(plan.target);
        let staged = null;
        for (const layer of shape.layers) {
            const crystalColors = [...new Set(layer
                .filter(part => part.shape === PART_CODES.CRYSTAL).map(part => part.color))];
            if (crystalColors.length > 1) throw new Error('Protected stage has multiple Crystal colors');
            const cage = builder.combineDisjoint(layer.map((part, quadrant) => {
                if (part.shape === PART_CODES.CRYSTAL) return null;
                if (part.shape === PART_CODES.NOTHING) {
                    return builder.takeDemand('sacrifice', null, quadrant);
                }
                return builder.takeDemand('exact', part, quadrant);
            }).filter(Boolean));
            staged = staged === null ? cage : builder.first('Stacker', [staged, cage]);
            if (!staged) throw new Error('Protected stage stacking failed');
            if (crystalColors.length) {
                staged = builder.first('Crystal Generator', [staged], crystalColors[0]);
                if (!staged) throw new Error('Protected Crystal generation failed');
            }
        }
        if (plan.quadrants.length === 2) {
            const result = builder.select('Cutter', [staged], plan.target);
            if (!result) throw new Error(`Protected half extraction did not produce ${plan.target}`);
            return result;
        }
        const columns = builder.partitionIntoColumns(staged);
        for (const column of columns) {
            const rotated = builder.rotateToCode(column, plan.target);
            if (rotated) return rotated;
        }
        throw new Error(`Protected column extraction did not produce ${plan.target}`);
    }
    if (plan.kind === 'crystal-to-pin-support-transition') {
        let result = buildPlanNode(builder, plan.upper);
        result = builder.select('Pin Pusher', [result], plan.target);
        if (!result) throw new Error(`Pin support transition did not produce ${plan.target}`);
        return result;
    }
    if (plan.kind === 'crystal-pin-column-transition') {
        if (!plan.upper) throw new Error('Terminal isolated Pin is outside the frozen E-010 stage');
        let pinned = buildPlanNode(builder, plan.upper);
        for (let index = 0; index < plan.pinRunLength; index += 1) {
            pinned = builder.first('Pin Pusher', [pinned]);
            if (!pinned) throw new Error('Pin column transition failed');
        }
        const result = plan.lower
            ? builder.select('Stacker', [buildPlanNode(builder, plan.lower), pinned], plan.target)
            : (pinned.code === plan.target ? pinned : null);
        if (!result) throw new Error(`Pin column transition did not produce ${plan.target}`);
        return result;
    }
    if (plan.kind === 'mixed-base-upper-transition') {
        const result = builder.select('Stacker', [
            buildPlanNode(builder, plan.base), buildPlanNode(builder, plan.upper),
        ], plan.target);
        if (!result) throw new Error(`Mixed base/upper transition did not produce ${plan.target}`);
        return result;
    }
    if (plan.kind === 'support-safe-column-composition') {
        const columns = plan.columns.map(column => buildPlanNode(builder, column));
        let result = columns[0];
        for (const column of columns.slice(1)) {
            result = builder.first('Stacker', [result, column]);
            if (!result) throw new Error('Support-safe column composition failed');
        }
        if (result.code !== plan.target) throw new Error(`Column composition ${result.code} != ${plan.target}`);
        return result;
    }
    if (plan.kind === 'quarter-column-recomposition') {
        const rotation = plan.routeDirection === 'CW' ? 'Rotator CW' : 'Rotator CCW';
        const inverse = plan.inverseDirection === 'CW' ? 'Rotator CW' : 'Rotator CCW';
        const routed = plan.columns.map(column => builder.first(rotation, [buildPlanNode(builder, column)]));
        if (routed.some(value => !value)) throw new Error('Quarter-column routing failed');
        const targetShape = Shape.fromShapeCode(plan.target);
        const middleShape = (plan.routeDirection === 'CW' ? rotate90CW : rotate90CCW)(
            targetShape, builder.operationConfig,
        )[0].toShapeCode();
        const middle = builder.select('Swapper', routed, middleShape);
        const result = middle && builder.select(inverse, [middle], plan.target);
        if (!result) throw new Error(`Quarter-column recomposition did not produce ${plan.target}`);
        return result;
    }
    throw new Error(`Unsupported mixed plan node ${plan.kind}`);
}

function buildMixedTarget(builder, plan) {
    const left = buildPlanNode(builder, plan.prerequisite.left);
    const right = buildPlanNode(builder, plan.prerequisite.right);
    const lowerTarget = plan.workingTarget.split(':').slice(0, plan.splitLayer).join(':');
    let result = builder.select('Swapper', [left, right], lowerTarget);
    if (!result) throw new Error(`Mixed recomposition did not produce ${lowerTarget}`);
    if (plan.upper) {
        result = builder.select('Stacker', [result, buildPlanNode(builder, plan.upper)], plan.workingTarget);
        if (!result) throw new Error(`Mixed upper attachment did not produce ${plan.workingTarget}`);
    }
    for (let turn = 0; turn < plan.rotationTurns; turn += 1) {
        result = builder.first('Rotator CCW', [result]);
        if (!result) throw new Error('Mixed inverse rotation failed');
    }
    if (result.code !== plan.target) throw new Error(`Mixed construction ${result.code} != ${plan.target}`);
    return result;
}

/** Experimental architecture; it deliberately accepts only public Solver input. */
export async function mixedPinCrystalGoalDecomposedSolve(instance, experimentConfig) {
    const limits = pinGoalDecomposedTestOnly.validateConfig(experimentConfig);
    const started = performance.now();
    const counters = { extractionStates: 0, matchingTransitions: 0 };
    const timedOut = () => performance.now() - started >= limits.maxWallMs;
    const targetCodes = instance.targetShapeCodes ?? [];
    const startingShapeCodes = instance.startingShapeCodes ?? [];
    const enabled = new Set(instance.enabledOperations ?? []);
    const operationConfig = new ShapeOperationConfig(instance.maxLayers ?? 4);

    if (targetCodes.length !== 1) {
        return resultBase(limits, started, counters, {
            solutionPath: null, depth: 0, statesExplored: 0, generatedStates: 0,
            outcome: 'exhausted', beamPruned: false, architectureStatus: 'unsupported-domain',
        });
    }
    const target = Shape.fromShapeCode(targetCodes[0]);
    const mixed = hasPart(target, PART_CODES.PIN) && hasPart(target, PART_CODES.CRYSTAL);
    if (!mixed) {
        const delegated = await crystalScaffoldGoalDecomposedSolve(instance, limits);
        return {
            ...delegated,
            architecture: ARCHITECTURE,
            architectureConfig: limits.id,
            component: 'crystal-scaffold-gdcs-v1',
        };
    }
    if (instance.allowSplitting || instance.preventWaste || target.numParts !== 4) {
        return resultBase(limits, started, counters, {
            solutionPath: null, depth: 0, statesExplored: 0, generatedStates: 0,
            outcome: 'exhausted', beamPruned: false, architectureStatus: 'unsupported-domain',
        });
    }

    let structuralPlan;
    try {
        structuralPlan = planMixedPinCrystalSubassembly(target.toShapeCode(), operationConfig.maxShapeLayers);
    } catch (error) {
        return resultBase(limits, started, counters, {
            solutionPath: null, depth: 0, statesExplored: 0, generatedStates: 0,
            outcome: 'exhausted', beamPruned: false, architectureStatus: 'unsupported-mixed-layout',
            mixedLayoutError: error.message,
        });
    }
    if (requiresTerminalIsolatedPin(structuralPlan)) {
        return resultBase(limits, started, counters, {
            solutionPath: null, depth: 0, statesExplored: 0, generatedStates: 0,
            outcome: 'exhausted', beamPruned: false,
            architectureStatus: 'unsupported-terminal-isolated-pin',
        });
    }

    const demands = [];
    try {
        collectDemands(structuralPlan, demands);
    } catch (error) {
        return resultBase(limits, started, counters, {
            solutionPath: null, depth: 0, statesExplored: 0, generatedStates: 0,
            outcome: 'exhausted', beamPruned: false, architectureStatus: 'unsupported-mixed-layout',
            mixedLayoutError: error.message,
        });
    }
    const recipeCache = new Map();
    function recipeFor(sourceIndex, demand) {
        const sourceCode = startingShapeCodes[sourceIndex];
        const signature = demand.kind === 'exact'
            ? `${demand.part.shape}\u0000${demand.part.color}` : '*ordinary*';
        const key = `${sourceCode}\u0000${signature}`;
        if (!recipeCache.has(key)) {
            const localCounters = { extractionStates: 0 };
            const predicate = demand.kind === 'exact'
                ? part => canFinishCell(part, demand.part)
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
        if (!augment(demand.id, new Set())) {
            matched = false;
            break;
        }
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
            architectureStatus: 'resource-mismatch', mixedDemandCount: demands.length,
        });
    }

    const demandSource = new Map();
    sourceMatch.forEach((demandId, sourceIndex) => {
        if (demandId !== null) demandSource.set(demandId, sourceIndex);
    });
    function atomForDemand(demand) {
        const sourceIndex = demandSource.get(demand.id);
        const recipe = recipeFor(sourceIndex, demand);
        const leaf = Object.freeze({ kind: 'leaf', inputId: sourceIndex, code: startingShapeCodes[sourceIndex] });
        const wrapped = wrapRecipe(leaf, recipe);
        return demand.kind === 'exact'
            ? finishAtom(wrapped, demand, enabled, operationConfig)
            : rotateAtom(wrapped, demand.quadrant, enabled, operationConfig);
    }

    let goal;
    try {
        const builder = new PhysicalPlanBuilder(enabled, operationConfig, atomForDemand, demands);
        goal = buildMixedTarget(builder, structuralPlan);
        if (builder.demandCursor !== demands.length) throw new Error('Not all mixed demands were consumed');
    } catch (error) {
        return resultBase(limits, started, counters, {
            solutionPath: null, depth: 0, statesExplored: counters.extractionStates,
            generatedStates: counters.matchingTransitions, outcome: 'exhausted', beamPruned: false,
            architectureStatus: error.message.startsWith('Required operation disabled:')
                ? 'unsupported-domain' : 'construction-failed',
            constructionError: error.message,
        });
    }
    const solutionPath = materializePlan(goal.plan, startingShapeCodes);
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
        component: 'mixed-pin-crystal-support-safe-v1', mixedDemandCount: demands.length,
        mixedPlanKind: structuralPlan.kind,
    });
}

export const mixedPinCrystalGoalDecomposedTestOnly = Object.freeze({
    collectDemands,
    requiresTerminalIsolatedPin,
});
