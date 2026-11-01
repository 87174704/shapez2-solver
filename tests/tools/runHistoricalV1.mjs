import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { ROOT, json, sha256, verifyVersion } from '../../versions/identity.mjs';

// No changes to the caller's checkout. The isolated tree is disposable input, not evidence.
export async function prepareHistoricalV1(destination) {
    await fs.mkdir(destination, { recursive: false });
    const inventory = await json(path.join(ROOT, 'versions/frozen-v1.inventory.json'));
    const archive = path.join(destination, 'baseline.tar');
    execFileSync('git', ['archive', '--format=tar', `--output=${archive}`, inventory.commit], { cwd: ROOT });
    // Extract with a relative archive name from the destination itself. tar never receives
    // -C or an absolute Windows path, so bsdtar, Git Bash and GNU tar behave identically.
    execFileSync('tar', ['-xf', path.basename(archive)], { cwd: destination });
    await fs.rm(archive);
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
    // Default to a disposable OS temporary tree; a caller-supplied destination is never removed.
    const explicit = process.argv[2] ? path.resolve(process.argv[2]) : null;
    const temporary = explicit ? null : await fs.mkdtemp(path.join(os.tmpdir(), 'shapez2-v1-'));
    const destination = explicit ?? path.join(temporary, 'v1');
    let removed = false;
    async function clean() {
        if (!temporary || removed) return;
        removed = true;
        if (path.dirname(temporary) !== path.resolve(os.tmpdir()) || !path.basename(temporary).startsWith('shapez2-v1-')) {
            console.error(`RESIDUAL: ${temporary} (refusing to remove a directory this entry did not create)`);
            return;
        }
        try {
            await fs.rm(temporary, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 });
            console.log(`CLEANED: ${temporary}`);
        } catch (error) {
            console.error(`RESIDUAL: ${temporary} (${error.message})`);
        }
    }
    const interrupt = signal => { clean().finally(() => process.exit(signal === 'SIGINT' ? 130 : 143)); };
    process.once('SIGINT', interrupt);
    process.once('SIGTERM', interrupt);
    try {
        console.log(temporary ? `temporary: ${temporary}` : `destination: ${destination}`);
        const prepared = await prepareHistoricalV1(destination);
        console.log(JSON.stringify({ historicalEnvironment: prepared }));
        const child = spawn(process.execPath, ['--test', '--test-reporter=tap'], { cwd: destination, stdio: 'inherit' });
        process.exitCode = await new Promise(resolve => child.on('exit', code => resolve(code ?? 1)));
    } finally {
        process.off('SIGINT', interrupt);
        process.off('SIGTERM', interrupt);
        await clean();
    }
}
