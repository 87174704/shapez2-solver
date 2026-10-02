# P8-02 Real-Browser Hard Performance and Stress Acceptance

Status: `NEEDS-FIX / STOPPED`  
Date: 2026-10-02 (Asia/Shanghai)

## Scope and frozen boundary

This milestone measured the current production implementation without changing Solver search semantics or optimizing product code. The real `/en/` page ran in installed Chrome with native module Workers and production payloads.

The frozen repeated-run protocol used two fresh Chrome profiles. Each profile ran two warmups and ten measured repetitions of three existing representative workloads: ordinary constructive, the 52-step interior-Crystal Hard path, and exact bounded-search W1. The acceptance gates remained unchanged: exact results and stable paths, Worker heap coverage, no more than 5 MiB first-to-final post-GC page-heap growth, no more than 2x second-half/first-half Worker wall-time drift, and no page timer gap above 100 ms.

The separate lifecycle gate ran once headless and once in a visible Chrome window. It supplied fresh-page first/repeat timing plus cancellation, one-shot Worker cleanup, stale-event suppression, immediate restart, and same-page recovery evidence.

## Results

All 60/60 measured solves completed with the expected route, outcome, depth/work signature, and stable path. Worker heap sampling covered 60/60 runs. W1 remained depth 6 / 3,612 states / 106,816 generated candidates.

| Workload | Worker result median / max | UI settled median / max | Timer gap median / max | Page post-GC heap median |
| --- | ---: | ---: | ---: | ---: |
| Ordinary constructive | 31.55 / 42.1 ms | 53.45 / 67.4 ms | 36.3 / 51.0 ms | 5.94 MiB |
| Interior Crystal Hard | 36.4 / 47.8 ms | 92.35 / 121.5 ms | 81.65 / 115.9 ms | 7.28 MiB |
| Bounded-search W1 | 366.75 / 418.0 ms | 390.45 / 449.5 ms | 33.95 / 45.9 ms | 6.55 MiB |

The largest wall-drift ratio was 1.0195 and the largest first-to-final post-GC page-heap increase was 0.71 MiB, so continuous-solve stability and memory-trend gates passed. The largest observed Worker heap was 33.05 MiB in W1; the interior-Crystal Hard workload peaked at 1.56 MiB.

Fresh-page first/immediate-repeat wall times for the 52-step Hard workload were 41.6/33.2 ms in headless Chrome and 47.6/48.1 ms in visible Chrome. Both paths were identical.

Cancellation passed in both lifecycle runs. The cancelled Worker detached `onmessage`, `onerror`, and `onmessageerror`, terminated exactly once, ignored an injected stale callback, restored the action/status UI, and allowed immediate stable solves. Across each lifecycle sequence all six terminal Workers were cleaned up exactly once.

## Blocking acceptance result

The interior-Crystal workload exceeded the frozen 100 ms responsiveness gate in 3/20 measured runs: 114.0 ms, 115.9 ms, and 111.1 ms. The other 57 measured runs remained below the threshold. Because the gate is per-run, correctness, average latency, stable memory, and a prior same-source PASS do not override these breaches.

The first run of this session produced valid measurements but inherited the old harness metadata `P7-03` / `2026-10-01`. That output was declared non-formal. Only task/date metadata collection was repaired; workloads, thresholds, instrumentation, and product code were unchanged. The complete 60-run protocol was then rerun as P8-02, and this formal rerun is the decisive artifact. No additional rerun or optimization was performed after the failure.

## Verification and identities

- Full repository suite: 198/198 passed.
- Production verification: 159/159 solved, replay-valid, constructive-routed, exact E-014 paths; zero resource reuse.
- Real Chrome lifecycle/UI gate: PASS headless and visible/headful.
- Syntax: 120/120 JavaScript/module files passed `node --check`.
- Solver copies: byte-identical SHA-256 `24388ad12ce2b3e29075790f762ba8731fe6015e021a56efcb184aad218ed2ad`.
- Results SHA-256: `81829caf86c3e04da24d01787ea60448f50d87e241f63de844f4adf860b6ff18`.
- Measurement harness SHA-256: `104888d64fefc0feda435ef7078e7b510cb84f767a2d11581d9e4732bf1212f3`.
- `git diff --check`: passed apart from informational LF/CRLF warnings.

The milestone verdict is `NEEDS-FIX / STOPPED`. Hard-capable Release Candidate closeout is not started.
