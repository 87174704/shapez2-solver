import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

globalThis.self = { postMessage() {} };

const { shapeSolver } = await import('../shapeSolver.js');
const { replaySolution } = await import('./helpers/shapeSolverOracle.mjs');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ALL_OPERATIONS = Object.freeze([
    'Rotator CW', 'Rotator CCW', 'Rotator 180', 'Half Destroyer', 'Cutter',
    'Swapper', 'Stacker', 'Painter', 'Pin Pusher', 'Crystal Generator',
]);

function solve(instance) {
    return shapeSolver(
        instance.targetShapeCodes,
        instance.startingShapeCodes,
        instance.enabledOperations,
        instance.maxLayers,
        instance.maxStatesPerLevel,
        instance.preventWaste,
        instance.orientationSensitive,
        instance.allowSplitting,
        instance.cleanPainting,
    );
}

async function productionImportGraph(entry) {
    const graph = new Set();
    const visit = async file => {
        if (graph.has(file)) return;
        graph.add(file);
        const source = await readFile(file, 'utf8');
        const imports = [...source.matchAll(/(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g)]
            .map(match => match[1]);
        for (const specifier of imports) {
            assert.equal(specifier.startsWith('node:'), false, `${path.relative(ROOT, file)} imports ${specifier}`);
            assert.equal(specifier.startsWith('.'), true, `${path.relative(ROOT, file)} has non-local runtime import ${specifier}`);
            const dependency = path.resolve(path.dirname(file), specifier);
            await visit(dependency);
        }
    };
    await visit(path.resolve(ROOT, entry));
    return [...graph].map(file => path.relative(ROOT, file).replaceAll('\\', '/')).sort();
}

test('production Solver static graph contains only browser-safe runtime modules', async () => {
    const graph = await productionImportGraph('shapeSolver.js');
    assert.deepEqual(graph.filter(file => file.startsWith('benchmarks/')), []);
    assert.equal(graph.includes('constructiveSolverRuntime.js'), true);
});

test('eligible public entry returns a replay-valid constructive solution', async () => {
    const instance = {
        targetShapeCodes: ['CuCuRuRu'],
        startingShapeCodes: ['CuCuCuCu', 'RuRuRuRu'],
        enabledOperations: ALL_OPERATIONS,
        maxLayers: 4,
        maxStatesPerLevel: 3000,
        preventWaste: false,
        orientationSensitive: false,
        allowSplitting: false,
        cleanPainting: true,
    };
    const result = await solve(instance);
    assert.equal(result.solverRoute, 'constructive-hybrid');
    assert.equal(result.architecture, 'interior-crystal-column-decomposition-v1');
    assert.equal(result.outcome, 'solved');
    assert.equal(replaySolution(instance, result.solutionPath, result).valid, true);
});

test('eligible unsupported construction falls back to bounded search', async () => {
    const result = await solve({
        targetShapeCodes: ['RuRuRuRu'],
        startingShapeCodes: ['CuCuCuCu'],
        enabledOperations: [],
        maxLayers: 4,
        maxStatesPerLevel: 100,
        preventWaste: false,
        orientationSensitive: false,
        allowSplitting: false,
        cleanPainting: true,
    });
    assert.equal(result.solverRoute, undefined);
    assert.equal(result.solutionPath, null);
    assert.equal(result.outcome, 'exhausted');
});

test('ineligible public parameters preserve the bounded-search route', async () => {
    const result = await solve({
        targetShapeCodes: ['WuCuRuSu'],
        startingShapeCodes: ['CuRuSuWu'],
        enabledOperations: ['Rotator CW'],
        maxLayers: 4,
        maxStatesPerLevel: 100,
        preventWaste: false,
        orientationSensitive: true,
        allowSplitting: false,
        cleanPainting: false,
    });
    assert.equal(result.solverRoute, undefined);
    assert.equal(result.depth, 1);
    assert.equal(result.solutionPath[0].operation, 'Rotator CW');
});
