import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const sha256 = value => createHash('sha256').update(value).digest('hex');
export const canonical = value => value === null || typeof value !== 'object'
    ? JSON.stringify(value) : Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
        : `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
export const aggregate = files => sha256(files.map(f => `${f.path}\0${f.sha256}`).join('\n'));
export const json = async file => JSON.parse(await readFile(file, 'utf8'));

// The checked-in index is the trust root. Caller-supplied documents never replace it.
// root selects the implementation being checked, not the trusted manifest location.
export async function verifyVersion({ version, root = ROOT, manifestDocument } = {}) {
    const index = await json(path.join(ROOT, 'versions/index.json'));
    const pin = index.versions[version];
    if (!pin) return { valid: false, errors: [`unknown version ${version}`] };
    const manifest = manifestDocument ?? await json(path.join(ROOT, pin.path));
    const errors = [];
    if (sha256(canonical(manifest)) !== pin.canonicalSha256) errors.push('manifest differs from trusted version pin');
    if (manifest.version !== version) errors.push('manifest version differs from requested version');
    if (version === index.current && manifest.parent?.canonicalSha256 !== index.versions[manifest.parent?.version]?.canonicalSha256) {
        errors.push('parent identity differs from trusted v1 pin');
    }
    for (const key of ['semantics', 'runtime', 'acceptance']) {
        const set = manifest[key];
        if (!set || !Array.isArray(set.files) || !set.files.length) { errors.push(`missing ${key} file set`); continue; }
        if (new Set(set.files.map(f => f.path)).size !== set.files.length) errors.push(`duplicate ${key} paths`);
        if (aggregate(set.files) !== set.sha256) errors.push(`${key} aggregate differs`);
        for (const f of set.files) {
            const file = path.resolve(root, f.path);
            if (!file.startsWith(path.resolve(root) + path.sep)) { errors.push(`unsafe binding ${f.path}`); continue; }
            try {
                if (sha256(await readFile(file)) !== f.sha256) errors.push(`${key}: ${f.path} hash differs`);
            } catch { errors.push(`${key}: ${f.path} missing`); }
        }
    }
    const frozenBytes = await readFile(path.join(ROOT, manifest.frozenInventory.path));
    if (sha256(frozenBytes) !== manifest.frozenInventory.sha256) errors.push('frozen inventory hash differs');
    const inventory = JSON.parse(frozenBytes);
    let checked = 0;
    for (const f of inventory.files.filter(f => f.path.startsWith('benchmarks/'))) {
        try {
            if (sha256(await readFile(path.join(root, f.path))) !== f.sha256) errors.push(`frozen: ${f.path} hash differs`);
        } catch { errors.push(`frozen: ${f.path} missing`); }
        checked++;
    }
    return { valid: errors.length === 0, version, manifestCanonicalSha256: pin.canonicalSha256,
        semanticsSha256: manifest.semantics.sha256, frozenFilesChecked: checked, errors };
}
