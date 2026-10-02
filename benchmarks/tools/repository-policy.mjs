import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { readJson, sha256 } from './benchmark-core.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const POLICY_PATH = path.join(ROOT, 'benchmarks/policy/official-policy.v1.json');

export async function fileSha256(relativePath) {
    return sha256(await readFile(path.join(ROOT, relativePath)));
}

export function aggregateBindings(bindings) {
    return sha256(bindings.map(binding => `${binding.path}\0${binding.sha256}`).join('\n'));
}

export async function loadRepositoryPolicy() {
    return readJson(POLICY_PATH);
}

export async function verifyFileBinding(binding) {
    const actual = await fileSha256(binding.path);
    return actual === binding.sha256 ? null : `${binding.path}: repository hash ${actual} differs from policy ${binding.sha256}`;
}

export async function verifyFileSet(binding) {
    const errors = (await Promise.all(binding.files.map(verifyFileBinding))).filter(Boolean);
    const aggregate = aggregateBindings(binding.files);
    if (aggregate !== binding.sha256) errors.push(`aggregate hash ${aggregate} differs from policy ${binding.sha256}`);
    return errors;
}

export async function rebuildOfficialHardTargets(policy, manifest) {
    const expected = [];
    for (const source of policy.officialTargets.sources) {
        const text = await readFile(path.join(ROOT, source.path), 'utf8');
        const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
        for (const [index, target] of lines.entries()) {
            const serial = String(index + 1).padStart(3, '0');
            expected.push({
                id: `hard-${source.track}-${serial}`,
                suite: 'hard',
                track: source.track,
                source: path.basename(source.path),
                line: index + 1,
                target,
                sha256: sha256(target),
            });
        }
    }
    const actual = manifest.cases.filter(item => item.suite === 'hard');
    const errors = [];
    if (actual.length !== policy.officialTargets.targetCount || expected.length !== policy.officialTargets.targetCount) {
        errors.push(`official Hard membership must contain exactly ${policy.officialTargets.targetCount} targets`);
    }
    const actualById = new Map(actual.map(item => [item.id, item]));
    for (const item of expected) {
        const found = actualById.get(item.id);
        if (!found) { errors.push(`official target missing from manifest: ${item.id}`); continue; }
        for (const key of ['suite', 'track', 'source', 'line', 'target', 'sha256']) {
            if (found[key] !== item[key]) errors.push(`${item.id}: manifest ${key} differs from official source`);
        }
    }
    for (const item of actual) if (!expected.some(candidate => candidate.id === item.id)) errors.push(`manifest has non-source Hard target ${item.id}`);
    return { errors, targets: actual, byId: actualById };
}

export function catalogPayloadFromSeed(seed, generatedBy) {
    return {
        schemaVersion: 2,
        version: seed.version,
        provenance: {
            authority: ['docs/benchmark/USER_RULES.md', 'benchmarks/sources/input_catalog.seed.json'],
            seedSha256: null,
            generatedBy,
        },
        ordinary: seed.ordinary,
        special: seed.special,
        refinement: seed.refinement,
    };
}
