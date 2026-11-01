// Corpus acceptance for the CURRENT working tree.
//
// Why this file exists instead of a new mode inside the frozen validator:
// `benchmarks/tools/**` is itself part of the frozen Release 1 inventory. Editing the
// validator would add a `frozen:` error to `verifyRelease()` and force a re-seal of 461
// hashes for a change that is purely about the caller's environment. So the validator is
// executed unmodified and this entry classifies its output.
//
// The deferral is deliberately NARROW. Exactly one error class may be deferred:
//   `[release ]canonical semantics: <path>: repository hash <actual> differs from policy <pinned>`
// and only for a game-semantics file whose bytes differ from the historical v1 pin *and*
// equal the pin declared by the repository's current version index. The comparison is
// replaced by an equally strict comparison against the current physics identity, never
// skipped. Every other error — targets, seed, catalog, schema, instance rules, replay,
// artifact content, projection, witness and rejection-log bindings — stays blocking.
//
// Modes:
//   strict   (default) reproduce the historical v1 byte identity; expected to fail outside
//            the reconstructed v1 tree.
//   deferred current-physics compatibility; only the game-semantics byte pin is replaced.
//
// This run never certifies the historical v1 identity. That remains verify-history.mjs.

import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, loadRepositoryPolicy } from '../../benchmarks/tools/repository-policy.mjs';
import { sha256 } from '../../benchmarks/tools/benchmark-core.mjs';
import { validateBenchmarkArtifact } from '../../benchmarks/tools/validate-benchmark.mjs';
import { validateCompositeRelease } from '../../benchmarks/tools/validate-composite-release.mjs';

const SEMANTICS_ERROR = /^(release canonicalSemantics|canonical semantics): (.+): repository hash ([0-9a-f]{64}) differs from policy ([0-9a-f]{64})$/;

async function readJson(file) {
    return JSON.parse(await fs.readFile(file, 'utf8'));
}

/** Historical pins from the repository policy plus the pins of the currently declared version. */
export async function loadSemanticsState() {
    const policy = await loadRepositoryPolicy();
    const index = await readJson(path.join(ROOT, 'versions/index.json'));
    const currentVersion = index.current;
    const currentManifestPath = index.versions[currentVersion].path;
    const current = await readJson(path.join(ROOT, currentManifestPath));
    const currentPins = new Map((current.semantics?.files ?? []).map(file => [file.path, file.sha256]));

    const files = [];
    for (const file of policy.gameSemantics.files) {
        let disk = null;
        try { disk = sha256(await fs.readFile(path.join(ROOT, file.path))); } catch { disk = null; }
        const currentPin = currentPins.get(file.path) ?? null;
        const matchesHistorical = disk === file.sha256;
        // A file is deferrable only when the working tree no longer matches the historical
        // pin but does match the currently declared physics pin. Anything else stays strict.
        const deferred = !matchesHistorical && currentPin !== null && disk === currentPin;
        files.push({ path: file.path, disk, historical: file.sha256, current: currentPin, matchesHistorical, deferred });
    }
    return { policy, currentVersion, currentManifestPath, files };
}

/** Split validator errors into the one deferrable class and everything else. */
export function classifySemanticsErrors(errors, allowed) {
    const deferred = [];
    const blocking = [];
    for (const message of errors) {
        const match = SEMANTICS_ERROR.exec(message);
        if (match) {
            const [, kind, filePath, actual] = match;
            const expected = allowed.get(filePath);
            if (expected !== undefined && actual === expected) {
                deferred.push({ kind, path: filePath, actual });
                continue;
            }
        }
        blocking.push(message);
    }
    return { deferred, blocking };
}

/**
 * Run the unmodified corpus validators and interpret the result.
 * @returns {Promise<object>} report; `ok` is true only when every non-deferred assertion held.
 */
export async function validateCorpus({ mode = 'strict' } = {}) {
    if (mode !== 'strict' && mode !== 'deferred') throw new Error(`unknown semantics mode ${mode}`);
    const state = await loadSemanticsState();
    const allowed = new Map(mode === 'deferred'
        ? state.files.filter(file => file.deferred).map(file => [file.path, file.current])
        : []);
    // In deferred mode a deferrable file must exist, otherwise the mode would silently
    // behave like strict and any PASS would be meaningless.
    const deferredCandidates = state.files.filter(file => file.deferred);
    const unrepresentable = state.files.filter(file => !file.matchesHistorical && !file.deferred);

    const profiles = [];
    const seen = new Set();
    for (const key of Object.keys(state.policy.profiles)) {
        let result;
        try {
            result = await validateBenchmarkArtifact({ releaseId: key });
        } catch (error) {
            profiles.push({ key, crash: error.message, blocking: [`crash: ${error.message}`], deferred: [] });
            continue;
        }
        const { deferred, blocking } = classifySemanticsErrors(result.errors, allowed);
        for (const item of deferred) seen.add(item.path);
        profiles.push({
            key,
            targets: result.summary?.targetCount ?? null,
            instances: result.summary?.instanceCount ?? null,
            replayed: result.summary?.mechanicallyReplayed ?? null,
            releaseValidationPerformed: result.summary?.releaseValidationPerformed ?? false,
            structuralFamilies: result.summary?.structuralFamilies ?? null,
            deferred,
            blocking,
        });
    }

    let composite;
    try {
        const result = await validateCompositeRelease();
        const { deferred, blocking } = classifySemanticsErrors(result.errors, allowed);
        for (const item of deferred) seen.add(item.path);
        composite = { ...result.summary, deferred, blocking };
    } catch (error) {
        composite = { crash: error.message, blocking: [`crash: ${error.message}`], deferred: [] };
    }

    const blocking = [
        ...profiles.flatMap(profile => profile.blocking.map(message => `${profile.key}: ${message}`)),
        ...composite.blocking.map(message => `composite: ${message}`),
    ];

    const problems = [];
    if (mode === 'deferred') {
        if (!deferredCandidates.length) problems.push('deferred mode requested but no game-semantics file matches the current physics pin');
        for (const file of unrepresentable) problems.push(`game-semantics file ${file.path} matches neither the historical nor the current pin`);
        for (const file of allowed.keys()) if (!seen.has(file)) problems.push(`deferred file ${file} was never exercised by any validator`);
        if (!seen.size) problems.push('no deferred semantics check was exercised');
    }
    for (const profile of profiles) {
        if (profile.crash) continue;
        if (profile.instances !== profile.replayed) problems.push(`${profile.key}: only ${profile.replayed}/${profile.instances} instances replayed`);
    }
    if (!composite.crash) {
        if (composite.memberCount !== 159) problems.push(`composite member count ${composite.memberCount} is not 159`);
        if (composite.mechanicallyReplayed !== 159) problems.push(`composite replayed ${composite.mechanicallyReplayed}/159`);
        if (composite.provenanceResolved !== 159) problems.push(`composite provenance resolved ${composite.provenanceResolved}/159`);
    }

    const instances = profiles.reduce((sum, profile) => sum + (profile.instances ?? 0), 0);
    const replayed = profiles.reduce((sum, profile) => sum + (profile.replayed ?? 0), 0);
    return {
        mode,
        ok: blocking.length === 0 && problems.length === 0,
        semantics: {
            currentVersion: state.currentVersion,
            currentManifestPath: state.currentManifestPath,
            files: state.files,
            deferred: deferredCandidates,
        },
        profiles,
        composite,
        counts: { profiles: profiles.length, instances, replayed, compositeMembers: composite.memberCount ?? null },
        blocking,
        problems,
    };
}

function table(rows) {
    const header = ['profile', 'targets', 'instances', 'replayed', 'families', 'deferred', 'blocking'];
    const body = rows.map(row => [row.key, row.targets, row.instances, row.replayed, row.structuralFamilies,
        row.deferred.length, row.blocking.length].map(value => String(value ?? '-')));
    const widths = header.map((title, index) => Math.max(title.length, ...body.map(line => line[index].length)));
    const format = (line) => line.map((value, index) => value.padEnd(widths[index])).join('  ');
    return [format(header), format(widths.map(width => '-'.repeat(width))), ...body.map(format)].join('\n');
}

async function main() {
    const argument = process.argv.slice(2).find(item => item.startsWith('--semantics='));
    const mode = argument ? argument.slice('--semantics='.length) : 'strict';
    const report = await validateCorpus({ mode });

    console.log(`mode: ${report.mode}`);
    console.log(`current physics version: ${report.semantics.currentVersion} (${report.semantics.currentManifestPath})`);
    console.log('');
    console.log('game-semantics files:');
    for (const file of report.semantics.files) {
        const state = file.matchesHistorical ? 'historical v1 byte identity' : (file.deferred ? 'deferred to current physics pin' : 'UNREPRESENTABLE');
        console.log(`  ${file.path.padEnd(36)} ${state}`);
    }
    console.log('');
    console.log(table(report.profiles));
    console.log('');
    const composite = report.composite;
    console.log(`composite hard-53x3-stage-v1: members=${composite.memberCount} replayed=${composite.mechanicallyReplayed} `
        + `provenance=${composite.provenanceResolved} expansion=${composite.expansionValidated} fingerprints=${composite.fingerprintsValidated} `
        + `deferred=${(composite.deferred ?? []).length} blocking=${(composite.blocking ?? []).length}`);
    console.log('');
    console.log(`counts: profiles=${report.counts.profiles} instances=${report.counts.instances} replayed=${report.counts.replayed} compositeMembers=${report.counts.compositeMembers}`);
    if (report.semantics.deferred.length) {
        console.log('');
        console.log(`replaced check (not skipped): ${report.semantics.deferred.map(file => file.path).join(', ')}`);
        for (const file of report.semantics.deferred) console.log(`  historical pin ${file.historical}\n  current pin    ${file.current}`);
    }
    if (report.blocking.length) {
        console.log('');
        console.log(`BLOCKING (${report.blocking.length}):`);
        for (const message of report.blocking) console.log(`  - ${message}`);
    }
    if (report.problems.length) {
        console.log('');
        console.log(`PROBLEMS (${report.problems.length}):`);
        for (const message of report.problems) console.log(`  - ${message}`);
    }
    console.log('');
    console.log('historical v1 identity: NOT certified by this run (use npm run test:historical-v1)');
    console.log(report.ok ? 'RESULT: PASS' : 'RESULT: FAIL');
    process.exitCode = report.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    await main();
}
