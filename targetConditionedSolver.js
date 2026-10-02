import {
    Shape, ShapeOperationConfig, InvalidOperationInputs,
    _getAllRotations, _getPaintColors,
    halfCut, cut, swapHalves, rotate90CW, rotate90CCW, rotate180,
    stack, topPaint, pushPin, genCrystal,
} from './shapeOperations.js';
import { PART_CODES, UNCOLORED_CODE, UNPAINTABLE_PARTS } from './shapeConstants.js';

const OPERATIONS = Object.freeze({
    'Rotator CW': { fn: rotate90CW, inputCount: 1 },
    'Rotator CCW': { fn: rotate90CCW, inputCount: 1 },
    'Rotator 180': { fn: rotate180, inputCount: 1 },
    'Half Destroyer': { fn: halfCut, inputCount: 1 },
    Cutter: { fn: cut, inputCount: 1 },
    Swapper: { fn: swapHalves, inputCount: 2, commutative: true },
    Stacker: { fn: stack, inputCount: 2 },
    Painter: { fn: topPaint, inputCount: 1, needsColor: true },
    'Pin Pusher': { fn: pushPin, inputCount: 1 },
    'Crystal Generator': { fn: genCrystal, inputCount: 1, needsColor: true },
});

const CONFIG_KEYS = Object.freeze([
    'id', 'admissionMode', 'maxOperations', 'maxChartNodes',
    'maxCandidateAttempts', 'maxVariantsPerShape', 'maxWallMs',
]);

function validateExperimentConfig(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Target-conditioned configuration must be an object');
    }
    for (const key of Object.keys(value)) {
        if (!CONFIG_KEYS.includes(key)) throw new Error(`Unknown target-conditioned configuration key: ${key}`);
    }
    if (!['strict-subgoal', 'progressive-subgoal'].includes(value.admissionMode)) {
        throw new Error('Unknown target-conditioned admission mode');
    }
    for (const key of ['maxOperations', 'maxChartNodes', 'maxCandidateAttempts', 'maxVariantsPerShape']) {
        if (!Number.isInteger(value[key]) || value[key] < 1) {
            throw new Error(`Target-conditioned ${key} must be a positive integer`);
        }
    }
    if (!Number.isFinite(value.maxWallMs) || value.maxWallMs <= 0) {
        throw new Error('Target-conditioned maxWallMs must be positive and finite');
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

function isOrdinary(shape) {
    return shape.layers.every(layer => layer.every(part =>
        part.shape !== PART_CODES.PIN && part.shape !== PART_CODES.CRYSTAL));
}

function targetColors(targets) {
    const colors = new Set();
    for (const target of targets) for (const layer of target.layers) for (const part of layer) {
        if (!UNPAINTABLE_PARTS.includes(part.shape) && part.color !== UNCOLORED_CODE) colors.add(part.color);
    }
    return [...colors].sort();
}

function targetPartKeys(targets) {
    const keys = new Set();
    for (const target of targets) for (const layer of target.layers) for (const part of layer) {
        if (part.shape !== PART_CODES.NOTHING) keys.add(`${part.shape}:${part.color}`);
    }
    return keys;
}

function createTargetAnalysis(targets, config, orientationSensitive) {
    const variants = [];
    const acceptableCodes = new Set();
    for (const target of targets) {
        const codes = orientationSensitive
            ? [target.toShapeCode()]
            : [..._getAllRotations(target, config)];
        for (const code of codes) {
            acceptableCodes.add(code);
            variants.push(Shape.fromShapeCode(code));
        }
    }
    const relevantParts = targetPartKeys(targets);
    const relevantUncoloredTypes = new Set([...relevantParts].map(key => key.split(':', 1)[0]));
    const cache = new Map();

    return {
        acceptableCodes,
        analyze(shapeOrCode) {
            const code = typeof shapeOrCode === 'string' ? shapeOrCode : shapeOrCode.toShapeCode();
            const cached = cache.get(code);
            if (cached) return cached;
            const shape = typeof shapeOrCode === 'string' ? Shape.fromShapeCode(shapeOrCode) : shapeOrCode;
            let bestCoverage = 0;
            let bestScore = -Infinity;
            let compatible = false;
            let relevant = false;
            let occupied = 0;
            for (const layer of shape.layers) for (const part of layer) {
                if (part.shape === PART_CODES.NOTHING) continue;
                occupied += 1;
                if (relevantParts.has(`${part.shape}:${part.color}`)
                    || (!UNPAINTABLE_PARTS.includes(part.shape)
                        && part.color === UNCOLORED_CODE
                        && relevantUncoloredTypes.has(part.shape))) {
                    relevant = true;
                }
            }

            for (const target of variants) {
                if (shape.numParts !== target.numParts || shape.numLayers > target.numLayers) continue;
                for (let offset = 0; offset <= target.numLayers - shape.numLayers; offset += 1) {
                    let coverage = 0;
                    let exactColors = 0;
                    let conflicts = 0;
                    for (let layerIndex = 0; layerIndex < shape.numLayers; layerIndex += 1) {
                        for (let partIndex = 0; partIndex < shape.numParts; partIndex += 1) {
                            const part = shape.layers[layerIndex][partIndex];
                            if (part.shape === PART_CODES.NOTHING) continue;
                            const targetPart = target.layers[layerIndex + offset][partIndex];
                            if (part.shape !== targetPart.shape) {
                                conflicts += 1;
                                continue;
                            }
                            const colorAttainable = UNPAINTABLE_PARTS.includes(part.shape)
                                ? part.color === targetPart.color
                                : part.color === targetPart.color || part.color === UNCOLORED_CODE;
                            if (!colorAttainable) {
                                conflicts += 1;
                                continue;
                            }
                            coverage += 1;
                            if (part.color === targetPart.color) exactColors += 1;
                        }
                    }
                    if (occupied > 0 && conflicts === 0 && coverage === occupied) compatible = true;
                    bestCoverage = Math.max(bestCoverage, conflicts === 0 ? coverage : 0);
                    bestScore = Math.max(bestScore, coverage * 4 + exactColors - conflicts * 7);
                }
            }
            if (!Number.isFinite(bestScore)) bestScore = -occupied * 7;
            const result = Object.freeze({
                code,
                goal: acceptableCodes.has(code),
                compatible,
                relevant,
                coverage: bestCoverage,
                score: bestScore,
                occupied,
            });
            cache.set(code, result);
            return result;
        },
    };
}

function resultBase(config, started, chartNodes, candidateAttempts, extra = {}) {
    return {
        architecture: 'target-conditioned-candidate-generation-v1',
        architectureConfig: config.id,
        admissionMode: config.admissionMode,
        chartNodes,
        candidateAttempts,
        wallMs: performance.now() - started,
        ...extra,
    };
}

function physicalOutputs(definition, inputShapes, color, operationConfig) {
    try {
        const args = definition.needsColor
            ? [...inputShapes, color, operationConfig]
            : [...inputShapes, operationConfig];
        return definition.fn(...args)
            .filter(shape => !shape.isEmpty())
            .map(shape => shape.toShapeCode());
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

/**
 * Experimental architecture entry point. It deliberately accepts only the
 * ordinary public Solver input and a predeclared configuration.
 */
export async function targetConditionedSolve(instance, experimentConfig) {
    const limits = validateExperimentConfig(experimentConfig);
    const started = performance.now();
    const targets = (instance.targetShapeCodes ?? []).map(code => Shape.fromShapeCode(code));
    const operationConfig = new ShapeOperationConfig(instance.maxLayers ?? 4);
    const enabled = new Set(instance.enabledOperations ?? []);

    if (targets.length !== 1 || instance.allowSplitting || instance.preventWaste || !targets.every(isOrdinary)) {
        return resultBase(limits, started, 0, 0, {
            solutionPath: null,
            depth: 0,
            statesExplored: 0,
            generatedStates: 0,
            outcome: 'exhausted',
            beamPruned: false,
            architectureStatus: 'unsupported-domain',
        });
    }

    const target = createTargetAnalysis(targets, operationConfig, instance.orientationSensitive === true);
    const paintColors = targetColors(targets);
    const nodes = [];
    const byShape = new Map();
    const buckets = Array.from({ length: limits.maxOperations + 1 }, () => []);
    let candidateAttempts = 0;
    let activeNodes = 0;
    let limitReason = null;
    let goalNode = null;

    function timedOut() {
        return performance.now() - started >= limits.maxWallMs;
    }

    function nodeQuality(node) {
        return [node.analysis.compatible ? 1 : 0, node.analysis.coverage, -countBits(node.mask), -node.cost, -node.id];
    }

    function compareQuality(a, b) {
        const qa = nodeQuality(a);
        const qb = nodeQuality(b);
        for (let index = 0; index < qa.length; index += 1) {
            if (qa[index] !== qb[index]) return qa[index] - qb[index];
        }
        return 0;
    }

    function addNode(code, mask, cost, plan, sourceOperation, parentAnalyses = []) {
        if (cost > limits.maxOperations) return null;
        const analysis = target.analyze(code);
        if (sourceOperation !== 'initial') {
            const parentBest = Math.max(...parentAnalyses.map(row => row.score), -Infinity);
            const strict = analysis.compatible;
            const progressive = strict || (analysis.relevant && analysis.score > parentBest);
            if (limits.admissionMode === 'strict-subgoal' ? !strict : !progressive) return null;
        }

        const variants = byShape.get(code) ?? [];
        for (const existingId of variants) {
            const existing = nodes[existingId];
            if (!existing.active) continue;
            if ((existing.mask & mask) === existing.mask && existing.cost <= cost) return null;
        }

        for (const existingId of variants) {
            const existing = nodes[existingId];
            if (!existing.active) continue;
            if ((existing.mask & mask) === mask && cost <= existing.cost) {
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
            analysis,
            active: true,
            expanded: false,
        };
        nodes.push(node);
        variants.push(node.id);
        byShape.set(code, variants);
        activeNodes += 1;

        const activeVariants = variants.map(id => nodes[id]).filter(row => row.active);
        if (activeVariants.length > limits.maxVariantsPerShape) {
            activeVariants.sort(compareQuality);
            const removed = activeVariants[0];
            removed.active = false;
            activeNodes -= 1;
            if (removed === node) return null;
        }

        if (nodes.length > limits.maxChartNodes) limitReason ??= 'chart-nodes';
        buckets[cost].push(node.id);
        if (analysis.goal) goalNode ??= node;
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
        if (outputs === null || (outputs.length === 0 && !instance.preventWaste)) return;
        if (definition.inputCount === 1 && outputs.length === 1 && outputs[0] === inputNodes[0].code) return;
        const mask = inputNodes.reduce((value, node) => value | node.mask, 0n);
        const cost = inputNodes.reduce((value, node) => value + node.cost, 0) + 1;
        for (const [selectedOutput, code] of outputs.entries()) {
            addNode(code, mask, cost, {
                kind: 'operation',
                operation,
                inputs: inputNodes.map(node => node.plan),
                inputCodes: inputNodes.map(node => node.code),
                outputCodes: outputs,
                selectedOutput,
                color,
            }, operation, inputNodes.map(node => node.analysis));
        }
    }

    for (const [inputId, code] of (instance.startingShapeCodes ?? []).entries()) {
        addNode(code, 1n << BigInt(inputId), 0, { kind: 'leaf', inputId }, 'initial');
        if (goalNode) break;
    }

    for (let cost = 0; cost <= limits.maxOperations && !goalNode && !limitReason; cost += 1) {
        let cursor = 0;
        while (cursor < buckets[cost].length && !goalNode && !limitReason) {
            const node = nodes[buckets[cost][cursor++]];
            if (!node?.active || node.expanded) continue;
            node.expanded = true;

            for (const operation of instance.enabledOperations ?? []) {
                const definition = OPERATIONS[operation];
                if (!definition || definition.inputCount !== 1) continue;
                if (operation === 'Pin Pusher' || operation === 'Crystal Generator') continue;
                if (definition.needsColor) {
                    if (operation !== 'Painter') continue;
                    if (instance.cleanPainting) {
                        if (node.shape.numLayers !== 1 || !node.shape.layers[0].every(part =>
                            UNPAINTABLE_PARTS.includes(part.shape) || part.color === UNCOLORED_CODE)) continue;
                    }
                    const colors = [...new Set([
                        ...paintColors,
                        ...targets.flatMap(targetShape => _getPaintColors(node.shape, targetShape)),
                    ])].sort();
                    for (const color of colors) attempt(operation, [node], color);
                } else {
                    attempt(operation, [node]);
                }
                if (goalNode || limitReason) break;
            }

            if (goalNode || limitReason) break;
            for (let partnerId = 0; partnerId < node.id && !goalNode && !limitReason; partnerId += 1) {
                const partner = nodes[partnerId];
                if (!partner?.active || (node.mask & partner.mask) !== 0n) continue;
                if (!node.analysis.relevant || !partner.analysis.relevant) continue;
                if (enabled.has('Swapper')) attempt('Swapper', [node, partner]);
                if (enabled.has('Stacker')) {
                    attempt('Stacker', [node, partner]);
                    if (!goalNode && !limitReason) attempt('Stacker', [partner, node]);
                }
            }
        }
    }

    if (goalNode) {
        const solutionPath = materializePlan(goalNode.plan, instance.startingShapeCodes ?? []);
        return resultBase(limits, started, activeNodes, candidateAttempts, {
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

    return resultBase(limits, started, activeNodes, candidateAttempts, {
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

export const targetConditionedTestOnly = Object.freeze({
    createTargetAnalysis,
    countBits,
    validateExperimentConfig,
});
