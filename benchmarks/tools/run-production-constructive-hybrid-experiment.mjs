#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const EXPERIMENT_ROOT = path.join(ROOT, 'benchmarks/experiments/production-constructive-hybrid-v1');
const BASELINE_ROOT = path.join(ROOT, 'benchmarks/solver-baselines/hard-53x3-v1');
const CONFIG_PATH = path.join(EXPERIMENT_ROOT, 'configs.json');
const FRONTIER_PATH = path.join(ROOT, 'benchmarks/experiments/interior-crystal-column-v1/ICCDCS-A/repeat.json');
const WORKER = path.join(ROOT, 'benchmarks/tools/production-constructive-hybrid-case.mjs');
const EXPECTED_BASELINE = 'a23979099a2ae0dc7c8fa0a77c89ffa77d23fc82170e38690de000b708082661';

function parseArgs(args) {
    let configId = null;
    let repeatSolved = false;
    let prepareOnly = false;
    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (arg === '--config' && args[index + 1]) configId = args[++index];
        else if (arg === '--repeat-solved') repeatSolved = true;
        else if (arg === '--prepare-only') prepareOnly = true;
        else throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
    if (!configId && !prepareOnly) throw new Error('--config is required');
    return { configId, repeatSolved, prepareOnly };
}

async function readJson(file) {
    return JSON.parse(await readFile(file, 'utf8'));
}

async function loadCases() {
    const [configs, identity, baselineConfig, names, frontier] = await Promise.all([
        readJson(CONFIG_PATH),
        readJson(path.join(BASELINE_ROOT, 'identity.json')),
        readJson(path.join(BASELINE_ROOT, 'config.json')),
        readdir(path.join(BASELINE_ROOT, 'records')),
        readJson(FRONTIER_PATH),
    ]);
    if (configs.baselineCanonicalSha256 !== EXPECTED_BASELINE
        || identity.baselineCanonicalSha256 !== EXPECTED_BASELINE
        || baselineConfig.baselineId !== 'hard-53x3-solver-baseline-v1') {
        throw new Error('Formal baseline identity mismatch');
    }
    if (configs.configurations.length !== 1 || configs.configurations[0].id !== 'PCHA-A') {
        throw new Error('Expected exactly the frozen PCHA-A configuration');
    }
    const frontierRecords = frontier.records.filter(row => row.status === 'SOLVED' && row.replayValid === true);
    if (frontier.baselineCanonicalSha256 !== EXPECTED_BASELINE
        || frontier.experimentId !== 'interior-crystal-column-decomposition-v1'
        || frontierRecords.length !== 159) {
        throw new Error('E-014 frontier identity/count mismatch');
    }
    const frontierByKey = new Map(frontierRecords.map(row => [`${row.targetId}:${row.familySlot}`, row]));
    const records = await Promise.all(names.filter(name => name.endsWith('.json')).sort()
        .map(name => readJson(path.join(BASELINE_ROOT, 'records', name))));
    if (records.length !== 159) throw new Error(`Expected 159 formal records, got ${records.length}`);
    const sourceCache = new Map();
    const cases = [];
    for (const record of records) {
        let source = sourceCache.get(record.sourceArtifact);
        if (!source) {
            source = await readJson(path.join(ROOT, record.sourceArtifact));
            sourceCache.set(record.sourceArtifact, source);
        }
        const instances = Array.isArray(source) ? source : source.instances;
        const instance = instances.find(row => row.id === record.instanceId);
        if (!instance || instance.instanceSha256 !== record.sourceInstanceSha256) {
            throw new Error(`Unable to bind formal member ${record.targetId}:${record.familySlot}`);
        }
        cases.push({
            identity: {
                targetId: record.targetId,
                familySlot: record.familySlot,
                instanceId: record.instanceId,
                sourceInstanceSha256: record.sourceInstanceSha256,
            },
            input: {
                targetShapeCodes: [instance.target],
                startingShapeCodes: instance.availableInputs.flatMap(row => Array(row.count).fill(row.shape)),
                enabledOperations: [
                    'Rotator CW', 'Rotator CCW', 'Rotator 180', 'Half Destroyer', 'Cutter',
                    'Swapper', 'Stacker', 'Painter', 'Pin Pusher', 'Crystal Generator',
                ],
                maxLayers: 4,
                maxStatesPerLevel: 3000,
                preventWaste: false,
                orientationSensitive: false,
                allowSplitting: false,
                cleanPainting: true,
            },
        });
    }
    return { configs, cases, frontierByKey };
}

function runChild(input, configuration) {
    return new Promise(resolve => {
        const child = spawn(process.execPath, [WORKER], {
            cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true,
        });
        let stdout = '';
        let stderr = '';
        let settled = false;
        const finish = value => {
            if (settled) return;
            settled = true;
            clearTimeout(watchdog);
            resolve(value);
        };
        child.stdout.setEncoding('utf8');
        child.stderr.setEncoding('utf8');
        child.stdout.on('data', chunk => { stdout += chunk; });
        child.stderr.on('data', chunk => { stderr += chunk; });
        child.on('error', error => finish({ status: 'ERROR', solved: false, exception: error.stack ?? String(error) }));
        child.on('close', (code, signal) => {
            if (settled) return;
            try {
                finish({ ...JSON.parse(stdout), processExitCode: code, processSignal: signal, stderr: stderr || null });
            } catch (error) {
                finish({ status: 'ERROR', solved: false, exception: `Invalid child result: ${error.message}`, stdout, stderr });
            }
        });
        const watchdog = setTimeout(() => {
            child.kill();
            finish({ status: 'WATCHDOG', solved: false, replayValid: null, replayError: null });
        }, configuration.maxWallMs + 3000);
        child.stdin.end(JSON.stringify({ input, configuration }));
    });
}

function reusesToken(pathValue) {
    const consumed = new Set();
    for (const step of pathValue ?? []) {
        for (const token of step.inputs ?? []) {
            if (consumed.has(token.id)) return true;
            consumed.add(token.id);
        }
    }
    return false;
}

function summarize(records, repeats, frontierByKey) {
    const counts = {};
    for (const row of records) counts[row.status] = (counts[row.status] ?? 0) + 1;
    const solved = records.filter(row => row.status === 'SOLVED' && row.replayValid === true);
    const repeatByKey = new Map(repeats.map(row => [`${row.targetId}:${row.familySlot}`, row]));
    const stable = solved.filter(row => {
        const repeat = repeatByKey.get(`${row.targetId}:${row.familySlot}`);
        return repeat?.status === 'SOLVED' && repeat.replayValid === true;
    });
    const pathIdenticalRepeats = stable.filter(row => {
        const repeat = repeatByKey.get(`${row.targetId}:${row.familySlot}`);
        return JSON.stringify(repeat.result.solutionPath) === JSON.stringify(row.result.solutionPath);
    }).length;
    const exactFrontierPaths = solved.filter(row => {
        const frontier = frontierByKey.get(`${row.targetId}:${row.familySlot}`);
        return JSON.stringify(frontier?.result?.solutionPath) === JSON.stringify(row.result.solutionPath);
    }).length;
    const resourceReuse = solved.filter(row => reusesToken(row.result.solutionPath)).length;
    const invalidReplay = records.filter(row => row.status === 'INVALID_REPLAY' || row.replayValid === false).length;
    const publicRouteSolved = solved.filter(row => row.solverRoute === 'constructive-hybrid').length;
    const hardFailure = invalidReplay > 0 || resourceReuse > 0
        || records.some(row => row.status === 'ERROR' || row.status === 'WATCHDOG');
    return {
        memberCount: records.length,
        counts,
        solved: solved.length,
        replayValidSolved: solved.length,
        repeated: repeats.length,
        stableSolved: stable.length,
        stableDistinctTargets: new Set(stable.map(row => row.targetId)).size,
        publicRouteSolved,
        pathIdenticalRepeats,
        exactFrontierPaths,
        resourceReuse,
        invalidReplay,
        accept: !hardFailure && stable.length === 159 && pathIdenticalRepeats === 159
            && exactFrontierPaths === 159 && publicRouteSolved === 159,
        provisional: !hardFailure && stable.length >= 156 && stable.length < 159,
        reject: hardFailure || stable.length < 156,
    };
}

async function writeArtifact(file, value) {
    await writeFile(file, `${JSON.stringify(value, null, 2)}\n`);
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    const { configs, cases, frontierByKey } = await loadCases();
    if (options.prepareOnly) {
        process.stdout.write(`${JSON.stringify({
            baseline: EXPECTED_BASELINE,
            members: cases.length,
            frontierMembers: frontierByKey.size,
            configurations: configs.configurations.map(row => row.id),
        })}\n`);
        return;
    }
    const configuration = configs.configurations.find(row => row.id === options.configId);
    if (!configuration) throw new Error(`Configuration ${options.configId} is not predeclared`);
    const outputDir = path.join(EXPERIMENT_ROOT, configuration.id);
    await mkdir(outputDir, { recursive: true });
    const firstPassPath = path.join(outputDir, 'first-pass.json');
    let records;
    try {
        const artifact = await readJson(firstPassPath);
        records = artifact.records;
        if (artifact.baselineCanonicalSha256 !== EXPECTED_BASELINE
            || artifact.configuration.id !== configuration.id || records.length !== 159) {
            throw new Error('Existing first-pass artifact identity mismatch');
        }
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        records = [];
        for (const [index, item] of cases.entries()) {
            const child = await runChild(item.input, configuration);
            const record = { ...item.identity, ...child };
            records.push(record);
            process.stdout.write(`[${index + 1}/159] ${item.identity.targetId}:${item.identity.familySlot} ${record.status}\n`);
        }
        await writeArtifact(firstPassPath, {
            schemaVersion: 1,
            experimentId: configs.experimentId,
            baselineCanonicalSha256: EXPECTED_BASELINE,
            configuration,
            records,
        });
    }
    let repeats = [];
    if (options.repeatSolved) {
        const solvedCases = cases.filter(item => {
            const row = records.find(record => record.targetId === item.identity.targetId
                && record.familySlot === item.identity.familySlot);
            return row?.status === 'SOLVED' && row.replayValid === true;
        });
        for (const [index, item] of solvedCases.entries()) {
            const child = await runChild(item.input, configuration);
            const record = { ...item.identity, ...child };
            repeats.push(record);
            process.stdout.write(`[repeat ${index + 1}/${solvedCases.length}] ${item.identity.targetId}:${item.identity.familySlot} ${record.status}\n`);
        }
        await writeArtifact(path.join(outputDir, 'repeat.json'), {
            schemaVersion: 1,
            experimentId: configs.experimentId,
            baselineCanonicalSha256: EXPECTED_BASELINE,
            configuration,
            records: repeats,
        });
    }
    const summary = summarize(records, repeats, frontierByKey);
    await writeArtifact(path.join(outputDir, 'summary.json'), {
        schemaVersion: 1,
        experimentId: configs.experimentId,
        baselineCanonicalSha256: EXPECTED_BASELINE,
        configuration,
        ...summary,
    });
    process.stdout.write(`${JSON.stringify(summary)}\n`);
}

await main();
