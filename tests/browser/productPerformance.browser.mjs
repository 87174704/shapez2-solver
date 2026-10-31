#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { once } from 'node:events';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const DEFAULT_OUTPUT = path.join(ROOT, 'benchmarks', 'integration', 'browser-performance-v1', 'results.json');
const ALL_OPERATIONS = Object.freeze([
    'Rotator CW', 'Rotator CCW', 'Rotator 180', 'Half Destroyer', 'Cutter',
    'Swapper', 'Stacker', 'Painter', 'Pin Pusher', 'Crystal Generator',
]);
const browserCandidates = process.platform === 'win32'
    ? [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    ]
    : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
const mimeTypes = new Map([
    ['.html', 'text/html; charset=utf-8'],
    ['.js', 'text/javascript; charset=utf-8'],
    ['.mjs', 'text/javascript; charset=utf-8'],
    ['.css', 'text/css; charset=utf-8'],
    ['.svg', 'image/svg+xml'],
    ['.png', 'image/png'],
]);

function parseArguments(argv) {
    const options = { profiles: 2, warmups: 2, runs: 10, output: DEFAULT_OUTPUT, task: 'P7-03' };
    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        const value = argv[index + 1];
        if (argument === '--profiles') options.profiles = Number(value);
        else if (argument === '--warmups') options.warmups = Number(value);
        else if (argument === '--runs') options.runs = Number(value);
        else if (argument === '--output') options.output = path.resolve(value);
        else if (argument === '--task') options.task = value;
        else throw new Error(`Unknown argument: ${argument}`);
        index += 1;
    }
    for (const key of ['profiles', 'warmups', 'runs']) {
        if (!Number.isInteger(options[key]) || options[key] < (key === 'warmups' ? 0 : 1)) {
            throw new Error(`--${key} must be a valid integer`);
        }
    }
    if (!options.task) throw new Error('--task must be a non-empty string');
    return options;
}

function currentShanghaiDate() {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(new Date());
}

async function findBrowser() {
    for (const candidate of browserCandidates) {
        try {
            if ((await stat(candidate)).isFile()) return candidate;
        } catch {
            // Continue to the next known installation.
        }
    }
    throw new Error('A supported Chrome/Chromium/Edge executable is required');
}

function startServer() {
    const server = http.createServer(async (request, response) => {
        try {
            const requestPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
            const relativePath = requestPath.replace(/^\/+/, '') + (requestPath.endsWith('/') ? 'index.html' : '');
            const filePath = path.resolve(ROOT, relativePath);
            if (filePath !== ROOT && !filePath.startsWith(`${ROOT}${path.sep}`)) {
                response.writeHead(403).end('Forbidden');
                return;
            }
            const contents = await readFile(filePath);
            response.writeHead(200, { 'content-type': mimeTypes.get(path.extname(filePath)) ?? 'application/octet-stream' });
            response.end(contents);
        } catch {
            response.writeHead(404).end('Not found');
        }
    });
    return new Promise((resolve, reject) => {
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => resolve(server));
    });
}

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

async function waitForDebugPort(profileDirectory) {
    const portFile = path.join(profileDirectory, 'DevToolsActivePort');
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
        try {
            const [port] = (await readFile(portFile, 'utf8')).trim().split(/\r?\n/);
            if (port) return Number(port);
        } catch {
            // Chrome has not written the file yet.
        }
        await delay(25);
    }
    throw new Error('Chrome did not expose a debugging port');
}

async function waitForPage(port, expectedUrl) {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
        const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json());
        const page = targets.find(target => target.type === 'page' && target.url === expectedUrl);
        if (page) return page;
        await delay(25);
    }
    throw new Error('Chrome did not expose the expected page target');
}

function connectToTarget(webSocketDebuggerUrl) {
    return new Promise((resolve, reject) => {
        const socket = new WebSocket(webSocketDebuggerUrl);
        const pending = new Map();
        const listeners = new Map();
        let nextId = 1;
        socket.addEventListener('error', reject, { once: true });
        socket.addEventListener('message', ({ data }) => {
            const message = JSON.parse(data);
            if (message.id) {
                const callbacks = pending.get(message.id);
                if (!callbacks) return;
                pending.delete(message.id);
                if (message.error) callbacks.reject(new Error(message.error.message));
                else callbacks.resolve(message.result);
                return;
            }
            for (const listener of listeners.get(message.method) ?? []) listener(message.params, message.sessionId);
        });
        socket.addEventListener('open', () => {
            const call = (method, params = {}, sessionId) => new Promise((resolveCommand, rejectCommand) => {
                const id = nextId++;
                pending.set(id, { resolve: resolveCommand, reject: rejectCommand });
                socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
            });
            resolve({
                call,
                close: () => socket.close(),
                on(method, listener) {
                    if (!listeners.has(method)) listeners.set(method, new Set());
                    listeners.get(method).add(listener);
                },
                evaluate(expression) {
                    return call('Runtime.evaluate', { expression, returnByValue: true }).then(result => {
                        if (result.exceptionDetails) {
                            throw new Error(result.exceptionDetails.exception?.description ?? 'Browser evaluation failed');
                        }
                        return result.result?.value;
                    });
                },
            });
        }, { once: true });
    });
}

async function waitForValue(client, expression, predicate, label, timeoutMs = 30000) {
    const deadline = Date.now() + timeoutMs;
    let value;
    while (Date.now() < deadline) {
        value = await client.evaluate(expression);
        if (predicate(value)) return value;
        await delay(5);
    }
    throw new Error(`Timed out waiting for ${label}; last value was ${JSON.stringify(value)}`);
}

function metricValue(metrics, name) {
    return metrics.metrics?.find(metric => metric.name === name)?.value ?? null;
}

async function collectPageMemory(client) {
    await client.call('HeapProfiler.collectGarbage');
    const [metrics, dom] = await Promise.all([
        client.call('Performance.getMetrics'),
        client.call('Memory.getDOMCounters'),
    ]);
    return {
        jsHeapUsedBytes: metricValue(metrics, 'JSHeapUsedSize'),
        jsHeapTotalBytes: metricValue(metrics, 'JSHeapTotalSize'),
        documents: dom.documents,
        nodes: dom.nodes,
        jsEventListeners: dom.jsEventListeners,
    };
}

function median(values) {
    const ordered = [...values].sort((a, b) => a - b);
    const middle = Math.floor(ordered.length / 2);
    return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2;
}

function percentile(values, fraction) {
    const ordered = [...values].sort((a, b) => a - b);
    return ordered[Math.min(ordered.length - 1, Math.ceil(ordered.length * fraction) - 1)];
}

function describe(values) {
    return {
        count: values.length,
        min: Math.min(...values),
        median: median(values),
        p90: percentile(values, 0.9),
        max: Math.max(...values),
    };
}

function sha256(value) {
    return createHash('sha256').update(value).digest('hex');
}

async function fileSha256(file) {
    return sha256(await readFile(file));
}

const workloads = Object.freeze([
    {
        id: 'ordinary-constructive',
        target: 'CuCuRuRu',
        starts: ['CuCuCuCu', 'RuRuRuRu'],
        operations: ALL_OPERATIONS,
        maxLayers: 4,
        maxStatesPerLevel: 3000,
        preventWaste: false,
        orientationSensitive: false,
        allowSplitting: false,
        cleanPainting: true,
        expected: { route: 'constructive-hybrid', outcome: 'solved' },
    },
    {
        id: 'interior-crystal-constructive',
        target: 'RrcrRrRr:RgcrRgRg:--cr----',
        starts: ['RuRuRuRu', 'RuRuRuRu', 'RuRuRuRu', 'RuRuRuRu'],
        operations: ALL_OPERATIONS,
        maxLayers: 4,
        maxStatesPerLevel: 3000,
        preventWaste: false,
        orientationSensitive: false,
        allowSplitting: false,
        cleanPainting: true,
        expected: { route: 'constructive-hybrid', stage: 'full-height-column-extraction', outcome: 'solved', depth: 52 },
    },
    {
        id: 'bounded-search-w1',
        target: 'CuRuSuWu',
        starts: ['CuCuCuCu', 'RuRuRuRu', 'SuSuSuSu', 'WuWuWuWu'],
        operations: ALL_OPERATIONS,
        maxLayers: 4,
        maxStatesPerLevel: 1000,
        preventWaste: false,
        orientationSensitive: false,
        allowSplitting: false,
        cleanPainting: false,
        expected: {
            route: null,
            outcome: 'solved',
            depth: 6,
            statesExplored: 3612,
            generatedStates: 106816,
        },
    },
]);

function configureExpression(workload) {
    return `(() => {
        const config = ${JSON.stringify(workload)};
        document.querySelector('.mode-tab[data-mode="solver"]')?.click();
        while (document.querySelector('#target-shapes .shape-remove')) {
            document.querySelector('#target-shapes .shape-remove').click();
        }
        while (document.querySelector('#starting-shapes .shape-remove')) {
            document.querySelector('#starting-shapes .shape-remove').click();
        }
        const addShape = (inputId, buttonId, code) => {
            document.getElementById(inputId).value = code;
            document.getElementById(buttonId).click();
        };
        addShape('target-input', 'add-target-shape-btn', config.target);
        for (const code of config.starts) addShape('starting-input', 'add-starting-shape-btn', code);
        const enabled = new Set(config.operations);
        for (const operation of document.querySelectorAll('.operation-item')) {
            operation.classList.toggle('enabled', enabled.has(operation.dataset.operation));
        }
        document.getElementById('max-layers').value = String(config.maxLayers);
        document.getElementById('max-states-per-level').value = String(config.maxStatesPerLevel);
        document.getElementById('prevent-waste').checked = config.preventWaste;
        document.getElementById('orientation-sensitive').checked = config.orientationSensitive;
        document.getElementById('allow-splitting').checked = config.allowSplitting;
        document.getElementById('clean-painting').checked = config.cleanPainting;
        return {
            targets: document.querySelectorAll('#target-shapes .shape-item').length,
            starts: document.querySelectorAll('#starting-shapes .shape-item').length,
            operations: document.querySelectorAll('.operation-item.enabled').length,
        };
    })()`;
}

const instrumentationExpression = `(() => {
    const NativeWorker = globalThis.Worker;
    globalThis.__p703 = { active: null, workers: [] };
    globalThis.Worker = function ObservedWorker(url, options) {
        const worker = new NativeWorker(url, options);
        const record = { messages: 0, statuses: 0, terminations: 0 };
        worker.addEventListener('message', ({ data }) => {
            record.messages += 1;
            const active = globalThis.__p703.active;
            if (!active) return;
            if (data?.type === 'status') {
                record.statuses += 1;
                if (active.firstStatusMs == null) active.firstStatusMs = performance.now() - active.startedAt;
            }
            if (data?.type === 'result') {
                active.workerResultMs = performance.now() - active.startedAt;
                active.result = {
                    route: data.result?.solverRoute ?? null,
                    stage: data.result?.interiorCrystalStage ?? null,
                    outcome: data.result?.outcome ?? null,
                    depth: data.result?.depth ?? null,
                    statesExplored: data.result?.statesExplored ?? null,
                    generatedStates: data.result?.generatedStates ?? null,
                    beamPruned: data.result?.beamPruned ?? null,
                    path: JSON.stringify(data.result?.solutionPath ?? null),
                };
            }
        });
        const nativeTerminate = worker.terminate.bind(worker);
        worker.terminate = () => {
            record.terminations += 1;
            return nativeTerminate();
        };
        globalThis.__p703.workers.push(record);
        return worker;
    };
    globalThis.Worker.prototype = NativeWorker.prototype;
    globalThis.__p703.begin = runId => {
        const intervalGaps = [];
        const frameGaps = [];
        let previousInterval = performance.now();
        let previousFrame = null;
        let running = true;
        const interval = setInterval(() => {
            const now = performance.now();
            intervalGaps.push(now - previousInterval);
            previousInterval = now;
        }, 10);
        const frame = now => {
            if (!running) return;
            if (previousFrame != null) frameGaps.push(now - previousFrame);
            previousFrame = now;
            requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);
        globalThis.__p703.active = {
            runId,
            startedAt: performance.now(),
            firstStatusMs: null,
            workerResultMs: null,
            result: null,
            finish() {
                running = false;
                clearInterval(interval);
                return {
                    firstStatusMs: this.firstStatusMs,
                    workerResultMs: this.workerResultMs,
                    result: this.result,
                    intervalTicks: intervalGaps.length,
                    maxTimerGapMs: intervalGaps.length ? Math.max(...intervalGaps) : null,
                    frameTicks: frameGaps.length,
                    maxFrameGapMs: frameGaps.length ? Math.max(...frameGaps) : null,
                };
            },
        };
        return globalThis.__p703.active.startedAt;
    };
    return true;
})()`;

async function runProfile({ browser, profileIndex, options, url }) {
    const profileDirectory = await mkdtemp(path.join(os.tmpdir(), `solver-p7-03-${profileIndex}-`));
    let browserProcess;
    let client;
    let memoryClient;
    const workerSessions = new Map();
    let activeMemoryRecord = null;
    let sampler;
    try {
        browserProcess = spawn(browser, [
            '--headless=new',
            '--disable-gpu',
            '--no-first-run',
            '--disable-background-networking',
            '--enable-precise-memory-info',
            `--user-data-dir=${profileDirectory}`,
            '--remote-debugging-port=0',
            url,
        ], { stdio: 'ignore' });
        const port = await waitForDebugPort(profileDirectory);
        const version = await fetch(`http://127.0.0.1:${port}/json/version`).then(response => response.json());
        const page = await waitForPage(port, url);
        client = await connectToTarget(page.webSocketDebuggerUrl);
        memoryClient = await connectToTarget(version.webSocketDebuggerUrl);
        await client.call('Performance.enable');
        memoryClient.on('Target.targetCreated', params => {
            if (process.env.P703_DEBUG_TARGETS) {
                process.stdout.write(`targetCreated:${params.targetInfo?.type}:${params.targetInfo?.url}\n`);
            }
        });
        memoryClient.on('Target.attachedToTarget', (params, outerSessionId) => {
            if (process.env.P703_DEBUG_TARGETS) {
                process.stdout.write(`attachedToTarget:${params.targetInfo?.type}:${params.targetInfo?.url}\n`);
            }
            if (params.targetInfo?.type !== 'worker') return;
            const record = {
                sessionId: params.sessionId,
                outerSessionId,
                memory: activeMemoryRecord,
                samplePending: false,
            };
            workerSessions.set(params.sessionId, record);
        });
        memoryClient.on('Target.detachedFromTarget', params => workerSessions.delete(params.sessionId));
        await memoryClient.call('Target.setDiscoverTargets', { discover: true });
        await memoryClient.call('Target.autoAttachRelated', {
            targetId: page.id,
            waitForDebuggerOnStart: false,
        });
        sampler = setInterval(() => {
            for (const record of workerSessions.values()) {
                if (record.samplePending || !record.memory) continue;
                record.samplePending = true;
                memoryClient.call('Runtime.getHeapUsage', {}, record.sessionId).then(metrics => {
                    if (process.env.P703_DEBUG_TARGETS && record.memory.workerHeapSamples === 0) {
                        process.stdout.write(`workerHeapUsage:${JSON.stringify(metrics)}\n`);
                    }
                    const used = metrics.usedSize ?? null;
                    const total = metrics.totalSize ?? null;
                    if (used != null) {
                        record.memory.workerHeapSamples += 1;
                        record.memory.workerPeakHeapUsedBytes = Math.max(
                            record.memory.workerPeakHeapUsedBytes ?? 0,
                            used,
                        );
                        record.memory.workerPeakHeapTotalBytes = Math.max(
                            record.memory.workerPeakHeapTotalBytes ?? 0,
                            total ?? 0,
                        );
                    }
                }).catch(error => {
                    if (process.env.P703_DEBUG_TARGETS) process.stdout.write(`workerMetricsError:${error.message}\n`);
                }).finally(() => { record.samplePending = false; });
            }
        }, 5);

        await waitForValue(
            client,
            "document.querySelectorAll('#starting-shapes .shape-item').length",
            value => value === 4,
            'the production UI to initialize',
            15000,
        );
        await client.evaluate(`(() => {
            const language = document.getElementById('lang-preference');
            language.value = 'en';
            language.dispatchEvent(new Event('change'));
        })()`);
        assert.equal(await client.evaluate(instrumentationExpression), true);
        const records = [];

        for (const workload of workloads) {
            const configured = await client.evaluate(configureExpression(workload));
            assert.deepEqual(configured, {
                targets: 1,
                starts: workload.starts.length,
                operations: workload.operations.length,
            }, `${workload.id}: UI setup failed`);
            const expectedSignature = { pathSha256: null };
            const totalRuns = options.warmups + options.runs;
            for (let runIndex = 0; runIndex < totalRuns; runIndex += 1) {
                const measured = runIndex >= options.warmups;
                const runId = `${profileIndex}:${workload.id}:${runIndex}`;
                const pageBefore = await collectPageMemory(client);
                const memory = {
                    workerHeapSamples: 0,
                    workerPeakHeapUsedBytes: null,
                    workerPeakHeapTotalBytes: null,
                };
                activeMemoryRecord = memory;
                const started = await client.evaluate(`globalThis.__p703.begin(${JSON.stringify(runId)})`);
                assert.equal(typeof started, 'number');
                const button = await client.evaluate(`(() => {
                    const button = document.querySelector('#panel-solver .btn-primary');
                    button.click();
                    return button.textContent;
                })()`);
                assert.equal(button, 'Cancel', `${runId}: solve did not start`);
                const ui = await waitForValue(
                    client,
                    `(() => ({
                        button: document.querySelector('#panel-solver .btn-primary')?.textContent,
                        tone: document.getElementById('status-dot')?.className,
                        now: performance.now(),
                        startedAt: globalThis.__p703.active?.startedAt,
                        hasResult: globalThis.__p703.active?.result != null,
                    }))()`,
                    value => value.button === 'Solve' && /done/.test(value.tone) && value.hasResult,
                    runId,
                );
                await delay(20);
                const observation = await client.evaluate('globalThis.__p703.active.finish()');
                activeMemoryRecord = null;
                const pageAfter = await collectPageMemory(client);
                const result = observation.result;
                assert.ok(result, `${runId}: no Worker result observed`);
                const pathSha256 = sha256(result.path);
                if (expectedSignature.pathSha256 == null) expectedSignature.pathSha256 = pathSha256;
                assert.equal(pathSha256, expectedSignature.pathSha256, `${runId}: path changed`);
                for (const [key, expected] of Object.entries(workload.expected)) {
                    assert.equal(result[key], expected, `${runId}: unexpected ${key}`);
                }
                const record = {
                    profile: profileIndex,
                    workload: workload.id,
                    run: runIndex - options.warmups,
                    measured,
                    workerResultMs: observation.workerResultMs,
                    uiSettledMs: ui.now - ui.startedAt,
                    firstStatusMs: observation.firstStatusMs,
                    intervalTicks: observation.intervalTicks,
                    maxTimerGapMs: observation.maxTimerGapMs,
                    frameTicks: observation.frameTicks,
                    maxFrameGapMs: observation.maxFrameGapMs,
                    pageBefore,
                    pageAfter,
                    ...memory,
                    result: { ...result, path: undefined, pathSha256 },
                };
                if (measured) records.push(record);
            }
        }
        return { profile: profileIndex, browserVersion: version.Browser, userAgent: version['User-Agent'], records };
    } finally {
        if (sampler) clearInterval(sampler);
        memoryClient?.close();
        client?.close();
        if (browserProcess && browserProcess.exitCode === null) {
            browserProcess.kill();
            await Promise.race([once(browserProcess, 'exit'), delay(2000)]);
        }
        await rm(profileDirectory, { recursive: true, force: true });
    }
}

function buildSummary(profileResults, options) {
    const records = profileResults.flatMap(result => result.records);
    const workloadsSummary = {};
    const gateFailures = [];
    for (const workload of workloads) {
        const selected = records.filter(record => record.workload === workload.id);
        const byProfile = [];
        for (let profile = 1; profile <= options.profiles; profile += 1) {
            const rows = selected.filter(record => record.profile === profile);
            const half = Math.floor(rows.length / 2);
            const firstMedian = median(rows.slice(0, half).map(row => row.workerResultMs));
            const secondMedian = median(rows.slice(half).map(row => row.workerResultMs));
            const pageHeapDeltaBytes = rows.at(-1).pageAfter.jsHeapUsedBytes - rows[0].pageAfter.jsHeapUsedBytes;
            const driftRatio = secondMedian / firstMedian;
            byProfile.push({ profile, firstMedian, secondMedian, driftRatio, pageHeapDeltaBytes });
            if (driftRatio > 2) gateFailures.push(`${workload.id}/profile-${profile}: wall drift ratio ${driftRatio}`);
            if (pageHeapDeltaBytes > 5 * 1024 * 1024) {
                gateFailures.push(`${workload.id}/profile-${profile}: page heap delta ${pageHeapDeltaBytes}`);
            }
        }
        const heapCovered = selected.filter(row => row.workerHeapSamples > 0).length;
        workloadsSummary[workload.id] = {
            measuredRuns: selected.length,
            workerResultMs: describe(selected.map(row => row.workerResultMs)),
            uiSettledMs: describe(selected.map(row => row.uiSettledMs)),
            maxTimerGapMs: describe(selected.map(row => row.maxTimerGapMs ?? 0)),
            maxFrameGapMs: describe(selected.map(row => row.maxFrameGapMs ?? 0)),
            pageAfterGcHeapUsedBytes: describe(selected.map(row => row.pageAfter.jsHeapUsedBytes)),
            workerPeakHeapUsedBytes: heapCovered
                ? describe(selected.filter(row => row.workerHeapSamples > 0).map(row => row.workerPeakHeapUsedBytes))
                : null,
            workerHeapCoverage: heapCovered / selected.length,
            profiles: byProfile,
            pathSha256: [...new Set(selected.map(row => row.result.pathSha256))],
        };
        if (selected.some(row => row.intervalTicks < 1)) gateFailures.push(`${workload.id}: missing heartbeat tick`);
        if (selected.some(row => (row.maxTimerGapMs ?? Infinity) > 100)) gateFailures.push(`${workload.id}: timer gap above 100 ms`);
        if (workload.id === 'bounded-search-w1' && heapCovered / selected.length < 0.8) {
            gateFailures.push(`bounded-search-w1: Worker heap coverage ${heapCovered}/${selected.length}`);
        }
    }
    const expectedRuns = options.profiles * options.runs * workloads.length;
    if (records.length !== expectedRuns) gateFailures.push(`measured run count ${records.length}/${expectedRuns}`);
    return {
        measuredRuns: records.length,
        expectedRuns,
        workloads: workloadsSummary,
        gateFailures,
        verdict: gateFailures.length ? 'NEEDS-FIX' : 'PASS',
    };
}

const options = parseArguments(process.argv.slice(2));
const browser = await findBrowser();
const server = await startServer();
try {
    const address = server.address();
    const url = `http://127.0.0.1:${address.port}/en/`;
    const profileResults = [];
    for (let profileIndex = 1; profileIndex <= options.profiles; profileIndex += 1) {
        process.stdout.write(`${options.task} profile ${profileIndex}/${options.profiles}\n`);
        profileResults.push(await runProfile({ browser, profileIndex, options, url }));
    }
    const summary = buildSummary(profileResults, options);
    const artifact = {
        schemaVersion: 1,
        task: options.task,
        recordedAt: currentShanghaiDate(),
        timezone: 'Asia/Shanghai',
        protocol: {
            freshProfiles: options.profiles,
            warmupsPerProfileWorkload: options.warmups,
            measuredRunsPerProfileWorkload: options.runs,
            workloads: workloads.map(({ expected, ...workload }) => ({ ...workload, expected })),
            timerHeartbeatMs: 10,
            workerHeapSampleIntervalMs: 5,
        },
        environment: {
            platform: process.platform,
            architecture: process.arch,
            node: process.version,
            browserExecutable: browser,
            browserVersions: [...new Set(profileResults.map(result => result.browserVersion))],
            userAgents: [...new Set(profileResults.map(result => result.userAgent))],
        },
        identities: {
            solverSha256: await fileSha256(path.join(ROOT, 'shapeSolver.js')),
            solverWebSha256: await fileSha256(path.join(ROOT, 'shapeSolver_web.js')),
            harnessSha256: await fileSha256(import.meta.filename),
        },
        summary,
        profiles: profileResults,
    };
    await mkdir(path.dirname(options.output), { recursive: true });
    await writeFile(options.output, `${JSON.stringify(artifact, null, 2)}\n`);
    process.stdout.write(`${summary.verdict}: ${JSON.stringify(summary)}\n`);
    if (summary.verdict !== 'PASS') process.exitCode = 1;
} finally {
    await new Promise(resolve => server.close(resolve));
}
