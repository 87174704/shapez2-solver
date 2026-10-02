# Baseline

Baseline commit: `b367b6e`

## Test environment

- Date: 2026-09-12 (Asia/Shanghai)
- OS: Microsoft Windows 11 Home, version `10.0.26200`, build `26200`
- CPU: AMD Ryzen 5 5600G with Radeon Graphics, 6 physical / 12 logical cores
- Installed memory: 31.79 GiB
- Node.js: `v24.21.0`
- npm: `11.19.0`
- Repository worktree was clean before baseline documentation was added.

## Correctness baseline

`npm test`:

- 6 tests passed; 0 failed, skipped, cancelled, or todo.
- Total test-run duration reported by Node: 949.77 ms in the recorded initial run.
- The dominant integration test (`omni swapper`) reported 797.25 ms in that run.

`node --test --experimental-test-coverage`:

- 6 tests passed.
- Aggregate coverage: 78.44% lines, 87.41% branches, 92.13% functions.
- `shapeSolver.js`: 73.18% lines, 85.09% branches, 90.91% functions.
- `shapeOperations.js`: 82.77% lines, 90.00% branches, 93.44% functions.
- Explorer (`shapeSolver.js` lines 879-1031) is uncovered.

Static syntax verification:

- Every Git-tracked `.js` and `.mjs` file passed `node --check`.

## Correctness limitations

- Passing tests establish compatibility with six existing cases, not complete solver correctness.
- The bounded heuristic search is intentionally incomplete once a frontier is pruned.
- Property/differential coverage for operation physics and exhaustive small-state comparison are not yet present.
- Browser Worker/UI behavior is not exercised by the Node suite.
- Confirmed baseline defect: `halfCut(Shape.fromShapeCode('----CuCu'))` produces the empty shape `--------`, but solver output filtering prevents that consume-only transition. With target `RuRuRuRu`, inputs `RuRuRuRu` plus `----CuCu`, only Half Destroyer enabled, and `preventWaste=true`, the solver incorrectly returns no solution after depth 1.
- Confirmed baseline defect: using `CuCuCuCu` and `HuHuHuHuHuHu` with Swapper causes `InvalidOperationInputs` to escape the solver, terminating the search instead of skipping an incompatible binary pair.

## Performance baseline

Command: `npm run bench:full`

- Harness: `tests/perf/shapeSolver.bench.mjs`
- Standard protocol: two unreported warmups followed by five measured runs per workload, forced GC before each run.
- Shared target/input: target `CuRuSuWu`; starting shapes `CuCuCuCu`, `RuRuRuRu`, `SuSuSuSu`, `WuWuWuWu`; max layers 4; orientation insensitive; no waste restriction; clean painting off.
- The harness asserts deterministic result kind, depth, work counters, and a stable solution signature. It intentionally has no wall-time pass/fail threshold.

Recorded standard full run:

| Workload | Configuration | Result | Depth | States | Generated | Wall ms median | Mean | Min-max | Stdev |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| W1 | all operations, cap 1,000, no splitting | solved | 6 | 3,612 | 106,816 | 584.53 | 590.33 | 577.16-608.21 | 12.36 |
| W2 | all operations, cap 5,000, no splitting | solved | 5 | 10,612 | 238,356 | 1,195.09 | 1,191.85 | 1,135.33-1,242.61 | 43.50 |
| W3 | all operations, cap 1,000, splitting | solved | 7 | 4,790 | 164,547 | 713.15 | 697.14 | 630.00-751.34 | 41.13 |
| W4 | Half Destroyer/Cutter/Swapper/Stacker, cap 1,000 | not found after pruning | 21 | 17,155 | 139,718 | 1,058.95 | 1,043.33 | 993.31-1,068.59 | 27.80 |

W4 is not an exhaustive no-solution proof. Astra's read-only instrumentation observed the collector reach 1,000 and 79,888 unique-state beam discard/eviction events (events, not globally distinct states) while preserving the recorded logical signature.

Opt-in stress W5 uses all operations, splitting, and cap 100. Three fresh-process cold measurements were 16.331 s, 16.657 s, and 16.482 s (median 16.482 s). Every baseline run stopped at the generated-state limit with depth 645, 64,435 visited states, and exactly 5,000,000 generated candidates. This paragraph is historical; retained E-003 updates the current harness expectation to a budgeted solution. Run the current behavior explicitly with `npm run bench:stress`; for a short verification use `npm run bench:stress -- --warmup 0 --runs 1`.

## Memory baseline

Fresh `--expose-gc` processes were used for each configuration. RSS is a process high-water approximation, not a continuously sampled JavaScript heap peak.

| Workload | Approx. RSS before | Approx. peak RSS | Peak increase | Post-GC heap |
| --- | ---: | ---: | ---: | ---: |
| W1, cap 1,000 | 35.98 MiB | 144.34 MiB | 108.36 MiB | about 5 MiB |
| W2, cap 5,000 | 36.05 MiB | 240.93 MiB | 204.88 MiB | about 5 MiB |
| W5, splitting stress | about 36 MiB | 261.67 MiB | 225.55 MiB | 4.66 MiB |

The low post-GC retained heap and high peak/RSS delta point to transient candidate allocation and garbage-collection pressure, not a demonstrated steady-state memory leak.

## CPU profile

The cap-5,000 workload was recorded with Node's sampling CPU profiler across two warmups and a third solve. The profile contained 1,412 samples over 2,268 ms. Percentages below are leaf/self-sample shares and are directional, not inclusive costs:

| Site | Self samples |
| --- | ---: |
| `getStateKey` (`shapeSolver.js:477`) | 12.24% |
| cache `getCachedValue` (`shapeSolver.js:36`) | 10.42% |
| garbage collection | 9.03% |
| `BoundedStateCollector.consider` (`shapeSolver.js:104`) | 7.49% |
| `cloneCounts` (`shapeSolver.js:328`) | 4.72% |
| `getCachedOperationOutputs` (`shapeSolver.js:341`) | 4.14% |
| `_makeLayersFall` (`shapeOperations.js:180`, two sampled frames) | 4.68% combined |
| `cut` (`shapeOperations.js:356`) | 2.16% |

GC tracing recorded 87 scavenges and two mark-compacts; one late major collection took 24.91 ms and reduced roughly 65.1 MiB to 50.2 MiB. The strongest implementation-level target is therefore candidate state representation/keying/allocation. The stronger algorithm-level symptom is splitting-driven search explosion, followed by quadratic binary-operation enumeration.

## First official-goal time-bounded baseline

Recorded 2026-09-14 (Asia/Shanghai) from manifest v1. The production solver snapshot is SHA-256 `C820FC503097EAD51EB18F06078314A5233F75BEE02CD3DA7E76E2F9E61901BE` for both byte-identical copies. Each case ran in a fresh process; watchdog timeouts are distinct from solver limits. Hard holdout was not run.

| Artifact | External watchdog | Cases | Solved | Generated limit | Watchdog | Errors | Valid replay |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Hard development v1 | 10 s | 32 | 10 | 16 | 6 | 0 | 10 |
| Hard validation v1 | 10 s | 11 | 4 | 6 | 1 | 0 | 4 |
| Insane stress v1 | 5 s | 52 | 4 | 11 | 37 | 0 | 4 |

All three reports recorded zero natural-unsolved cases under the bounded run, zero invalid or unsupported solved-path replays, and no process error. A solver `generated-states` limit and an external watchdog are neither exhaustive no-solution results nor evidence about the full 120-second built-in budget. Raw reports under `benchmarks/results/` contain exact per-case work, progress, RSS, path, source, corpus, and configuration identity.

## Hard 53×3 formal Solver baseline

Recorded 2026-09-24 (Asia/Shanghai) against released composite `hard-53x3-stage-v1`. This is the formal optimization comparison baseline, not a solver-quality acceptance gate.

- Baseline ID: `hard-53x3-solver-baseline-v1`
- Baseline canonical hash: `a23979099a2ae0dc7c8fa0a77c89ffa77d23fc82170e38690de000b708082661`
- Benchmark canonical identity: `5836350ed30779f76fa32a6d4e9dce3628f7b5a554dfc4cb4e512c3b1ffe72db`
- Bound final-selection hash: `6e3efdece360e8dd338a49dd3edd8fe10620b288aa161d35a8d01ab966e1b47f`
- Solver code identity: `68f2be34f9737204a69f1db2c83463c76e9a3110732f829da916ae5d14aba873`
- Frozen configuration hash: `2ed7ea7b1d6af5d8c81e7b4a3baa9277a41cfb8c460947b8664706058ddab009`
- Result membership hash: `2d575703b6f014a18280368e3924a9f9e08697aacec5579f6e1ab536591aade3`
- Result canonical hash: `b5280ee921365f7dcbaaaed900aba040c49e3b3dedcd89c9af181f659ee0d987`

All 159 members ran once in fresh sequential Node subprocesses with the production-equivalent operation/rule set and frozen limits. Outcomes were 0 solved, 106 candidate-cap, 52 shape-universe-cap, and one internal 120-second timeout; there were no state-cap, memory-limit, search-exhausted, or error results. All 53 targets were 0/3 solved. This low solve rate does not invalidate the baseline: the measurement, classification, membership, and identity gates all passed.

The authoritative artifacts are under `benchmarks/solver-baselines/hard-53x3-v1/`. `REPORT.md` is the human summary; `config.json`, `results.json`, `aggregate.json`, `failure-landscape.json`, `identity.json`, and 159 per-instance records are the machine-readable evidence. Deterministic resume-only reconstruction reproduced every canonical artifact unchanged.

The run made no Solver semantic modification and no benchmark source mutation. Node subprocess wall time and RSS are not browser Worker measurements; `statesExplored` is the production visited/accepted counter rather than an exact expansion count; frontier fields are sampled progress. The released composite includes every Hard target, so the former manifest-v1 Hard holdout is now observed and must not be described as untouched in future optimization claims.
