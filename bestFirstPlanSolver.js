import {
    Shape, ShapeOperationConfig, InvalidOperationInputs,
    _getAllRotations, _getPaintColors,
    halfCut, cut, swapHalves, rotate90CW, rotate90CCW, rotate180,
    stack, topPaint, pushPin, genCrystal,
} from './shapeOperations.js';
import { PART_CODES, UNCOLORED_CODE, UNPAINTABLE_PARTS } from './shapeConstants.js';

const ARCHITECTURE = 'bounded-best-first-plan-synthesis-v1';

const OPERATIONS = Object.freeze({
    'Rotator CW': { fn: rotate90CW, inputCount: 1 },
    'Rotator CCW': { fn: rotate90CCW, inputCount: 1 },
    'Rotator 180': { fn: rotate180, inputCount: 1 },
    'Half Destroyer': { fn: halfCut, inputCount: 1 },
    Cutter: { fn: cut, inputCount: 1 },
    Swapper: { fn: swapHalves, inputCount: 2 },
    Stacker: { fn: stack, inputCount: 2 },
    Painter: { fn: topPaint, inputCount: 1, needsColor: true },
    'Pin Pusher': { fn: pushPin, inputCount: 1 },
    'Crystal Generator': { fn: genCrystal, inputCount: 1, needsColor: true },
});

const CONFIG_KEYS = Object.freeze([
    'id', 'maxOperations', 'maxChartNodes', 'maxExpandedNodes',
    'maxCandidateAttempts', 'maxVariantsPerShape', 'maxPartnerPool',
    'maxPartnersPerExpansion', 'maxWallMs',
]);

function validateConfig(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Best-first plan configuration must be an object');
    }
    for (const key of Object.keys(value)) {
        if (!CONFIG_KEYS.includes(key)) throw new Error(`Unknown best-first configuration key: ${key}`);
    }
    for (const key of CONFIG_KEYS.filter(key => key !== 'id' && key !== 'maxWallMs')) {
        if (!Number.isInteger(value[key]) || value[key] < 1) {
            throw new Error(`Best-first ${key} must be a positive integer`);
        }
    }
    if (typeof value.id !== 'string' || value.id.length === 0) {
        throw new Error('Best-first id must be a non-empty string');
    }
    if (!Number.isFinite(value.maxWallMs) || value.maxWallMs <= 0) {
        throw new Error('Best-first maxWallMs must be positive and finite');
    }
    return Object.freeze({ ...value });
}

function countBits(mask) {
    let value = mask;
    let count = 0;
    while (value) {
        value &= value - 1n;
        count += 1;
    }
    return count;
}

function partAttainable(part, targetPart) {
    if (part.shape !== targetPart.shape) return false;
    if (UNPAINTABLE_PARTS.includes(part.shape)) return part.color === targetPart.color;
    return part.color === targetPart.color || part.color === UNCOLORED_CODE;
}

function createTargetAnalysis(targets, config, orientationSensitive) {
    const variants = [];
    const acceptableCodes = new Set();
    const partKeys = new Set();
    const shapeKinds = new Set();
    let targetOccupied = 0;
    for (const target of targets) {
        for (const layer of target.layers) for (const part of layer) {
            if (part.shape === PART_CODES.NOTHING) continue;
            targetOccupied += 1;
            partKeys.add(`${part.shape}:${part.color}`);
            shapeKinds.add(part.shape);
        }
        const codes = orientationSensitive ? [target.toShapeCode()] : [..._getAllRotations(target, config)];
        for (const code of codes) {
            acceptableCodes.add(code);
            variants.push(Shape.fromShapeCode(code));
        }
    }
    const cache = new Map();

    return {
        acceptableCodes,
        targetOccupied,
        analyze(shapeOrCode) {
            const code = typeof shapeOrCode === 'string' ? shapeOrCode : shapeOrCode.toShapeCode();
            const cached = cache.get(code);
            if (cached) return cached;
            const shape = typeof shapeOrCode === 'string' ? Shape.fromShapeCode(shapeOrCode) : shapeOrCode;
            let occupied = 0;
            let support = 0;
            for (const layer of shape.layers) for (const part of layer) {
                if (part.shape === PART_CODES.NOTHING) continue;
                occupied += 1;
                if (partKeys.has(`${part.shape}:${part.color}`)
                    || (!UNPAINTABLE_PARTS.includes(part.shape)
                        && part.color === UNCOLORED_CODE && shapeKinds.has(part.shape))) support += 1;
            }

            let best = null;
            for (const target of variants) {
                if (shape.numParts !== target.numParts) continue;
                const maxOffset = Math.max(0, target.numLayers - shape.numLayers);
                for (let offset = 0; offset <= maxOffset; offset += 1) {
                    let coverage = 0;
                    let exactColors = 0;
                    let conflicts = 0;
                    for (let layerIndex = 0; layerIndex < shape.numLayers; layerIndex += 1) {
                        for (let partIndex = 0; partIndex < shape.numParts; partIndex += 1) {
                            const part = shape.layers[layerIndex][partIndex];
                            if (part.shape === PART_CODES.NOTHING) continue;
                            const targetPart = target.layers[layerIndex + offset]?.[partIndex];
                            if (!targetPart || !partAttainable(part, targetPart)) {
                                conflicts += 1;
                                continue;
                            }
                            coverage += 1;
                            if (part.color === targetPart.color) exactColors += 1;
                        }
                    }
                    const candidate = { coverage, exactColors, conflicts };
                    if (!best || coverage * 8 + exactColors - conflicts * 12
                        > best.coverage * 8 + best.exactColors - best.conflicts * 12) best = candidate;
                }
            }
            best ??= { coverage: 0, exactColors: 0, conflicts: occupied };
            const compatible = occupied > 0 && best.conflicts === 0 && best.coverage === occupied;
            const result = Object.freeze({
                code,
                goal: acceptableCodes.has(code),
                compatible,
                coverage: best.coverage,
                exactColors: best.exactColors,
                conflicts: best.conflicts,
                support,
                occupied,
                occupancyGap: Math.abs(targetOccupied - occupied),
            });
            cache.set(code, result);
            return result;
        },
    };
}

function compareNodes(a, b) {
    const aa = a.analysis;
    const bb = b.analysis;
    const fields = [
        [aa.goal ? 1 : 0, bb.goal ? 1 : 0],
        [aa.compatible ? 1 : 0, bb.compatible ? 1 : 0],
        [aa.coverage, bb.coverage],
        [aa.exactColors, bb.exactColors],
        [aa.support, bb.support],
        [-aa.conflicts, -bb.conflicts],
        [-aa.occupancyGap, -bb.occupancyGap],
        [-countBits(a.mask), -countBits(b.mask)],
        [-a.cost, -b.cost],
        [-a.id, -b.id],
    ];
    for (const [left, right] of fields) if (left !== right) return left - right;
    return 0;
}

class MaxHeap {
    constructor(compare) {
        this.values = [];
        this.compare = compare;
    }

    push(value) {
        const values = this.values;
        values.push(value);
        let index = values.length - 1;
        while (index > 0) {
            const parent = Math.floor((index - 1) / 2);
            if (this.compare(values[parent], value) >= 0) break;
            values[index] = values[parent];
            index = parent;
        }
        values[index] = value;
    }

    pop() {
        if (this.values.length === 0) return null;
        const root = this.values[0];
        const tail = this.values.pop();
        if (this.values.length === 0) return root;
        let index = 0;
        while (true) {
            const left = index * 2 + 1;
            if (left >= this.values.length) break;
            const right = left + 1;
            let child = left;
            if (right < this.values.length && this.compare(this.values[right], this.values[left]) > 0) child = right;
            if (this.compare(this.values[child], tail) <= 0) break;
            this.values[index] = this.values[child];
            index = child;
        }
        this.values[index] = tail;
        return root;
    }
}

function targetColors(targets, shapeFilter = null) {
    const colors = new Set();
    for (const target of targets) for (const layer of target.layers) for (const part of layer) {
        if (part.color === UNCOLORED_CODE) continue;
        if (shapeFilter ? part.shape === shapeFilter : !UNPAINTABLE_PARTS.includes(part.shape)) colors.add(part.color);
    }
    return [...colors].sort();
}

function physicalOutputs(definition, inputShapes, color, operationConfig) {
    try {
        const args = definition.needsColor
            ? [...inputShapes, color, operationConfig]
            : [...inputShapes, operationConfig];
        return definition.fn(...args).filter(shape => !shape.isEmpty()).map(shape => shape.toShapeCode());
    } catch (error) {
        if (error instanceof InvalidOperationInputs) return null;
        throw error;
    }
}

function materializePlan(plan, startingShapeCodes) {
    let nextId = startingShapeCodes.length;
    const steps = [];
    function execute(node) {
        if (node.kind === 'leaf') return node.inputId;
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

function resultBase(config, started, chartNodes, expandedNodes, candidateAttempts, extra = {}) {
    return {
        architecture: ARCHITECTURE,
        architectureConfig: config.id,
        chartNodes,
        expandedNodes,
        candidateAttempts,
        wallMs: performance.now() - started,
        ...extra,
    };
}

/** Experimental architecture. Benchmark identity and witness fields are intentionally absent. */
export async function bestFirstPlanSolve(instance, experimentConfig) {
    const limits = validateConfig(experimentConfig);
    const started = performance.now();
    const targets = (instance.targetShapeCodes ?? []).map(code => Shape.fromShapeCode(code));
    const startingShapeCodes = instance.startingShapeCodes ?? [];
    const operationConfig = new ShapeOperationConfig(instance.maxLayers ?? 4);
    const enabled = new Set(instance.enabledOperations ?? []);
    if (targets.length !== 1 || instance.allowSplitting || instance.preventWaste) {
        return resultBase(limits, started, 0, 0, 0, {
            solutionPath: null, depth: 0, statesExplored: 0, generatedStates: 0,
            outcome: 'exhausted', beamPruned: false, architectureStatus: 'unsupported-domain',
        });
    }

    const target = createTargetAnalysis(targets, operationConfig, instance.orientationSensitive === true);
    const paintColors = targetColors(targets);
    const crystalColors = targetColors(targets, PART_CODES.CRYSTAL);
    const nodes = [];
    const byShape = new Map();
    const queue = new MaxHeap(compareNodes);
    const partnerPool = [];
    let activeNodes = 0;
    let expandedNodes = 0;
    let candidateAttempts = 0;
    let limitReason = null;
    let goalNode = null;

    function timedOut() {
        return performance.now() - started >= limits.maxWallMs;
    }

    function refreshPartnerPool(node) {
        partnerPool.push(node);
        partnerPool.sort((a, b) => compareNodes(b, a));
        if (partnerPool.length > limits.maxPartnerPool) partnerPool.length = limits.maxPartnerPool;
    }

    function addNode(code, mask, cost, plan) {
        if (cost > limits.maxOperations || limitReason || goalNode) return null;
        const variants = byShape.get(code) ?? [];
        for (const id of variants) {
            const existing = nodes[id];
            if (existing?.active && (existing.mask & mask) === existing.mask && existing.cost <= cost) return null;
        }
        for (const id of variants) {
            const existing = nodes[id];
            if (existing?.active && (existing.mask & mask) === mask && cost <= existing.cost) {
                existing.active = false;
                activeNodes -= 1;
            }
        }
        const node = {
            id: nodes.length,
            code,
            shape: Shape.fromShapeCode(code),
            mask,
            cost,
            plan,
            analysis: target.analyze(code),
            active: true,
            expanded: false,
        };
        nodes.push(node);
        variants.push(node.id);
        byShape.set(code, variants);
        activeNodes += 1;

        const activeVariants = variants.map(id => nodes[id]).filter(row => row.active);
        if (activeVariants.length > limits.maxVariantsPerShape) {
            activeVariants.sort((a, b) => compareNodes(b, a));
            for (const removed of activeVariants.slice(limits.maxVariantsPerShape)) {
                removed.active = false;
                activeNodes -= 1;
            }
            if (!node.active) return null;
        }
        queue.push(node);
        refreshPartnerPool(node);
        if (node.analysis.goal) goalNode = node;
        if (nodes.length >= limits.maxChartNodes && !goalNode) limitReason = 'chart-nodes';
        return node;
    }

    function attempt(operation, inputNodes, color = null) {
        if (limitReason || goalNode) return;
        if (candidateAttempts >= limits.maxCandidateAttempts) {
            limitReason = 'candidate-attempts';
            return;
        }
        if (timedOut()) {
            limitReason = 'time';
            return;
        }
        candidateAttempts += 1;
        const definition = OPERATIONS[operation];
        const outputs = physicalOutputs(definition, inputNodes.map(node => node.shape), color, operationConfig);
        if (outputs === null || outputs.length === 0) return;
        if (definition.inputCount === 1 && outputs.length === 1 && outputs[0] === inputNodes[0].code) return;
        const mask = inputNodes.reduce((value, node) => value | node.mask, 0n);
        const cost = inputNodes.reduce((value, node) => value + node.cost, 0) + 1;
        if (cost > limits.maxOperations) return;
        for (const [selectedOutput, code] of outputs.entries()) {
            addNode(code, mask, cost, {
                kind: 'operation', operation,
                inputs: inputNodes.map(node => node.plan),
                inputCodes: inputNodes.map(node => node.code),
                outputCodes: outputs,
                selectedOutput,
                color,
            });
            if (limitReason || goalNode) break;
        }
    }

    for (const [inputId, code] of startingShapeCodes.entries()) {
        addNode(code, 1n << BigInt(inputId), 0, { kind: 'leaf', inputId });
        if (goalNode || limitReason) break;
    }

    while (!goalNode && !limitReason) {
        if (expandedNodes >= limits.maxExpandedNodes) {
            limitReason = 'expanded-nodes';
            break;
        }
        if (timedOut()) {
            limitReason = 'time';
            break;
        }
        const node = queue.pop();
        if (!node) break;
        if (!node.active || node.expanded) continue;
        node.expanded = true;
        expandedNodes += 1;

        for (const operation of instance.enabledOperations ?? []) {
            const definition = OPERATIONS[operation];
            if (!definition || definition.inputCount !== 1) continue;
            if (definition.needsColor) {
                const colors = operation === 'Crystal Generator'
                    ? crystalColors
                    : [...new Set([...paintColors, ...targets.flatMap(value => _getPaintColors(node.shape, value))])].sort();
                if (operation === 'Painter' && instance.cleanPainting
                    && (node.shape.numLayers !== 1 || !node.shape.layers[0].every(part =>
                        UNPAINTABLE_PARTS.includes(part.shape) || part.color === UNCOLORED_CODE))) continue;
                for (const color of colors) attempt(operation, [node], color);
            } else {
                attempt(operation, [node]);
            }
            if (goalNode || limitReason) break;
        }

        if (goalNode || limitReason) break;
        let paired = 0;
        for (const partner of partnerPool) {
            if (paired >= limits.maxPartnersPerExpansion) break;
            if (!partner.active || partner.id === node.id || (partner.mask & node.mask) !== 0n) continue;
            paired += 1;
            if (enabled.has('Swapper')) attempt('Swapper', [node, partner]);
            if (enabled.has('Stacker')) {
                attempt('Stacker', [node, partner]);
                if (!goalNode && !limitReason) attempt('Stacker', [partner, node]);
            }
            if (goalNode || limitReason) break;
        }
    }

    if (goalNode) {
        const solutionPath = materializePlan(goalNode.plan, startingShapeCodes);
        return resultBase(limits, started, activeNodes, expandedNodes, candidateAttempts, {
            solutionPath,
            depth: solutionPath.length,
            statesExplored: activeNodes,
            generatedStates: candidateAttempts,
            outcome: 'solved',
            beamPruned: false,
            architectureStatus: 'solved',
            resourceMask: goalNode.mask.toString(),
        });
    }

    return resultBase(limits, started, activeNodes, expandedNodes, candidateAttempts, {
        solutionPath: null,
        depth: limits.maxOperations,
        statesExplored: activeNodes,
        generatedStates: candidateAttempts,
        outcome: limitReason ? 'limit' : 'exhausted',
        limitReached: !!limitReason,
        limitReason,
        beamPruned: false,
        architectureStatus: limitReason ? 'limited' : 'exhausted',
    });
}

export const bestFirstPlanTestOnly = Object.freeze({
    compareNodes,
    countBits,
    createTargetAnalysis,
    validateConfig,
});
