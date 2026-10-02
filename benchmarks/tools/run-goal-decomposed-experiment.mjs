#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const EXPERIMENT_ROOT = path.join(ROOT, 'benchmarks/experiments/goal-decomposed-v1');
const CONFIG_PATH = path.join(EXPERIMENT_ROOT, 'configs.json');
const BASELINE_ROOT = path.join(ROOT, 'benchmarks/solver-baselines/hard-53x3-v1');
const WORKER = path.join(ROOT, 'benchmarks/tools/goal-decomposed-case.mjs');
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
        else if (arg === '--help') return { help: true };
        else throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
    if (!configId && !prepareOnly) throw new Error('--config is required');
    return { configId, repeatSolved, prepareOnly };
}

async function readJson(file) {
    return JSON.parse(await readFile(file, 'utf8'));
}

async function loadCases() {
    const [configs, identity, baselineConfig, names] = await Promise.all([
        readJson(CONFIG_PATH),
        readJson(path.join(BASELINE_ROOT, 'identity.json')),
        readJson(path.join(BASELINE_ROOT, 'config.json')),
        readdir(path.join(BASELINE_ROOT, 'records')),
    ]);
    if (configs.baselineCanonicalSha256 !== EXPECTED_BASELINE
        || identity.baselineCanonicalSha256 !== EXPECTED_BASELINE
        || baselineConfig.baselineId !== 'hard-53x3-solver-baseline-v1') {
        throw new Error('Formal baseline identity mismatch');
    }
    if (configs.configurations.length !== 1 || configs.configurations[0].id !== 'GDCS-A') {
        throw new Error('Expected exactly the frozen GDCS-A configuration');
    }
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
        if (instance.rules?.maxLayers !== 4 || instance.rules?.allowSplitting !== false
            || instance.rules?.cleanPainting !== true) {
            throw new Error(`Unexpected formal rules for ${record.targetId}:${record.familySlot}`);
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
    return { configs, cases };
}

function runChild(input, configuration) {
    return new Promise(resolve => {
        const child = spawn(process.execPath, [WORKER], {
            cwd: ROOT,
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: true,
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
                const parsed = JSON.parse(stdout);
                finish({ ...parsed, processExitCode: code, processSignal: signal, stderr: stderr || null });
            } catch (error) {
                finish({
                    status: 'ERROR', solved: false,
                    exception: `Invalid child result: ${error.message}`,
                    processExitCode: code, processSignal: signal, stdout, stderr,
                });
            }
        });
        const watchdog = setTimeout(() => {
            child.kill();
            finish({ status: 'WATCHDOG', solved: false, replayValid: null, replayError: null });
        }, configuration.maxWallMs + 3000);
        child.stdin.end(JSON.stringify({ input, configuration }));
    });
}

function summarize(records, repeats = []) {
    const counts = {};
    const architectureStatuses = {};
    const limitReasons = {};
    for (const row of records) {
        counts[row.status] = (counts[row.status] ?? 0) + 1;
        const architectureStatus = row.result?.architectureStatus ?? null;
        if (architectureStatus) architectureStatuses[architectureStatus] = (architectureStatuses[architectureStatus] ?? 0) + 1;
        const limitReason = row.result?.limitReason ?? null;
        if (limitReason) limitReasons[limitReason] = (limitReasons[limitReason] ?? 0) + 1;
    }
    const solved = records.filter(row => row.status === 'SOLVED' && row.replayValid === true);
    const repeatByKey = new Map(repeats.map(row => [`${row.targetId}:${row.familySlot}`, row]));
    const stable = solved.filter(row => {
        const repeat = repeatByKey.get(`${row.targetId}:${row.familySlot}`);
        return repeat?.status === 'SOLVED' && repeat.replayValid === true;
    });
    const distinctTargets = new Set(stable.map(row => row.targetId)).size;
    const prior = new Set(['hard-main-001:F1', 'hard-main-001:F2']);
    const stableNew = stable.filter(row => !prior.has(`${row.targetId}:${row.familySlot}`));
    return {
        memberCount: records.length,
        counts,
        architectureStatuses,
        limitReasons,
        solved: solved.length,
        replayValidSolved: solved.length,
        repeated: repeats.length,
        stableSolved: stable.length,
        stableDistinctTargets: distinctTargets,
        stableNewMembers: stableNew.length,
        stableMembers: stable.map(row => ({
            targetId: row.targetId,
            familySlot: row.familySlot,
            instanceId: row.instanceId,
            operationCount: row.operationCount,
        })),
        accept: stable.length >= 3 && distinctTargets >= 2 && stableNew.length >= 1,
        provisional: stableNew.length >= 1 && !(stable.length >= 3 && distinctTargets >= 2),
    };
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
        process.stdout.write('Usage: node benchmarks/tools/run-goal-decomposed-experiment.mjs --config GDCS-A [--repeat-solved]\n');
        return;
    }
    const { configs, cases } = await loadCases();
    if (options.prepareOnly) {
        process.stdout.write(`${JSON.stringify({
            baseline: EXPECTED_BASELINE,
            members: cases.length,
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
        if (artifact.baselineCanonicalSha256 !== EXPECTED_BASELINE || artifact.configuration.id !== configuration.id
            || records.length !== 159) throw new Error('Existing first-pass artifact identity mismatch');
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        records = [];
        for (const [index, item] of cases.entries()) {
            const child = await runChild(item.input, configuration);
            const record = { ...item.identity, ...child };
            records.push(record);
            process.stdout.write(`[${index + 1}/159] ${item.identity.targetId}:${item.identity.familySlot} ${record.status}\n`);
        }
        await writeFile(firstPassPath, `${JSON.stringify({
            schemaVersion: 1,
            experimentId: configs.experimentId,
            baselineCanonicalSha256: EXPECTED_BASELINE,
            configuration,
            records,
        }, null, 2)}\n`);
    }

    let repeats = [];
    if (options.repeatSolved) {
        const solvedCases = cases.filter(item => {
            const record = records.find(row => row.targetId === item.identity.targetId && row.familySlot === item.identity.familySlot);
            return record?.status === 'SOLVED' && record.replayValid === true;
        });
        for (const [index, item] of solvedCases.entries()) {
            const child = await runChild(item.input, configuration);
            const record = { ...item.identity, ...child };
            repeats.push(record);
            process.stdout.write(`[repeat ${index + 1}/${solvedCases.length}] ${item.identity.targetId}:${item.identity.familySlot} ${record.status}\n`);
        }
        await writeFile(path.join(outputDir, 'repeat.json'), `${JSON.stringify({
            schemaVersion: 1,
            experimentId: configs.experimentId,
            baselineCanonicalSha256: EXPECTED_BASELINE,
            configuration,
            records: repeats,
        }, null, 2)}\n`);
    }

    const summary = summarize(records, repeats);
    await writeFile(path.join(outputDir, 'summary.json'), `${JSON.stringify({
        schemaVersion: 1,
        experimentId: configs.experimentId,
        baselineCanonicalSha256: EXPECTED_BASELINE,
        configuration,
        ...summary,
    }, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify(summary)}\n`);
}

await main();
