import { canonicalJson, sha256 } from './benchmark-core.mjs';
import { writeFile, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

export const BASELINE_RUNNER_VERSION = 'hard-53x3-formal-solver-baseline-v1';
export const BASELINE_ID = 'hard-53x3-solver-baseline-v1';
export const OPERATIONS = Object.freeze([
    'Rotator CW', 'Rotator CCW', 'Rotator 180', 'Half Destroyer', 'Cutter',
    'Swapper', 'Stacker', 'Painter', 'Pin Pusher', 'Crystal Generator',
]);
export const STATUSES = Object.freeze([
    'SOLVED', 'TIMEOUT', 'STATE_CAP', 'CANDIDATE_CAP', 'MEMORY_LIMIT',
    'SHAPE_UNIVERSE_CAP', 'NOT_FOUND_PRUNED', 'SEARCH_EXHAUSTED', 'ERROR',
]);

export function canonicalHash(value) { return sha256(canonicalJson(value)); }

export async function atomicJson(filePath, value) {
    const temporary = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
    await rename(temporary, filePath);
}

export function configHash(config) {
    const { createdAt: _createdAt, configCanonicalSha256: _hash, ...identity } = config;
    return canonicalHash(identity);
}

export function classifyResult(result) {
    if (Array.isArray(result?.solutionPath) || result?.outcome === 'solved') return { status: 'SOLVED', terminationReason: 'solved' };
    if (result?.outcome === 'limit' || result?.limitReached) {
        const reasons = {
            time: 'TIMEOUT', 'visited-states': 'STATE_CAP',
            'generated-states': 'CANDIDATE_CAP', 'shape-universe': 'SHAPE_UNIVERSE_CAP',
        };
        return { status: reasons[result.limitReason] ?? 'ERROR', terminationReason: `solver-${result.limitReason ?? 'unknown-limit'}` };
    }
    if (result?.outcome === 'not-found-pruned') return { status: 'NOT_FOUND_PRUNED', terminationReason: 'beam-pruned' };
    if (result?.outcome === 'exhausted') return { status: 'SEARCH_EXHAUSTED', terminationReason: 'search-exhausted' };
    return { status: 'ERROR', terminationReason: 'unknown-solver-outcome' };
}

export function resolveCases(manifest, finalSelection, sourceDocuments) {
    const slots = new Map(finalSelection.slots.map(slot => [`${slot.targetId}:${slot.slot}`, slot]));
    const sources = new Map(manifest.sourceRegistry.map(source => [source.sourceId, source]));
    const resolved = manifest.members.map(member => {
        const source = sources.get(member.sourceId);
        const document = sourceDocuments.get(member.sourceId);
        const instances = source?.contentType === 'instance-array' ? document : document?.instances;
        const instance = instances?.find(item => item.id === member.sourceInstanceId);
        const slot = slots.get(`${member.targetId}:${member.slot}`);
        if (!source || !instance || !slot || instance.instanceSha256 !== member.sourceInstanceSha256
            || instance.diversity?.structureSignature !== member.structuralSignature
            || slot.selectedInstanceId !== member.sourceInstanceId
            || slot.structuralSignature !== member.structuralSignature) {
            throw new Error(`Composite member cannot be resolved: ${member.targetId}:${member.slot}`);
        }
        if (instance.rules?.maxLayers !== 4 || instance.rules?.cleanPainting !== true
            || instance.rules?.allowSplitting !== false) {
            throw new Error(`Unexpected frozen instance rules: ${member.targetId}:${member.slot}`);
        }
        const sourceCategory = slot.selectionCategory === 'baseline' ? 'baseline'
            : slot.selectionCategory === 'retained-B' ? 'retained-B' : 'replacement';
        const tags = instance.difficulty?.structuralTags ?? [];
        const pin = tags.includes('pins');
        const crystal = tags.includes('crystals');
        const mechanismClass = pin && crystal ? 'mixed-pin-crystal'
            : pin ? 'pin' : crystal ? 'crystal' : 'ordinary';
        const startingShapeCodes = instance.availableInputs.flatMap(row => Array(row.count).fill(row.shape));
        return {
            targetId: member.targetId, familySlot: member.slot, instanceId: instance.id,
            structuralSignature: member.structuralSignature, familyIdentity: member.familyIdentity,
            sourceId: member.sourceId, sourceArtifact: source.path, sourceInstanceSha256: member.sourceInstanceSha256,
            selectionCategory: slot.selectionCategory, sourceCategory,
            depthClass: slot.depthClassification ?? null, track: instance.track,
            mechanism: {
                structuralTags: tags, mechanismClass,
                ordinaryOnly: tags.includes('ordinary-only'), pin, crystal,
                mixedPinCrystal: pin && crystal,
                swapperRelated: (instance.difficulty?.operationCounts?.Swapper ?? 0) > 0,
                refinementGroup: instance.difficulty?.refinementGroup ?? null,
            },
            witnessDepth: instance.difficulty?.witnessDepth ?? null,
            input: {
                targetShapeCodes: [instance.target], startingShapeCodes,
                enabledOperations: [...OPERATIONS], maxLayers: 4, maxStatesPerLevel: 3000,
                preventWaste: false, orientationSensitive: false,
                allowSplitting: false, cleanPainting: true,
            },
        };
    });
    if (resolved.length !== 159 || new Set(resolved.map(item => `${item.targetId}:${item.familySlot}`)).size !== 159) {
        throw new Error('Resolved membership is not exactly 159 unique target/family slots');
    }
    return resolved;
}

export function quantiles(values) {
    const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
    if (!sorted.length) return { count: 0, min: null, median: null, p90: null, p95: null, max: null };
    const percentile = p => {
        const index = (sorted.length - 1) * p;
        const lower = Math.floor(index);
        const fraction = index - lower;
        return sorted[lower] + (sorted[Math.min(lower + 1, sorted.length - 1)] - sorted[lower]) * fraction;
    };
    return { count: sorted.length, min: sorted[0], median: percentile(0.5), p90: percentile(0.9), p95: percentile(0.95), max: sorted.at(-1) };
}

function summary(records) {
    const byStatus = Object.fromEntries(STATUSES.map(status => [status, 0]));
    for (const record of records) byStatus[record.status] += 1;
    return { count: records.length, solved: byStatus.SOLVED, solveRate: records.length ? byStatus.SOLVED / records.length : null, byStatus };
}

export function aggregateResults(cases, records) {
    if (cases.length !== 159 || records.length !== 159) throw new Error('Aggregation requires exactly 159 results');
    const caseByKey = new Map(cases.map(item => [`${item.targetId}:${item.familySlot}`, item]));
    const merged = records.map(record => {
        if (!STATUSES.includes(record.status)) throw new Error(`Unknown result status ${record.status}`);
        const metadata = caseByKey.get(`${record.targetId}:${record.familySlot}`);
        if (!metadata || metadata.instanceId !== record.instanceId) throw new Error(`Unexpected result ${record.instanceId}`);
        return { ...metadata, ...record };
    });
    if (new Set(merged.map(item => `${item.targetId}:${item.familySlot}`)).size !== 159) throw new Error('Duplicate result membership');
    const group = fn => {
        const grouped = new Map();
        for (const row of merged) for (const label of fn(row)) {
            if (!grouped.has(label)) grouped.set(label, []);
            grouped.get(label).push(row);
        }
        return Object.fromEntries([...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([label, rows]) => [label, summary(rows)]));
    };
    const targets = new Map();
    for (const row of merged) {
        if (!targets.has(row.targetId)) targets.set(row.targetId, []);
        targets.get(row.targetId).push(row);
    }
    const targetResults = [...targets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([targetId, rows]) => {
        if (rows.length !== 3) throw new Error(`Target ${targetId} does not have three families`);
        const solved = rows.filter(row => row.status === 'SOLVED').length;
        const baseline = rows.find(row => row.sourceCategory === 'baseline');
        const deeper = rows.filter(row => ['C', 'D', 'E'].includes(row.depthClass));
        const times = rows.map(row => row.wallMs).filter(Number.isFinite);
        const states = rows.map(row => row.statesExplored).filter(Number.isFinite);
        const candidates = rows.map(row => row.candidatesGenerated).filter(Number.isFinite);
        const orderOfMagnitude = values => values.length >= 2 && Math.min(...values) > 0 && Math.max(...values) / Math.min(...values) >= 10;
        return {
            targetId, solved, statuses: Object.fromEntries(rows.map(row => [row.familySlot, row.status])),
            baselineSolvedDeepFailed: baseline?.status === 'SOLVED' && deeper.some(row => row.status !== 'SOLVED'),
            deepSolvedBFailed: deeper.some(row => row.status === 'SOLVED') && rows.some(row => row.depthClass === 'B' && row.status !== 'SOLVED'),
            allSameFailure: solved === 0 && new Set(rows.map(row => row.status)).size === 1,
            orderOfMagnitudeTime: orderOfMagnitude(times), orderOfMagnitudeStates: orderOfMagnitude(states),
            orderOfMagnitudeCandidates: orderOfMagnitude(candidates),
        };
    });
    const targetSolvedCounts = Object.fromEntries([3, 2, 1, 0].map(n => [`${n}/3`, targetResults.filter(row => row.solved === n).length]));
    const cost = rows => Object.fromEntries([
        ['wallMs', 'wallMs'], ['cpuMs', 'cpuMs'], ['statesExplored', 'statesExplored'],
        ['candidatesGenerated', 'candidatesGenerated'], ['maxSearchDepthReached', 'maxSearchDepthReached'],
        ['peakRssMiB', 'peakRssMiB'],
    ].map(([name, key]) => [name, quantiles(rows.map(row => row[key]))]));
    return {
        schemaVersion: 1, total: summary(merged), targetSolvedCounts,
        targetsWithAnySolved: targetResults.filter(row => row.solved > 0).length,
        targetResults,
        byTrack: group(row => [row.track]),
        bySourceCategory: group(row => [row.sourceCategory]),
        byDepthClass: group(row => [row.depthClass ?? 'baseline']),
        byMechanism: group(row => [
            `class:${row.mechanism.mechanismClass}`,
            row.mechanism.ordinaryOnly ? 'tag:ordinary-only' : null,
            row.mechanism.pin ? 'pin' : null, row.mechanism.crystal ? 'crystal' : null,
            row.mechanism.mixedPinCrystal ? 'mixed-pin-crystal' : null,
            row.mechanism.swapperRelated ? 'swapper-related' : null,
            row.mechanism.refinementGroup ? `refinement:${row.mechanism.refinementGroup}` : null,
        ].filter(Boolean)),
        costs: { solved: cost(merged.filter(row => row.status === 'SOLVED')), failed: cost(merged.filter(row => row.status !== 'SOLVED')) },
    };
}

export function baselineIdentity(config, orderedResults) {
    const membership = orderedResults.map(row => ({ targetId: row.targetId, familySlot: row.familySlot, instanceId: row.instanceId }));
    const resultCanonicalSha256 = canonicalHash(orderedResults);
    const identity = {
        baselineId: BASELINE_ID, benchmarkCanonicalSha256: config.benchmark.compositeCanonicalSha256,
        finalSelectionCanonicalSha256: config.benchmark.finalSelectionCanonicalSha256,
        solverCodeCanonicalSha256: config.solver.codeCanonicalSha256,
        configCanonicalSha256: config.configCanonicalSha256,
        membershipCanonicalSha256: canonicalHash(membership), resultCanonicalSha256,
    };
    return { ...identity, baselineCanonicalSha256: canonicalHash(identity) };
}
