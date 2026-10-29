import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { replay } from './independent-replay.mjs';
const born = performance.now(), root = import.meta.dirname, repo = path.resolve(root, '../..');
let request = ''; for await (const chunk of process.stdin) request += chunk;
const r = JSON.parse(request), cases = JSON.parse(fs.readFileSync(path.join(root, 'measured-cases.json')));
const input = cases.find(c => c.id === r.caseId).input, mode = r.algorithm;
const send = x => fs.writeSync(1, JSON.stringify(x) + '\n');
let active = false;
globalThis.self = { postMessage(message) { if (active) send({ type: 'PROGRESS', message }); } };
const moduleRoot = mode === 'rc' ? 'E:/solver' : repo;
const { shapeSolver } = await import(pathToFileURL(path.join(moduleRoot, 'shapeSolver.js')));
const { replaySolution } = await import('../../tests/helpers/shapeSolverOracle.mjs');
const invoke = p => shapeSolver(p.targetShapeCodes, p.startingShapeCodes, p.enabledOperations, p.maxLayers,
    p.maxStatesPerLevel, p.preventWaste, p.orientationSensitive, p.allowSplitting, p.cleanPainting,
    mode === 'rc' ? undefined : { strictOrientationConstructive: mode === 'on' });
const warm = performance.now(); for (let i = 0; i < 3; i++) await invoke(cases.find(c => c.id === 'S2').input);
global.gc?.();
send({ type: 'START', mode, warmMs: performance.now() - warm, beforeSearchMs: performance.now() - born });
active = true; const started = performance.now();
try {
    const result = await invoke(input), searchMs = performance.now() - started;
    active = false;
    send({ type: 'SEARCH_END', searchMs, peakRssMiB: process.resourceUsage().maxRSS / 1024 });
    let validation = null, independent = null;
    if (Array.isArray(result.solutionPath)) {
        const oracle = replaySolution(input, result.solutionPath, result);
        const other = replay(input, result.solutionPath);
        validation = { valid: oracle.valid, error: oracle.error };
        independent = { valid: other.valid, error: other.error ?? null, at: other.at ?? result.solutionPath.length };
    }
    const status = Array.isArray(result.solutionPath) ? validation.valid && independent.valid ? 'SOLVED' : 'INVALID_SOLUTION'
        : result.outcome === 'limit' ? 'RESOURCE_LIMIT' : result.outcome ?? 'NOT_FOUND';
    send({ type: 'RESULT', status, mode, searchMs, result, validation, independent,
        operationCount: result.solutionPath?.length ?? null,
        solverRoute: result.solverRoute ?? 'general-search', attempt: result.strictConstructiveAttempt ?? null,
        pathHash: result.solutionPath ? createHash('sha256').update(JSON.stringify(result.solutionPath)).digest('hex') : null });
} catch (error) { send({ type: 'RESULT', status: 'ERROR', error: error.stack, searchMs: performance.now() - started }); }
