import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const probePath = fileURLToPath(new URL('./helpers/shapeSolverLimitProbe.mjs', import.meta.url));

function assertSolvedAtBoundary(result) {
    assert.deepEqual(result, {
        outcome: 'solved',
        limitReached: false,
        limitReason: null,
        beamPruned: false,
        depth: 2,
        statesExplored: 2,
        generatedStates: 2,
        operations: ['Rotator CW', 'Rotator CW'],
        operationAttempts: 2,
    });
}

function assertLimit(result, limitReason, expected) {
    assert.deepEqual(result, {
        outcome: 'limit',
        limitReached: true,
        limitReason,
        beamPruned: false,
        operations: null,
        operationAttempts: expected.operationAttempts,
        depth: expected.depth,
        statesExplored: expected.statesExplored,
        generatedStates: expected.generatedStates,
    });
}

test('recipe limits honor exact boundaries under an external watchdog', { timeout: 7000 }, async () => {
    const { stdout } = await execFileAsync(process.execPath, [probePath], {
        timeout: 3000,
        windowsHide: true,
        maxBuffer: 1024 * 1024,
    });
    const report = JSON.parse(stdout);

    assertLimit(report.generated.before, 'generated-states', {
        depth: 0, statesExplored: 1, generatedStates: 1, operationAttempts: 1,
    });
    assertSolvedAtBoundary(report.generated.equal);
    assertSolvedAtBoundary(report.generated.over);

    assertLimit(report.visited.before, 'visited-states', {
        depth: 0, statesExplored: 1, generatedStates: 1, operationAttempts: 1,
    });
    assertSolvedAtBoundary(report.visited.equal);
    assertSolvedAtBoundary(report.visited.over);

    assertLimit(report.shapes.initializationOver, 'shape-universe', {
        depth: 0, statesExplored: 0, generatedStates: 0, operationAttempts: 0,
    });
    assertLimit(report.shapes.before, 'shape-universe', {
        depth: 0, statesExplored: 1, generatedStates: 0, operationAttempts: 0,
    });
    assertSolvedAtBoundary(report.shapes.equal);
    assertSolvedAtBoundary(report.shapes.over);

    assert.deepEqual(report.time.before, {
        outcome: 'exhausted',
        limitReached: false,
        limitReason: null,
        beamPruned: false,
        depth: 0,
        statesExplored: 1,
        generatedStates: 0,
        operations: null,
        operationAttempts: 1,
    });
    for (const result of [report.time.equal, report.time.over, report.time.stateTailEqual]) {
        assertLimit(result, 'time', {
            depth: 0, statesExplored: 1, generatedStates: 0, operationAttempts: 1,
        });
    }

    assert.match(report.validation.zero, /positive integer/);
    assert.match(report.validation.aboveDefault, /cannot exceed the production default/);
    assert.match(report.validation.unknown, /Unknown test-only solver limit/);
    assert.match(report.validation.clock, /clock must be a function/);
});
