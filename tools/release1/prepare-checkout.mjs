import path from 'node:path';
import { ROOT, json } from '../../versions/identity.mjs';
import { MANIFEST } from '../../versions/release1.mjs';
import { restore } from './prepare.mjs';
const m = await json(path.join(ROOT, MANIFEST));
console.log(JSON.stringify({ restored: await restore(ROOT,m.source.files), bindings:m.source.files.length }));
