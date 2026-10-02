# P7-02 Real-UI Product Lifecycle Acceptance

Status: `PASS / STOPPED`  
Date: 2026-10-02 (Asia/Shanghai)

## Scope

The production `/en/` page was exercised in installed Chrome through its real controls, native module Workers, production payloads, and production Solver/Explorer code. The acceptance sequence covered visible progress, terminate-based cancellation, immediate restart, stale-event suppression, consecutive solves, malformed Worker payload errors, mixed-part invalid-call isolation, bounded partial results, button/loading cleanup, and same-page recovery.

The 2026-10-02 reconfirmation used Chrome `154.0.8037.59` in two fresh profiles: one normal automated gate and one visible/headful gate. Both ran the same real-page sequence.

The page-side Worker wrapper was observational. It recorded messages and termination state but did not rewrite a request, response, Solver option, operation, or result. Deterministic stale-event checks invoked a callback captured from an already terminated task; this exercised the production lifecycle guard after cleanup without changing Solver semantics.

## Result

- A bounded-search run displayed a real `solver.status.progress` update before cancellation. The two accepted observations reached depth 5 / 2,386 total states and depth 4 / 1,386 total states respectively, each with a 1,000-state queue and beam pruning visible.
- Cancellation immediately restored `Solve`, displayed `Cancelled.`, terminated the Worker exactly once, and detached `onmessage`, `onerror`, and `onmessageerror` before termination.
- A captured stale status callback after cancellation could not change the cancelled UI state.
- The next two bounded-search runs both solved, rendered graph/status output, cleaned up their Workers exactly once, and returned identical operation-path signatures.
- Malformed solve and Explorer payloads produced terminal Worker error messages; each restored the correct action button, cleaned up once, and was followed by a successful same-page run.
- A real mixed four/six-part Explorer request isolated 16 invalid operation attempts while compatible work completed, rather than crashing the Worker.
- A captured stale status callback after terminal cleanup could not change the settled UI state.
- Removing the six-part input and disabling operations allowed Explorer to complete immediately on the same page, proving restart and state cleanup.
- A high-depth Explorer request stopped cleanly at the 128-shape limit, rendered its partial graph, restored `Explore`, and reported 126 operation nodes.
- Six native Workers were observed in the lifecycle sequence: cancelled solve, two completed solves, mixed-part Explorer, recovered Explorer, and bounded partial Explorer. Every terminal Worker was detached and terminated exactly once.

The full sequence passed twice in fresh Chrome profiles, including one visible/headful run. This is product lifecycle evidence, not a browser performance distribution and not permission to change search semantics.

## Verification

- `npm run test:browser-worker`: PASS headless and headful with Chrome `154.0.8037.59`.
- `npm test`: 198/198.
- `npm run verify:production`: 159/159 solved, replay-valid, exact E-014 paths, constructive-routed; zero resource reuse.
- 120/120 JavaScript/module files passed syntax checking; Solver copies remained byte-identical at SHA-256 `24388AD12CE2B3E29075790F762BA8731FE6015E021A56EFCB184AAD218ED2AD`.
- No Solver, Worker lifecycle implementation, production UI behavior, search architecture, benchmark, or frozen capability artifact was modified for P7-02.

The reproducible gate is `tests/browser/workerLifecycle.browser.mjs` via `npm run test:browser-worker`. Set `SOLVER_BROWSER_HEADFUL=1` to run the same gate in a visible Chrome window.
