# Benchmark System

Status: manifest v1, the isolated official harness, and the first time-bounded suite baseline were accepted on 2026-09-14. No Hard holdout result has been executed or inspected by the optimizing Agent.

## Benchmark classes

### A. Diagnostic benchmark

W1-W5 in `tests/perf/shapeSolver.bench.mjs` are retained unchanged as focused diagnostics:

- W1 is the quick regression signature.
- W2 exercises a larger retained frontier and transient allocation.
- W3 exercises splitting-enabled ordering but its solved path does not use Splitter.
- W4 is a restricted-operation pruned search. It is not an exhaustive proof of no solution.
- W5 is the historical splitting-fragmentation regression that motivated E-003. Its current solved path does not use Splitter.

All five share one target and one starting-inventory family. They may test a specific behavior or A/B variable, but they are not evidence for the distribution of official Shapez 2 goals.

### B. Real-world Hard benchmark

The Hard suite is the 53 unique, valid official goal codes in:

- `benchmarks/hard_main.txt` (12)
- `benchmarks/hard_side.txt` (41)

It is the primary workload-distribution benchmark for solve rate, valid paths, solution depth, search work, runtime, and resource outcomes under the standardized configuration below.

### C. Insane stress benchmark

The Insane suite is the 52 unique, valid official goal codes in:

- `benchmarks/insane_main.txt` (12)
- `benchmarks/insane_side.txt` (40)

It is a stress/complexity suite. Unsolved and limited cases are expected evidence, not automatic regressions. The report emphasizes failure classification, reached depth, states/candidates, runtime, memory approximation, and growth.

All 105 current goals parse successfully, no target is duplicated within or across files, and every current target has four parts per layer. Hard targets have two to four layers; Insane targets have three to five layers. The manifest records the exact corpus snapshot rather than inferring these facts at run time.

## Standardized official-goal problem

The corpus contains final targets, not complete saved-game resource-patch inventories. Each case therefore uses a frozen, reproducible target-derived input model matching the application's default extraction workflow:

1. Parse the single target.
2. Derive starting shapes with `_extractLayers(target, "color", false, false, false)`.
3. Preserve the returned order and duplicates.
4. Do not provide target colors, pins, or crystals directly; the solver must use recipe operations for them.
5. Enable all ten recipe operations.
6. Use exact target orientation, `preventWaste=false`, `allowSplitting=true`, `cleanPainting=false`, and `maxStatesPerLevel=3000`.
7. Use `maxLayers=4` for Hard and `maxLayers=5` for Insane.

This is an official-*goal* workload under a standardized resource assumption. It exercises target structure and solver branches but must not be described as an exact replay of game saves, because actual map resources are not present in the supplied files.

Changing any item above creates a named benchmark profile/version; it must not silently replace this baseline. A non-splitting or alternate-resource run may be useful as an explicitly separate diagnostic profile.

## Frozen Hard split

`benchmarks/manifest.json` is the source of truth. For manifest version 1, each Hard source file is stratified independently so both main and side goals occur in every partition:

1. Normalize each non-empty line by trimming surrounding whitespace.
2. Compute SHA-256 over the UTF-8 target code.
3. Sort within the source file by digest, breaking a digest tie by original one-based line number.
4. Allocate 60% development, 20% validation, and 20% holdout with the largest-remainder method. If fractional remainders tie, assign in development, validation, holdout order.
5. Persist the assignments. Corpus additions require a new manifest version and do not repartition version-1 cases.

The resulting fixed counts are:

| Source | Development | Validation | Holdout | Total |
| --- | ---: | ---: | ---: | ---: |
| hard_main | 7 | 3 | 2 | 12 |
| hard_side | 25 | 8 | 8 | 41 |
| **Hard total** | **32** | **11** | **10** | **53** |

Development cases may be inspected and used to form hypotheses. Validation cases are run at declared phase gates and may reject a change, but repeated case-specific tuning moves the work back to development. Holdout is reserved for an independent final Reviewer and is excluded unless an explicit holdout override is supplied.

If a holdout result is inspected and then used to alter code, configuration, or heuristic choice, manifest v1 holdout is permanently marked contaminated for that line of work. It cannot regain holdout status by reverting or renaming it; a later independent claim needs a newly frozen source of untouched cases.

Insane cases use partition `stress`; no development/validation/holdout interpretation is attached to them at this stage.

## Execution and artifacts

Each official case runs in a fresh Node process. The parent harness applies an external watchdog so a stalled or poorly cooperative Worker-equivalent solve cannot block the suite. The solver's own `time`, `generated-states`, `visited-states`, and `shape-universe` outcomes remain distinct from an external `watchdog-timeout` or process error.

The raw JSON report records:

- manifest version/hash, exact case IDs, repository identity, configuration, runtime environment, and command options;
- solved/not-found/solver-limit/watchdog/error counts;
- depth reached, accepted/visited states (`statesExplored`), generated candidates (`generatedStates`), and wall time per case;
- fresh-process `maxRSS` as an approximate process high-water memory value where the platform reports it consistently;
- replay status and diagnostics for every solved case;
- aggregate and per-depth work/growth summaries where the available solver result supports them.

Command: `npm run bench:official -- [options]`. The safe default is Hard development with a 30-second external watchdog. Use `--suite`, `--source`, `--partition`, `--case`, and `--timeout-ms` to select work; `--output-file <path>` preserves the full report. Hard holdout additionally requires `--include-holdout` and remains reserved for the final Reviewer.

`maxRSS` includes Node/module overhead and is not a JavaScript heap allocation trace. A killed process may not return its own high-water value, so watchdog cases can have unavailable memory. Same-process RSS deltas are not accepted as per-case peak memory.

The harness never hard-fails because a case is slow or unsolved. It does fail on malformed corpus/manifest identity, duplicate IDs, configuration drift, or a replay-invalid solved path.

## Baseline protocol

The first baseline sequence is:

1. Run unit tests and a single development smoke case.
2. Run Hard development, save raw JSON, and inspect failures only there.
3. Freeze any harness correction that does not tune the solver.
4. Run Hard validation once for the phase checkpoint.
5. Run Insane as a bounded stress batch; solve rate is descriptive.
6. Leave Hard holdout untouched for the independent final Reviewer.

The initial checkpoint may use an explicitly shorter external watchdog to bound project time, but the report and filename must include that budget. Such a run is a time-bounded baseline, not evidence for the solver's full built-in 120-second outcome on watchdog-limited cases.

No heuristic is accepted from official results without a predeclared A/B identity, case set, quality/replay criteria, and preserved raw reports. Runtime causality needs interleaved fresh-process A/B or another declared paired design; historical non-interleaved percentages are record-only evidence.

## Accepted baseline v1

| Suite/partition | Artifact | Watchdog | Outcome summary | Replay |
| --- | --- | ---: | --- | --- |
| Hard development | `official-hard-development-v1-10s.json` | 10 s | 10 solved, 16 generated-state limits, 6 watchdogs | 10 valid |
| Hard validation | `official-hard-validation-v1-10s.json` | 10 s | 4 solved, 6 generated-state limits, 1 watchdog | 4 valid |
| Insane stress | `official-insane-stress-v1-5s.json` | 5 s | 4 solved, 11 generated-state limits, 37 watchdogs | 4 valid |

The reports contain 95 selected non-holdout cases in total and no Hard holdout case. There were no natural-unsolved or error outcomes, and no invalid/unsupported solved-path replay. Null final wall time on a watchdog case means the child was terminated before returning a final measurement; its `latestProgress` remains diagnostic evidence only.

These accepted artifacts use the pre-P5-08 result schema and solver hash `C820FC50...01BE`. Current harness schema v2 records exact `beamPruned`, distinguishes `exhausted` from `not-found-pruned`, and preserves their sum as aggregate `unsolved`; limits, watchdogs, cancellation, and errors remain separate. Historical artifacts are not rewritten. A current non-holdout one-case smoke confirmed the v2 solved/replay path without replacing the suite baseline.
