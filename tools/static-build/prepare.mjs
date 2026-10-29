// Restore ONLY the already-pinned current identity and frozen Benchmark byte
// representation after checkout. Do not restore historical test source files.
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { ROOT, sha, readJson, writeJson } from './shared.mjs';
const manifest=await readJson('versions/shape-operations-v2-support-closure.json');
const inventory=await readJson('versions/frozen-v1.inventory.json');
const pins=[...manifest.semantics.files,...manifest.runtime.files,...manifest.acceptance.files,...inventory.files.filter(f=>f.path.startsWith('benchmarks/'))];
const restored=[];
for(const f of pins) {
  const target=path.resolve(ROOT,f.path);assert.ok(target.startsWith(ROOT));
  const bytes=await fs.readFile(target);if(sha(bytes)===f.sha256)continue;
  const lf=Buffer.from(bytes.toString('utf8').replaceAll('\r\n','\n')),crlf=Buffer.from(lf.toString('utf8').replaceAll('\n','\r\n'));
  let mixed;if(f.mixedNewlineRecipe&&sha(lf)===f.mixedNewlineRecipe.normalizedLfSha256){const lines=lf.toString().split('\n');for(const i of f.mixedNewlineRecipe.crlfLineIndices)lines[i]+='\r';mixed=Buffer.from(lines.join('\n'));}
  const exact=[lf,crlf,mixed].filter(Boolean).find(b=>sha(b)===f.sha256);assert.ok(exact,`Input content differs from RC pin: ${f.path}`);
  await fs.writeFile(target,exact);restored.push({path:f.path,sha256:sha(exact)});
}
await writeJson('.f1/evidence/input-representation.json',{status:'VERIFIED',restored});console.log(`Pinned input byte representation verified; ${restored.length} newline-only restorations.`);
