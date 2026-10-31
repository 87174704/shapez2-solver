import fs from 'node:fs';
const input = JSON.parse(fs.readFileSync(0, 'utf8'));
globalThis.self = { postMessage() {} };
const { shapeSolver } = await import('../../shapeSolver.js');
const { replaySolution } = await import('../../tests/helpers/shapeSolverOracle.mjs');
const { replay } = await import('../release1/replay.mjs');
const p = input;
const result = await shapeSolver(p.targetShapeCodes, p.startingShapeCodes, p.enabledOperations, p.maxLayers,
    p.maxStatesPerLevel, p.preventWaste, p.orientationSensitive, p.allowSplitting, p.cleanPainting);
const solved = Array.isArray(result.solutionPath);
const validation = solved ? replaySolution(p, result.solutionPath, result) : null;
const independent = solved ? replay(p, result.solutionPath) : null;
process.stdout.write(JSON.stringify({ result, solved, replayValid: validation?.valid ?? null, independentReplayValid: independent?.valid ?? null }));
