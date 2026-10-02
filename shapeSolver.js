import {
    Shape, ShapeOperationConfig, InvalidOperationInputs,
    _getAllRotations, _getPaintColors, _getCrystalColors, _getSimilarity,
    halfCut, cut, swapHalves, rotate90CW, rotate90CCW, rotate180, stack, topPaint, pushPin, genCrystal
} from './shapeOperations.js';
import { COLOR_CODES, UNCOLORED_CODE, UNPAINTABLE_PARTS } from './shapeConstants.js';
import { interiorCrystalColumnSolve } from './interiorCrystalColumnSolver.js';

const PRODUCTION_CONSTRUCTIVE_CONFIG = Object.freeze({
    id: 'PCHA-A',
    maxExtractionOperations: 8,
    maxExtractionStates: 180000,
    maxMatchingTransitions: 750000,
    maxOperations: 768,
    maxWallMs: 12000,
});

const operations = {
    "Rotator CW": { fn: rotate90CW, inputCount: 1, cacheId: 0 },
    "Rotator CCW": { fn: rotate90CCW, inputCount: 1, cacheId: 1 },
    "Rotator 180": { fn: rotate180, inputCount: 1, cacheId: 2 },
    "Half Destroyer": { fn: halfCut, inputCount: 1, cacheId: 3 },
    "Cutter": { fn: cut, inputCount: 1, cacheId: 4 },
    "Swapper": { fn: swapHalves, inputCount: 2, commutative: true, cacheId: 5 },
    "Stacker": { fn: stack, inputCount: 2, cacheId: 6 },
    "Painter": { fn: topPaint, inputCount: 1, needsColor: true, cacheId: 7 },
    "Pin Pusher": { fn: pushPin, inputCount: 1, cacheId: 8 },
    "Crystal Generator": { fn: genCrystal, inputCount: 1, needsColor: true, cacheId: 9 }
};
// These limits protect the renderer process as well as the worker. Chromium may
// terminate the whole tab when a worker exhausts the shared process memory.
const MAX_TOTAL_STATES = 500000;
const MAX_FRONTIER_STATES = 5000;
const MAX_GENERATED_STATES = 5000000;
const MAX_INTERNED_SHAPES = 150000;
const OPERATION_CACHE_KEY_BASE = MAX_INTERNED_SHAPES + 1;
const OPERATION_CACHE_KEY_STRIDE = OPERATION_CACHE_KEY_BASE ** 2;
// Shape IDs and one-unit color codes fit inside one per-operation stride.
// The assertion keeps every composite key collision-free as a Number.
const MAX_OPERATION_CACHE_KEY = Object.keys(operations).length * OPERATION_CACHE_KEY_STRIDE - 1;
if (0xFFFF >= OPERATION_CACHE_KEY_BASE || !Number.isSafeInteger(MAX_OPERATION_CACHE_KEY)) {
    throw new Error('Operation-output cache keys must be safe integers');
}
const MAX_SEARCH_TIME_MS = 120000;
const OPERATION_TIME_CHECK_INTERVAL = 2048;
const MIN_SPLIT_THROUGHPUT = 1 / 4096;
const DEFAULT_SOLVER_LIMITS = Object.freeze({
    maxTotalStates: MAX_TOTAL_STATES,
    maxGeneratedStates: MAX_GENERATED_STATES,
    maxInternedShapes: MAX_INTERNED_SHAPES,
    maxSearchTimeMs: MAX_SEARCH_TIME_MS,
    operationTimeCheckInterval: OPERATION_TIME_CHECK_INTERVAL,
});
const EXPLORER_MIN_RESULT_BYTES = 512;
const DEFAULT_EXPLORER_LIMITS = Object.freeze({
    maxAttempts: 25000,
    maxShapes: 128,
    maxOperations: 256,
    maxEdges: 768,
    maxSearchTimeMs: 3000,
    maxSerializedBytes: 1024 * 1024,
});
const EXPLORER_COLORS = Object.freeze([...new Set(Object.values(COLOR_CODES))]);

function normalizeTestLimits(overrides = {}) {
    const allowed = new Set(Object.keys(DEFAULT_SOLVER_LIMITS));
    for (const key of Object.keys(overrides)) {
        if (!allowed.has(key)) throw new Error(`Unknown test-only solver limit: ${key}`);
    }

    const limits = { ...DEFAULT_SOLVER_LIMITS, ...overrides };
    for (const key of ['maxTotalStates', 'maxGeneratedStates', 'maxInternedShapes', 'operationTimeCheckInterval']) {
        if (!Number.isInteger(limits[key]) || limits[key] <= 0) {
            throw new Error(`Test-only solver limit ${key} must be a positive integer`);
        }
    }
    if (!Number.isFinite(limits.maxSearchTimeMs) || limits.maxSearchTimeMs < 0) {
        throw new Error('Test-only solver limit maxSearchTimeMs must be a non-negative finite number');
    }
    for (const key of ['maxTotalStates', 'maxGeneratedStates', 'maxInternedShapes', 'maxSearchTimeMs']) {
        if (limits[key] > DEFAULT_SOLVER_LIMITS[key]) {
            throw new Error(`Test-only solver limit ${key} cannot exceed the production default`);
        }
    }
    return limits;
}

function normalizeExplorerTestLimits(overrides = {}) {
    const allowed = new Set(Object.keys(DEFAULT_EXPLORER_LIMITS));
    for (const key of Object.keys(overrides)) {
        if (!allowed.has(key)) throw new Error(`Unknown test-only Explorer limit: ${key}`);
    }
    const limits = { ...DEFAULT_EXPLORER_LIMITS, ...overrides };
    for (const key of ['maxAttempts', 'maxShapes', 'maxOperations', 'maxEdges']) {
        if (!Number.isInteger(limits[key]) || limits[key] < 0) {
            throw new Error(`Test-only Explorer limit ${key} must be a non-negative integer`);
        }
    }
    if (!Number.isFinite(limits.maxSearchTimeMs) || limits.maxSearchTimeMs < 0) {
        throw new Error('Test-only Explorer limit maxSearchTimeMs must be a non-negative finite number');
    }
    if (!Number.isInteger(limits.maxSerializedBytes)
        || limits.maxSerializedBytes < EXPLORER_MIN_RESULT_BYTES) {
        throw new Error('Test-only Explorer limit maxSerializedBytes is too small for a classified result');
    }
    for (const key of Object.keys(DEFAULT_EXPLORER_LIMITS)) {
        if (limits[key] > DEFAULT_EXPLORER_LIMITS[key]) {
            throw new Error(`Test-only Explorer limit ${key} cannot exceed the production default`);
        }
    }
    return limits;
}

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
    constructor(limit, visited, useCoarseness = false, diagnostics = null, beamPruned = null, observe = null, passive = null) {
        this.limit = limit;
        this.visited = visited;
        this.useCoarseness = useCoarseness;
        this.diagnostics = diagnostics;
        // Shared by every layer collector in one solve. Once a unique state is
        // actually rejected by, or evicted from, the beam, later score-only
        // losers can stay lazy: the result classification is already known.
        this.beamPruned = beamPruned ?? { value: false };
        this.heap = [];
        this.retainedByKey = new Map();
        this.sequence = 0;
        this.consideredCount = 0;
        this.profileEvent = null;
        this.observe = observe;
        this.passive = passive;
    }

    get size() {
        return this.heap.length;
    }

    _isWorse(a, b) {
        if (a.score !== b.score) return a.score < b.score;
        if (this.useCoarseness && a.coarseness !== b.coarseness) return a.coarseness < b.coarseness;
        return a.sequence > b.sequence;
    }

    _isBetter(score, coarseness, sequence, entry) {
        if (score !== entry.score) return score > entry.score;
        if (this.useCoarseness && coarseness !== entry.coarseness) return coarseness > entry.coarseness;
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

    consider(stateKey, score, createState, coarseness = 0) {
        return this.considerLazy(score, coarseness, () => ({ stateKey, createState }));
    }

    // Defers state-key and state creation until a candidate can still enter a
    // full beam. Callers that need to inspect a possible goal first may
    // materialize their candidate themselves and pass the cached result here.
    considerLazy(score, coarseness, createCandidate) {
        this.consideredCount += 1;
        this.profileEvent?.('considered');
        const sequence = this.sequence++;
        this.observe?.('candidate-ranking', { score, coarseness, sequence, beamSize: this.heap.length });

        if (this.heap.length >= this.limit && !this._isBetter(score, coarseness, sequence, this.heap[0])) {
            this.profileEvent?.('rankingPreReject');
            // This event is deliberately before, and independent of, createCandidate.
            this.observe?.('ranking-pre-reject', { score, coarseness, sequence });
            if (this.diagnostics || !this.beamPruned.value) {
                const candidate = createCandidate();
                if (this.visited.has(candidate.stateKey)) {
                    this.observe?.('collector-visited-duplicate', { sequence, stateKey: candidate.stateKey });
                    this.profileEvent?.('visitedDuplicate');
                    if (this.diagnostics) this.diagnostics.visitedDuplicate += 1;
                } else if (this.retainedByKey.has(candidate.stateKey)) {
                    this.observe?.('collector-retained-duplicate', { sequence, stateKey: candidate.stateKey });
                    this.profileEvent?.('retainedDuplicate');
                    if (this.diagnostics) this.diagnostics.retainedDuplicate += 1;
                } else {
                    this.observe?.('collector-unique-reject', { sequence, stateKey: candidate.stateKey });
                    this.profileEvent?.('uniqueRankingReject');
                    this.beamPruned.value = true;
                    if (this.diagnostics) this.diagnostics.uniqueBeamRejected += 1;
                }
                if (this.diagnostics && score === this.heap[0].score && coarseness !== this.heap[0].coarseness) {
                    this.diagnostics.primaryTieWithDifferentCoarseness += 1;
                }
            } else {
                this.observe?.('collector-lazy-reject', { sequence });
                this.passive?.('lazy-reject');
                this.profileEvent?.('rankingPreRejectUnclassified');
            }
            return false;
        }

        const candidate = createCandidate();
        const { stateKey, createState } = candidate;
        if (this.visited.has(stateKey)) {
            this.observe?.('collector-visited-duplicate', { sequence, stateKey });
            this.profileEvent?.('visitedDuplicate');
            if (this.diagnostics) this.diagnostics.visitedDuplicate += 1;
            return false;
        }
        if (this.retainedByKey.has(stateKey)) {
            this.observe?.('collector-retained-duplicate', { sequence, stateKey });
            this.profileEvent?.('retainedDuplicate');
            if (this.diagnostics) this.diagnostics.retainedDuplicate += 1;
            return false;
        }

        const entry = { stateKey, semanticKey: candidate.semanticKey, score, coarseness, sequence, state: createState() };
        this.observe?.('collector-admit', { sequence, stateKey, score, coarseness });
        this.passive?.('admit');
        this.profileEvent?.('admitted');

        if (this.heap.length < this.limit) {
            this.heap.push(entry);
            this.retainedByKey.set(stateKey, entry);
            this._bubbleUp(this.heap.length - 1);
            return true;
        }

        const evicted = this.heap[0];
        this.observe?.('collector-evict', { sequence: evicted.sequence, stateKey: evicted.stateKey });
        this.profileEvent?.('evicted');
        this.beamPruned.value = true;
        if (this.diagnostics) {
            this.diagnostics.uniqueBeamEvicted += 1;
            if (score === evicted.score && coarseness !== evicted.coarseness) {
                this.diagnostics.primaryTieWithDifferentCoarseness += 1;
                if (this.useCoarseness && coarseness > evicted.coarseness) {
                    this.diagnostics.admittedByCoarseness += 1;
                }
            }
        }
        this.retainedByKey.delete(evicted.stateKey);
        this.heap[0] = entry;
        this.retainedByKey.set(stateKey, entry);
        this._sinkDown(0);
        return true;
    }

    toBestFirstStates() {
        return this.heap
            .sort((a, b) => b.score - a.score || (this.useCoarseness && b.coarseness - a.coarseness) || a.sequence - b.sequence)
            .map(entry => entry.state);
    }

    semanticRetainedKeys() {
        return this.heap
            .map(entry => entry.semanticKey)
            .filter(key => key !== undefined)
            .sort();
    }
}

let cancelled = false;

self.onmessage = async function (e) {
    const { action, data } = e.data;

    if (action === 'cancel') {
        cancelled = true;
        self.postMessage({ type: 'status', messageKey: 'status.cancelled', status: 'idle' });
        return;
    }

    if (action !== 'solve' && action !== 'explore') return;

    cancelled = false;
    try {
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
            return;
        }

        const { startingShapeCodes, enabledOperations, depthLimit, maxLayers } = data;
        const graph = await shapeExplorer(startingShapeCodes, enabledOperations, depthLimit ?? 999, maxLayers ?? 4);
        if (!cancelled) {
            self.postMessage({ type: 'result', result: graph });
        }
    } catch (err) {
        if (cancelled) return;
        self.postMessage({
            type: 'error',
            messageKey: 'status.errorMessage',
            messageParams: { message: err?.message ?? String(err) },
        });
    }
};

async function shapeSolver(targetShapeCodes, startingShapeCodes, enabledOperations, maxLayers, maxStatesPerLevel = Infinity, preventWaste, orientationSensitive, allowSplitting, cleanPainting) {
    const constructiveEligible = targetShapeCodes.length === 1
        && maxLayers === 4
        && orientationSensitive === false
        && allowSplitting === false
        && cleanPainting === true;
    if (constructiveEligible) {
        const instance = {
            targetShapeCodes,
            startingShapeCodes,
            enabledOperations,
            maxLayers,
            maxStatesPerLevel,
            preventWaste,
            orientationSensitive,
            allowSplitting,
            cleanPainting,
        };
        const constructed = await interiorCrystalColumnSolve(
            instance,
            PRODUCTION_CONSTRUCTIVE_CONFIG,
        );
        if (Array.isArray(constructed.solutionPath)) {
            return { ...constructed, solverRoute: 'constructive-hybrid' };
        }
    }
    return shapeSolverCore(
        targetShapeCodes, startingShapeCodes, enabledOperations, maxLayers, maxStatesPerLevel,
        preventWaste, orientationSensitive, allowSplitting, cleanPainting, null,
    );
}

// This named seam is intentionally test-only. It leaves the Worker message
// protocol and positional public solver API unchanged.
async function shapeSolverTestOnly(instance, { useCoarseness = true, diagnostics = false, limits, now, profile, observer } = {}) {
    if (now !== undefined && typeof now !== 'function') {
        throw new Error('The test-only solver clock must be a function');
    }
    if (observer !== undefined && (observer === null || typeof observer !== 'object'
        || (observer.onEvent !== undefined && typeof observer.onEvent !== 'function')
        || (observer.events !== undefined && !Array.isArray(observer.events)))) {
        throw new Error('Test-only observer requires an object with optional onEvent function or events array');
    }
    return shapeSolverCore(
        instance.targetShapeCodes, instance.startingShapeCodes, instance.enabledOperations, instance.maxLayers,
        instance.maxStatesPerLevel ?? Infinity, instance.preventWaste, instance.orientationSensitive,
        instance.allowSplitting, instance.cleanPainting ?? false,
        { useCoarseness, diagnostics, limits: normalizeTestLimits(limits), now, profile, observer },
    );
}

async function shapeSolverCore(targetShapeCodes, startingShapeCodes, enabledOperations, maxLayers, maxStatesPerLevel = Infinity, preventWaste, orientationSensitive, allowSplitting, cleanPainting, testOptions) {
    const config = new ShapeOperationConfig(maxLayers);
    const solverLimits = testOptions?.limits ?? DEFAULT_SOLVER_LIMITS;
    let previousTestTime = -Infinity;
    const readNow = testOptions?.now
        ? () => {
            const value = testOptions.now();
            if (!Number.isFinite(value) || value < previousTestTime) {
                throw new Error('The test-only solver clock must return finite monotonic values');
            }
            previousTestTime = value;
            return value;
        }
        : () => performance.now();
    const useCoarseness = allowSplitting && (testOptions ? testOptions.useCoarseness : true);
    const profile = testOptions?.profile ?? null;
    const observer = testOptions?.observer ?? null;
    const observerData = observer ? {
        schemaVersion: 1,
        descriptors: [],
        descriptorPayloadUtf16Bytes: 0,
        operationOutputBirthIds: new Set(),
        candidateMaterializedIds: new Set(),
        goalMaterializedIds: new Set(),
        admittedIds: new Set(),
        finalRetainedIds: new Set(),
        expandedIds: new Set(),
        d024ShapeSlots: 0,
        d024OverflowAttempts: 0,
        candidateMaterializations: 0,
        collectorLazyRejects: 0,
        operationAttempts: 0,
    } : null;
    if (observer) observer.data = observerData;
    const traceEnabled = !!(observer?.onEvent || observer?.events);
    let traceOrdinal = 0;
    function trace(type, details = null) {
        if (!traceEnabled) return;
        const event = { ordinal: traceOrdinal++, type, ...(details ?? {}) };
        observer.events?.push(event);
        observer.onEvent?.(event);
    }
    function observeOutputIds(tokens, set) {
        if (!observerData) return;
        for (const token of tokens) set.add(getTokenShapeId(token));
    }
    if (profile && (typeof profile !== 'object' || !Number.isInteger(profile.sampleEvery)
        || profile.sampleEvery < 1 || (profile.onState !== undefined && typeof profile.onState !== 'function'))) {
        throw new Error('Test-only profile requires positive integer sampleEvery and optional onState callback');
    }
    const profileData = profile ? {
        schemaVersion: 1, sampleEvery: profile.sampleEvery, expandedStates: 0,
        counters: {}, byDepthOperator: {}, expandedBySourceOperator: {},
        finalRetainedBySourceOperator: {}, stateSamples: [], shapeSummary: null,
        definitions: {
            rawAttempts: 'Physical-operation lookup invocations plus eligible Splitter attempts; includes cache hits and the attempt that reaches shape cap',
            successors: 'Calls to enqueueSuccessor; equals generatedStates on a completed diagnostic result',
            theoreticalPairs: 'Swapper n(n+1)/2 or Stacker n squared for n distinct input tokens before same-token count restriction',
            resourceSelfPairSkips: 'Same-token pair lacking two copies; not a physical operation attempt',
            considered: 'Successors passed to collector after goal and candidate-cap checks',
            admitted: 'Unique candidate temporarily inserted into collector, including candidates later evicted',
            finalRetainedStates: 'States in completed layer frontiers; excludes an interrupted partial layer',
            expandedStates: 'States whose expansion loop passed its initial time check, including a state that is already a goal',
            shadow: 'Deterministic every-N expanded-state sample; clones counts solely to inspect duplicate keys',
            operatorConservation: 'rawAttempts = invalidInputs + emptyOutputSkips + unaryIdentitySkips + successors + timeTerminatedAttempts + shapeCapTerminatedAttempts',
            collectorConservation: 'considered = visitedDuplicate + retainedDuplicate + uniqueRankingReject + rankingPreRejectUnclassified + admitted',
            shapeUse: 'seenInFinalFrontier and seenInExpandedState count distinct shape IDs, not state or candidate counts',
            costProxies: 'physicalExecutions, operationCacheHit/Miss, internLookups/newShapes, goalChecks, similarityCacheHit/Miss, inventoryClones, stateKeyBuilds, materializedCandidates, collector events, frontierSorts and solutionReplays; shadow clone/key work is excluded',
        },
        availability: {
            rankingPreReject: 'exact; production may reject before constructing a state key',
            uniqueRankingReject: 'exact only until beamPruned latches; later uniqueness is unknown',
            shadowDuplicates: 'exact for deterministic sampled expanded states only; shadow work is not production cost',
            cost: 'exact operation and allocation-event count proxies; no wall-time attribution',
            targetAncestry: 'unavailable: no proven target ancestry graph; relevance fields are descriptive proxies',
            profileWallTime: 'includes synchronous state-row writes and end-of-run shape proxy analysis',
        },
    } : null;
    if (profile) profile.data = profileData;
    let profileState = null;
    let activeOpName = null;
    let activeOutputTokens = null;
    let profileShadowActive = false;
    const shapeLife = profile ? [] : null;
    function profileCounter(name, amount = 1) {
        if (!profileData) return;
        profileData.counters[name] = (profileData.counters[name] ?? 0) + amount;
        if (!profileState || !activeOpName) return;
        const row = profileState.byOperator[activeOpName] ??= {};
        row[name] = (row[name] ?? 0) + amount;
        const key = `${profileState.depth}:${activeOpName}`;
        const aggregate = profileData.byDepthOperator[key] ??= {};
        aggregate[name] = (aggregate[name] ?? 0) + amount;
    }
    function profileShape(shapeId, field) {
        if (profileData && shapeLife[shapeId]) shapeLife[shapeId][field] += 1;
    }
    function flushProfileState() {
        if (!profileState) return;
        const { shadowFullKeys, shadowOutputKeys, shadowResourceKeys, reversedPairs,
            shadowOutputsByOp, shadowPairOutputs, ...row } = profileState;
        if (row.sampled) profileData.stateSamples.push(row);
        profile.onState?.(row);
        profileState = null;
    }
    function profileQuantiles(values) {
        if (!values.length) return { count: 0, min: null, median: null, p90: null, max: null };
        values.sort((a, b) => a - b);
        const at = p => values[Math.floor((values.length - 1) * p)];
        return { count: values.length, min: values[0], median: at(0.5), p90: at(0.9), max: values.at(-1) };
    }
    function finalizeProfile() {
        if (!profileData) return;
        flushProfileState();
        const fieldCount = field => shapeLife.filter(row => row[field] > 0).length;
        const operatorCreated = shapeLife.filter(row => row.birthOperator !== 'initial');
        const birthCounts = field => Object.fromEntries([...new Set(shapeLife.map(row => row[field]))]
            .map(value => [value, shapeLife.filter(row => row[field] === value).length]));
        const birthsByDepthOperator = {};
        for (const row of shapeLife) {
            const key = `${row.birthDepth}:${row.birthOperator}`;
            birthsByDepthOperator[key] = (birthsByDepthOperator[key] ?? 0) + 1;
        }
        const neverFraction = field => operatorCreated.length === 0 ? null
            : operatorCreated.filter(row => row[field] === 0).length / operatorCreated.length;
        profileData.shapeSummary = {
            total: shapeLife.length, initial: shapeLife.length - operatorCreated.length,
            operatorCreated: operatorCreated.length,
            birthsByOperator: birthCounts('birthOperator'), birthsByDepth: birthCounts('birthDepth'),
            birthsByDepthOperator,
            outputUsed: fieldCount('outputUse'), producedByAdmittedCandidate: fieldCount('admitted'),
            seenInFinalFrontier: fieldCount('retained'), seenInExpandedState: fieldCount('expanded'),
            consumed: fieldCount('consumed'), neverExpanded: shapeLife.length - fieldCount('expanded'),
            operatorCreatedNeverConsumedFraction: neverFraction('consumed'),
            operatorCreatedNeverFinalRetainedFraction: neverFraction('retained'),
            operatorCreatedNeverExpandedFraction: neverFraction('expanded'),
            outputUseQuantiles: profileQuantiles(shapeLife.map(row => row.outputUse)),
            expandedUseQuantiles: profileQuantiles(shapeLife.map(row => row.expanded)),
            observedLifetimeDepthQuantiles: profileQuantiles(shapeLife.map(row =>
                row.lastUseDepth < 0 ? 0 : row.lastUseDepth - row.birthDepth)),
        };
        const targetColors = new Set(targetObjects.flatMap(shape => shape.layers.flatMap(layer => layer.map(part => part.color))));
        const targetMaxLayers = Math.max(...targetObjects.map(shape => shape.numLayers));
        let offTargetColorShapes = 0;
        let moreLayersThanTarget = 0;
        for (const code of shapeCodes) {
            const shape = Shape.fromShapeCode(code);
            if (shape.numLayers > targetMaxLayers) moreLayersThanTarget += 1;
            if (shape.layers.some(layer => layer.some(part => part.color !== UNCOLORED_CODE
                && !targetColors.has(part.color)))) offTargetColorShapes += 1;
        }
        profileData.targetRelevanceProxy = {
            definition: 'Descriptive only; color or layer mismatch does not prove a shape cannot reach the target',
            offTargetColorShapes, moreLayersThanTarget,
        };
    }
    const diagnostics = testOptions?.diagnostics ? {
        useCoarseness,
        uniqueBeamRejected: 0,
        uniqueBeamEvicted: 0,
        visitedDuplicate: 0,
        retainedDuplicate: 0,
        primaryTieWithDifferentCoarseness: 0,
        admittedByCoarseness: 0,
        operationAttempts: 0,
        retainedSemanticKeysByDepth: [],
    } : null;
    const finalizeResult = result => { finalizeProfile(); return diagnostics ? {
        ...result,
        diagnostics: {
            ...diagnostics,
            retainedSemanticKeysByDepth: diagnostics.retainedSemanticKeysByDepth.map(layer => ({
                depth: layer.depth,
                keys: [...layer.keys],
            })),
        },
    } : result; };
    const searchStarted = readNow();
    let lastUpdate = readNow();
    let depth = 0;
    let generatedStates = 0;
    let operationAttempts = 0;
    let shapeLimitReached = false;
    const makeInitializationLimitResult = () => {
        if (traceEnabled) trace('limit', { limitReason: 'shape-universe', depth, statesExplored: 0,
            generatedStates, shapeSlots: shapeCodes.length, operationAttempts });
        return finalizeResult({
        solutionPath: null,
        depth,
        statesExplored: 0,
        generatedStates,
        limitReached: true,
        limitReason: 'shape-universe',
        outcome: 'limit',
        beamPruned: false,
        });
    };
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
        profileCounter('internLookups');
        let shapeId = shapeCodeToId.get(code);
        if (shapeId === undefined) {
            if (shapeCodes.length >= solverLimits.maxInternedShapes) {
                shapeLimitReached = true;
                if (observerData) observerData.d024OverflowAttempts += 1;
                if (traceEnabled) trace('shape-slot-overflow', { code, operator: activeOpName, slots: shapeCodes.length });
                return null;
            }
            shapeId = shapeCodes.length;
            shapeCodeToId.set(code, shapeId);
            shapeCodes.push(code);
            if (observerData) {
                const descriptor = { shapeId, code, birthOperator: activeOpName ?? 'initial',
                    payloadUtf16Bytes: code.length * 2 };
                observerData.descriptors.push(descriptor);
                observerData.descriptorPayloadUtf16Bytes += descriptor.payloadUtf16Bytes;
                observerData.d024ShapeSlots += 1;
                if (activeOpName) observerData.operationOutputBirthIds.add(shapeId);
            }
            if (traceEnabled) trace('shape-birth', { shapeId, code, operator: activeOpName ?? 'initial', slots: shapeCodes.length });
            profileCounter('newShapes');
            if (profileData) shapeLife.push({ birthDepth: depth, birthOperator: activeOpName ?? 'initial',
                outputUse: 0, admitted: 0, retained: 0, expanded: 0, consumed: 0, lastUseDepth: -1 });
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
    if (shapeLimitReached) return makeInitializationLimitResult();
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
    if (shapeLimitReached) return makeInitializationLimitResult();
    const targetAcceptableLists = targetAcceptableSets.map(set => [...set]);
    const orderedTargetAcceptableLists = [...targetAcceptableLists].sort((a, b) => a.length - b.length);
    const targetCodeUniverse = new Set(targetAcceptableLists.flat());
    const targetLayerShapeIds = new Set(
        targetObjects.flatMap(targetObject => targetObject.toListOfLayers().map(internShapeCode))
    );
    if (shapeLimitReached) return makeInitializationLimitResult();

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
            profileCounter('shapeObjectCacheMiss');
            shapeObject = Shape.fromShapeCode(getShapeCode(shapeId));
            setCachedValue(shapeCache, shapeId, shapeObject, CACHE_LIMITS.shapes);
        }
        return shapeObject;
    }

    function getCachedSimilarity(shapeId) {
        let score = getCachedValue(similarityCache, shapeId);
        profileCounter(score === undefined ? 'similarityCacheMiss' : 'similarityCacheHit');
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

    function traceInventory(counts) {
        return [...counts].map(([token, count]) => ({ token, count,
            shapeId: getTokenShapeId(token), code: getTokenCode(token),
            throughput: getTokenThroughput(token) }));
    }

    function cloneCounts(counts) {
        if (!profileShadowActive) profileCounter('inventoryClones');
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
        profileCounter('rawAttempts');
        const shapeIdA = getTokenShapeId(inputTokenA);
        let outputs;

        if (op.inputCount === 1) {
            const cacheKey = color === null
                ? op.cacheId * OPERATION_CACHE_KEY_STRIDE + shapeIdA
                : op.cacheId * OPERATION_CACHE_KEY_STRIDE + color.charCodeAt(0) * OPERATION_CACHE_KEY_BASE + shapeIdA;
            outputs = getCachedValue(operationOutputCache, cacheKey);
            const cacheHit = outputs !== undefined;
            profileCounter(outputs === undefined ? 'operationCacheMiss' : 'operationCacheHit');
            if (outputs === undefined) {
                profileCounter('physicalExecutions');
                const inputShape = getShapeObject(shapeIdA);
                try {
                    outputs = (color === null ? op.fn(inputShape, config) : op.fn(inputShape, color, config))
                        .filter(outputShape => !outputShape.isEmpty())
                        .map(outputShape => internShapeCode(outputShape.toShapeCode()))
                        .filter(shapeId => shapeId !== null);
                } catch (error) {
                    if (!(error instanceof InvalidOperationInputs)) throw error;
                    outputs = null;
                }
                setCachedValue(operationOutputCache, cacheKey, outputs, CACHE_LIMITS.operationOutputs);
            }
            if (profileData && outputs) for (const id of outputs) profileShape(id, 'outputUse');
            if (traceEnabled) trace('operation-output', { operation: opName, color,
                inputShapeIds: [shapeIdA], cacheKey, cacheHit,
                outputShapeIds: outputs === null ? null : [...outputs],
                outputCodes: outputs === null ? null : outputs.map(getShapeCode) });
            return outputs;
        }

        const shapeIdB = getTokenShapeId(inputTokenB);
        const [keyA, keyB, shapeA, shapeB] = op.commutative && shapeIdA > shapeIdB
            ? [shapeIdB, shapeIdA, getShapeObject(shapeIdB), getShapeObject(shapeIdA)]
            : [shapeIdA, shapeIdB, getShapeObject(shapeIdA), getShapeObject(shapeIdB)];
        const cacheKey = op.cacheId * OPERATION_CACHE_KEY_STRIDE
            + keyA * OPERATION_CACHE_KEY_BASE
            + keyB;
        outputs = getCachedValue(operationOutputCache, cacheKey);
        const cacheHit = outputs !== undefined;
        profileCounter(outputs === undefined ? 'operationCacheMiss' : 'operationCacheHit');
        if (outputs === undefined) {
            profileCounter('physicalExecutions');
            try {
                outputs = op.fn(shapeA, shapeB, config)
                    .filter(outputShape => !outputShape.isEmpty())
                    .map(outputShape => internShapeCode(outputShape.toShapeCode()))
                    .filter(shapeId => shapeId !== null);
            } catch (error) {
                if (!(error instanceof InvalidOperationInputs)) throw error;
                outputs = null;
            }
            setCachedValue(operationOutputCache, cacheKey, outputs, CACHE_LIMITS.operationOutputs);
        }
        if (profileData && outputs) for (const id of outputs) profileShape(id, 'outputUse');
        if (traceEnabled) trace('operation-output', { operation: opName, color,
            inputShapeIds: [shapeIdA, shapeIdB], physicalInputShapeIds: [keyA, keyB],
            cacheKey, cacheHit, outputShapeIds: outputs === null ? null : [...outputs],
            outputCodes: outputs === null ? null : outputs.map(getShapeCode) });
        if (profileState?.sampled) {
            const pair = profileState.shadow.pairwiseByOperator[opName] ??= { attempts: 0, invalid: 0,
                duplicateOutputSignatures: 0, uniqueOutputSignatures: 0 };
            pair.attempts += 1;
            if (outputs === null) pair.invalid += 1;
            else {
                const signature = [...outputs].sort((a, b) => a - b).join('|');
                const seen = profileState.shadowPairOutputs.get(opName) ?? new Set();
                if (!profileState.shadowPairOutputs.has(opName)) profileState.shadowPairOutputs.set(opName, seen);
                if (seen.has(signature)) pair.duplicateOutputSignatures += 1;
                else { seen.add(signature); pair.uniqueOutputSignatures += 1; }
            }
        }
        return outputs;
    }

    function checkGoal(counts) {
        profileCounter('goalChecks');
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

    function calculateThroughputSquareTotal(counts) {
        let total = 0;
        for (const [token, count] of counts) {
            const throughput = getTokenThroughput(token);
            total += throughput * throughput * count;
        }
        return total;
    }

    function getStateKey(counts) {
        if (!profileShadowActive) profileCounter('stateKeyBuilds');
        return [...counts]
            .sort(([tokenA], [tokenB]) => tokenA - tokenB)
            .map(([token, count]) => `${token}#${count}`)
            .join('|');
    }

    function getSemanticStateKey(counts) {
        return [...counts]
            .map(([token, count]) => ({
                shape: getTokenCode(token),
                units: Math.round(getTokenThroughput(token) * 4096),
                count,
            }))
            .sort((a, b) => a.shape.localeCompare(b.shape) || a.units - b.units || a.count - b.count)
            .map(({ shape, units, count }) => `${shape}@${units}#${count}`)
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
        profileCounter('solutionReplays');
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
        const shapeId = internShapeCode(code);
        if (shapeId === null) return makeInitializationLimitResult();
        adjustCount(initialCounts, makeToken(shapeId, 1.0), 1);
    }

    const initialKey = getStateKey(initialCounts);
    if (traceEnabled) trace('initial-inventory', { stateKey: initialKey, inventory: traceInventory(initialCounts) });
    const initialScoreTotal = calculateSimilarityTotal(initialCounts);
    const initialThroughputTotal = calculateThroughputTotal(initialCounts);
    const initialThroughputSquareTotal = allowSplitting ? calculateThroughputSquareTotal(initialCounts) : 0;
    let frontier = [{
        stateKey: initialKey,
        counts: initialCounts,
        trace: null,
        throughputTotal: initialThroughputTotal,
        throughputSquareTotal: initialThroughputSquareTotal,
        scoreTotal: initialScoreTotal,
        score: initialThroughputTotal > 0 ? initialScoreTotal / initialThroughputTotal : 0
    }];
    const visited = new Set([initialKey]);
    const beamPruned = { value: false };

    function classifyResult(result) {
        // A found path and an enforced safety limit take precedence over the
        // no-result classification, even if beam pruning happened earlier.
        const outcome = Array.isArray(result.solutionPath) ? 'solved'
            : result.limitReached ? 'limit'
            : beamPruned.value ? 'not-found-pruned'
            : 'exhausted';
        return { ...result, outcome, beamPruned: beamPruned.value };
    }

    function makeLimitResult(limitReason) {
        if (traceEnabled) trace('limit', { limitReason, depth, statesExplored: visited.size,
            generatedStates, shapeSlots: shapeCodes.length, operationAttempts });
        return finalizeResult(classifyResult({
            solutionPath: null,
            depth,
            statesExplored: visited.size,
            generatedStates,
            limitReached: true,
            limitReason,
        }));
    }

    function recordOperationAttempt() {
        operationAttempts += 1;
        if (observerData) observerData.operationAttempts = operationAttempts;
        if (traceEnabled) trace('operation-attempt', { operation: activeOpName, operationAttempts });
        if (diagnostics) diagnostics.operationAttempts = operationAttempts;
        return operationAttempts % solverLimits.operationTimeCheckInterval === 0
            && readNow() - searchStarted >= solverLimits.maxSearchTimeMs;
    }

    function recordRetainedLayer(nextDepth, collector) {
        if (!diagnostics) return;
        diagnostics.retainedSemanticKeysByDepth.push({
            depth: nextDepth,
            keys: collector.semanticRetainedKeys(),
        });
    }

    function postProgress(displayDepth, collector) {
        self.postMessage({
            type: 'status',
            messageKey: 'solver.status.progress',
            messageParams: {
                depth: displayDepth,
                queueLength: collector.size,
                totalStates: visited.size,
                beamPruned: beamPruned.value,
                generatedStates,
                cacheEntries: similarityCache.size + shapeCache.size + paintColorsCache.size + operationOutputCache.size,
                internedShapes: shapeCodes.length,
            },
            status: 'running',
        });
        lastUpdate = readNow();
    }

    while (frontier.length > 0 && !cancelled) {
        const currentDepthStates = frontier;
        const nextStates = new BoundedStateCollector(frontierLimit, visited, useCoarseness, diagnostics, beamPruned,
            traceEnabled ? trace : null,
            observer ? type => {
                if (type === 'lazy-reject') observerData.collectorLazyRejects += 1;
                if (type === 'admit' && activeOutputTokens) {
                    observeOutputIds(activeOutputTokens, observerData.admittedIds);
                }
            } : null);
        if (profileData) nextStates.profileEvent = event => {
            profileCounter(event);
            if (event === 'admitted' && activeOutputTokens) {
                for (const token of activeOutputTokens) profileShape(getTokenShapeId(token), 'admitted');
            }
        };

        function enqueueSuccessor({
            createCounts,
            parent,
            stepFactory,
            throughputTotal,
            throughputSquareTotal,
            scoreTotal,
            outputTokens,
            inputTokens = [],
            canCompleteGoal = true,
        }) {
            generatedStates += 1;
            if (traceEnabled) trace('successor', { depth: depth + 1, generatedStates,
                operation: activeOpName, parentStateKey: parent.stateKey,
                inputTokens: [...inputTokens], outputTokens: [...outputTokens],
                outputCodes: outputTokens.map(getTokenCode) });
            profileCounter('successors');
            if (profileData) {
                for (const token of inputTokens) {
                    const life = shapeLife[getTokenShapeId(token)];
                    if (life) { life.consumed += 1; life.lastUseDepth = Math.max(life.lastUseDepth, depth); }
                }
                if (profileState?.sampled) {
                    let shadowCounts;
                    let fullKey;
                    profileShadowActive = true;
                    try {
                        shadowCounts = createCounts();
                        fullKey = getStateKey(shadowCounts);
                    } finally {
                        profileShadowActive = false;
                    }
                    const outputKey = outputTokens.map(token => getTokenCode(token)).sort().join('|');
                    const resourceKey = [...shadowCounts].map(([token, count]) => `${getTokenThroughput(token)}#${count}`)
                        .sort().join('|');
                    const sample = profileState.shadow;
                    sample.candidates += 1;
                    if (profileState.shadowFullKeys.has(fullKey)) sample.duplicateFullState += 1;
                    else profileState.shadowFullKeys.add(fullKey);
                    if (profileState.shadowOutputKeys.has(outputKey)) sample.duplicateOutputShape += 1;
                    else profileState.shadowOutputKeys.add(outputKey);
                    const opOutputs = profileState.shadowOutputsByOp.get(activeOpName) ?? new Set();
                    if (!profileState.shadowOutputsByOp.has(activeOpName)) profileState.shadowOutputsByOp.set(activeOpName, opOutputs);
                    if (opOutputs.has(outputKey)) sample.duplicateOutputByOperator[activeOpName] =
                        (sample.duplicateOutputByOperator[activeOpName] ?? 0) + 1;
                    else opOutputs.add(outputKey);
                    if (profileState.shadowResourceKeys.has(resourceKey)) sample.duplicateResourceMultiset += 1;
                    else profileState.shadowResourceKeys.add(resourceKey);
                    if (activeOpName === 'Stacker' && inputTokens.length === 2) {
                        const pair = inputTokens.map(token => getTokenCode(token));
                        const reverseKey = `${pair[1]}|${pair[0]}`;
                        if (profileState.reversedPairs.get(reverseKey) === fullKey) sample.reversedOrderedSameState += 1;
                        profileState.reversedPairs.set(`${pair[0]}|${pair[1]}`, fullKey);
                    }
                }
            }

            let candidate;
            function materializeCandidate() {
                if (!candidate) {
                    if (observerData) {
                        observerData.candidateMaterializations += 1;
                        observeOutputIds(outputTokens, observerData.candidateMaterializedIds);
                    }
                    profileCounter('materializedCandidates');
                    const counts = createCounts();
                    candidate = { counts, stateKey: getStateKey(counts) };
                    if (traceEnabled) trace('candidate-materialized', { generatedStates,
                        stateKey: candidate.stateKey, inventory: traceInventory(counts) });
                }
                return candidate;
            }

            if (
                canCompleteGoal &&
                (outputTokens.length === 0 || outputTokens.some(token => targetCodeUniverse.has(getTokenShapeId(token))))
            ) {
                const { counts } = materializeCandidate();
                if (observerData) observeOutputIds(outputTokens, observerData.goalMaterializedIds);
                const goalReached = checkGoal(counts);
                if (traceEnabled) trace('candidate-goal-check', { generatedStates, goalReached });
                if (goalReached) {
                    const goalState = {
                        trace: { parent: parent.trace, step: stepFactory() },
                    };
                    return finalizeResult(classifyResult({
                        solutionPath: materializeSolutionPath(goalState),
                        depth: depth + 1,
                        statesExplored: visited.size,
                        generatedStates,
                    }));
                }
            }

            if (generatedStates >= solverLimits.maxGeneratedStates) {
                return makeLimitResult('generated-states');
            }

            const score = throughputTotal > 1e-12 ? scoreTotal / throughputTotal : 0;
            const coarseness = allowSplitting && throughputTotal > 1e-12 ? throughputSquareTotal / throughputTotal : 0;
            activeOutputTokens = outputTokens;
            nextStates.considerLazy(score, coarseness, () => {
                const { stateKey, counts } = materializeCandidate();
                return {
                    stateKey,
                    semanticKey: diagnostics ? getSemanticStateKey(counts) : undefined,
                    createState: () => ({
                        stateKey,
                        counts,
                        trace: { parent: parent.trace, step: stepFactory() },
                        throughputTotal,
                        throughputSquareTotal,
                        scoreTotal,
                        score,
                        ...(profileData ? { profileSourceOperation: activeOpName } : {}),
                    }),
                };
            });
            activeOutputTokens = null;
            return null;
        }

        for (const current of currentDepthStates) {
            if (cancelled) break;

            if (readNow() - searchStarted >= solverLimits.maxSearchTimeMs) {
                return makeLimitResult('time');
            }

            const { counts, scoreTotal, throughputTotal, throughputSquareTotal } = current;
            const inputGroups = groupEquivalentInputs(counts);
            if (observerData) for (const [token, count] of counts) {
                if (count > 0) observerData.expandedIds.add(getTokenShapeId(token));
            }
            if (traceEnabled) trace('expand', { depth, stateKey: current.stateKey,
                inventory: traceInventory(counts), score: current.score });
            if (profileData) {
                flushProfileState();
                profileData.expandedStates += 1;
                const ordinal = profileData.expandedStates;
                const sampled = (ordinal - 1) % profile.sampleEvery === 0;
                profileState = { ordinal, depth, eligibleTokens: inputGroups.length, sampled,
                    sourceOperation: current.profileSourceOperation ?? 'initial',
                    byOperator: {}, shadow: sampled ? { candidates: 0, duplicateFullState: 0,
                        duplicateOutputShape: 0, duplicateResourceMultiset: 0,
                        reversedOrderedSameState: 0, duplicateOutputByOperator: {}, pairwiseByOperator: {} } : null,
                    shadowFullKeys: sampled ? new Set() : null,
                    shadowOutputKeys: sampled ? new Set() : null,
                    shadowResourceKeys: sampled ? new Set() : null,
                    shadowOutputsByOp: sampled ? new Map() : null,
                    shadowPairOutputs: sampled ? new Map() : null,
                    reversedPairs: sampled ? new Map() : null };
                const source = profileState.sourceOperation;
                profileData.expandedBySourceOperator[source] =
                    (profileData.expandedBySourceOperator[source] ?? 0) + 1;
                for (const [token, count] of counts) if (count > 0) {
                    const life = shapeLife[getTokenShapeId(token)];
                    if (life) { life.expanded += 1; life.lastUseDepth = Math.max(life.lastUseDepth, depth); }
                }
            }

            const currentIsGoal = checkGoal(counts);
            if (traceEnabled) trace('expanded-goal-check', { depth, stateKey: current.stateKey, goalReached: currentIsGoal });
            if (currentIsGoal) {
                return finalizeResult(classifyResult({
                    solutionPath: materializeSolutionPath(current),
                    depth,
                    statesExplored: visited.size,
                    generatedStates,
                }));
            }

            if (allowSplitting) {
                activeOpName = 'Splitter';
                for (const { token, shapeId, throughput } of inputGroups) {
                    const childThroughput = throughput / 2;
                    if (childThroughput < MIN_SPLIT_THROUGHPUT) continue;

                    const childToken = makeToken(shapeId, childThroughput);
                    const outputTokens = [childToken, childToken];
                    profileCounter('rawAttempts');
                    if (recordOperationAttempt()) { profileCounter('timeTerminatedAttempts'); return makeLimitResult('time'); }
                    const completed = enqueueSuccessor({
                        createCounts: () => {
                            const nextCounts = cloneCounts(counts);
                            adjustCount(nextCounts, token, -1);
                            adjustCount(nextCounts, childToken, 2);
                            return nextCounts;
                        },
                        parent: current,
                        stepFactory: () => makeStep("Splitter", [token], outputTokens),
                        throughputTotal,
                        throughputSquareTotal: throughputSquareTotal - throughput * throughput + 2 * childThroughput * childThroughput,
                        scoreTotal,
                        outputTokens,
                        inputTokens: [token],
                        canCompleteGoal: false,
                    });
                    if (completed) return completed;
                }
            }

            for (const opName of enabledOperations) {
                if (cancelled) break;
                activeOpName = opName;

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
                                if (inputShape.layers.length !== 1) { profileCounter('cleanPaintSkips'); continue; }
                                const topLayer = inputShape.layers[0];
                                const allUncolored = topLayer.every(part =>
                                    UNPAINTABLE_PARTS.includes(part.shape) || part.color === UNCOLORED_CODE
                                );
                                if (!allUncolored) { profileCounter('cleanPaintSkips'); continue; }
                            }

                            const colors = opName === "Painter"
                                ? getCachedPaintColors(shapeId)
                                : [...targetCrystalColors];

                            for (const color of colors) {
                                const outputCodes = getCachedOperationOutputs(opName, op, token, null, color);
                                if (shapeLimitReached) { profileCounter('shapeCapTerminatedAttempts'); return makeLimitResult('shape-universe'); }
                                if (recordOperationAttempt()) { profileCounter('timeTerminatedAttempts'); return makeLimitResult('time'); }
                                if (outputCodes === null) { profileCounter('invalidInputs'); continue; }
                                if (outputCodes.length === 0 && !preventWaste) { profileCounter('emptyOutputSkips'); continue; }
                                if (outputCodes.length === 1 && outputCodes[0] === shapeId) { profileCounter('unaryIdentitySkips'); continue; }

                                const outputTokens = [];
                                let outputSimilarityTotal = 0;

                                for (const outputCode of outputCodes) {
                                    const outputToken = makeToken(outputCode, throughput);
                                    outputTokens.push(outputToken);
                                    outputSimilarityTotal += getCachedSimilarity(outputCode) * throughput;
                                }

                                const nextThroughputTotal = throughputTotal - throughput + outputTokens.length * throughput;
                                const nextScoreTotal = scoreTotal - inputSimilarity * throughput + outputSimilarityTotal;
                                const completed = enqueueSuccessor({
                                    createCounts: () => {
                                        const nextCounts = cloneCounts(counts);
                                        adjustCount(nextCounts, token, -1);
                                        for (const outputToken of outputTokens) adjustCount(nextCounts, outputToken, 1);
                                        return nextCounts;
                                    },
                                    parent: current,
                                    stepFactory: () => makeStep(opName, [token], outputTokens, color),
                                    throughputTotal: nextThroughputTotal,
                                    throughputSquareTotal: throughputSquareTotal - throughput * throughput + outputTokens.length * throughput * throughput,
                                    scoreTotal: nextScoreTotal,
                                    outputTokens,
                                    inputTokens: [token],
                                });
                                if (completed) return completed;
                            }
                        } else {
                            const outputCodes = getCachedOperationOutputs(opName, op, token);
                            if (shapeLimitReached) { profileCounter('shapeCapTerminatedAttempts'); return makeLimitResult('shape-universe'); }
                            if (recordOperationAttempt()) { profileCounter('timeTerminatedAttempts'); return makeLimitResult('time'); }
                            if (outputCodes === null) { profileCounter('invalidInputs'); continue; }
                            if (outputCodes.length === 0 && !preventWaste) { profileCounter('emptyOutputSkips'); continue; }
                            if (outputCodes.length === 1 && outputCodes[0] === shapeId) { profileCounter('unaryIdentitySkips'); continue; }

                            const outputTokens = [];
                            let outputSimilarityTotal = 0;

                            for (const outputCode of outputCodes) {
                                const outputToken = makeToken(outputCode, throughput);
                                outputTokens.push(outputToken);
                                outputSimilarityTotal += getCachedSimilarity(outputCode) * throughput;
                            }

                            const nextThroughputTotal = throughputTotal - throughput + outputTokens.length * throughput;
                            const nextScoreTotal = scoreTotal - inputSimilarity * throughput + outputSimilarityTotal;
                            const completed = enqueueSuccessor({
                                createCounts: () => {
                                    const nextCounts = cloneCounts(counts);
                                    adjustCount(nextCounts, token, -1);
                                    for (const outputToken of outputTokens) adjustCount(nextCounts, outputToken, 1);
                                    return nextCounts;
                                },
                                parent: current,
                                stepFactory: () => makeStep(opName, [token], outputTokens),
                                throughputTotal: nextThroughputTotal,
                                throughputSquareTotal: throughputSquareTotal - throughput * throughput + outputTokens.length * throughput * throughput,
                                scoreTotal: nextScoreTotal,
                                outputTokens,
                                inputTokens: [token],
                            });
                            if (completed) return completed;
                        }
                    }
                } else if (inputCount === 2) {
                    if (profileData) {
                        const n = inputGroups.length;
                        profileCounter('eligibleOperandTokens', n);
                        profileCounter('theoreticalPairs', op.commutative ? n * (n + 1) / 2 : n * n);
                    }
                    for (let i = 0; i < inputGroups.length && !cancelled; i++) {
                        const startJ = op.commutative ? i : 0;
                        for (let j = startJ; j < inputGroups.length && !cancelled; j++) {
                            const inputA = inputGroups[i];
                            const inputB = inputGroups[j];
                            if (i === j && inputA.count < 2) { profileCounter('resourceSelfPairSkips'); continue; }

                            const outputCodes = getCachedOperationOutputs(opName, op, inputA.token, inputB.token);
                            if (shapeLimitReached) { profileCounter('shapeCapTerminatedAttempts'); return makeLimitResult('shape-universe'); }
                            if (recordOperationAttempt()) { profileCounter('timeTerminatedAttempts'); return makeLimitResult('time'); }
                            if (outputCodes === null) { profileCounter('invalidInputs'); continue; }
                            if (outputCodes.length === 0 && !preventWaste) { profileCounter('emptyOutputSkips'); continue; }

                            const combinedThroughput = Math.min(inputA.throughput, inputB.throughput);
                            const outputTokens = [];
                            let outputSimilarityTotal = 0;

                            for (const outputCode of outputCodes) {
                                const outputToken = makeToken(outputCode, combinedThroughput);
                                outputTokens.push(outputToken);
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
                            const completed = enqueueSuccessor({
                                createCounts: () => {
                                    const nextCounts = cloneCounts(counts);
                                    adjustCount(nextCounts, inputA.token, -1);
                                    adjustCount(nextCounts, inputB.token, -1);
                                    for (const outputToken of outputTokens) adjustCount(nextCounts, outputToken, 1);
                                    return nextCounts;
                                },
                                parent: current,
                                stepFactory: () => makeStep(opName, [inputA.token, inputB.token], outputTokens),
                                throughputTotal: nextThroughputTotal,
                                throughputSquareTotal: throughputSquareTotal
                                    - inputA.throughput * inputA.throughput
                                    - inputB.throughput * inputB.throughput
                                    + outputTokens.length * combinedThroughput * combinedThroughput,
                                scoreTotal: nextScoreTotal,
                                outputTokens,
                                inputTokens: [inputA.token, inputB.token],
                            });
                            if (completed) return completed;
                        }
                    }
                }
            }

            const now = readNow();
            if (now - searchStarted >= solverLimits.maxSearchTimeMs) {
                return makeLimitResult('time');
            }
            if (now - lastUpdate > 200) postProgress(depth + 1, nextStates);
        }

        recordRetainedLayer(depth + 1, nextStates);
        profileCounter('frontierSorts');
        frontier = nextStates.toBestFirstStates();
        if (observerData) for (const state of frontier) for (const [token, count] of state.counts) {
            if (count > 0) observerData.finalRetainedIds.add(getTokenShapeId(token));
        }
        if (traceEnabled) trace('frontier', { depth: depth + 1,
            states: frontier.map(state => ({ stateKey: state.stateKey, score: state.score,
                inventory: traceInventory(state.counts) })) });
        if (profileData) for (const state of frontier) {
            const source = state.profileSourceOperation ?? 'initial';
            profileData.finalRetainedBySourceOperator[source] =
                (profileData.finalRetainedBySourceOperator[source] ?? 0) + 1;
            profileData.counters.finalRetainedStates = (profileData.counters.finalRetainedStates ?? 0) + 1;
            for (const [token, count] of state.counts) {
                if (count > 0) profileShape(getTokenShapeId(token), 'retained');
            }
        }
        if (visited.size + frontier.length > solverLimits.maxTotalStates) {
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
            state.throughputSquareTotal = 0;
            state.scoreTotal = 0;
            state.score = 0;
        }

        const now = readNow();
        if (now - lastUpdate > 200) {
            postProgress(depth, nextStates);
        }
    }

    if (cancelled) return null;
    return finalizeResult(classifyResult({ solutionPath: null, depth, statesExplored: visited.size, generatedStates }));
}

async function shapeExplorer(startingShapeCodes, enabledOperations, depthLimit, maxLayers) {
    return shapeExplorerCore(startingShapeCodes, enabledOperations, depthLimit, maxLayers, null);
}

async function shapeExplorerTestOnly(instance, { limits, now } = {}) {
    if (now !== undefined && typeof now !== 'function') {
        throw new Error('The test-only Explorer clock must be a function');
    }
    return shapeExplorerCore(
        instance.startingShapeCodes,
        instance.enabledOperations,
        instance.depthLimit ?? 999,
        instance.maxLayers ?? 4,
        { limits: normalizeExplorerTestLimits(limits), now },
    );
}

async function shapeExplorerCore(startingShapeCodes, enabledOperations, depthLimit, maxLayers, testOptions) {
    if (!Number.isInteger(depthLimit) || depthLimit < 0) {
        throw new Error('Explorer depth limit must be a non-negative integer');
    }
    if (!Number.isInteger(maxLayers) || maxLayers < 1) {
        throw new Error('Explorer max layers must be a positive integer');
    }

    const config = new ShapeOperationConfig(maxLayers);
    const limits = testOptions?.limits ?? DEFAULT_EXPLORER_LIMITS;
    let previousTime = -Infinity;
    const readNow = testOptions?.now
        ? () => {
            const value = testOptions.now();
            if (!Number.isFinite(value) || value < previousTime) {
                throw new Error('The test-only Explorer clock must return finite monotonic values');
            }
            previousTime = value;
            return value;
        }
        : () => performance.now();
    const started = readNow();
    const encoder = new TextEncoder();
    const utf8Bytes = value => encoder.encode(JSON.stringify(value)).length;

    let nextShapeId = 0;
    let nextOpId = 0;
    let attempts = 0;
    let invalidAttempts = 0;
    const shapeCodeToId = new Map();
    const shapeRecords = [];
    const shapesList = [];
    const opsList = [];
    const edges = [];
    function measureResult(result) {
        for (let previous = -1; result.serializedBytes !== previous;) {
            previous = result.serializedBytes;
            result.serializedBytes = utf8Bytes(result);
        }
        return result.serializedBytes;
    }

    function projectedSerializedBytes(shapeItems, opItems, edgeItems) {
        const projection = {
            shapes: [...shapesList, ...shapeItems],
            ops: [...opsList, ...opItems],
            edges: [...edges, ...edgeItems],
            outcome: 'limit',
            complete: false,
            limitReason: 'serialization',
            depthReached: depthLimit,
            partialDepth: depthLimit,
            attempts: limits.maxAttempts,
            invalidAttempts: limits.maxAttempts,
            serializedBytes: 0,
        };
        return measureResult(projection);
    }

    function makeResult(outcome, limitReason, depthReached, partialDepth = null) {
        const result = {
            shapes: shapesList,
            ops: opsList,
            edges,
            outcome,
            complete: outcome === 'complete',
            limitReason,
            depthReached,
            partialDepth,
            attempts,
            invalidAttempts,
            serializedBytes: 0,
        };
        measureResult(result);
        if (result.serializedBytes > limits.maxSerializedBytes) {
            throw new Error('Explorer serialized-result accounting exceeded its configured limit');
        }
        return result;
    }

    function addStartingShape(code) {
        if (shapeCodeToId.has(code)) return null;
        const shape = Shape.fromShapeCode(code);
        if (shape.isEmpty()) return null;
        if (shapesList.length >= limits.maxShapes) return 'shapes';
        const id = nextShapeId;
        const node = { id: `shape-${id}`, code };
        if (projectedSerializedBytes([node], [], []) > limits.maxSerializedBytes) return 'serialization';
        nextShapeId += 1;
        shapeCodeToId.set(code, id);
        shapeRecords.push({ id, code, shape });
        shapesList.push(node);
        return null;
    }

    for (const code of startingShapeCodes) {
        const reason = addStartingShape(code);
        if (reason) return makeResult('limit', reason, 0, 0);
    }

    const availableIds = new Set(shapeRecords.map(record => record.id));
    let frontier = new Set(availableIds);

    function commitDiscovery(inputIds, opName, params, outputs, newlyDiscovered) {
        const novel = [];
        const seen = new Set();
        for (const shape of outputs) {
            if (shape.isEmpty()) continue;
            const code = shape.toShapeCode();
            if (seen.has(code) || shapeCodeToId.has(code)) continue;
            seen.add(code);
            novel.push({ code, shape });
        }
        if (novel.length === 0) return null;
        if (shapesList.length + novel.length > limits.maxShapes) return 'shapes';
        if (opsList.length >= limits.maxOperations) return 'operations';

        const shapeNodes = novel.map((entry, index) => ({
            id: `shape-${nextShapeId + index}`,
            code: entry.code,
        }));
        const opNode = { id: `op-${nextOpId}`, type: opName, params };
        const inputEdges = [...new Set(inputIds)].map(id => ({ source: `shape-${id}`, target: opNode.id }));
        const outputEdges = shapeNodes.map(node => ({ source: opNode.id, target: node.id }));
        const newEdges = [...inputEdges, ...outputEdges];
        if (edges.length + newEdges.length > limits.maxEdges) return 'edges';
        if (projectedSerializedBytes(shapeNodes, [opNode], newEdges) > limits.maxSerializedBytes) {
            return 'serialization';
        }

        opsList.push(opNode);
        edges.push(...newEdges);
        nextOpId += 1;
        for (let index = 0; index < novel.length; index++) {
            const id = nextShapeId++;
            const { code, shape } = novel[index];
            shapeCodeToId.set(code, id);
            shapeRecords.push({ id, code, shape });
            shapesList.push(shapeNodes[index]);
            availableIds.add(id);
            newlyDiscovered.add(id);
        }
        return null;
    }

    function attemptCall(inputIds, opName, color, newlyDiscovered) {
        if (attempts >= limits.maxAttempts) return 'attempts';
        if (readNow() - started >= limits.maxSearchTimeMs) return 'time';
        attempts += 1;
        const op = operations[opName];
        const inputShapes = inputIds.map(id => shapeRecords[id].shape);
        let outputs;
        try {
            outputs = op.needsColor
                ? op.fn(inputShapes[0], color, config)
                : op.fn(...inputShapes, config);
        } catch (error) {
            if (!(error instanceof InvalidOperationInputs)) throw error;
            invalidAttempts += 1;
            outputs = null;
        }
        if (readNow() - started >= limits.maxSearchTimeMs) return 'time';
        if (!outputs) return null;
        return commitDiscovery(
            inputIds,
            opName,
            op.needsColor ? { color } : {},
            outputs,
            newlyDiscovered,
        );
    }

    const operationNames = [...new Set(enabledOperations)].filter(name => operations[name]);
    let depthReached = 0;
    for (let depth = 1; depth <= depthLimit; depth++) {
        if (cancelled) return null;
        if (frontier.size === 0) break;
        const newlyDiscovered = new Set();
        const allIds = [...availableIds];
        const frontierIds = [...frontier];

        for (const opName of operationNames) {
            if (cancelled) return null;
            const op = operations[opName];
            if (op.inputCount === 1) {
                for (const id of frontierIds) {
                    for (const color of op.needsColor ? EXPLORER_COLORS : [null]) {
                        const reason = attemptCall([id], opName, color, newlyDiscovered);
                        if (reason) return makeResult('limit', reason, depth - 1, depth);
                    }
                }
                continue;
            }

            if (op.commutative) {
                for (let left = 0; left < allIds.length; left++) {
                    for (let right = left; right < allIds.length; right++) {
                        const id1 = allIds[left];
                        const id2 = allIds[right];
                        if (!frontier.has(id1) && !frontier.has(id2)) continue;
                        const reason = attemptCall([id1, id2], opName, null, newlyDiscovered);
                        if (reason) return makeResult('limit', reason, depth - 1, depth);
                    }
                }
            } else {
                for (const id1 of allIds) {
                    for (const id2 of allIds) {
                        if (!frontier.has(id1) && !frontier.has(id2)) continue;
                        const reason = attemptCall([id1, id2], opName, null, newlyDiscovered);
                        if (reason) return makeResult('limit', reason, depth - 1, depth);
                    }
                }
            }
        }
        depthReached = depth;
        frontier = newlyDiscovered;
    }

    if (cancelled) return null;
    return makeResult('complete', null, depthReached);
}

export { BoundedStateCollector, shapeExplorerTestOnly, shapeSolver, shapeSolverTestOnly };
