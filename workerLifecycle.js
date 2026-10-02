function errorMessage(error) {
    if (error && typeof error.message === 'string') return error.message;
    return String(error ?? 'Unknown Worker error');
}

export function startWorkerTask({
    workerFactory,
    payload,
    onStatus = () => {},
    onResult = () => {},
    onError = () => {},
    now = () => performance.now(),
}) {
    const startTime = now();
    let worker;
    try {
        worker = workerFactory();
    } catch (error) {
        const failedTask = {
            active: false,
            cancel: () => false,
        };
        queueMicrotask(() => onError({ message: errorMessage(error) }));
        return failedTask;
    }
    let active = true;

    const close = () => {
        if (!active) return false;
        active = false;
        worker.onmessage = null;
        worker.onerror = null;
        worker.onmessageerror = null;
        worker.terminate();
        return true;
    };

    const finish = (callback, ...args) => {
        if (!close()) return false;
        callback(...args);
        return true;
    };

    const task = {
        get active() {
            return active;
        },
        cancel() {
            return close();
        },
    };

    worker.onmessage = ({ data }) => {
        if (!active || !data) return;

        if (data.type === 'status') {
            onStatus(data);
            return;
        }

        if (data.type === 'result') {
            finish(onResult, data.result, startTime);
            return;
        }

        if (data.type === 'error') {
            finish(onError, data);
        }
    };

    worker.onerror = (event) => {
        event?.preventDefault?.();
        finish(onError, { message: errorMessage(event) });
    };

    worker.onmessageerror = (event) => {
        finish(onError, { message: errorMessage(event) });
    };

    try {
        worker.postMessage(payload);
    } catch (error) {
        // Defer the callback until callers have stored the returned task.
        queueMicrotask(() => finish(onError, { message: errorMessage(error) }));
    }

    return task;
}
