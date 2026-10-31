import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

const repositoryRoot = path.resolve(import.meta.dirname, '..', '..');
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
]);

async function findBrowser() {
    for (const candidate of browserCandidates) {
        try {
            if ((await stat(candidate)).isFile()) return candidate;
        } catch {
            // Try the next known location.
        }
    }
    return null;
}

function startServer() {
    const server = http.createServer(async (request, response) => {
        try {
            const requestPath = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
            const relativePath = requestPath.replace(/^\/+/, '') + (requestPath.endsWith('/') ? 'index.html' : '');
            const filePath = path.resolve(repositoryRoot, relativePath);
            const rootPrefix = `${repositoryRoot}${path.sep}`;
            if (filePath !== repositoryRoot && !filePath.startsWith(rootPrefix)) {
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
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
        try {
            const [port] = (await readFile(portFile, 'utf8')).trim().split(/\r?\n/);
            if (port) return Number(port);
        } catch {
            // Chrome has not created the port file yet.
        }
        await delay(50);
    }
    throw new Error('Chrome did not expose a debugging port');
}

async function waitForPage(port, expectedUrl) {
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
        const targets = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json());
        const page = targets.find(target => target.type === 'page' && target.url === expectedUrl);
        if (page) return page;
        await delay(50);
    }
    throw new Error('Chrome did not open the Worker lifecycle harness');
}

function connectToPage(webSocketDebuggerUrl) {
    return new Promise((resolve, reject) => {
        const socket = new WebSocket(webSocketDebuggerUrl);
        const pending = new Map();
        let nextId = 1;

        socket.addEventListener('error', reject, { once: true });
        socket.addEventListener('message', ({ data }) => {
            const message = JSON.parse(data);
            const callbacks = pending.get(message.id);
            if (!callbacks) return;
            pending.delete(message.id);
            if (message.error) callbacks.reject(new Error(message.error.message));
            else callbacks.resolve(message.result);
        });
        socket.addEventListener('open', () => {
            const call = (method, params = {}) => new Promise((resolveCommand, rejectCommand) => {
                const id = nextId++;
                pending.set(id, { resolve: resolveCommand, reject: rejectCommand });
                socket.send(JSON.stringify({ id, method, params }));
            });
            resolve({
                close: () => socket.close(),
                call,
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

async function waitForValue(client, expression, predicate, label, timeoutMs = 10000) {
    const deadline = Date.now() + timeoutMs;
    let value;
    while (Date.now() < deadline) {
        value = await client.evaluate(expression);
        if (predicate(value)) return value;
        await delay(50);
    }
    throw new Error(`Timed out waiting for ${label}; last value was ${JSON.stringify(value)}`);
}

const browser = await findBrowser();
if (!browser) {
    throw new Error('A supported Chrome/Chromium/Edge executable is required for Worker lifecycle verification');
}

const profileDirectory = await mkdtemp(path.join(os.tmpdir(), 'solver-worker-lifecycle-'));
const server = await startServer();
let browserProcess;
let pageClient;

try {
    const address = server.address();
    const url = `http://127.0.0.1:${address.port}/tests/browser/workerLifecycleHarness.html`;
    browserProcess = spawn(browser, [
        ...(process.env.SOLVER_BROWSER_HEADFUL === '1' ? [] : ['--headless=new']),
        '--disable-gpu',
        '--no-first-run',
        '--disable-background-networking',
        `--user-data-dir=${profileDirectory}`,
        '--remote-debugging-port=0',
        url,
    ], { stdio: 'ignore' });

    const port = await waitForDebugPort(profileDirectory);
    const page = await waitForPage(port, url);
    pageClient = await connectToPage(page.webSocketDebuggerUrl);

    const deadline = Date.now() + 10000;
    let status;
    while (Date.now() < deadline) {
        status = await pageClient.evaluate("document.getElementById('result')?.dataset.status");
        if (status === 'passed' || status === 'failed') break;
        await delay(50);
    }
    const details = await pageClient.evaluate("document.getElementById('result')?.textContent");
    assert.equal(status, 'passed', `Browser Worker checks failed or timed out: ${details}`);

    const uiUrl = `http://127.0.0.1:${address.port}/en/`;
    await pageClient.call('Page.navigate', { url: uiUrl });
    await waitForValue(
        pageClient,
        "document.querySelectorAll('#starting-shapes .shape-item').length",
        value => value === 4,
        'the production UI to initialize',
        15000,
    );

    const configured = await pageClient.evaluate(`(() => {
        const language = document.getElementById('lang-preference');
        language.value = 'en';
        language.dispatchEvent(new Event('change'));
        const targetInput = document.getElementById('target-input');
        targetInput.value = 'CuRuSuWu';
        document.getElementById('add-target-shape-btn').click();
        for (const operation of document.querySelectorAll('.operation-item')) {
            operation.classList.add('enabled');
        }
        document.getElementById('max-states-per-level').value = '5000';
        return document.querySelectorAll('#target-shapes .shape-item').length;
    })()`);
    assert.equal(configured, 1, 'production UI target setup failed');

    const solveStarted = await pageClient.evaluate(`(() => {
        const button = document.querySelector('#panel-solver .btn-primary');
        button.click();
        return button.textContent;
    })()`);
    assert.equal(solveStarted, 'Cancel', 'production solve did not enter its active state');
    const solveCancelled = await pageClient.evaluate(`(() => {
        const button = document.querySelector('#panel-solver .btn-primary');
        button.click();
        return { button: button.textContent, status: document.getElementById('status-text').textContent };
    })()`);
    assert.deepEqual(solveCancelled, { button: 'Solve', status: 'Cancelled.' });

    const solveRestarted = await pageClient.evaluate(`(() => {
        document.querySelector('#target-shapes .shape-remove').click();
        const targetInput = document.getElementById('target-input');
        targetInput.value = 'CuCuCuCu';
        document.getElementById('add-target-shape-btn').click();
        const button = document.querySelector('#panel-solver .btn-primary');
        button.click();
        return button.textContent;
    })()`);
    assert.equal(solveRestarted, 'Cancel');
    await waitForValue(
        pageClient,
        "document.getElementById('status-dot').className",
        value => /done/.test(value),
        'solve restart result',
    );
    assert.equal(
        await pageClient.evaluate("document.querySelector('#panel-solver .btn-primary').textContent"),
        'Solve',
    );

    const exploreCancelled = await pageClient.evaluate(`(() => {
        document.querySelector('.mode-tab[data-mode="explorer"]').click();
        document.getElementById('depth-limit-input').value = '999';
        const button = document.querySelector('#panel-explorer .btn-primary');
        button.click();
        const started = button.textContent;
        button.click();
        return {
            started,
            stopped: button.textContent,
            status: document.getElementById('status-text').textContent,
        };
    })()`);
    assert.deepEqual(exploreCancelled, { started: 'Cancel', stopped: 'Explore', status: 'Cancelled.' });

    await pageClient.evaluate(`(() => {
        for (const element of document.querySelectorAll('.operation-item')) element.classList.remove('enabled');
    })()`);
    const exploreRestartStart = await pageClient.evaluate(`(() => {
        document.getElementById('depth-limit-input').value = '1';
        const button = document.querySelector('#panel-explorer .btn-primary');
        button.click();
        return button.textContent;
    })()`);
    assert.equal(exploreRestartStart, 'Cancel');
    await waitForValue(
        pageClient,
        "document.querySelector('#panel-explorer .btn-primary')?.textContent",
        value => value === 'Explore',
        'explore restart result',
    );
    assert.match(
        await pageClient.evaluate("document.getElementById('status-dot').className"),
        /done/,
        'explore restart did not reach a completed state',
    );

    const solveErrorStarted = await pageClient.evaluate(`(() => {
        document.querySelector('.mode-tab[data-mode="solver"]').click();
        const NativeWorker = globalThis.Worker;
        globalThis.Worker = function TestableWorker(url, options) {
            const worker = new NativeWorker(url, options);
            const nativePostMessage = worker.postMessage.bind(worker);
            worker.postMessage = (message, transfer) => {
                if (globalThis.__failNextSolveWorker && message?.action === 'solve') {
                    globalThis.__failNextSolveWorker = false;
                    message = { action: 'solve', data: {} };
                }
                if (globalThis.__failNextExplorerWorker && message?.action === 'explore') {
                    globalThis.__failNextExplorerWorker = false;
                    message = { ...message, data: { ...message.data, depthLimit: -1 } };
                }
                return transfer === undefined
                    ? nativePostMessage(message)
                    : nativePostMessage(message, transfer);
            };
            return worker;
        };
        globalThis.Worker.prototype = NativeWorker.prototype;
        globalThis.__failNextSolveWorker = true;
        const button = document.querySelector('#panel-solver .btn-primary');
        button.click();
        return { button: button.textContent, intercepted: !globalThis.__failNextSolveWorker };
    })()`);
    assert.deepEqual(
        solveErrorStarted,
        { button: 'Cancel', intercepted: true },
        'solve error fixture did not start through the injected Worker payload',
    );
    await waitForValue(
        pageClient,
        "document.getElementById('status-dot').className",
        value => /error/.test(value),
        'solve error cleanup',
    );
    assert.equal(
        await pageClient.evaluate("document.querySelector('#panel-solver .btn-primary').textContent"),
        'Solve',
        'solve error did not restore the action button',
    );
    await pageClient.evaluate("document.querySelector('#panel-solver .btn-primary').click()");
    await waitForValue(
        pageClient,
        "document.getElementById('status-dot').className",
        value => /done/.test(value),
        'solve restart after error',
    );

    const explorerErrorStarted = await pageClient.evaluate(`(() => {
        globalThis.__failNextExplorerWorker = true;
        const button = document.querySelector('#panel-explorer .btn-primary');
        button.click();
        return { button: button.textContent, intercepted: !globalThis.__failNextExplorerWorker };
    })()`);
    assert.deepEqual(
        explorerErrorStarted,
        { button: 'Cancel', intercepted: true },
        'Explorer error fixture did not start through the injected Worker payload',
    );
    await waitForValue(
        pageClient,
        "document.getElementById('status-dot').className",
        value => /error/.test(value),
        'Explorer error cleanup',
    );
    assert.equal(
        await pageClient.evaluate("document.querySelector('#panel-explorer .btn-primary').textContent"),
        'Explore',
        'Explorer error did not restore the action button',
    );

    const exploreRestarted = await pageClient.evaluate(`(() => {
        for (const operation of document.querySelectorAll('.operation-item')) {
            operation.classList.remove('enabled');
        }
        const button = document.querySelector('#panel-explorer .btn-primary');
        button.click();
        return button.textContent;
    })()`);
    assert.equal(exploreRestarted, 'Cancel');
    await waitForValue(
        pageClient,
        "document.querySelector('#panel-explorer .btn-primary')?.textContent",
        value => value === 'Explore',
        'explore restart after error',
    );
    assert.match(
        await pageClient.evaluate("document.getElementById('status-dot').className"),
        /done/,
        'explore restart after error did not complete',
    );

    // Product acceptance: drive a nontrivial constructive solve through the
    // real webpage controls. Observe the production Worker response without
    // replacing its payload or Solver behavior, then prove UI cleanup by
    // completing the same solve a second time.
    await pageClient.call('Page.navigate', { url: uiUrl });
    await waitForValue(
        pageClient,
        "document.querySelectorAll('#starting-shapes .shape-item').length",
        value => value === 4,
        'the production UI to reinitialize for product acceptance',
        15000,
    );

    const productConfigured = await pageClient.evaluate(`(() => {
        const NativeWorker = globalThis.Worker;
        globalThis.__productUiResults = [];
        globalThis.__productUiStart = 0;
        globalThis.Worker = function ProductObservedWorker(url, options) {
            const worker = new NativeWorker(url, options);
            worker.addEventListener('message', ({ data }) => {
                if (data?.type !== 'result' || data.result?.solverRoute !== 'constructive-hybrid') return;
                globalThis.__productUiResults.push({
                    route: data.result.solverRoute,
                    stage: data.result.interiorCrystalStage ?? null,
                    outcome: data.result.outcome,
                    depth: data.result.depth,
                    pathLength: data.result.solutionPath?.length ?? 0,
                    pathSignature: JSON.stringify(data.result.solutionPath),
                    wallTimeMs: performance.now() - globalThis.__productUiStart,
                });
            });
            return worker;
        };
        globalThis.Worker.prototype = NativeWorker.prototype;

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
        addShape('target-input', 'add-target-shape-btn', 'RrcrRrRr:RgcrRgRg:--cr----');
        for (let index = 0; index < 4; index += 1) {
            addShape('starting-input', 'add-starting-shape-btn', 'RuRuRuRu');
        }
        for (const operation of document.querySelectorAll('.operation-item')) {
            operation.classList.add('enabled');
        }
        document.getElementById('max-layers').value = '4';
        document.getElementById('max-states-per-level').value = '3000';
        document.getElementById('prevent-waste').checked = false;
        document.getElementById('orientation-sensitive').checked = false;
        document.getElementById('allow-splitting').checked = false;
        document.getElementById('clean-painting').checked = true;

        return {
            targets: document.querySelectorAll('#target-shapes .shape-item').length,
            starts: document.querySelectorAll('#starting-shapes .shape-item').length,
            operations: document.querySelectorAll('.operation-item.enabled').length,
            cleanPainting: document.getElementById('clean-painting').checked,
        };
    })()`);
    assert.deepEqual(productConfigured, {
        targets: 1,
        starts: 4,
        operations: 10,
        cleanPainting: true,
    }, 'real-page constructive input setup failed');

    const runProductUiSolve = async (expectedResultCount, label) => {
        const started = await pageClient.evaluate(`(() => {
            globalThis.__productUiStart = performance.now();
            const button = document.querySelector('#panel-solver .btn-primary');
            button.click();
            return button.textContent;
        })()`);
        assert.equal(started, 'Cancel', `${label} did not enter the active UI state`);
        await waitForValue(
            pageClient,
            `(() => ({
                results: globalThis.__productUiResults?.length ?? 0,
                button: document.querySelector('#panel-solver .btn-primary')?.textContent,
                tone: document.getElementById('status-dot')?.className,
            }))()`,
            value => value.results === expectedResultCount
                && value.button === 'Solve'
                && /done/.test(value.tone),
            label,
            20000,
        );
        return pageClient.evaluate(`(() => ({
            result: globalThis.__productUiResults[${expectedResultCount - 1}],
            button: document.querySelector('#panel-solver .btn-primary')?.textContent,
            tone: document.getElementById('status-dot')?.className,
            status: document.getElementById('status-text')?.textContent,
            placeholderDisplay: document.getElementById('placeholder')?.style.display,
            graphChildren: document.getElementById('graph-container')?.childElementCount ?? 0,
        }))()`);
    };

    const firstProductSolve = await runProductUiSolve(1, 'first real-page constructive solve');
    const secondProductSolve = await runProductUiSolve(2, 'second real-page constructive solve');
    for (const [label, observation] of [
        ['first', firstProductSolve],
        ['second', secondProductSolve],
    ]) {
        assert.equal(observation.result.route, 'constructive-hybrid', `${label} solve missed production route`);
        assert.equal(
            observation.result.stage,
            'full-height-column-extraction',
            `${label} solve missed the interior-Crystal stage`,
        );
        assert.equal(observation.result.outcome, 'solved', `${label} solve did not report solved`);
        assert.ok(observation.result.pathLength > 0, `${label} solve returned an empty path`);
        assert.equal(observation.button, 'Solve', `${label} solve did not clean up the action button`);
        assert.match(observation.tone, /done/, `${label} solve did not leave completed status`);
        assert.match(observation.status, /Solved in/, `${label} solve did not render the solved status`);
        assert.equal(observation.placeholderDisplay, 'none', `${label} solve did not reveal the graph`);
        assert.ok(observation.graphChildren > 0, `${label} solve did not render graph content`);
    }
    assert.equal(
        secondProductSolve.result.pathSignature,
        firstProductSolve.result.pathSignature,
        'consecutive real-page solves returned different operation paths',
    );

    const productSummary = {
        route: firstProductSolve.result.route,
        stage: firstProductSolve.result.stage,
        depth: firstProductSolve.result.depth,
        pathLength: firstProductSolve.result.pathLength,
        wallTimeMs: [
            Number(firstProductSolve.result.wallTimeMs.toFixed(2)),
            Number(secondProductSolve.result.wallTimeMs.toFixed(2)),
        ],
        consecutivePathStable: true,
    };

    // P7-02 product lifecycle acceptance. This sequence keeps the real page,
    // native module Worker, and production Solver payloads intact. The Worker
    // wrapper records lifecycle evidence only; it never changes a request or
    // a response. A captured, already-detached callback is invoked after each
    // terminal transition to prove that stale delivery cannot mutate the UI.
    await pageClient.call('Page.navigate', { url: uiUrl });
    await waitForValue(
        pageClient,
        "document.querySelectorAll('#starting-shapes .shape-item').length",
        value => value === 4,
        'the production UI to reinitialize for lifecycle acceptance',
        15000,
    );

    const lifecycleConfigured = await pageClient.evaluate(`(() => {
        const NativeWorker = globalThis.Worker;
        globalThis.__p702 = { workers: [], timeline: [] };
        globalThis.Worker = function LifecycleObservedWorker(url, options) {
            const worker = new NativeWorker(url, options);
            const record = {
                messages: [],
                terminations: 0,
                handlersDetachedAtTermination: [],
            };
            worker.addEventListener('message', ({ data }) => {
                record.messages.push({
                    type: data?.type ?? null,
                    messageKey: data?.messageKey ?? null,
                    status: data?.status ?? null,
                    outcome: data?.result?.outcome ?? null,
                    complete: data?.result?.complete ?? null,
                    limitReason: data?.result?.limitReason ?? null,
                    invalidAttempts: data?.result?.invalidAttempts ?? null,
                    shapeCount: data?.result?.shapes?.length ?? null,
                    opCount: data?.result?.ops?.length ?? null,
                    depth: data?.result?.depth ?? null,
                    pathSignature: data?.result?.solutionPath
                        ? JSON.stringify(data.result.solutionPath)
                        : null,
                });
            });
            const nativeTerminate = worker.terminate.bind(worker);
            worker.terminate = () => {
                record.terminations += 1;
                record.handlersDetachedAtTermination.push(
                    worker.onmessage === null
                    && worker.onerror === null
                    && worker.onmessageerror === null,
                );
                return nativeTerminate();
            };
            globalThis.__p702.workers.push({ worker, record });
            return worker;
        };
        globalThis.Worker.prototype = NativeWorker.prototype;

        while (document.querySelector('#target-shapes .shape-remove')) {
            document.querySelector('#target-shapes .shape-remove').click();
        }
        const targetInput = document.getElementById('target-input');
        targetInput.value = 'CuRuSuWu';
        document.getElementById('add-target-shape-btn').click();
        const enabled = new Set(['Half Destroyer', 'Cutter', 'Swapper', 'Stacker']);
        for (const operation of document.querySelectorAll('.operation-item')) {
            operation.classList.toggle('enabled', enabled.has(operation.dataset.operation));
        }
        document.getElementById('max-layers').value = '4';
        document.getElementById('max-states-per-level').value = '1000';
        document.getElementById('prevent-waste').checked = false;
        document.getElementById('orientation-sensitive').checked = false;
        document.getElementById('allow-splitting').checked = false;
        document.getElementById('clean-painting').checked = false;

        return {
            targets: document.querySelectorAll('#target-shapes .shape-item').length,
            starts: document.querySelectorAll('#starting-shapes .shape-item').length,
            operations: document.querySelectorAll('.operation-item.enabled').length,
        };
    })()`);
    assert.deepEqual(lifecycleConfigured, { targets: 1, starts: 4, operations: 4 });

    const progressRunStarted = await pageClient.evaluate(`(() => {
        const button = document.querySelector('#panel-solver .btn-primary');
        button.click();
        const entry = globalThis.__p702.workers.at(-1);
        entry.staleMessage = entry.worker.onmessage;
        globalThis.__p702.timeline.push('solve-started');
        return button.textContent;
    })()`);
    assert.equal(progressRunStarted, 'Cancel', 'progress/cancel run did not start');

    const visibleProgress = await waitForValue(
        pageClient,
        `(() => ({
            text: document.getElementById('status-text')?.textContent ?? '',
            tone: document.getElementById('status-dot')?.className ?? '',
            statusMessages: globalThis.__p702.workers.at(-1)?.record.messages
                .filter(message => message.type === 'status').length ?? 0,
        }))()`,
        value => /^Solving at depth /.test(value.text)
            && /running/.test(value.tone)
            && value.statusMessages > 0,
        'visible production progress before cancellation',
        15000,
    );

    const cancelledState = await pageClient.evaluate(`(() => {
        const button = document.querySelector('#panel-solver .btn-primary');
        button.click();
        const entry = globalThis.__p702.workers.at(-1);
        const afterCancel = {
            button: button.textContent,
            status: document.getElementById('status-text')?.textContent,
            tone: document.getElementById('status-dot')?.className,
            terminations: entry.record.terminations,
            detached: entry.record.handlersDetachedAtTermination.at(-1),
        };
        entry.staleMessage?.({
            data: { type: 'status', message: 'STALE SOLVE STATUS', status: 'error' },
        });
        globalThis.__p702.timeline.push('solve-cancelled-stale-injected');
        return afterCancel;
    })()`);
    assert.deepEqual(cancelledState, {
        button: 'Solve',
        status: 'Cancelled.',
        tone: 'status-dot idle',
        terminations: 1,
        detached: true,
    });
    await delay(250);
    assert.deepEqual(
        await pageClient.evaluate(`(() => ({
            button: document.querySelector('#panel-solver .btn-primary')?.textContent,
            status: document.getElementById('status-text')?.textContent,
            tone: document.getElementById('status-dot')?.className,
        }))()`),
        { button: 'Solve', status: 'Cancelled.', tone: 'status-dot idle' },
        'stale solve delivery changed the cancelled UI state',
    );

    await pageClient.evaluate(`(() => {
        for (const operation of document.querySelectorAll('.operation-item')) {
            operation.classList.add('enabled');
        }
        document.getElementById('max-states-per-level').value = '1000';
    })()`);

    const runBoundedUiSolve = async (label) => {
        const workerCount = await pageClient.evaluate('globalThis.__p702.workers.length');
        const started = await pageClient.evaluate(`(() => {
            const button = document.querySelector('#panel-solver .btn-primary');
            button.click();
            return button.textContent;
        })()`);
        assert.equal(started, 'Cancel', `${label} did not start`);
        await waitForValue(
            pageClient,
            `(() => ({
                workers: globalThis.__p702.workers.length,
                button: document.querySelector('#panel-solver .btn-primary')?.textContent,
                tone: document.getElementById('status-dot')?.className,
                result: globalThis.__p702.workers[${workerCount}]?.record.messages
                    .find(message => message.type === 'result') ?? null,
            }))()`,
            value => value.workers === workerCount + 1
                && value.button === 'Solve'
                && /done/.test(value.tone)
                && value.result?.outcome === 'solved',
            label,
            20000,
        );
        return pageClient.evaluate(`(() => ({
            result: globalThis.__p702.workers[${workerCount}].record.messages
                .find(message => message.type === 'result'),
            terminations: globalThis.__p702.workers[${workerCount}].record.terminations,
            detached: globalThis.__p702.workers[${workerCount}]
                .record.handlersDetachedAtTermination.at(-1),
            status: document.getElementById('status-text')?.textContent,
            graphChildren: document.getElementById('graph-container')?.childElementCount ?? 0,
        }))()`);
    };

    const firstLifecycleSolve = await runBoundedUiSolve('first completed bounded solve after cancellation');
    const secondLifecycleSolve = await runBoundedUiSolve('consecutive completed bounded solve');
    for (const observation of [firstLifecycleSolve, secondLifecycleSolve]) {
        assert.equal(observation.terminations, 1, 'completed solve Worker was not terminated exactly once');
        assert.equal(observation.detached, true, 'completed solve handlers were not detached before termination');
        assert.match(observation.status, /Solved in/, 'completed solve status was not rendered');
        assert.ok(observation.graphChildren > 0, 'completed solve graph was not rendered');
    }
    assert.equal(
        secondLifecycleSolve.result.pathSignature,
        firstLifecycleSolve.result.pathSignature,
        'consecutive bounded solves returned different operation paths',
    );

    const mixedPartExplorerStarted = await pageClient.evaluate(`(() => {
        document.querySelector('.mode-tab[data-mode="explorer"]').click();
        for (const operation of document.querySelectorAll('.operation-item')) {
            operation.classList.toggle('enabled', operation.dataset.operation === 'Swapper');
        }
        const input = document.getElementById('starting-input');
        input.value = 'HuHuHuHuHuHu';
        document.getElementById('add-starting-shape-btn').click();
        document.getElementById('depth-limit-input').value = '2';
        const button = document.querySelector('#panel-explorer .btn-primary');
        button.click();
        const entry = globalThis.__p702.workers.at(-1);
        entry.staleMessage = entry.worker.onmessage;
        globalThis.__p702.timeline.push('mixed-part-explorer-started');
        return button.textContent;
    })()`);
    assert.equal(mixedPartExplorerStarted, 'Cancel', 'mixed-part Explorer fixture did not start');
    const mixedPartExplorer = await waitForValue(
        pageClient,
        `(() => ({
            button: document.querySelector('#panel-explorer .btn-primary')?.textContent,
            status: document.getElementById('status-text')?.textContent,
            tone: document.getElementById('status-dot')?.className,
            terminations: globalThis.__p702.workers.at(-1)?.record.terminations,
            detached: globalThis.__p702.workers.at(-1)?.record.handlersDetachedAtTermination.at(-1),
            result: globalThis.__p702.workers.at(-1)?.record.messages
                .find(message => message.type === 'result') ?? null,
        }))()`,
        value => value.button === 'Explore'
            && /done/.test(value.tone)
            && value.result?.outcome === 'complete'
            && value.terminations === 1,
        'mixed-part Explorer completion',
        10000,
    );
    assert.equal(mixedPartExplorer.detached, true, 'mixed-part Explorer handlers were not detached');
    assert.ok(mixedPartExplorer.result.invalidAttempts > 0, 'mixed-part invalid calls were not observed');
    assert.match(mixedPartExplorer.status, /^Exploration complete\./);

    const staleMixedPartSuppressed = await pageClient.evaluate(`(() => {
        const entry = globalThis.__p702.workers.at(-1);
        const before = {
            status: document.getElementById('status-text')?.textContent,
            tone: document.getElementById('status-dot')?.className,
        };
        entry.staleMessage?.({
            data: { type: 'status', message: 'STALE EXPLORER STATUS', status: 'running' },
        });
        return {
            before,
            after: {
                status: document.getElementById('status-text')?.textContent,
                tone: document.getElementById('status-dot')?.className,
            },
        };
    })()`);
    assert.deepEqual(staleMixedPartSuppressed.after, staleMixedPartSuppressed.before);

    const explorerRecoveryStarted = await pageClient.evaluate(`(() => {
        const sixPart = Array.from(document.querySelectorAll('#starting-shapes .shape-item'))
            .find(element => element.dataset.shapeCode === 'HuHuHuHuHuHu');
        sixPart?.querySelector('.shape-remove')?.click();
        for (const operation of document.querySelectorAll('.operation-item')) {
            operation.classList.remove('enabled');
        }
        document.getElementById('depth-limit-input').value = '1';
        const button = document.querySelector('#panel-explorer .btn-primary');
        button.click();
        return button.textContent;
    })()`);
    assert.equal(explorerRecoveryStarted, 'Cancel', 'Explorer recovery did not start');
    const explorerRecovery = await waitForValue(
        pageClient,
        `(() => ({
            button: document.querySelector('#panel-explorer .btn-primary')?.textContent,
            status: document.getElementById('status-text')?.textContent,
            tone: document.getElementById('status-dot')?.className,
            terminations: globalThis.__p702.workers.at(-1)?.record.terminations,
            detached: globalThis.__p702.workers.at(-1)?.record.handlersDetachedAtTermination.at(-1),
        }))()`,
        value => value.button === 'Explore'
            && /done/.test(value.tone)
            && value.terminations === 1,
        'Explorer recovery completion',
        10000,
    );
    assert.equal(explorerRecovery.detached, true, 'Explorer recovery handlers were not detached');
    assert.match(explorerRecovery.status, /^Exploration complete\./);

    const limitedExplorerStarted = await pageClient.evaluate(`(() => {
        for (const item of Array.from(document.querySelectorAll('#starting-shapes .shape-item'))) {
            if (item.dataset.shapeCode !== 'CuCuCuCu') item.querySelector('.shape-remove')?.click();
        }
        for (const operation of document.querySelectorAll('.operation-item')) {
            operation.classList.toggle('enabled', ['Painter', 'Stacker'].includes(operation.dataset.operation));
        }
        document.getElementById('depth-limit-input').value = '999';
        const button = document.querySelector('#panel-explorer .btn-primary');
        button.click();
        return button.textContent;
    })()`);
    assert.equal(limitedExplorerStarted, 'Cancel', 'bounded partial Explorer did not start');
    const limitedExplorer = await waitForValue(
        pageClient,
        `(() => ({
            button: document.querySelector('#panel-explorer .btn-primary')?.textContent,
            status: document.getElementById('status-text')?.textContent,
            tone: document.getElementById('status-dot')?.className,
            terminations: globalThis.__p702.workers.at(-1)?.record.terminations,
            detached: globalThis.__p702.workers.at(-1)?.record.handlersDetachedAtTermination.at(-1),
            result: globalThis.__p702.workers.at(-1)?.record.messages
                .find(message => message.type === 'result') ?? null,
            graphChildren: document.getElementById('graph-container')?.childElementCount ?? 0,
        }))()`,
        value => value.button === 'Explore'
            && value.result?.outcome === 'limit'
            && value.result?.limitReason === 'shapes'
            && value.terminations === 1,
        'bounded partial Explorer completion',
        20000,
    );
    assert.equal(limitedExplorer.detached, true, 'bounded partial Explorer handlers were not detached');
    assert.equal(limitedExplorer.result.complete, false);
    assert.equal(limitedExplorer.result.shapeCount, 128);
    assert.match(limitedExplorer.status, /^Exploration stopped at the shape limit\./);
    assert.match(limitedExplorer.tone, /idle/);
    assert.ok(limitedExplorer.graphChildren > 0, 'bounded partial Explorer graph was not rendered');

    const lifecycleSummary = {
        progressText: visibleProgress.text,
        progressStatusMessages: visibleProgress.statusMessages,
        cancellationClean: true,
        staleSolveSuppressed: true,
        consecutivePathStable: true,
        mixedPartInvalidAttempts: mixedPartExplorer.result.invalidAttempts,
        staleMixedPartSuppressed: true,
        explorerRecovered: true,
        limitedExplorer: {
            reason: limitedExplorer.result.limitReason,
            shapes: limitedExplorer.result.shapeCount,
            operations: limitedExplorer.result.opCount,
        },
        workersObserved: await pageClient.evaluate('globalThis.__p702.workers.length'),
    };

    console.log(`PASS: real browser Worker lifecycle and UI production-path checks completed with ${browser}; ${JSON.stringify({ productSummary, lifecycleSummary })}`);
} finally {
    pageClient?.close();
    if (browserProcess && browserProcess.exitCode === null) {
        browserProcess.kill();
        await Promise.race([once(browserProcess, 'exit'), delay(2000)]);
    }
    await new Promise(resolve => server.close(resolve));
    await rm(profileDirectory, { recursive: true, force: true });
}
