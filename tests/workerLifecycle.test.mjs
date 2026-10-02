import assert from 'node:assert/strict';
import test from 'node:test';

import { startWorkerTask } from '../workerLifecycle.js';

class FakeWorker {
    constructor({ postError } = {}) {
        this.onmessage = null;
        this.onerror = null;
        this.onmessageerror = null;
        this.postError = postError;
        this.posted = [];
        this.terminateCount = 0;
    }

    postMessage(message) {
        if (this.postError) throw this.postError;
        this.posted.push(message);
    }

    terminate() {
        this.terminateCount += 1;
    }
}

test('worker task terminates and detaches before delivering one result', () => {
    const worker = new FakeWorker();
    const events = [];
    let task;

    task = startWorkerTask({
        workerFactory: () => worker,
        payload: { action: 'solve' },
        now: () => 42,
        onResult(result, startTime) {
            events.push({ result, startTime, active: task.active, terminateCount: worker.terminateCount });
        },
    });

    const staleHandler = worker.onmessage;
    staleHandler({ data: { type: 'result', result: 'first' } });
    staleHandler({ data: { type: 'result', result: 'late' } });

    assert.deepEqual(worker.posted, [{ action: 'solve' }]);
    assert.deepEqual(events, [{ result: 'first', startTime: 42, active: false, terminateCount: 1 }]);
    assert.equal(worker.onmessage, null);
    assert.equal(worker.onerror, null);
    assert.equal(worker.onmessageerror, null);
    assert.equal(worker.terminateCount, 1);
});

test('result callback failures cannot prevent Worker cleanup', () => {
    const worker = new FakeWorker();
    const task = startWorkerTask({
        workerFactory: () => worker,
        payload: { action: 'solve' },
        onResult() {
            throw new Error('render failure');
        },
    });

    assert.throws(
        () => worker.onmessage({ data: { type: 'result', result: 'done' } }),
        /render failure/,
    );
    assert.equal(task.active, false);
    assert.equal(worker.terminateCount, 1);
    assert.equal(worker.onmessage, null);
});

test('terminate-based cancellation suppresses stale status, result, and error events', () => {
    const worker = new FakeWorker();
    const events = [];
    const task = startWorkerTask({
        workerFactory: () => worker,
        payload: { action: 'explore' },
        onStatus: () => events.push('status'),
        onResult: () => events.push('result'),
        onError: () => events.push('error'),
    });

    const staleMessage = worker.onmessage;
    const staleError = worker.onerror;
    assert.equal(task.cancel(), true);
    assert.equal(task.cancel(), false);
    staleMessage({ data: { type: 'status' } });
    staleMessage({ data: { type: 'result' } });
    staleMessage({ data: { type: 'error' } });
    staleError({ message: 'late error' });

    assert.deepEqual(events, []);
    assert.equal(task.active, false);
    assert.equal(worker.terminateCount, 1);
});

test('terminal Worker errors clean up once and a new task can complete', () => {
    const firstWorker = new FakeWorker();
    const secondWorker = new FakeWorker();
    const events = [];

    const first = startWorkerTask({
        workerFactory: () => firstWorker,
        payload: { action: 'explore' },
        onError: error => events.push(`error:${error.messageParams.message}`),
    });
    firstWorker.onmessage({
        data: { type: 'error', messageKey: 'status.errorMessage', messageParams: { message: 'bad pair' } },
    });

    const second = startWorkerTask({
        workerFactory: () => secondWorker,
        payload: { action: 'explore' },
        onResult: result => events.push(`result:${result}`),
    });
    secondWorker.onmessage({ data: { type: 'result', result: 'restarted' } });

    assert.deepEqual(events, ['error:bad pair', 'result:restarted']);
    assert.equal(first.active, false);
    assert.equal(second.active, false);
    assert.equal(firstWorker.terminateCount, 1);
    assert.equal(secondWorker.terminateCount, 1);
});

test('native, message, and synchronous Worker errors use the same one-shot cleanup path', async () => {
    const nativeWorker = new FakeWorker();
    const nativeErrors = [];
    startWorkerTask({
        workerFactory: () => nativeWorker,
        payload: { action: 'solve' },
        onError: error => nativeErrors.push(error.message),
    });
    let prevented = false;
    nativeWorker.onerror({ message: 'native failure', preventDefault: () => { prevented = true; } });

    const postWorker = new FakeWorker({ postError: new Error('clone failure') });
    const postErrors = [];
    const postTask = startWorkerTask({
        workerFactory: () => postWorker,
        payload: { action: 'solve' },
        onError: error => postErrors.push(error.message),
    });
    await Promise.resolve();

    assert.equal(prevented, true);
    assert.deepEqual(nativeErrors, ['native failure']);

    const messageWorker = new FakeWorker();
    const messageErrors = [];
    startWorkerTask({
        workerFactory: () => messageWorker,
        payload: { action: 'solve' },
        onError: error => messageErrors.push(error.message),
    });
    messageWorker.onmessageerror({ message: 'message failure' });

    assert.deepEqual(messageErrors, ['message failure']);
    assert.deepEqual(postErrors, ['clone failure']);
    assert.equal(nativeWorker.terminateCount, 1);
    assert.equal(messageWorker.terminateCount, 1);
    assert.equal(postWorker.terminateCount, 1);
    assert.equal(postTask.active, false);
});

test('Worker construction failures are reported after returning an inactive task', async () => {
    const errors = [];
    const task = startWorkerTask({
        workerFactory() {
            throw new Error('constructor failure');
        },
        payload: { action: 'solve' },
        onError: error => errors.push({ message: error.message, active: task.active }),
    });

    assert.equal(task.active, false);
    assert.equal(task.cancel(), false);
    await Promise.resolve();
    assert.deepEqual(errors, [{ message: 'constructor failure', active: false }]);
});
