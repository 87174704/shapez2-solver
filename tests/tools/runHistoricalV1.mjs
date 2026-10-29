import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { ROOT, json, sha256, verifyVersion } from '../../versions/identity.mjs';

// No changes to the caller's checkout. Keep the isolated directory as evidence.
export async function prepareHistoricalV1(destination) {
    await fs.mkdir(destination, { recursive: false });
    const inventory = await json(path.join(ROOT, 'versions/frozen-v1.inventory.json'));
    const archive = path.join(destination, 'baseline.tar');
    execFileSync('git', ['archive', '--format=tar', `--output=${archive}`, inventory.commit], { cwd: ROOT });
    execFileSync('tar', ['-xf', archive, '-C', destination]);
    const verified = [];
    for (const f of inventory.files) {
        const file = path.join(destination, f.path);
        let bytes = await fs.readFile(file);
        if (sha256(bytes) !== f.sha256) {
            // git stores LF; historical policies pin original Windows checkout bytes.
            // Restore only if the exact historical hash agrees; never infer acceptance.
            const lf = Buffer.from(bytes.toString('utf8').replaceAll('\r\n', '\n'));
            const crlf = Buffer.from(lf.toString('utf8').replaceAll('\n', '\r\n'));
            let mixed;
            if (f.mixedNewlineRecipe && sha256(lf) === f.mixedNewlineRecipe.normalizedLfSha256) {
                const lines = lf.toString('utf8').split('\n');
                for (const i of f.mixedNewlineRecipe.crlfLineIndices) lines[i] += '\r';
                mixed = Buffer.from(lines.join('\n'));
            }
            const exact = [lf, crlf, mixed].filter(Boolean).find(candidate => sha256(candidate) === f.sha256);
            if (!exact) throw Error(`cannot restore historical bytes: ${f.path}`);
            bytes = exact;
            await fs.writeFile(file, bytes);
        }
        verified.push({ path: f.path, sha256: sha256(bytes) });
    }
    await fs.symlink(path.join(ROOT, 'node_modules'), path.join(destination, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
    const identity = await verifyVersion({ version: 'shape-operations-v1', root: destination });
    if (!identity.valid) throw Error(identity.errors.join('\n'));
    await fs.writeFile(path.join(destination, 'historical-byte-verification.json'), JSON.stringify({ commit: inventory.commit, identity, files: verified }, null, 2));
    return { root: destination, identity, files: verified.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.join(ROOT, 'tests/tools/runHistoricalV1.mjs')) {
    const destination = path.resolve(process.argv[2] ?? path.join(ROOT, `.codex-temp-v1-${Date.now()}`));
    const prepared = await prepareHistoricalV1(destination);
    console.log(JSON.stringify({ historicalEnvironment: prepared }));
    const child = spawn(process.execPath, ['--test', '--test-reporter=tap'], { cwd: destination, stdio: 'inherit' });
    process.exitCode = await new Promise(resolve => child.on('exit', code => resolve(code ?? 1)));
}
