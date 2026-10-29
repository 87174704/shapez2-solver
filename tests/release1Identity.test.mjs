import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { ROOT, json, verifyVersion } from '../versions/identity.mjs';
import { verifyRelease, MANIFEST } from '../versions/release1.mjs';

test('Release 1 refuses forged source, removed bindings, physics and inventory substitutions', async t => {
  const source = await json(path.join(ROOT, MANIFEST));
  for (const [name, mutate] of [
    ['solver', m => { m.runtime.files.find(f=>f.path==='shapeSolver.js').sha256='0'.repeat(64); }],
    ['missing validator', m => { m.runtime.files=m.runtime.files.filter(f=>f.path!=='constructive/validate-strict-plan.js'); }],
    ['physics', m => { m.semantics.files[0].sha256='0'.repeat(64); }],
    ['inventory', m => { m.frozenInventory.sha256='0'.repeat(64); }],
    ['source binding', m => { m.source.files.pop(); }],
  ]) await t.test(name, async () => {
    const m = structuredClone(source); mutate(m);
    const r = await verifyRelease({ manifestDocument:m });
    assert.equal(r.valid,false);
    assert.ok(r.errors.includes('release manifest differs from trusted pin'));
  });
});

test('Release 1 detects implementation substitution independently of historical identity', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(),'release1-tamper-'));
  try {
    await fs.writeFile(path.join(dir,'shapeSolver.js'),'// forged\n');
    const r = await verifyRelease({root:dir});
    assert.equal(r.valid,false);
    assert.ok(r.errors.includes('runtime: shapeSolver.js hash differs'));
    const old = await verifyVersion({version:'shape-operations-v2-support-closure'});
    assert.equal(old.valid,false);
    assert.ok(old.errors.includes('runtime: shapeSolver.js hash differs'));
  } finally { await fs.rm(dir,{recursive:true,force:true}); }
});
