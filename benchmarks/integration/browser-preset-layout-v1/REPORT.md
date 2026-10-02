# P7-04f Deterministic Preset Solver-Graph Layout

Status: `PASS / STOPPED`  
Date: 2026-10-01 (Asia/Shanghai)

## Change and boundary

The real-page responsiveness failure was closed without changing Solver or Worker behavior. Solver result graphs no longer run a general ELK or breadth-first layout algorithm. The already topologically ordered solution path is mapped in one linear pass: starting shapes use rank 0, each operation follows its deepest input, and each output follows its operation. Nodes retain deterministic first-seen order within a rank, 160 px rank spacing, 120 px within-rank spacing, and LR/RL/TB/BT transforms. Cytoscape applies those coordinates with `preset`.

An exact 256-entry LRU reuses shape image data URLs by color mode, render size, and shape code. Graph node/edge identity, labels, images, interactions, path data, UI route, mix layout, Explorer, Worker lifecycle, and all Solver semantics remain unchanged.

## Formal protocol and result

The unchanged P7-03 harness ran the same two fresh Chrome profiles, two warmups, ten measured repetitions, and three real `/en/` workloads. All 60/60 measured solves retained their exact route, outcome, path, depth, state, and generated-candidate expectations. Every workload was path-stable across both profiles. Worker heap coverage was 60/60.

| Workload | Worker result median / max | UI settled median / max | Timer gap median / max | Page post-GC heap median |
| --- | ---: | ---: | ---: | ---: |
| Ordinary constructive | 28.2 / 33.6 ms | 48.35 / 55.2 ms | 36.45 / 41.8 ms | 5.93 MiB |
| Interior Crystal | 38.6 / 48.9 ms | 94.4 / 136.4 ms | 85.25 / 96.4 ms | 7.27 MiB |
| Bounded-search W1 | 417.1 / 446.9 ms | 440.75 / 469.0 ms | 34.2 / 41.3 ms | 6.54 MiB |

Every timer gap was at most the predeclared 100 ms threshold. The largest second-half/first-half Worker-result median ratio was 1.0181. The largest first-to-final page post-GC heap increase was 0.68 MiB. W1 retained depth 6, 3,612 states, and 106,816 generated candidates.

The formal browser was Chrome 154.0.8037.59, whereas the historical P7-03 run used Chrome 153.0.8010.53. The verdict uses the absolute predeclared gate, not an across-version causal timing percentage.

## Closeout verification

- Full repository suite: 188/188 passed.
- Production capability: 159/159 solved, replay-valid, constructive-routed, exact E-014 paths; zero resource reuse.
- Real Chrome lifecycle/UI gate: PASS, including the 52-step graph, consecutive paths, cancellation, stale suppression, terminal error cleanup, and recovery.
- Syntax: 119/119 JavaScript/module files passed `node --check`.
- Solver copies: byte-identical SHA-256 `876a3e5f494ecb8edd4392506fecf5bfc7f383a42162f3599a1a4a110cbd9191`.
- Formal results SHA-256: `423708b7f99d1e3a51cc92281a7ebba3830d4e3b57381fea5ff149e8c6bf3e19`.
- `operationGraph.js` SHA-256: `041a0c35a71a5e07a323d10a4e7c2af4b2d5977ef454550c5bcf9bb5d874c3ff`.
- `git diff --check`: passed apart from informational LF/CRLF warnings.

## Independent final audit

GPT-6 Astra Medium returned PASS with no blocker and no need for Astra High. The audit dynamically checked all 159 frozen E-014 paths (28,268 nodes / 28,104 edges), LR/RL/TB/BT dependency progression, manual relayout, coordinate uniqueness, LRU capacity/hit refresh/eviction/key isolation, all seven 60-run raw artifacts, protocol identity, final measurements, hashes, and production 159/159.

Residual claim limits are explicit: the 96.4 ms interior-Crystal maximum leaves 3.6 ms margin; evidence is scoped to the frozen workloads, machine, and Chrome 154; fixed coordinates do not promise optimal edge crossings or pixel-perfect label layout; and the cache is bounded by entries rather than exact bytes.

The formal product gate and independent final audit both PASS. P7-04 and Product acceptance are complete and stopped.
