import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolveCases } from '../../benchmarks/tools/solver-baseline-core.mjs';
const root = import.meta.dirname, repo = path.resolve(root, '../..');
const hash = b => createHash('sha256').update(b).digest('hex');
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const save = (p, x) => fs.writeFileSync(path.join(root, p), JSON.stringify(x, null, 2) + '\n');
if (fs.existsSync(path.join(root, 'measured-cases.json'))) throw Error('Already prepared');
const rc = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: 'E:/solver' }).toString().trim();
if (rc !== 'ec9cc5cb633d021b6af276565223a392f8329b87') throw Error('RC changed');
const tracked = where => Object.fromEntries(execFileSync('git', ['ls-files', '-z'], { cwd: where }).toString().split('\0').filter(Boolean)
    .map(p => [p, hash(fs.readFileSync(path.join(where, p)))]));
const release = read(path.join(repo, 'benchmarks/releases/hard-53x3-stage-v1.release.json'));
const frozen = resolveCases(release, read(path.join(repo, release.bindings.finalSelection.path)),
    new Map(release.sourceRegistry.map(s => [s.sourceId, read(path.join(repo, s.path))])));
if (frozen.length !== 159) throw Error('Frozen membership changed');
const old = read('E:/solver-external-comparison-v2-20261030/measured-cases.json').filter(c => c.source === 'new-common-v2');
if (old.length !== 18) throw Error('Ordinary membership changed');
const holdouts = read(path.join(repo, 'tests/strict-routing/holdouts.json'));
const cases = [...old, ...holdouts, ...frozen.map(c => ({ id: c.targetId + '-' + c.familySlot,
    tier: 'frozen-hard', source: 'frozen-159', input: c.input }))];
if (new Set(cases.map(c => c.id)).size !== cases.length) throw Error('Duplicate cases');
save('measured-cases.json', cases);
save('input-lock.json', { rc, cases: cases.length, ordinary: 18, holdouts: holdouts.length, frozen: frozen.length,
    sha256: hash(fs.readFileSync(path.join(root, 'measured-cases.json'))), recordedAt: new Date().toISOString(),
    inputs: cases.map(c => ({ id: c.id, sha256: hash(JSON.stringify(c.input)) })) });
save('source-before.json', { rc, original: tracked('E:/solver'), comparison: tracked('E:/solver-ordinary-rca-20261030/production'),
    mandatoryReports: Object.fromEntries(['REPORT.md', 'SEARCH_ROUTE_MATRIX.md', 'OPTIMIZATION_PLAN.md', 'REPRODUCE.md']
        .map(p => [p, hash(fs.readFileSync('E:/solver-ordinary-rca-20261030/' + p))])), node: process.version, v8: process.versions.v8 });
save('formal-config.json', { variants: ['rc', 'off', 'on'], repetitions: 3, wallLimitMs: 2000, memoryLimitMiB: 768,
    heapMiB: 512, serial: true, caseIds: cases.map(c => c.id), warmup: 'S2 three times per fresh process',
    ordering: 'Reverse cases on odd repetitions; rotate and reverse variants per case/repetition',
    rcRoot: 'E:/solver', patchRoot: repo });
console.log({ cases: cases.length, frozen: frozen.length });
