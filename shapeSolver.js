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
const MAX_TOTAL_STATES = 2500000;

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
    let lastUpdate = performance.now();
    let depth = 0;

    const targetObjects = targetShapeCodes.map(code => Shape.fromShapeCode(code));
    const targetAcceptableSets = targetObjects.map((targetObject, index) => {
        const acceptableCodes = new Set();
        if (orientationSensitive) {
            acceptableCodes.add(targetShapeCodes[index]);
        } else {
            for (const code of _getAllRotations(targetObject, config)) acceptableCodes.add(code);
        }
        return acceptableCodes;
    });
    const targetAcceptableLists = targetAcceptableSets.map(set => [...set]);
    const orderedTargetAcceptableLists = [...targetAcceptableLists].sort((a, b) => a.length - b.length);
    const targetCodeUniverse = new Set(targetAcceptableLists.flat());

    const targetCrystalColors = new Set(
        targetObjects.flatMap(targetObject => [..._getCrystalColors(targetObject)])
    );

    const similarityCache = new Map();
    const shapeCache = new Map();
    const paintColorsCache = new Map();
    const operationOutputCache = new Map();

    function getShapeObject(code) {
        let shapeObject = shapeCache.get(code);
        if (shapeObject === undefined) {
            shapeObject = Shape.fromShapeCode(code);
            shapeCache.set(code, shapeObject);
        }
        return shapeObject;
    }

    function getCachedSimilarity(code) {
        let score = similarityCache.get(code);
        if (score === undefined) {
            const shapeObject = getShapeObject(code);
            score = 0;
            for (const targetObject of targetObjects) {
                const similarity = _getSimilarity(shapeObject, targetObject);
                if (similarity > score) score = similarity;
            }
            // Give full credit to any shape that appears as a layer in any target,
            // so intermediate layer shapes survive pruning.
            if (score < 0.99 && targetObjects.some(t => t.toListOfLayers().includes(code))) {
                score = 1.0;
            }
            similarityCache.set(code, score);
        }
        return score;
    }

    function getCachedPaintColors(code) {
        let colors = paintColorsCache.get(code);
        if (colors === undefined) {
            const inputShape = getShapeObject(code);
            colors = [...new Set(targetObjects.flatMap(targetObject => _getPaintColors(inputShape, targetObject)))];
            paintColorsCache.set(code, colors);
        }
        return colors;
    }

    function makeToken(code, throughput = 1.0) {
        return allowSplitting ? `${code}@${throughput}` : code;
    }

    function getTokenCode(token) {
        if (!allowSplitting) return token;
        const separatorIndex = token.lastIndexOf('@');
        return separatorIndex === -1 ? token : token.slice(0, separatorIndex);
    }

    function getTokenThroughput(token) {
        if (!allowSplitting) return 1.0;
        const separatorIndex = token.lastIndexOf('@');
        return separatorIndex === -1 ? 1.0 : Number(token.slice(separatorIndex + 1));
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
        const codeA = getTokenCode(inputTokenA);
        let outputs;

        if (op.inputCount === 1) {
            const cacheKey = color === null ? `${opName}|${codeA}` : `${opName}|${codeA}|${color}`;
            outputs = operationOutputCache.get(cacheKey);
            if (outputs === undefined) {
                const inputShape = getShapeObject(codeA);
                outputs = (color === null ? op.fn(inputShape, config) : op.fn(inputShape, color, config))
                    .filter(outputShape => !outputShape.isEmpty())
                    .map(outputShape => outputShape.toShapeCode());
                operationOutputCache.set(cacheKey, outputs);
            }
            return outputs;
        }

        const codeB = getTokenCode(inputTokenB);
        const [keyA, keyB, shapeA, shapeB] = op.commutative && codeA > codeB
            ? [codeB, codeA, getShapeObject(codeB), getShapeObject(codeA)]
            : [codeA, codeB, getShapeObject(codeA), getShapeObject(codeB)];
        const cacheKey = `${opName}|${keyA}|${keyB}`;
        outputs = operationOutputCache.get(cacheKey);
        if (outputs === undefined) {
            outputs = op.fn(shapeA, shapeB, config)
                .filter(outputShape => !outputShape.isEmpty())
                .map(outputShape => outputShape.toShapeCode());
            operationOutputCache.set(cacheKey, outputs);
        }
        return outputs;
    }

    function checkGoal(counts) {
        if (targetAcceptableSets.length === 1 && !allowSplitting && !preventWaste) {
            const acceptableSet = targetAcceptableSets[0];
            for (const [token, count] of counts) {
                if (count > 0 && acceptableSet.has(getTokenCode(token))) return true;
            }
            return false;
        }

        if (!allowSplitting) {
            const remainingCounts = cloneCounts(counts);

            function assignTarget(targetIndex) {
                if (targetIndex >= orderedTargetAcceptableLists.length) {
                    if (!preventWaste) return true;
                    for (const [code, count] of remainingCounts) {
                        if (count > 0 && !targetCodeUniverse.has(code)) return false;
                    }
                    return true;
                }

                for (const code of orderedTargetAcceptableLists[targetIndex]) {
                    const count = remainingCounts.get(code) ?? 0;
                    if (count <= 0) continue;

                    if (count === 1) {
                        remainingCounts.delete(code);
                    } else {
                        remainingCounts.set(code, count - 1);
                    }

                    if (assignTarget(targetIndex + 1)) return true;
                    remainingCounts.set(code, count);
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
                if (throughput > 1e-9 && acceptableSet.has(getTokenCode(token))) {
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
                if (throughput > 1e-9 && !targetCodeUniverse.has(getTokenCode(token))) return false;
            }
        }

        return true;
    }

    function calculateSimilarityTotal(counts) {
        let total = 0;
        for (const [token, count] of counts) {
            total += getCachedSimilarity(getTokenCode(token)) * count;
        }
        return total;
    }

    function getStateKey(counts) {
        const parts = [];
        for (const [token, count] of counts) {
            parts.push(`${token}#${count}`);
        }
        parts.sort();
        return parts.join('|');
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
            groups.push({
                token,
                count,
                code: getTokenCode(token),
                throughput: getTokenThroughput(token)
            });
        }
        return groups;
    }

    function materializeSolutionPath(state) {
        const compactSteps = [];
        for (let current = state; current?.step; current = current.parent) {
            compactSteps.push(current.step);
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
            pushToken(makeToken(code, 1.0));
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
        adjustCount(initialCounts, makeToken(code, 1.0), 1);
    }

    const initialKey = getStateKey(initialCounts);
    const initialScoreTotal = calculateSimilarityTotal(initialCounts);
    let frontier = [{
        stateKey: initialKey,
        counts: initialCounts,
        parent: null,
        step: null,
        itemCount: startingShapeCodes.length,
        scoreTotal: initialScoreTotal,
        score: startingShapeCodes.length > 0 ? initialScoreTotal / startingShapeCodes.length : 0
    }];
    const visited = new Set([initialKey]);

    function pruneStatesAtDepth(states, maxStates) {
        if (states.length <= maxStates) return states;
        states.sort((a, b) => b.score - a.score);
        return states.slice(0, maxStates);
    }

    while (frontier.length > 0 && !cancelled) {
        const currentDepthStates = frontier;
        const nextDepthStates = [];
        const levelSeen = new Set();

        for (const current of currentDepthStates) {
            if (cancelled) break;

            const { counts, scoreTotal, itemCount } = current;
            const inputGroups = groupEquivalentInputs(counts);

            if (checkGoal(counts)) {
                return { solutionPath: materializeSolutionPath(current), depth, statesExplored: visited.size };
            }

            if (allowSplitting) {
                for (const { token, code, throughput } of inputGroups) {
                    const childToken = makeToken(code, throughput / 2);
                    const nextCounts = cloneCounts(counts);
                    adjustCount(nextCounts, token, -1);
                    adjustCount(nextCounts, childToken, 2);

                    const nextItemCount = itemCount + 1;
                    const nextScoreTotal = scoreTotal + getCachedSimilarity(code);
                    const stateKey = getStateKey(nextCounts);
                    if (!visited.has(stateKey) && !levelSeen.has(stateKey)) {
                        levelSeen.add(stateKey);
                        nextDepthStates.push({
                            stateKey,
                            counts: nextCounts,
                            parent: current,
                            step: makeStep("Splitter", [token], [childToken, childToken]),
                            itemCount: nextItemCount,
                            scoreTotal: nextScoreTotal,
                            score: nextScoreTotal / nextItemCount
                        });
                    }
                }
            }

            for (const opName of enabledOperations) {
                if (cancelled) break;

                const op = operations[opName];
                if (!op) continue;
                const { inputCount, needsColor } = op;

                if (inputCount === 1) {
                    for (const { token, code, throughput } of inputGroups) {
                        if (cancelled) break;

                        const inputSimilarity = getCachedSimilarity(code);

                        if (needsColor) {
                            const inputShape = getShapeObject(code);
                            if (cleanPainting && opName === "Painter") {
                                if (inputShape.layers.length !== 1) continue;
                                const topLayer = inputShape.layers[0];
                                const allUncolored = topLayer.every(part =>
                                    UNPAINTABLE_PARTS.includes(part.shape) || part.color === UNCOLORED_CODE
                                );
                                if (!allUncolored) continue;
                            }

                            const colors = opName === "Painter"
                                ? getCachedPaintColors(code)
                                : [...targetCrystalColors];

                            for (const color of colors) {
                                const outputCodes = getCachedOperationOutputs(opName, op, token, null, color);
                                if (outputCodes.length === 0) continue;

                                const nextCounts = cloneCounts(counts);
                                const outputTokens = [];
                                let outputSimilarityTotal = 0;

                                adjustCount(nextCounts, token, -1);
                                for (const outputCode of outputCodes) {
                                    const outputToken = makeToken(outputCode, throughput);
                                    outputTokens.push(outputToken);
                                    adjustCount(nextCounts, outputToken, 1);
                                    outputSimilarityTotal += getCachedSimilarity(outputCode);
                                }

                                const nextItemCount = itemCount - 1 + outputTokens.length;
                                const nextScoreTotal = scoreTotal - inputSimilarity + outputSimilarityTotal;
                                const stateKey = getStateKey(nextCounts);
                                if (!visited.has(stateKey) && !levelSeen.has(stateKey)) {
                                    levelSeen.add(stateKey);
                                    nextDepthStates.push({
                                        stateKey,
                                        counts: nextCounts,
                                        parent: current,
                                        step: makeStep(opName, [token], outputTokens, color),
                                        itemCount: nextItemCount,
                                        scoreTotal: nextScoreTotal,
                                        score: nextScoreTotal / nextItemCount
                                    });
                                }
                            }
                        } else {
                            const outputCodes = getCachedOperationOutputs(opName, op, token);
                            if (outputCodes.length === 0) continue;

                            const nextCounts = cloneCounts(counts);
                            const outputTokens = [];
                            let outputSimilarityTotal = 0;

                            adjustCount(nextCounts, token, -1);
                            for (const outputCode of outputCodes) {
                                const outputToken = makeToken(outputCode, throughput);
                                outputTokens.push(outputToken);
                                adjustCount(nextCounts, outputToken, 1);
                                outputSimilarityTotal += getCachedSimilarity(outputCode);
                            }

                            const nextItemCount = itemCount - 1 + outputTokens.length;
                            const nextScoreTotal = scoreTotal - inputSimilarity + outputSimilarityTotal;
                            const stateKey = getStateKey(nextCounts);
                            if (!visited.has(stateKey) && !levelSeen.has(stateKey)) {
                                levelSeen.add(stateKey);
                                nextDepthStates.push({
                                    stateKey,
                                    counts: nextCounts,
                                    parent: current,
                                    step: makeStep(opName, [token], outputTokens),
                                    itemCount: nextItemCount,
                                    scoreTotal: nextScoreTotal,
                                    score: nextScoreTotal / nextItemCount
                                });
                            }
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
                                outputSimilarityTotal += getCachedSimilarity(outputCode);
                            }

                            const nextItemCount = itemCount - 2 + outputTokens.length;
                            const nextScoreTotal = scoreTotal - getCachedSimilarity(inputA.code) - getCachedSimilarity(inputB.code) + outputSimilarityTotal;
                            const stateKey = getStateKey(nextCounts);
                            if (!visited.has(stateKey) && !levelSeen.has(stateKey)) {
                                levelSeen.add(stateKey);
                                nextDepthStates.push({
                                    stateKey,
                                    counts: nextCounts,
                                    parent: current,
                                    step: makeStep(opName, [inputA.token, inputB.token], outputTokens),
                                    itemCount: nextItemCount,
                                    scoreTotal: nextScoreTotal,
                                    score: nextScoreTotal / nextItemCount
                                });
                            }
                        }
                    }
                }
            }
        }

        // Prune first, then add to visited — critical to avoid visited explosion
        const prunedNextStates = pruneStatesAtDepth(nextDepthStates, maxStatesPerLevel);
        frontier = [];
        for (const state of prunedNextStates) {
            if (!visited.has(state.stateKey)) {
                visited.add(state.stateKey);
                frontier.push(state);
            }
        }
        if (frontier.length > 0) {
            depth += 1;
        }

        for (const state of currentDepthStates) {
            state.counts = null;
            state.itemCount = 0;
            state.scoreTotal = 0;
            state.score = 0;
        }

        if (visited.size >= MAX_TOTAL_STATES) {
            return { solutionPath: null, depth, statesExplored: visited.size, limitReached: true };
        }

        const now = performance.now();
        if (now - lastUpdate > 200) {
            const prunedCount = nextDepthStates.length - prunedNextStates.length;
            self.postMessage({
                type: 'status',
                messageKey: 'solver.status.progress',
                messageParams: {
                    depth,
                    queueLength: frontier.length,
                    totalStates: visited.size,
                    prunedCount,
                },
                status: 'running',
            });
            lastUpdate = now;
        }
    }

    if (cancelled) return null;
    return { solutionPath: null, depth, statesExplored: visited.size };
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