import { verifyCurrentInputs } from './current.mjs';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { ROOT, json, sha256, canonical } from './identity.mjs';
import { replayWitness, validateInputRules } from '../benchmarks/tools/benchmark-core.mjs';
import { buildSolverEvaluationView } from '../benchmarks/tools/environment-expansion.mjs';

// New acceptance of old immutable inputs. This does not issue a v1 release PASS.
export async function validateFrozenArtifactCurrent({ artifactPath, artifactDocument, projectionDocument } = {}) {
    const identity = await verifyCurrentInputs();
    const errors = [...identity.errors];
    const inventory = await json(path.join(ROOT, 'versions/frozen-v1.inventory.json'));
    const binding = inventory.files.find(f => f.path === artifactPath && f.path.startsWith('benchmarks/'));
    if (!binding) return { valid: false, errors: [...errors, 'artifact is not in frozen inventory'] };
    const bytes = await readFile(path.join(ROOT, binding.path));
    if (sha256(bytes) !== binding.sha256) errors.push('repository artifact differs from frozen bytes');
    const frozen = JSON.parse(bytes);
    const artifact = artifactDocument ?? frozen;
    if (canonical(artifact) !== canonical(frozen)) errors.push('actual artifact canonical content differs from frozen identity');
    if (!Array.isArray(artifact.instances)) errors.push('missing instances');
    const catalog = await json(path.join(ROOT, 'benchmarks/input_catalog.json'));
    let replayed = 0;
    for (const instance of artifact.instances ?? []) {
        const rules = validateInputRules(instance, catalog);
        if (!rules.valid) errors.push(...rules.errors);
        const replay = replayWitness(instance, catalog);
        if (!replay.valid) errors.push(...replay.errors);
        else replayed++;
    }
    if (projectionDocument && canonical(projectionDocument) !== canonical(buildSolverEvaluationView(artifact))) {
        errors.push('public projection differs from actual artifact');
    }
    return { valid: errors.length === 0, certification: 'maintenance-replay-of-frozen-v1-inputs',
        implementation: identity, historicalArtifactReleaseId: frozen.releaseId,
        artifactCanonicalSha256: sha256(canonical(frozen)), replayed, errors };
}
