import {
    Shape, ShapeOperationConfig,
    _getAllRotations, _getPaintColors, _getCrystalColors, _getSimilarity,
    halfCut, cut, swapHalves, rotate90CW, rotate90CCW, rotate180, stack, topPaint, pushPin, genCrystal
} from './shapeOperations.js';
import { UNCOLORED_CODE, UNPAINTABLE_PARTS } from './shapeConstants.js';

const operations = {
    "Rotator CW": { fn: rotate90CW, inputCount: 1 },
    "Rotator CCW": { fn: rotate90CCW, inputCount: 1 },
    "Rotator 180": { fn: rotate180, inputCount: 1 },
    "Half Destroyer": { fn: halfCut, inputCount: 1 },
    "Cutter": { fn: cut, inputCount: 1 },
    "Swapper": { fn: swapHalves, inputCount: 2, commutative: true },
    "Stacker": { fn: stack, inputCount: 2 },
    "Painter": { fn: topPaint, inputCount: 1, needsColor: true },
    "Pin Pusher": { fn: pushPin, inputCount: 1 },
    "Crystal Generator": { fn: genCrystal, inputCount: 1, needsColor: true }
};
// These limits protect the renderer process as well as the worker. Chromium may
// terminate the whole tab when a worker exhausts the shared process memory.
const MAX_TOTAL_STATES = 500000;
const MAX_FRONTIER_STATES = 5000;
const MAX_GENERATED_STATES = 5000000;
const MAX_INTERNED_SHAPES = 150000;
const MAX_SEARCH_TIME_MS = 120000;
const MIN_SPLIT_THROUGHPUT = 1 / 4096;

const CACHE_LIMITS = Object.freeze({
    similarity: 100000,
    shapes: 20000,
    paintColors: 15000,
    operationOutputs: 75000,
});

function getCachedValue(cache, key) {
    return cache.get(key);
}

function setCachedValue(cache, key, value, limit) {
    if (cache.has(key)) cache.delete(key);
    cache.set(key, value);

    if (cache.size > limit) {
        cache.delete(cache.keys().next().value);
    }
}

// Keeps only the best K states while successors are being generated. The old
// implementation materialized every successor and sorted the whole level,
// which made maxStatesPerLevel ineffective as a memory limit.
class BoundedStateCollector {
    constructor(limit, visited) {
        this.limit = limit;
        this.visited = visited;
        this.heap = [];
        this.retainedByKey = new Map();
        this.sequence = 0;
        this.consideredCount = 0;
    }

    get size() {
        return this.heap.length;
    }

    _isWorse(a, b) {
        if (a.score !== b.score) return a.score < b.score;
        return a.sequence > b.sequence;
    }

    _isBetter(score, sequence, entry) {
        if (score !== entry.score) return score > entry.score;
        return sequence < entry.sequence;
    }

    _swap(a, b) {
        [this.heap[a], this.heap[b]] = [this.heap[b], this.heap[a]];
    }

    _bubbleUp(index) {
        while (index > 0) {
            const parent = Math.floor((index - 1) / 2);
            if (!this._isWorse(this.heap[index], this.heap[parent])) break;
            this._swap(index, parent);
            index = parent;
        }
    }

    _sinkDown(index) {
        while (true) {
            const left = index * 2 + 1;
            const right = left + 1;
            let worst = index;

            if (left < this.heap.length && this._isWorse(this.heap[left], this.heap[worst])) worst = left;
            if (right < this.heap.length && this._isWorse(this.heap[right], this.heap[worst])) worst = right;
            if (worst === index) break;

            this._swap(index, worst);
            index = worst;
        }
    }

    consider(stateKey, score, createState) {
        this.consideredCount += 1;
        const sequence = this.sequence++;

        if (this.visited.has(stateKey) || this.retainedByKey.has(stateKey)) return false;

        if (this.heap.length >= this.limit && !this._isBetter(score, sequence, this.heap[0])) {
            return false;
        }

        const entry = { stateKey, score, sequence, state: createState() };

        if (this.heap.length < this.limit) {
            this.heap.push(entry);
            this.retainedByKey.set(stateKey, entry);
            this._bubbleUp(this.heap.length - 1);
            return true;
        }

        const evicted = this.heap[0];
        this.retainedByKey.delete(evicted.stateKey);
        this.heap[0] = entry;
        this.retainedByKey.set(stateKey, entry);
        this._sinkDown(0);
        return true;
    }

    toBestFirstStates() {
        return this.heap
            .sort((a, b) => b.score - a.score || a.sequence - b.sequence)
            .map(entry => entry.state);
    }
}

let cancelled = false;

self.onmessage = async function (e) {
    const { action, data } = e.data;

    if (action === 'solve') {
        const {
            targetShapeCodes,
            startingShapeCodes,
            enabledOperations,
            maxLayers,
            maxStatesPerLevel,
            preventWaste,
            orientationSensitive,
            allowSplitting,
            cleanPainting
        } = data;

        cancelled = false;
        const result = await shapeSolver(
            targetShapeCodes,
            startingShapeCodes,
            enabledOperations,
            maxLayers,
            maxStatesPerLevel,
            preventWaste,
            orientationSensitive,
            allowSplitting,
            cleanPainting
        );
        if (!cancelled) {
            self.postMessage({ type: 'result', result });
        }
    } else if (action === 'explore') {
        cancelled = false;
        const { startingShapeCodes, enabledOperations, depthLimit, maxLayers } = data;
        try {
            const graph = await shapeExplorer(startingShapeCodes, enabledOperations, depthLimit || 999, maxLayers || 4);
            if (!cancelled) {
                self.postMessage({ type: 'result', result: graph });
            }
        } catch (err) {
            self.postMessage({
                type: 'status',
                messageKey: 'status.errorMessage',
                messageParams: { message: err.message },
                status: 'error',
            });
        }
    } else if (action === 'cancel') {
        cancelled = true;
        self.postMessage({ type: 'status', messageKey: 'status.cancelled', status: 'idle' });
    }
};

async function shapeSolver(targetShapeCodes, startingShapeCodes, enabledOperations, maxLayers, maxStatesPerLevel = Infinity, preventWaste, orientationSensitive, allowSplitting, cleanPainting) {
    const config = new ShapeOperationConfig(maxLayers);
    const searchStarted = performance.now();
    let lastUpdate = performance.now();
    let depth = 0;
    let generatedStates = 0;
    let shapeLimitReached = false;
    const frontierLimit = Math.max(
        1,
        Math.min(
            Number.isFinite(maxStatesPerLevel) ? Math.floor(maxStatesPerLevel) : MAX_FRONTIER_STATES,
            MAX_FRONTIER_STATES
        )
    );

    const shapeCodeToId = new Map();
    const shapeCodes = [];

    function internShapeCode(code) {
        let shapeId = shapeCodeToId.get(code);
        if (shapeId === undefined) {
            if (shapeCodes.length >= MAX_INTERNED_SHAPES) {
                shapeLimitReached = true;
                return null;
            }
            shapeId = shapeCodes.length;
            shapeCodeToId.set(code, shapeId);
            shapeCodes.push(code);
        }
        return shapeId;
    }

    function getShapeCode(shapeId) {
        return shapeCodes[shapeId];
    }

    const targetObjects = targetShapeCodes.map(code => {
        internShapeCode(code);
        return Shape.fromShapeCode(code);
    });
    const targetAcceptableSets = targetObjects.map((targetObject, index) => {
        const acceptableShapeIds = new Set();
        if (orientationSensitive) {
            acceptableShapeIds.add(internShapeCode(targetShapeCodes[index]));
        } else {
            for (const code of _getAllRotations(targetObject, config)) {
                acceptableShapeIds.add(internShapeCode(code));
            }
        }
        return acceptableShapeIds;
    });
    const targetAcceptableLists = targetAcceptableSets.map(set => [...set]);
    const orderedTargetAcceptableLists = [...targetAcceptableLists].sort((a, b) => a.length - b.length);
    const targetCodeUniverse = new Set(targetAcceptableLists.flat());
    const targetLayerShapeIds = new Set(
        targetObjects.flatMap(targetObject => targetObject.toListOfLayers().map(internShapeCode))
    );

    const targetCrystalColors = new Set(
        targetObjects.flatMap(targetObject => [..._getCrystalColors(targetObject)])
    );

    const similarityCache = new Map();
    const shapeCache = new Map();
    const paintColorsCache = new Map();
    const operationOutputCache = new Map();

    function getShapeObject(shapeId) {
        let shapeObject = getCachedValue(shapeCache, shapeId);
        if (shapeObject === undefined) {
            shapeObject = Shape.fromShapeCode(getShapeCode(shapeId));
            setCachedValue(shapeCache, shapeId, shapeObject, CACHE_LIMITS.shapes);
        }
        return shapeObject;
    }

    function getCachedSimilarity(shapeId) {
        let score = getCachedValue(similarityCache, shapeId);
        if (score === undefined) {
            const shapeObject = getShapeObject(shapeId);
            score = 0;
            for (const targetObject of targetObjects) {
                const similarity = _getSimilarity(shapeObject, targetObject);
                if (similarity > score) score = similarity;
            }
            // Give full credit to any shape that appears as a layer in any target,
            // so intermediate layer shapes survive pruning.
            if (score < 0.99 && targetLayerShapeIds.has(shapeId)) {
                score = 1.0;
            }
            setCachedValue(similarityCache, shapeId, score, CACHE_LIMITS.similarity);
        }
        return score;
    }

    function getCachedPaintColors(shapeId) {
        let colors = getCachedValue(paintColorsCache, shapeId);
        if (colors === undefined) {
            const inputShape = getShapeObject(shapeId);
            colors = [...new Set(targetObjects.flatMap(targetObject => _getPaintColors(inputShape, targetObject)))];
            setCachedValue(paintColorsCache, shapeId, colors, CACHE_LIMITS.paintColors);
        }
        return colors;
    }

    const tokenKeyToId = new Map();
    const tokenShapeIds = [];
    const tokenThroughputs = [];

    function makeToken(shapeId, throughput = 1.0) {
        if (!allowSplitting) return shapeId;

        const key = `${shapeId}@${throughput}`;
        let tokenId = tokenKeyToId.get(key);
        if (tokenId === undefined) {
            tokenId = tokenShapeIds.length;
            tokenKeyToId.set(key, tokenId);
            tokenShapeIds.push(shapeId);
            tokenThroughputs.push(throughput);
        }
        return tokenId;
    }

    function getTokenShapeId(token) {
        return allowSplitting ? tokenShapeIds[token] : token;
    }

    function getTokenCode(token) {
        return getShapeCode(getTokenShapeId(token));
    }

    function getTokenThroughput(token) {
        return allowSplitting ? tokenThroughputs[token] : 1.0;
    }

    function cloneCounts(counts) {
        return new Map(counts);
    }

    function adjustCount(counts, token, delta) {
        const nextCount = (counts.get(token) ?? 0) + delta;
        if (nextCount <= 0) {
            counts.delete(token);
        } else {
            counts.set(token, nextCount);
        }
    }

    function getCachedOperationOutputs(opName, op, inputTokenA, inputTokenB = null, color = null) {
        const shapeIdA = getTokenShapeId(inputTokenA);
        let outputs;

        if (op.inputCount === 1) {
            const cacheKey = color === null ? `${opName}|${shapeIdA}` : `${opName}|${shapeIdA}|${color}`;
            outputs = getCachedValue(operationOutputCache, cacheKey);
            if (outputs === undefined) {
                const inputShape = getShapeObject(shapeIdA);
                outputs = (color === null ? op.fn(inputShape, config) : op.fn(inputShape, color, config))
                    .filter(outputShape => !outputShape.isEmpty())
                    .map(outputShape => internShapeCode(outputShape.toShapeCode()))
                    .filter(shapeId => shapeId !== null);
                setCachedValue(operationOutputCache, cacheKey, outputs, CACHE_LIMITS.operationOutputs);
            }
            return outputs;
        }

        const shapeIdB = getTokenShapeId(inputTokenB);
        const [keyA, keyB, shapeA, shapeB] = op.commutative && shapeIdA > shapeIdB
            ? [shapeIdB, shapeIdA, getShapeObject(shapeIdB), getShapeObject(shapeIdA)]
            : [shapeIdA, shapeIdB, getShapeObject(shapeIdA), getShapeObject(shapeIdB)];
        const cacheKey = `${opName}|${keyA}|${keyB}`;
        outputs = getCachedValue(operationOutputCache, cacheKey);
        if (outputs === undefined) {
            outputs = op.fn(shapeA, shapeB, config)
                .filter(outputShape => !outputShape.isEmpty())
                .map(outputShape => internShapeCode(outputShape.toShapeCode()))
                .filter(shapeId => shapeId !== null);
            setCachedValue(operationOutputCache, cacheKey, outputs, CACHE_LIMITS.operationOutputs);
        }
        return outputs;
    }

    function checkGoal(counts) {
        if (targetAcceptableSets.length === 1 && !allowSplitting && !preventWaste) {
            const acceptableSet = targetAcceptableSets[0];
            for (const [token, count] of counts) {
                if (count > 0 && acceptableSet.has(getTokenShapeId(token))) return true;
            }
            return false;
        }

        if (!allowSplitting) {
            const remainingCounts = cloneCounts(counts);

            function assignTarget(targetIndex) {
                if (targetIndex >= orderedTargetAcceptableLists.length) {
                    if (!preventWaste) return true;
                    for (const [shapeId, count] of remainingCounts) {
                        if (count > 0 && !targetCodeUniverse.has(shapeId)) return false;
                    }
                    return true;
                }

                for (const shapeId of orderedTargetAcceptableLists[targetIndex]) {
                    const count = remainingCounts.get(shapeId) ?? 0;
                    if (count <= 0) continue;

                    if (count === 1) {
                        remainingCounts.delete(shapeId);
                    } else {
                        remainingCounts.set(shapeId, count - 1);
                    }

                    if (assignTarget(targetIndex + 1)) return true;
                    remainingCounts.set(shapeId, count);
                }

                return false;
            }

            return assignTarget(0);
        }

        const remainingThroughput = new Map();
        for (const [token, count] of counts) {
            const totalThroughput = count * getTokenThroughput(token);
            if (totalThroughput > 1e-9) {
                remainingThroughput.set(token, totalThroughput);
            }
        }

        for (const acceptableSet of targetAcceptableSets) {
            const matchingTokens = [];
            let totalThroughput = 0;

            for (const [token, throughput] of remainingThroughput) {
                if (throughput > 1e-9 && acceptableSet.has(getTokenShapeId(token))) {
                    totalThroughput += throughput;
                    matchingTokens.push(token);
                }
            }

            if (totalThroughput < 1.0 - 1e-9) return false;

            let needed = 1.0;
            for (const token of matchingTokens) {
                if (needed <= 1e-9) break;
                const throughput = remainingThroughput.get(token) ?? 0;
                const consumed = Math.min(throughput, needed);
                needed -= consumed;
                const nextThroughput = throughput - consumed;
                if (nextThroughput < 1e-9) {
                    remainingThroughput.delete(token);
                } else {
                    remainingThroughput.set(token, nextThroughput);
                }
            }
        }

        if (preventWaste) {
            for (const [token, throughput] of remainingThroughput) {
                if (throughput > 1e-9 && !targetCodeUniverse.has(getTokenShapeId(token))) return false;
            }
        }

        return true;
    }

    function calculateSimilarityTotal(counts) {
        let total = 0;
        for (const [token, count] of counts) {
            total += getCachedSimilarity(getTokenShapeId(token)) * getTokenThroughput(token) * count;
        }
        return total;
    }

    function calculateThroughputTotal(counts) {
        let total = 0;
        for (const [token, count] of counts) {
            total += getTokenThroughput(token) * count;
        }
        return total;
    }

    function getStateKey(counts) {
        return [...counts]
            .sort(([tokenA], [tokenB]) => tokenA - tokenB)
            .map(([token, count]) => `${token}#${count}`)
            .join('|');
    }

    function makeStep(operation, inputTokens, outputTokens, color = null) {
        return {
            operation,
            inputTokens,
            outputTokens,
            params: color ? { color } : {}
        };
    }

    function groupEquivalentInputs(counts) {
        const groups = [];
        for (const [token, count] of counts) {
            const shapeId = getTokenShapeId(token);
            groups.push({
                token,
                count,
                shapeId,
                throughput: getTokenThroughput(token)
            });
        }
        return groups;
    }

    function materializeSolutionPath(state) {
        const compactSteps = [];
        for (let trace = state?.trace; trace; trace = trace.parent) {
            compactSteps.push(trace.step);
        }
        compactSteps.reverse();

        let nextId = 0;
        const tokenPools = new Map();

        function pushToken(token) {
            let pool = tokenPools.get(token);
            if (!pool) {
                pool = [];
                tokenPools.set(token, pool);
            }
            const id = nextId++;
            pool.push(id);
            return id;
        }

        function popToken(token) {
            const pool = tokenPools.get(token);
            if (!pool?.length) {
                throw new Error(`Unable to replay solver path for token ${token}`);
            }
            return pool.pop();
        }

        for (const code of startingShapeCodes) {
            pushToken(makeToken(internShapeCode(code), 1.0));
        }

        return compactSteps.map(step => {
            const inputs = step.inputTokens.map(token => ({
                id: popToken(token),
                shape: getTokenCode(token)
            }));
            const outputs = step.outputTokens.map(token => ({
                id: pushToken(token),
                shape: getTokenCode(token)
            }));
            return {
                operation: step.operation,
                inputs,
                outputs,
                params: step.params ?? {}
            };
        });
    }

    const initialCounts = new Map();
    for (const code of startingShapeCodes) {
        adjustCount(initialCounts, makeToken(internShapeCode(code), 1.0), 1);
    }

    const initialKey = getStateKey(initialCounts);
    const initialScoreTotal = calculateSimilarityTotal(initialCounts);
    const initialThroughputTotal = calculateThroughputTotal(initialCounts);
    let frontier = [{
        stateKey: initialKey,
        counts: initialCounts,
        trace: null,
        throughputTotal: initialThroughputTotal,
        scoreTotal: initialScoreTotal,
        score: initialThroughputTotal > 0 ? initialScoreTotal / initialThroughputTotal : 0
    }];
    const visited = new Set([initialKey]);

    function makeLimitResult(limitReason) {
        return {
            solutionPath: null,
            depth,
            statesExplored: visited.size,
            generatedStates,
            limitReached: true,
            limitReason,
        };
    }

    function postProgress(displayDepth, collector) {
        self.postMessage({
            type: 'status',
            messageKey: 'solver.status.progress',
            messageParams: {
                depth: displayDepth,
                queueLength: collector.size,
                totalStates: visited.size,
                prunedCount: Math.max(0, collector.consideredCount - collector.size),
                generatedStates,
                cacheEntries: similarityCache.size + shapeCache.size + paintColorsCache.size + operationOutputCache.size,
                internedShapes: shapeCodes.length,
            },
            status: 'running',
        });
        lastUpdate = performance.now();
    }

    while (frontier.length > 0 && !cancelled) {
        const currentDepthStates = frontier;
        const nextStates = new BoundedStateCollector(frontierLimit, visited);

        function enqueueSuccessor({
            stateKey,
            counts,
            parent,
            stepFactory,
            throughputTotal,
            scoreTotal,
            outputTokens,
            canCompleteGoal = true,
        }) {
            generatedStates += 1;

            if (
                canCompleteGoal &&
                outputTokens.some(token => targetCodeUniverse.has(getTokenShapeId(token))) &&
                checkGoal(counts)
            ) {
                const goalState = {
                    trace: { parent: parent.trace, step: stepFactory() },
                };
                return {
                    solutionPath: materializeSolutionPath(goalState),
                    depth: depth + 1,
                    statesExplored: visited.size,
                    generatedStates,
                };
            }

            if (generatedStates >= MAX_GENERATED_STATES) {
                return makeLimitResult('generated-states');
            }

            if ((generatedStates & 2047) === 0 && performance.now() - searchStarted >= MAX_SEARCH_TIME_MS) {
                return makeLimitResult('time');
            }

            const score = throughputTotal > 1e-12 ? scoreTotal / throughputTotal : 0;
            nextStates.consider(stateKey, score, () => ({
                stateKey,
                counts,
                trace: { parent: parent.trace, step: stepFactory() },
                throughputTotal,
                scoreTotal,
                score,
            }));
            return null;
        }

        for (const current of currentDepthStates) {
            if (cancelled) break;

            if (performance.now() - searchStarted >= MAX_SEARCH_TIME_MS) {
                return makeLimitResult('time');
            }

            const { counts, scoreTotal, throughputTotal } = current;
            const inputGroups = groupEquivalentInputs(counts);

            if (checkGoal(counts)) {
                return {
                    solutionPath: materializeSolutionPath(current),
                    depth,
                    statesExplored: visited.size,
                    generatedStates,
                };
            }

            if (allowSplitting) {
                for (const { token, shapeId, throughput } of inputGroups) {
                    const childThroughput = throughput / 2;
                    if (childThroughput < MIN_SPLIT_THROUGHPUT) continue;

                    const childToken = makeToken(shapeId, childThroughput);
                    const nextCounts = cloneCounts(counts);
                    adjustCount(nextCounts, token, -1);
                    adjustCount(nextCounts, childToken, 2);

                    const stateKey = getStateKey(nextCounts);
                    const outputTokens = [childToken, childToken];
                    const completed = enqueueSuccessor({
                        stateKey,
                        counts: nextCounts,
                        parent: current,
                        stepFactory: () => makeStep("Splitter", [token], outputTokens),
                        throughputTotal,
                        scoreTotal,
                        outputTokens,
                        canCompleteGoal: false,
                    });
                    if (completed) return completed;
                }
            }

            for (const opName of enabledOperations) {
                if (cancelled) break;

                const op = operations[opName];
                if (!op) continue;
                const { inputCount, needsColor } = op;

                if (inputCount === 1) {
                    for (const { token, shapeId, throughput } of inputGroups) {
                        if (cancelled) break;

                        const inputSimilarity = getCachedSimilarity(shapeId);

                        if (needsColor) {
                            const inputShape = getShapeObject(shapeId);
                            if (cleanPainting && opName === "Painter") {
                                if (inputShape.layers.length !== 1) continue;
                                const topLayer = inputShape.layers[0];
                                const allUncolored = topLayer.every(part =>
                                    UNPAINTABLE_PARTS.includes(part.shape) || part.color === UNCOLORED_CODE
                                );
                                if (!allUncolored) continue;
                            }

                            const colors = opName === "Painter"
                                ? getCachedPaintColors(shapeId)
                                : [...targetCrystalColors];

                            for (const color of colors) {
                                const outputCodes = getCachedOperationOutputs(opName, op, token, null, color);
                                if (shapeLimitReached) return makeLimitResult('shape-universe');
                                if (outputCodes.length === 0) continue;
                                if (outputCodes.length === 1 && outputCodes[0] === shapeId) continue;

                                const nextCounts = cloneCounts(counts);
                                const outputTokens = [];
                                let outputSimilarityTotal = 0;

                                adjustCount(nextCounts, token, -1);
                                for (const outputCode of outputCodes) {
                                    const outputToken = makeToken(outputCode, throughput);
                                    outputTokens.push(outputToken);
                                    adjustCount(nextCounts, outputToken, 1);
                                    outputSimilarityTotal += getCachedSimilarity(outputCode) * throughput;
                                }

                                const nextThroughputTotal = throughputTotal - throughput + outputTokens.length * throughput;
                                const nextScoreTotal = scoreTotal - inputSimilarity * throughput + outputSimilarityTotal;
                                const stateKey = getStateKey(nextCounts);
                                const completed = enqueueSuccessor({
                                    stateKey,
                                    counts: nextCounts,
                                    parent: current,
                                    stepFactory: () => makeStep(opName, [token], outputTokens, color),
                                    throughputTotal: nextThroughputTotal,
                                    scoreTotal: nextScoreTotal,
                                    outputTokens,
                                });
                                if (completed) return completed;
                            }
                        } else {
                            const outputCodes = getCachedOperationOutputs(opName, op, token);
                            if (shapeLimitReached) return makeLimitResult('shape-universe');
                            if (outputCodes.length === 0) continue;
                            if (outputCodes.length === 1 && outputCodes[0] === shapeId) continue;

                            const nextCounts = cloneCounts(counts);
                            const outputTokens = [];
                            let outputSimilarityTotal = 0;

                            adjustCount(nextCounts, token, -1);
                            for (const outputCode of outputCodes) {
                                const outputToken = makeToken(outputCode, throughput);
                                outputTokens.push(outputToken);
                                adjustCount(nextCounts, outputToken, 1);
                                outputSimilarityTotal += getCachedSimilarity(outputCode) * throughput;
                            }

                            const nextThroughputTotal = throughputTotal - throughput + outputTokens.length * throughput;
                            const nextScoreTotal = scoreTotal - inputSimilarity * throughput + outputSimilarityTotal;
                            const stateKey = getStateKey(nextCounts);
                            const completed = enqueueSuccessor({
                                stateKey,
                                counts: nextCounts,
                                parent: current,
                                stepFactory: () => makeStep(opName, [token], outputTokens),
                                throughputTotal: nextThroughputTotal,
                                scoreTotal: nextScoreTotal,
                                outputTokens,
                            });
                            if (completed) return completed;
                        }
                    }
                } else if (inputCount === 2) {
                    for (let i = 0; i < inputGroups.length && !cancelled; i++) {
                        const startJ = op.commutative ? i : 0;
                        for (let j = startJ; j < inputGroups.length && !cancelled; j++) {
                            const inputA = inputGroups[i];
                            const inputB = inputGroups[j];
                            if (i === j && inputA.count < 2) continue;

                            const outputCodes = getCachedOperationOutputs(opName, op, inputA.token, inputB.token);
                            if (shapeLimitReached) return makeLimitResult('shape-universe');
                            if (outputCodes.length === 0) continue;

                            const nextCounts = cloneCounts(counts);
                            const combinedThroughput = Math.min(inputA.throughput, inputB.throughput);
                            const outputTokens = [];
                            let outputSimilarityTotal = 0;

                            adjustCount(nextCounts, inputA.token, -1);
                            adjustCount(nextCounts, inputB.token, -1);
                            for (const outputCode of outputCodes) {
                                const outputToken = makeToken(outputCode, combinedThroughput);
                                outputTokens.push(outputToken);
                                adjustCount(nextCounts, outputToken, 1);
                                outputSimilarityTotal += getCachedSimilarity(outputCode) * combinedThroughput;
                            }

                            const nextThroughputTotal = throughputTotal
                                - inputA.throughput
                                - inputB.throughput
                                + outputTokens.length * combinedThroughput;
                            const nextScoreTotal = scoreTotal
                                - getCachedSimilarity(inputA.shapeId) * inputA.throughput
                                - getCachedSimilarity(inputB.shapeId) * inputB.throughput
                                + outputSimilarityTotal;
                            const stateKey = getStateKey(nextCounts);
                            const completed = enqueueSuccessor({
                                stateKey,
                                counts: nextCounts,
                                parent: current,
                                stepFactory: () => makeStep(opName, [inputA.token, inputB.token], outputTokens),
                                throughputTotal: nextThroughputTotal,
                                scoreTotal: nextScoreTotal,
                                outputTokens,
                            });
                            if (completed) return completed;
                        }
                    }
                }
            }

            const now = performance.now();
            if (now - lastUpdate > 200) postProgress(depth + 1, nextStates);
        }

        frontier = nextStates.toBestFirstStates();
        if (visited.size + frontier.length > MAX_TOTAL_STATES) {
            return makeLimitResult('visited-states');
        }

        for (const state of frontier) {
            visited.add(state.stateKey);
        }

        if (frontier.length > 0) {
            depth += 1;
        }

        for (const state of currentDepthStates) {
            state.counts = null;
            state.throughputTotal = 0;
            state.scoreTotal = 0;
            state.score = 0;
        }

        const now = performance.now();
        if (now - lastUpdate > 200) {
            postProgress(depth, nextStates);
        }
    }

    if (cancelled) return null;
    return { solutionPath: null, depth, statesExplored: visited.size, generatedStates };
}

async function shapeExplorer(startingShapeCodes, enabledOperations, depthLimit, maxLayers) {
    const config = new ShapeOperationConfig(maxLayers);

    let nextShapeId = 0;
    let nextOpId = 0;
    const shapeCodeToId = new Map();
    const shapesList = [];
    const opsList = [];
    const edges = [];

    function addShapeIfNew(code) {
        if (!shapeCodeToId.has(code)) {
            const id = nextShapeId++;
            shapeCodeToId.set(code, id);
            shapesList.push({ id, code });
            return { id, added: true };
        }
        return { id: shapeCodeToId.get(code), added: false };
    }

    function getShapeById(id) {
        return Shape.fromShapeCode(shapesList.find(s => s.id === id).code);
    }

    const availableIds = new Set();
    for (const code of startingShapeCodes) {
        const { id } = addShapeIfNew(code);
        availableIds.add(id);
    }

    let frontier = new Set(availableIds);

    for (let depth = 1; depth <= depthLimit; depth++) {
        if (cancelled) {
            return null;
        }

        const newlyDiscovered = new Set();
        const startIds = Array.from(availableIds);
        const primaryIds = Array.from(frontier);

        if (primaryIds.length === 0) break;

        for (const opName of enabledOperations) {
            if (cancelled) {
                return null;
            }

            const op = operations[opName];
            if (!op) continue;

            const { fn, inputCount, needsColor } = op;

            if (inputCount === 1) {
                for (const id of primaryIds) {
                    if (cancelled) break;

                    const inputShape = getShapeById(id);
                    if (inputShape.isEmpty()) continue;
                    const colors = needsColor ? ["r"] : [null];

                    for (const color of colors) {
                        if (cancelled) break;

                        const outputs = needsColor ? fn(inputShape, color, config) : fn(inputShape, config);
                        const outputCodes = outputs.map(o => o.toShapeCode()).filter(Boolean);

                        if (outputCodes.some(oc => oc === shapesList[id].code)) {
                            continue;
                        }

                        const opId = `op-${nextOpId++}`;
                        opsList.push({ id: opId, type: opName, params: color ? { color } : {} });
                        edges.push({ source: `shape-${id}`, target: opId });

                        for (const oc of outputCodes) {
                            const { id: outId, added } = addShapeIfNew(oc);
                            if (outId === null) continue;
                            if (added) {
                                availableIds.add(outId);
                                newlyDiscovered.add(outId);
                            }
                            edges.push({ source: opId, target: `shape-${outId}` });
                        }
                    }
                }
            } else if (inputCount === 2) {
                const isStacker = opName === "Stacker";

                for (const id1 of startIds) {
                    if (cancelled) break;

                    const s1 = getShapeById(id1);
                    if (s1.isEmpty()) continue;

                    for (const id2 of primaryIds) {
                        if (cancelled) break;

                        if (id1 === id2 && !isStacker) continue;
                        if (id1 > id2 && !isStacker) continue;

                        const s2 = getShapeById(id2);
                        if (s2.isEmpty()) continue;

                        if (isStacker && id1 !== id2) {
                            const outA = fn(getShapeById(id1), getShapeById(id2), config)
                                .map(o => o.toShapeCode()).filter(Boolean);
                            const outB = fn(getShapeById(id2), getShapeById(id1), config)
                                .map(o => o.toShapeCode()).filter(Boolean);

                            if (JSON.stringify(outA) === JSON.stringify(outB) && id1 > id2) {
                                continue;
                            }
                        }

                        const outputs = fn(getShapeById(id1), getShapeById(id2), config);
                        const outputCodes = outputs.map(o => o.toShapeCode()).filter(Boolean);

                        const code1 = shapesList[id1].code;
                        const code2 = shapesList[id2].code;

                        if (outputCodes.some(oc => oc === code1 || oc === code2)) {
                            continue;
                        }

                        const opId = `op-${nextOpId++}`;
                        opsList.push({ id: opId, type: opName, params: {} });
                        edges.push({ source: `shape-${id1}`, target: opId });
                        edges.push({ source: `shape-${id2}`, target: opId });

                        for (const oc of outputCodes) {
                            const { id: outId, added } = addShapeIfNew(oc);
                            if (outId === null) continue;
                            if (added) {
                                availableIds.add(outId);
                                newlyDiscovered.add(outId);
                            }
                            edges.push({ source: opId, target: `shape-${outId}` });
                        }
                    }
                }
            }
        }
        frontier = newlyDiscovered;
    }

    if (!cancelled) {
        const shapesNodes = shapesList.map(s => ({ id: `shape-${s.id}`, code: s.code }));
        return { shapes: shapesNodes, ops: opsList, edges };
    }

    return null;
}

export { BoundedStateCollector, shapeSolver };
