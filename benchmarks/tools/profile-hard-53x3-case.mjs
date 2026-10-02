// Diagnostic child process. Never writes to the frozen formal baseline directory.
import process from 'node:process';
import { createHash } from 'node:crypto';
import { closeSync, openSync, writeSync } from 'node:fs';

globalThis.self = { postMessage() {} };

let stateFile = null;
try {
    let inputText = '';
    for await (const chunk of process.stdin) inputText += chunk;
    const { input, sampleEvery, statePath } = JSON.parse(inputText);
    stateFile = openSync(statePath, 'w');
    const { shapeSolverTestOnly } = await import('../../shapeSolver.js');
    const profile = {
        sampleEvery,
        onState(row) { writeSync(stateFile, `${JSON.stringify(row)}\n`); },
    };
    const started = performance.now();
    const result = await shapeSolverTestOnly(input, { diagnostics: false, profile });
    const wallMs = performance.now() - started;
    closeSync(stateFile);
    stateFile = null;
    const signature = Array.isArray(result?.solutionPath)
        ? createHash('sha256').update(JSON.stringify(result.solutionPath)).digest('hex') : null;
    process.stdout.write(JSON.stringify({
        outcome: result?.outcome ?? null, limitReason: result?.limitReason ?? null,
        depth: result?.depth ?? null, statesExplored: result?.statesExplored ?? null,
        generatedStates: result?.generatedStates ?? null, beamPruned: result?.beamPruned ?? null,
        solutionSignature: signature, wallMs, peakRssMiB: process.resourceUsage().maxRSS / 1024,
        profile: profile.data,
    }));
} catch (error) {
    if (stateFile !== null) closeSync(stateFile);
    process.stdout.write(JSON.stringify({ error: error?.stack ?? String(error) }));
    process.exitCode = 1;
}
