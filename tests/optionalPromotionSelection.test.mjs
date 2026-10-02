import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
    canonicalJson, deriveStructuralFingerprint, replayWitness, sha256,
    validateExpansionMetadata,
} from '../benchmarks/tools/benchmark-core.mjs';
import { classifyDiversityDepth } from '../benchmarks/tools/diversity-depth-classifier.mjs';

const load = relative => readFile(new URL(relative, import.meta.url), 'utf8').then(JSON.parse);
const fileSha256 = bytes => createHash('sha256').update(bytes).digest('hex');

const EXPECTED_PROMOTIONS = Object.freeze([
    ['hard-main-002', 'F3', 'F2', 'E'],
    ['hard-main-003', 'F2', 'F3', 'E'],
    ['hard-side-006', 'F3', 'F2', 'E'],
    ['hard-side-007', 'F2', 'F3', 'E'],
    ['hard-side-008', 'F2', 'F3', 'E'],
    ['hard-side-009', 'F2', 'F3', 'E'],
    ['hard-side-010', 'F2', 'F3', 'E'],
    ['hard-side-011', 'F2', 'F3', 'E'],
    ['hard-side-012', 'F2', 'F3', 'E'],
    ['hard-side-013', 'F2', 'F3', 'E'],
    ['hard-side-015', 'F2', 'F3', 'E'],
    ['hard-side-016', 'F2', 'F3', 'E'],
    ['hard-side-017', 'F2', 'F3', 'E'],
    ['hard-side-018', 'F2', 'F3', 'E'],
    ['hard-side-020', 'F2', 'F3', 'E'],
    ['hard-side-027', 'F2', 'F3', 'C'],
]);

const EXPECTED_NEGATIVE_TARGETS = Object.freeze([
    'hard-side-001', 'hard-side-002', 'hard-side-004', 'hard-side-014', 'hard-side-019',
]);

test('frozen optional promotion selection binds the authoritative 16/5 decision', async () => {
    const [
        selection, optionalCandidates, sourceAudit, baseline, catalog, expansionPolicy,
        laterCandidateLog, optionalBytes, auditBytes,
    ] = await Promise.all([
        load('../benchmarks/final-depth-reselection/v1/optional-promotion-selection.json'),
        load('../benchmarks/hard-53x3-deep-diversity/v1/optional-candidates.json'),
        load('../benchmarks/hard-53x3-deep-diversity/v1/unknown-feasibility.json'),
        load('../benchmarks/hard-53x1/v1/instances.json'),
        load('../benchmarks/input_catalog.json'),
        load('../benchmarks/policy/input-environment-expansion.v1.json'),
        load('../benchmarks/final-depth-reselection/v1/candidate-log.json'),
        readFile(new URL('../benchmarks/hard-53x3-deep-diversity/v1/optional-candidates.json', import.meta.url)),
        readFile(new URL('../benchmarks/hard-53x3-deep-diversity/v1/unknown-feasibility.json', import.meta.url)),
    ]);

    assert.equal(selection.schemaVersion, 1);
    assert.equal(selection.selectionId, 'hard-final-optional-promotion-selection-v1');
    assert.equal(selection.selectionVersion, 1);
    assert.equal(selection.status, 'frozen');
    assert.equal(selection.count, 16);
    assert.equal(selection.promotions.length, 16);
    assert.equal(selection.negativeDecisions.decision, 'KEEP_CURRENT_B_B');
    assert.equal(selection.negativeDecisions.count, 5);
    assert.deepEqual(selection.negativeDecisions.targetIds, EXPECTED_NEGATIVE_TARGETS);

    assert.deepEqual(
        selection.promotions.map(row => [
            row.targetId, row.retainedOriginalSlot, row.replacedOriginalSlot, row.acceptedDepth,
        ]),
        EXPECTED_PROMOTIONS,
    );
    assert.deepEqual(
        selection.promotions.map(row => row.targetId),
        selection.promotions.map(row => row.targetId).toSorted((a, b) => a.localeCompare(b)),
    );
    assert.equal(new Set(selection.promotions.map(row => row.targetId)).size, 16);
    assert.equal(new Set(selection.promotions.map(row => row.replacementInstanceId)).size, 16);
    assert.deepEqual(
        Object.fromEntries(['C', 'E'].map(depth => [
            depth, selection.promotions.filter(row => row.acceptedDepth === depth).length,
        ])),
        { C: 1, E: 15 },
    );

    assert.equal(selection.sourceOptionalCandidates.fileSha256, fileSha256(optionalBytes));
    assert.equal(
        selection.sourceOptionalCandidates.canonicalSha256,
        sha256(canonicalJson(optionalCandidates)),
    );
    assert.equal(selection.sourceOptionalCandidates.candidateCount, optionalCandidates.length);
    assert.equal(selection.sourceAudit.fileSha256, fileSha256(auditBytes));
    assert.equal(selection.sourceAudit.canonicalSha256, sha256(canonicalJson(sourceAudit)));
    assert.equal(selection.sourceAudit.entryCount, sourceAudit.length);

    const selectedTargets = new Set(selection.promotions.map(row => row.targetId));
    assert.equal(EXPECTED_NEGATIVE_TARGETS.some(targetId => selectedTargets.has(targetId)), false);
    assert.deepEqual(
        [...selectedTargets, ...EXPECTED_NEGATIVE_TARGETS].toSorted((a, b) => a.localeCompare(b)),
        optionalCandidates.map(row => row.targetId).toSorted((a, b) => a.localeCompare(b)),
    );

    const baselineByTarget = new Map(baseline.instances.map(instance => [instance.targetId, instance]));
    const auditByTarget = new Map(sourceAudit.map(row => [row.targetId, row]));
    for (const binding of selection.promotions) {
        const matches = optionalCandidates.filter(candidate => candidate.targetId === binding.targetId);
        assert.equal(matches.length, 1, `${binding.targetId}: optional candidate identity is ambiguous`);
        const [candidate] = matches;
        assert.equal(candidate.targetId, binding.targetId);
        assert.equal(candidate.id, binding.replacementInstanceId);
        assert.equal(candidate.instanceSha256, binding.replacementInstanceSha256);
        assert.equal(binding.replacementSourceArtifact, selection.sourceOptionalCandidates.path);
        assert.ok(['F2', 'F3'].includes(binding.retainedOriginalSlot));
        assert.ok(['F2', 'F3'].includes(binding.replacedOriginalSlot));
        assert.notEqual(binding.retainedOriginalSlot, binding.replacedOriginalSlot);

        const replay = replayWitness(candidate, catalog);
        assert.equal(replay.valid, true, `${candidate.id}: ${replay.errors?.join('; ')}`);
        const expansion = validateExpansionMetadata(candidate, catalog, replay, expansionPolicy);
        assert.equal(expansion.valid, true, `${candidate.id}: ${expansion.errors.join('; ')}`);
        const structural = deriveStructuralFingerprint(candidate, replay);
        assert.equal(structural.signature, candidate.diversity.structureSignature);
        assert.equal(structural.signature, binding.replacementSignature);

        const audit = auditByTarget.get(binding.targetId);
        assert.equal(audit?.status, 'DEEP_ROUTE_FOUND');
        assert.equal(audit?.candidateSignature, binding.replacementSignature);
        assert.equal(audit?.candidateDepth, binding.acceptedDepth);
        const source = baselineByTarget.get(binding.targetId);
        const depth = classifyDiversityDepth(
            source, replayWitness(source, catalog), candidate, replay,
        );
        assert.equal(depth.level, binding.acceptedDepth);
        assert.equal(
            laterCandidateLog.some(row => row.targetId === binding.targetId),
            false,
            `${binding.targetId}: a later candidate decision overrides the frozen source audit`,
        );
    }

    const { optionalPromotionSelectionHash, ...hashBinding } = selection;
    assert.equal(selection.hashAlgorithm, 'sha256');
    assert.equal(selection.hashCanonicalization, 'canonical-json-v1');
    assert.equal(optionalPromotionSelectionHash, sha256(canonicalJson(hashBinding)));
});
