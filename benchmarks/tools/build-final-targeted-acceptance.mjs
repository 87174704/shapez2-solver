import path from 'node:path';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
    artifactContentHash, canonicalJson, deriveStructuralFingerprint, readJson,
    replayWitness, sha256, validateExpansionMetadata,
} from './benchmark-core.mjs';
import { ROOT } from './repository-policy.mjs';

const SOURCE = Object.freeze({
    baseline: {
        path: 'benchmarks/hard-53x1/v1/instances.json',
        releaseId: 'hard-53x1-stage-v1',
        artifactCanonicalSha256: '11005e04e359fff9d0d3a0fec66dd491ca8e441f5c5c880e1ff3441b9fc77da3',
        instancesSha256: '40c4ea586dfeafb5f5e37545101220451d2cc9a9ca2ab54eb9d00a94806c8375',
    },
    pilot: {
        path: 'benchmarks/diversity-pilot/v1/instances.json',
        releaseId: 'hard-53x3-diversity-pilot-v1',
        artifactCanonicalSha256: '9eaf8dc3a64cf68830ea0ec734b8ea6aba0fe67304d8033765125ce6fb6139f0',
        instancesSha256: '9ccffd150764176162ca759c4b9f414c3b308f60a967e6e33e322e0e1968f3a0',
    },
    rollout: {
        path: 'benchmarks/hard-53x3-rollout/v1/instances.json',
        releaseId: 'hard-53x3-rollout-stage-v1',
        artifactCanonicalSha256: '36ffc2397f3fa5c29b0edf0840515c0159008e0bd91c41ac7f4d2407c12064ad',
        instancesSha256: '874369d93095d0a4a69e130d15c36543d2072ff86870ec86106ab01501bf809e',
    },
    deepPass: {
        path: 'benchmarks/hard-53x3-deep-diversity/v1/instances.json',
        releaseId: 'hard-53x3-deep-replacement-candidates-v1',
        artifactCanonicalSha256: 'e1430836207c556c2a7b0dd92d11d746446cce6106bf5e592c02a23efabf5172',
        instancesSha256: '25e3ce318786f442b7c7953b2f968fe7e4e443f7b3aea6ff434cbcccdfb9ca65',
    },
    optionalCandidates: {
        path: 'benchmarks/hard-53x3-deep-diversity/v1/optional-candidates.json',
        releaseId: 'hard-53x3-deep-replacement-candidates-v1',
        fileSha256: '9b823a8dace291b72b8dd8b6e6a52f7a3b6435282fc4945c6584b1f7d3c735f1',
        artifactCanonicalSha256: '1992e8d284b83d5c3ab7d65b0be15e821e94d4134fb178122b9f86e30afc3718',
    },
    optionalAudit: {
        path: 'benchmarks/hard-53x3-deep-diversity/v1/unknown-feasibility.json',
        artifactCanonicalSha256: 'c4ccd989b7cea374fc08dfd1307cffa7f34246f139c60304442b53a18f42691f',
    },
    finalReselection: {
        path: 'benchmarks/final-depth-reselection/v1/instances.json',
        releaseId: 'hard-final-depth-reselection-candidates-v1',
        artifactCanonicalSha256: '188fe904af003afb0d0a5f5615cd25824b4b1bb02ad73a046ed20db0de74430d',
        instancesSha256: '0dc5efe6ba46f4a99be4f2f9faa9eef10a2ddd51ce32084cd825154063561e1d',
    },
    optionalSelection: {
        path: 'benchmarks/final-depth-reselection/v1/optional-promotion-selection.json',
        selectionCanonicalSha256: '1adee7776f28ed10194108925dd21f4a0a9d591a945a6060e6a145ad17645989',
    },
});

const SUPPORT = Object.freeze({
    official: {
        path: 'benchmarks/manifest.json',
        canonicalSha256: '1c6ecb35fdf1eab5ccfb72cc89129061ccbb1d71c6b8a67efb90781760896cf2',
    },
    catalog: {
        path: 'benchmarks/input_catalog.json',
        canonicalSha256: '621ea22866958327bc159573cc9b3182d7f10948e6b3701561bdd1c331121ac9',
    },
    expansionPolicy: {
        path: 'benchmarks/policy/input-environment-expansion.v1.json',
        canonicalSha256: 'f29895130af866e7f6ba55a72fa4c55b6af497c2d37a33fe84bf8fb463476a6b',
    },
    deepStatus: {
        path: 'benchmarks/hard-53x3-deep-diversity/v1/target-status.json',
        canonicalSha256: '0a2ff8d8db8cc8b6d4dac1e31a5ad83e6e03675335acadb119a56f00bca2f219',
    },
    reselection: {
        path: 'benchmarks/final-depth-reselection/v1/reselection.json',
        canonicalSha256: 'ce1b96d6f4105e24bbff989fb5d8fb152d7e4b4d5e0ff2cd6452b993e77e1e61',
    },
    hardMain010: {
        path: 'benchmarks/final-depth-reselection/v1/hard-main-010-feasibility.json',
        canonicalSha256: 'b2cb7d82ca5404641f1b545cce94c13eced1fbfde2f1a808111349abc0cdfc2e',
    },
});

const EXPECTED = Object.freeze({
    targets: 53,
    instances: 159,
    main: 12,
    side: 41,
    categoryCounts: {
        baseline: 53,
        'retained-B': 64,
        'required-deep': 14,
        'targeted-reselection': 11,
        'hard-main-010': 1,
        'optional-promotion': 16,
    },
    depthDistribution: { C: 1, D: 7, E: 34 },
    replacements: 42,
});

const fileSha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const fail = message => { throw new Error(message); };
const assert = (condition, message) => { if (!condition) fail(message); };

function only(items, predicate, description) {
    const matches = items.filter(predicate);
    assert(matches.length === 1, `${description}: expected exactly one match, found ${matches.length}`);
    return matches[0];
}

function countBy(items, keyFor) {
    const result = {};
    for (const item of items) {
        const key = keyFor(item);
        result[key] = (result[key] ?? 0) + 1;
    }
    return Object.fromEntries(Object.entries(result).sort(([a], [b]) => a.localeCompare(b)));
}

function instanceReference(instance, sourceKey) {
    return {
        sourceArtifact: SOURCE[sourceKey].path,
        sourceReleaseId: SOURCE[sourceKey].releaseId,
        sourceInstanceId: instance.id,
        sourceInstanceSha256: instance.instanceSha256,
        structuralSignature: instance.diversity.structureSignature,
        sourceInstanceProvenance: structuredClone(instance.provenance),
    };
}

function selectedSlot(targetId, slot, instance, sourceKey, selectionCategory, depthClassification = undefined) {
    const row = {
        targetId,
        slot,
        familyIdentity: `${targetId}:${slot}:${instance.diversity.structureSignature}`,
        selectedInstanceId: instance.id,
        selectedInstanceSha256: instance.instanceSha256,
        structuralSignature: instance.diversity.structureSignature,
        sourceArtifact: SOURCE[sourceKey].path,
        sourceReleaseId: SOURCE[sourceKey].releaseId,
        sourceArtifactCanonicalSha256: SOURCE[sourceKey].artifactCanonicalSha256,
        sourceInstanceReference: instanceReference(instance, sourceKey),
        selectionCategory,
    };
    if (depthClassification) row.depthClassification = depthClassification;
    return row;
}

function replacementSlot({
    targetId, slot, instance, sourceKey, category, depth, original, retained,
    originalSourceKey, decisionSource, supersededCandidateReference,
}) {
    const row = selectedSlot(targetId, slot, instance, sourceKey, category, depth);
    row.replacement = {
        replacedOriginalSlot: slot,
        retainedOriginalSlot: retained.slot,
        originalCandidateReference: instanceReference(original.instance, originalSourceKey),
        retainedOriginalReference: instanceReference(retained.instance, retained.sourceKey),
        replacementCandidateReference: instanceReference(instance, sourceKey),
        decisionSource,
    };
    if (supersededCandidateReference) {
        row.replacement.supersededCandidateReference = supersededCandidateReference;
    }
    return row;
}

async function readSources() {
    const entries = await Promise.all(Object.entries(SOURCE).map(async ([key, identity]) => {
        const absolute = path.join(ROOT, identity.path);
        const bytes = await readFile(absolute);
        return [key, { bytes, json: JSON.parse(bytes) }];
    }));
    return Object.fromEntries(entries);
}

function verifyFrozenSourceIdentities(sources) {
    for (const [key, identity] of Object.entries(SOURCE)) {
        const { bytes, json } = sources[key];
        if (identity.fileSha256) {
            assert(fileSha256(bytes) === identity.fileSha256, `${key}: file SHA-256 changed`);
        }
        if (identity.instancesSha256) {
            assert(json.sha256 === identity.instancesSha256, `${key}: declared instances SHA-256 changed`);
        }
        if (identity.artifactCanonicalSha256) {
            assert(artifactContentHash(json) === identity.artifactCanonicalSha256, `${key}: canonical identity changed`);
        }
    }
    const selection = sources.optionalSelection.json;
    const { optionalPromotionSelectionHash, ...selectionBinding } = selection;
    const calculated = sha256(canonicalJson(selectionBinding));
    assert(calculated === SOURCE.optionalSelection.selectionCanonicalSha256,
        'optionalSelection: canonical selection SHA-256 changed');
    assert(optionalPromotionSelectionHash === calculated,
        'optionalSelection: declared canonical selection SHA-256 changed');
}

export async function buildFinalTargetedAcceptance({ write = true } = {}) {
    const sources = await readSources();
    verifyFrozenSourceIdentities(sources);
    const [official, catalog, expansionPolicy, deepStatus, reselection, hardMain010] = await Promise.all(
        Object.values(SUPPORT).map(identity => readJson(path.join(ROOT, identity.path))),
    );
    for (const [key, identity] of Object.entries(SUPPORT)) {
        const value = { official, catalog, expansionPolicy, deepStatus, reselection, hardMain010 }[key];
        assert(artifactContentHash(value) === identity.canonicalSha256,
            `${key}: decision/support canonical identity changed`);
    }

    const officialTargets = official.cases.filter(item => item.suite === 'hard');
    assert(officialTargets.length === EXPECTED.targets, 'official Hard target count changed');
    const baseline = sources.baseline.json;
    const pilot = sources.pilot.json;
    const rollout = sources.rollout.json;
    const deepPass = sources.deepPass.json;
    const optionalCandidates = sources.optionalCandidates.json;
    const finalReselection = sources.finalReselection.json;
    const optionalSelection = sources.optionalSelection.json;

    const baselineByTarget = new Map(baseline.instances.map(instance => [instance.targetId, instance]));
    const overlayByTarget = new Map();
    for (const [sourceKey, artifact] of [['pilot', pilot], ['rollout', rollout]]) {
        for (const instance of artifact.instances) {
            const slot = instance.id.endsWith('-02') ? 'F2' : instance.id.endsWith('-03') ? 'F3' : null;
            assert(slot, `${instance.id}: cannot mechanically resolve original B slot`);
            const target = overlayByTarget.get(instance.targetId) ?? {};
            assert(!target[slot], `${instance.targetId}/${slot}: duplicate original B slot`);
            target[slot] = { instance, sourceKey, slot };
            overlayByTarget.set(instance.targetId, target);
        }
    }

    const targetedIds = new Set(reselection.map(row => row.targetId));
    const requiredRows = deepStatus.filter(row => row.status === 'DEEP_REPLACEMENT_FOUND'
        && !targetedIds.has(row.targetId));
    assert(requiredRows.length === 14, `required deep mapping count ${requiredRows.length} != 14`);
    const requiredByTarget = new Map(requiredRows.map(row => [row.targetId, row]));
    const targetedByTarget = new Map(reselection.map(row => [row.targetId, row]));
    assert(targetedByTarget.size === 11, 'targeted re-selection mapping is not 11 unique targets');
    const optionalByTarget = new Map(optionalSelection.promotions.map(row => [row.targetId, row]));
    assert(optionalByTarget.size === 16, 'optional promotion mapping is not 16 unique targets');
    const negativeTargets = new Set(optionalSelection.negativeDecisions.targetIds);
    assert(negativeTargets.size === 5 && optionalSelection.negativeDecisions.decision === 'KEEP_CURRENT_B_B',
        'optional negative mapping is not frozen 5-target KEEP_CURRENT_B_B');

    const replacementTargetSets = [
        ...requiredByTarget.keys(), ...targetedByTarget.keys(), hardMain010.targetId, ...optionalByTarget.keys(),
    ];
    assert(new Set(replacementTargetSets).size === replacementTargetSets.length,
        'replacement categories overlap; selection is not mechanical');
    assert([...negativeTargets].every(targetId => !replacementTargetSets.includes(targetId)),
        'an optional negative target was promoted');

    const slots = [];
    const selectedInstances = [];
    const originalBSignatures = new Set();
    const rejectedSignatures = new Set();
    for (const row of reselection) {
        rejectedSignatures.add(row.rejectedStagedSignature);
        rejectedSignatures.add(row.rejectedDeepPassSignature);
    }
    for (const attempt of hardMain010.attempts.filter(row => row.normalizedDepth === 'B')) {
        rejectedSignatures.add(attempt.signature);
    }

    for (const target of officialTargets) {
        const targetId = target.id;
        const family1 = baselineByTarget.get(targetId);
        const original = overlayByTarget.get(targetId);
        assert(family1, `${targetId}/F1: missing frozen baseline`);
        assert(original?.F2 && original?.F3, `${targetId}: missing original F2/F3`);
        assert(family1.target === target.target, `${targetId}/F1: official target mismatch`);
        originalBSignatures.add(original.F2.instance.diversity.structureSignature);
        originalBSignatures.add(original.F3.instance.diversity.structureSignature);

        const targetSlots = [selectedSlot(targetId, 'F1', family1, 'baseline', 'baseline')];
        const addRetained = slot => targetSlots.push(selectedSlot(
            targetId, slot, original[slot].instance, original[slot].sourceKey, 'retained-B', 'B',
        ));
        const addReplacement = descriptor => {
            const replaced = descriptor.replacedSlot;
            const retainedSlot = replaced === 'F2' ? 'F3' : 'F2';
            addRetained(retainedSlot);
            targetSlots.push(replacementSlot({
                ...descriptor,
                targetId,
                slot: replaced,
                original: original[replaced],
                retained: original[retainedSlot],
                originalSourceKey: original[replaced].sourceKey,
            }));
        };

        if (requiredByTarget.has(targetId)) {
            const mapping = requiredByTarget.get(targetId);
            const replacedSlot = `F${mapping.replacedFamily}`;
            const retainedSlot = `F${mapping.retainedFamily}`;
            assert(original[replacedSlot].instance.id === mapping.replacedInstanceId,
                `${targetId}: required-deep replaced ID does not resolve`);
            assert(original[retainedSlot].instance.id === mapping.retainedInstanceId,
                `${targetId}: required-deep retained ID does not resolve`);
            const candidate = only(deepPass.instances,
                instance => instance.targetId === targetId
                    && instance.diversity.structureSignature === mapping.newSignature,
                `${targetId}: required-deep candidate`);
            addReplacement({
                instance: candidate,
                sourceKey: 'deepPass',
                category: 'required-deep',
                depth: mapping.candidateDepth,
                replacedSlot,
                decisionSource: { path: SUPPORT.deepStatus.path, targetId },
            });
        } else if (targetedByTarget.has(targetId)) {
            const mapping = targetedByTarget.get(targetId);
            const retained = only(Object.values(original),
                item => item.instance.diversity.structureSignature === mapping.retainedBSignature,
                `${targetId}: targeted retained B slot`);
            const replaced = only(Object.values(original),
                item => item.instance.diversity.structureSignature === mapping.rejectedStagedSignature,
                `${targetId}: targeted replaced B slot`);
            const candidate = only(finalReselection.instances,
                instance => instance.targetId === targetId
                    && instance.diversity.structureSignature === mapping.newSignature,
                `${targetId}: targeted replacement candidate`);
            const superseded = only(deepPass.instances,
                instance => instance.targetId === targetId
                    && instance.diversity.structureSignature === mapping.rejectedDeepPassSignature,
                `${targetId}: superseded deep-pass candidate`);
            assert(retained.slot !== replaced.slot, `${targetId}: targeted slot identity collision`);
            addReplacement({
                instance: candidate,
                sourceKey: 'finalReselection',
                category: 'targeted-reselection',
                depth: mapping.depth,
                replacedSlot: replaced.slot,
                decisionSource: { path: SUPPORT.reselection.path, targetId },
                supersededCandidateReference: instanceReference(superseded, 'deepPass'),
            });
        } else if (targetId === hardMain010.targetId) {
            const mapping = only(deepStatus, row => row.targetId === targetId,
                `${targetId}: deep status`);
            const replacedSlot = `F${mapping.replacedFamily}`;
            const candidate = only(finalReselection.instances,
                instance => instance.targetId === targetId
                    && instance.diversity.structureSignature === hardMain010.accepted.signature,
                `${targetId}: accepted feasibility candidate`);
            addReplacement({
                instance: candidate,
                sourceKey: 'finalReselection',
                category: 'hard-main-010',
                depth: hardMain010.accepted.depth,
                replacedSlot,
                decisionSource: { path: SUPPORT.hardMain010.path, targetId },
            });
        } else if (optionalByTarget.has(targetId)) {
            const mapping = optionalByTarget.get(targetId);
            const candidate = only(optionalCandidates,
                instance => instance.targetId === targetId
                    && instance.id === mapping.replacementInstanceId
                    && instance.instanceSha256 === mapping.replacementInstanceSha256
                    && instance.diversity.structureSignature === mapping.replacementSignature,
                `${targetId}: frozen optional candidate`);
            addReplacement({
                instance: candidate,
                sourceKey: 'optionalCandidates',
                category: 'optional-promotion',
                depth: mapping.acceptedDepth,
                replacedSlot: mapping.replacedOriginalSlot,
                decisionSource: {
                    path: SOURCE.optionalSelection.path,
                    targetId,
                    selectionCanonicalSha256: SOURCE.optionalSelection.selectionCanonicalSha256,
                },
            });
        } else {
            addRetained('F2');
            addRetained('F3');
        }

        targetSlots.sort((a, b) => a.slot.localeCompare(b.slot));
        assert(targetSlots.length === 3, `${targetId}: final slot count is not 3`);
        for (const row of targetSlots) {
            const sourceKey = Object.keys(SOURCE).find(key => SOURCE[key].path === row.sourceArtifact);
            const sourceArtifact = sources[sourceKey].json;
            const sourceRows = sourceArtifact.instances ?? sourceArtifact;
            const instance = only(sourceRows,
                candidate => candidate.id === row.selectedInstanceId
                    && candidate.instanceSha256 === row.selectedInstanceSha256,
                `${targetId}/${row.slot}: selected source instance`);
            selectedInstances.push(instance);
        }
        slots.push(...targetSlots);
    }

    assert(slots.length === EXPECTED.instances, `final selection count ${slots.length} != 159`);
    assert(new Set(slots.map(row => `${row.targetId}/${row.slot}`)).size === slots.length,
        'duplicate target/family slot in final selection');
    const categoryCounts = countBy(slots, row => row.selectionCategory);
    assert(canonicalJson(categoryCounts) === canonicalJson(EXPECTED.categoryCounts),
        `selection category accounting mismatch: ${JSON.stringify(categoryCounts)}`);
    const depthDistribution = countBy(
        slots.filter(row => row.replacement), row => row.depthClassification,
    );
    assert(canonicalJson(depthDistribution) === canonicalJson(EXPECTED.depthDistribution),
        `depth accounting mismatch: ${JSON.stringify(depthDistribution)}`);
    assert(slots.filter(row => row.replacement).length === EXPECTED.replacements,
        'replacement accounting mismatch');
    assert([...negativeTargets].every(targetId =>
        slots.filter(row => row.targetId === targetId && row.selectionCategory === 'retained-B').length === 2),
    'an optional negative target did not retain both original B families');

    let replayPassed = 0;
    let expansionPassed = 0;
    const signaturesByTarget = new Map();
    for (const instance of selectedInstances) {
        const replay = replayWitness(instance, catalog);
        assert(replay.valid, `${instance.id}: replay invalid: ${replay.errors?.join('; ')}`);
        replayPassed += 1;
        const expansion = validateExpansionMetadata(instance, catalog, replay, expansionPolicy);
        assert(expansion.valid, `${instance.id}: expansion invalid: ${expansion.errors.join('; ')}`);
        expansionPassed += 1;
        const structural = deriveStructuralFingerprint(instance, replay);
        assert(structural.signature === instance.diversity.structureSignature,
            `${instance.id}: structural fingerprint mismatch`);
        const signatures = signaturesByTarget.get(instance.targetId) ?? new Set();
        signatures.add(structural.signature);
        signaturesByTarget.set(instance.targetId, signatures);
    }
    assert([...signaturesByTarget.values()].every(signatures => signatures.size === 3),
        'intra-target structural duplicate entered final selection');
    const selectedSignatures = new Set(slots.map(row => row.structuralSignature));
    assert([...rejectedSignatures].every(signature => !selectedSignatures.has(signature)),
        'a rejected shallow/overclassified/superseded candidate entered final selection');
    assert(sources.deepPass.json.instances.every(instance => instance.provenance.releaseId
        === SOURCE.deepPass.releaseId), 'deep-pass provenance was rewritten');
    assert(sources.finalReselection.json.instances.every(instance => instance.provenance.releaseId
        === SOURCE.finalReselection.releaseId), 'final re-selection provenance was rewritten');
    assert(optionalCandidates.every(instance => instance.provenance.releaseId
        === SOURCE.optionalCandidates.releaseId), 'optional candidate provenance was rewritten');

    const selectionCanonicalSha256 = sha256(canonicalJson(slots));
    const result = {
        schemaVersion: 1,
        selectionId: 'hard-53x3-final-targeted-selection-v1',
        status: 'frozen',
        hashAlgorithm: 'sha256',
        hashCanonicalization: 'canonical-json-v1',
        hashScope: 'canonical JSON of slots only; slots are ordered by official target order then F1/F2/F3',
        selectionCanonicalSha256,
        sourceIdentityChain: structuredClone(SOURCE),
        decisionIdentityChain: structuredClone(SUPPORT),
        frozenOptionalNegativeDecision: {
            decision: 'KEEP_CURRENT_B_B',
            targetIds: [...negativeTargets],
        },
        accounting: {
            targets: officialTargets.length,
            mainTargets: officialTargets.filter(target => target.track === 'main').length,
            sideTargets: officialTargets.filter(target => target.track === 'side').length,
            instances: slots.length,
            categoryCounts,
            replacements: slots.filter(row => row.replacement).length,
            retainedOriginalBFamilies: categoryCounts['retained-B'],
            depthDistribution,
            formalDepthDistribution: countBy(
                slots.filter(row => row.depthClassification), row => row.depthClassification,
            ),
            replayPassed,
            expansionPassed,
            targetsWithThreeUniqueStructuralFamilies: [...signaturesByTarget.values()]
                .filter(signatures => signatures.size === 3).length,
        },
        solverFilteringUsed: false,
        formalCompositeReleaseConstructed: false,
        compositeReleaseBlocker: 'Frozen v3 release format cannot represent the immutable baseline, pilot, rollout, deep-pass, optional-candidate, and targeted-reselection provenance chains in one artifact without rewriting provenance.',
        slots,
    };

    assert(result.accounting.mainTargets === EXPECTED.main, 'main target membership mismatch');
    assert(result.accounting.sideTargets === EXPECTED.side, 'side target membership mismatch');
    if (write) {
        const directory = path.join(ROOT, 'benchmarks/final-targeted-acceptance/v1');
        await mkdir(directory, { recursive: true });
        await writeFile(path.join(directory, 'final-selection.json'), `${JSON.stringify(result, null, 2)}\n`);
    }
    return { selection: result, selectedInstances };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const { selection } = await buildFinalTargetedAcceptance();
    console.log(JSON.stringify({
        status: selection.status,
        selectionCanonicalSha256: selection.selectionCanonicalSha256,
        accounting: selection.accounting,
        compositeReleaseBlocker: selection.compositeReleaseBlocker,
    }, null, 2));
}
