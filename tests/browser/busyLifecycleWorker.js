self.onmessage = ({ data }) => {
    self.postMessage({ type: 'status', phase: 'started', action: data.action });
    self.postMessage({ type: 'status', phase: 'late', action: data.action });
    self.postMessage({ type: 'result', result: { action: data.action, phase: 'late' } });
    self.postMessage({ type: 'error', message: `${data.action} late error` });
    const deadline = performance.now() + 10000;
    while (performance.now() < deadline) {
        // This deliberately synchronous loop proves parent-side terminate can
        // stop work after the Worker has begun executing.
    }
    self.postMessage({ type: 'result', result: { action: data.action } });
};
