import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildFinalTargetedAcceptance } from '../benchmarks/tools/build-final-targeted-acceptance.mjs';
import { canonicalJson, sha256 } from '../benchmarks/tools/benchmark-core.mjs';

const load = relative => readFile(new URL(relative, import.meta.url), 'utf8').then(JSON.parse);

function reverseObjectKeys(value) {
    if (Array.isArray(value)) return value.map(reverseObjectKeys);
    if (value === null || typeof value !== 'object') return value;
    return Object.fromEntries(Object.keys(value).reverse().map(key => [key, reverseObjectKeys(value[key])]));
}

test('final targeted selection is a deterministic mechanical reconstruction', async () => {
    const [{ selection }, committed] = await Promise.all([
        buildFinalTargetedAcceptance({ write: false }),
        load('../benchmarks/final-targeted-acceptance/v1/final-selection.json'),
    ]);
    assert.deepEqual(selection, committed);
    assert.equal(selection.status, 'frozen');
    assert.equal(selection.accounting.targets, 53);
    assert.equal(selection.accounting.mainTargets, 12);
    assert.equal(selection.accounting.sideTargets, 41);
    assert.equal(selection.accounting.instances, 159);
    assert.deepEqual(selection.accounting.categoryCounts, {
        baseline: 53,
        'hard-main-010': 1,
        'optional-promotion': 16,
        'required-deep': 14,
        'retained-B': 64,
        'targeted-reselection': 11,
    });
    assert.equal(selection.accounting.replacements, 42);
    assert.equal(selection.accounting.retainedOriginalBFamilies, 64);
    assert.deepEqual(selection.accounting.depthDistribution, { C: 1, D: 7, E: 34 });
    assert.deepEqual(selection.accounting.formalDepthDistribution, { B: 64, C: 1, D: 7, E: 34 });
    assert.equal(selection.accounting.replayPassed, 159);
    assert.equal(selection.accounting.expansionPassed, 159);
    assert.equal(selection.accounting.targetsWithThreeUniqueStructuralFamilies, 53);
});

test('selection identity depends only on canonical final slot content', async () => {
    const selection = await load('../benchmarks/final-targeted-acceptance/v1/final-selection.json');
    const expected = sha256(canonicalJson(selection.slots));
    assert.equal(selection.selectionCanonicalSha256, expected);
    assert.equal(sha256(canonicalJson(reverseObjectKeys(selection.slots))), expected);
    assert.equal(new Set(selection.slots.map(row => `${row.targetId}/${row.slot}`)).size, 159);
    assert.equal(new Set(selection.slots.map(row => row.selectedInstanceId)).size, 159);
});

test('frozen optional decisions, replacement provenance, and structural uniqueness are preserved', async () => {
    const [selection, optionalMapping, reselection] = await Promise.all([
        load('../benchmarks/final-targeted-acceptance/v1/final-selection.json'),
        load('../benchmarks/final-depth-reselection/v1/optional-promotion-selection.json'),
        load('../benchmarks/final-depth-reselection/v1/reselection.json'),
    ]);
    const optionalRows = selection.slots.filter(row => row.selectionCategory === 'optional-promotion');
    assert.deepEqual(
        optionalRows.map(row => row.targetId).toSorted(),
        optionalMapping.promotions.map(row => row.targetId).toSorted(),
    );
    for (const targetId of optionalMapping.negativeDecisions.targetIds) {
        const targetRows = selection.slots.filter(row => row.targetId === targetId);
        assert.equal(targetRows.filter(row => row.selectionCategory === 'retained-B').length, 2);
        assert.equal(targetRows.filter(row => row.depthClassification === 'B').length, 2);
        assert.equal(targetRows.some(row => row.replacement), false);
    }
    for (const row of selection.slots.filter(item => item.replacement)) {
        assert.ok(['F2', 'F3'].includes(row.replacement.replacedOriginalSlot));
        assert.ok(['F2', 'F3'].includes(row.replacement.retainedOriginalSlot));
        assert.notEqual(row.replacement.replacedOriginalSlot, row.replacement.retainedOriginalSlot);
        assert.equal(row.replacement.replacementCandidateReference.sourceInstanceId, row.selectedInstanceId);
        assert.equal(row.replacement.originalCandidateReference.sourceInstanceId.length > 0, true);
    }
    const selectedSignatures = new Set(selection.slots.map(row => row.structuralSignature));
    for (const row of reselection) {
        assert.equal(selectedSignatures.has(row.rejectedStagedSignature), false);
        assert.equal(selectedSignatures.has(row.rejectedDeepPassSignature), false);
    }
    const byTarget = Map.groupBy(selection.slots, row => row.targetId);
    assert.equal([...byTarget.values()].every(rows =>
        rows.length === 3 && new Set(rows.map(row => row.structuralSignature)).size === 3), true);
    assert.equal(selection.solverFilteringUsed, false);
    assert.equal(selection.formalCompositeReleaseConstructed, false);
});
