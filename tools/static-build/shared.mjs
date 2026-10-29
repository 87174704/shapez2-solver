import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export const sri = bytes => 'sha384-' + createHash('sha384').update(bytes).digest('base64');
export const git = (...args) => execFileSync('git', ['--no-optional-locks', '-c', 'core.safecrlf=false', ...args], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 32 * 1024 * 1024 }).trim();
export const readJson = async file => JSON.parse(await fs.readFile(path.join(ROOT, file), 'utf8'));
export const writeJson = async (file, data) => { const p = path.join(ROOT, file); await fs.mkdir(path.dirname(p), { recursive: true }); await fs.writeFile(p, JSON.stringify(data, null, 2) + '\n'); };
export async function filesUnder(dir, { ignoreDirs = [] } = {}) {
  const result = [];
  for (const d of await fs.readdir(dir, { withFileTypes: true })) {
    if (ignoreDirs.includes(d.name)) continue;
    if (d.isSymbolicLink()) throw Error(`Symlink in artifact input: ${d.name}`);
    if (d.isDirectory()) result.push(...(await filesUnder(path.join(dir, d.name), { ignoreDirs })).map(p => d.name + '/' + p));
    else result.push(d.name);
  }
  return result.sort();
}
export async function request(url) {
  const at = new Date().toISOString();
  const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20000), headers: { 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36', origin: 'http://127.0.0.1:4173' } }).catch(error => { throw Object.assign(error, { record: { url, at, status: 'NETWORK_ERROR', error: error.message } }); });
  const bytes = Buffer.from(await response.arrayBuffer());
  const record = { url, finalUrl: response.url, at, status: response.status, contentType: response.headers.get('content-type'), acao: response.headers.get('access-control-allow-origin'), bytes: bytes.length, sha256: sha(bytes), integrity: sri(bytes) };
  if (!response.ok) throw Object.assign(Error(`HTTP ${response.status}: ${url}`), { record });
  if (!response.url.startsWith('https://')) throw Error('Non-HTTPS redirect');
  return { bytes, record };
}
