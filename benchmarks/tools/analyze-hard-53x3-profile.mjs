#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PROFILE_DIR = path.join(ROOT, 'benchmarks/profiling/hard-53x3-architecture-v1');
const sample = JSON.parse(await readFile(path.join(PROFILE_DIR, 'sample.json'), 'utf8'));

function quantiles(values) {
    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
    if (!sorted.length) return { count: 0, min: null, median: null, p90: null, max: null };
    const at = p => {
        const index = (sorted.length - 1) * p;
        const lower = Math.floor(index);
        const fraction = index - lower;
        return sorted[lower] + (sorted[Math.min(lower + 1, sorted.length - 1)] - sorted[lower]) * fraction;
    };
    return { count: sorted.length, min: sorted[0], median: at(0.5), p90: at(0.9), max: sorted.at(-1) };
}

function add(target, source) {
    for (const [key, value] of Object.entries(source ?? {})) {
        if (Number.isFinite(value)) target[key] = (target[key] ?? 0) + value;
    }
}

function operatorTotals(profile) {
    const totals = {};
    for (const [depthOperator, counters] of Object.entries(profile.byDepthOperator ?? {})) {
        const separator = depthOperator.indexOf(':');
        const operator = depthOperator.slice(separator + 1);
        add(totals[operator] ??= {}, counters);
    }
    for (const [operator, births] of Object.entries(profile.shapeSummary?.birthsByOperator ?? {})) {
        (totals[operator] ??= {}).newShapes = births;
    }
    return totals;
}

function shadowTotals(profile) {
    const totals = {
        sampledStates: 0, candidates: 0, duplicateFullState: 0,
        duplicateOutputShape: 0, duplicateResourceMultiset: 0,
        reversedOrderedSameState: 0, pairwiseByOperator: {},
    };
    for (const state of profile.stateSamples ?? []) {
        const shadow = state.shadow;
        if (!shadow) continue;
        totals.sampledStates += 1;
        for (const key of ['candidates', 'duplicateFullState', 'duplicateOutputShape',
            'duplicateResourceMultiset', 'reversedOrderedSameState']) {
            totals[key] += shadow[key] ?? 0;
        }
        for (const [operator, counters] of Object.entries(shadow.pairwiseByOperator ?? {})) {
            add(totals.pairwiseByOperator[operator] ??= {}, counters);
        }
    }
    totals.duplicateFullStateRatio = totals.candidates ? totals.duplicateFullState / totals.candidates : null;
    totals.duplicateOutputShapeRatio = totals.candidates ? totals.duplicateOutputShape / totals.candidates : null;
    totals.duplicateResourceMultisetRatio = totals.candidates ? totals.duplicateResourceMultiset / totals.candidates : null;
    for (const counters of Object.values(totals.pairwiseByOperator)) {
        const classified = (counters.uniqueOutputSignatures ?? 0) + (counters.duplicateOutputSignatures ?? 0);
        counters.duplicateOutputRatio = classified ? counters.duplicateOutputSignatures / classified : null;
    }
    return totals;
}

const records = [];
for (const selected of sample.cases) {
    const file = path.join(PROFILE_DIR, 'records', `${selected.key.replace(':', '-')}.json`);
    const record = JSON.parse(await readFile(file, 'utf8'));
    const profile = record.profile;
    const expanded = profile.expandedStates;
    const operators = operatorTotals(profile);
    const shadow = shadowTotals(profile);
    records.push({
        key: selected.key,
        reason: selected.reason,
        baselineStatus: selected.baseline.status,
        mechanismClass: selected.mechanism.mechanismClass,
        swapperRelated: selected.mechanism.swapperRelated,
        mixedPinCrystal: selected.mechanism.mixedPinCrystal,
        logicalParity: record.logicalParity,
        outcome: record.outcome,
        limitReason: record.limitReason,
        depth: record.depth,
        statesVisited: record.statesExplored,
        expandedStates: expanded,
        candidates: record.generatedStates,
        rawAttempts: profile.counters.rawAttempts ?? 0,
        candidatesPerVisited: record.generatedStates / record.statesExplored,
        candidatesPerExpanded: record.generatedStates / expanded,
        rawAttemptsPerExpanded: (profile.counters.rawAttempts ?? 0) / expanded,
        collector: Object.fromEntries(['considered', 'rankingPreReject', 'rankingPreRejectUnclassified',
            'visitedDuplicate', 'retainedDuplicate', 'uniqueRankingReject', 'admitted', 'evicted',
            'finalRetainedStates', 'materializedCandidates', 'inventoryClones', 'stateKeyBuilds']
            .map(key => [key, profile.counters[key] ?? 0])),
        operatorCreatedShapes: profile.shapeSummary.operatorCreated,
        operatorCreatedNeverConsumedFraction: profile.shapeSummary.operatorCreatedNeverConsumedFraction,
        operatorCreatedNeverFinalRetainedFraction: profile.shapeSummary.operatorCreatedNeverFinalRetainedFraction,
        operatorCreatedNeverExpandedFraction: profile.shapeSummary.operatorCreatedNeverExpandedFraction,
        shapesSeenInExpandedState: profile.shapeSummary.seenInExpandedState,
        targetRelevanceProxy: profile.targetRelevanceProxy,
        operators,
        shadow,
    });
}

function summarize(rows) {
    const operators = {};
    const collector = {};
    const shadow = { sampledStates: 0, candidates: 0, duplicateFullState: 0,
        duplicateOutputShape: 0, duplicateResourceMultiset: 0, reversedOrderedSameState: 0,
        pairwiseByOperator: {} };
    let operatorCreatedShapes = 0;
    let neverConsumed = 0;
    let neverRetained = 0;
    let neverExpanded = 0;
    for (const row of rows) {
        for (const [operator, counters] of Object.entries(row.operators)) add(operators[operator] ??= {}, counters);
        add(collector, row.collector);
        operatorCreatedShapes += row.operatorCreatedShapes;
        neverConsumed += row.operatorCreatedShapes * row.operatorCreatedNeverConsumedFraction;
        neverRetained += row.operatorCreatedShapes * row.operatorCreatedNeverFinalRetainedFraction;
        neverExpanded += row.operatorCreatedShapes * row.operatorCreatedNeverExpandedFraction;
        for (const key of ['sampledStates', 'candidates', 'duplicateFullState', 'duplicateOutputShape',
            'duplicateResourceMultiset', 'reversedOrderedSameState']) shadow[key] += row.shadow[key] ?? 0;
        for (const [operator, counters] of Object.entries(row.shadow.pairwiseByOperator)) {
            add(shadow.pairwiseByOperator[operator] ??= {}, counters);
        }
    }
    const operatorList = Object.entries(operators).map(([operator, counters]) => ({ operator, ...counters }))
        .sort((a, b) => (b.rawAttempts ?? 0) - (a.rawAttempts ?? 0));
    const totalRaw = operatorList.reduce((sum, row) => sum + (row.rawAttempts ?? 0), 0);
    const totalSuccessors = operatorList.reduce((sum, row) => sum + (row.successors ?? 0), 0);
    const totalNewShapes = operatorList.reduce((sum, row) => sum + (row.newShapes ?? 0), 0);
    for (const row of operatorList) {
        row.rawAttemptShare = totalRaw ? (row.rawAttempts ?? 0) / totalRaw : null;
        row.successorShare = totalSuccessors ? (row.successors ?? 0) / totalSuccessors : null;
        row.newShapeShare = totalNewShapes ? (row.newShapes ?? 0) / totalNewShapes : null;
    }
    shadow.duplicateFullStateRatio = shadow.candidates ? shadow.duplicateFullState / shadow.candidates : null;
    shadow.duplicateOutputShapeRatio = shadow.candidates ? shadow.duplicateOutputShape / shadow.candidates : null;
    shadow.duplicateResourceMultisetRatio = shadow.candidates ? shadow.duplicateResourceMultiset / shadow.candidates : null;
    for (const counters of Object.values(shadow.pairwiseByOperator)) {
        const classified = (counters.uniqueOutputSignatures ?? 0) + (counters.duplicateOutputSignatures ?? 0);
        counters.duplicateOutputRatio = classified ? counters.duplicateOutputSignatures / classified : null;
    }
    return {
        count: rows.length,
        logicalParity: { pass: rows.filter(row => row.logicalParity).length, fail: rows.filter(row => !row.logicalParity).length },
        ratios: {
            candidatesPerVisited: quantiles(rows.map(row => row.candidatesPerVisited)),
            candidatesPerExpanded: quantiles(rows.map(row => row.candidatesPerExpanded)),
            rawAttemptsPerExpanded: quantiles(rows.map(row => row.rawAttemptsPerExpanded)),
        },
        totals: {
            expandedStates: rows.reduce((sum, row) => sum + row.expandedStates, 0),
            candidates: rows.reduce((sum, row) => sum + row.candidates, 0),
            rawAttempts: rows.reduce((sum, row) => sum + row.rawAttempts, 0),
            operatorCreatedShapes,
        },
        operatorCreatedShapeUse: {
            neverConsumedFraction: operatorCreatedShapes ? neverConsumed / operatorCreatedShapes : null,
            neverFinalRetainedFraction: operatorCreatedShapes ? neverRetained / operatorCreatedShapes : null,
            neverExpandedFraction: operatorCreatedShapes ? neverExpanded / operatorCreatedShapes : null,
        },
        collector,
        operators: operatorList,
        sampledShadow: shadow,
    };
}

const cohorts = {
    all: summarize(records),
    candidateCap: summarize(records.filter(row => row.baselineStatus === 'CANDIDATE_CAP')),
    shapeUniverseCap: summarize(records.filter(row => row.baselineStatus === 'SHAPE_UNIVERSE_CAP')),
    timeoutControl: summarize(records.filter(row => row.baselineStatus === 'TIMEOUT')),
};

const analysis = {
    schemaVersion: 1,
    benchmarkCanonicalSha256: sample.benchmarkCanonicalSha256,
    baselineCanonicalSha256: sample.baselineCanonicalSha256,
    instrumentedSolverSha256: sample.instrumentedSolverSha256,
    sampleEveryExpandedState: sample.sampleEveryExpandedState,
    caveats: {
        timeoutControl: 'Profiling overhead advances the production wall clock; timeout control is descriptive and not logical-parity evidence.',
        shadowDuplicates: 'Exact only within deterministic sampled expanded states; not a random estimator and not production work.',
        rankingDedup: 'Production ranks before key construction; uniqueness of later ranking pre-rejects remains unavailable after the beam-pruned latch.',
        targetRelevance: 'Color/layer mismatch is a descriptive proxy, not a sound pruning proof.',
    },
    cohorts,
    cases: records,
};

await writeFile(path.join(PROFILE_DIR, 'analysis.json'), `${JSON.stringify(analysis, null, 2)}\n`);
console.log(JSON.stringify({
    output: 'benchmarks/profiling/hard-53x3-architecture-v1/analysis.json',
    all: cohorts.all,
}, null, 2));
