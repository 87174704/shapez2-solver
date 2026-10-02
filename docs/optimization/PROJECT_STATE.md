# Project State

Last verified: 2026-10-02 (Asia/Shanghai; formal baseline measured 2026-09-24)

## Current phase

- Phase: **End-to-end Hard-capable Release published; PASS / STOPPED**.
- Frozen capability frontier: E-014 at 159/159 across 53/53 Hard targets, with stable replay-valid paths.
- Accepted integration boundary: P6-15 browser-safe production integration; the public Worker graph must remain free of Node-only, bare, and `benchmarks/` imports.
- Priority: P8-05 is `PASS / STOPPED` under D-073. `hard-capable-v1` at `f62683a3be7e826c8c764afcee4977114b15a9f0` is deployed and binds unchanged `hard-capable-rc-v1`; no later release, Solver, benchmark, optimization, or other task starts automatically.
- Guardrail: distinguish capability correctness from product performance. Do not change search semantics because a browser measurement is slow, and do not start a Solver architecture experiment without a demonstrated product capability blocker and a new predeclaration.
- Immutable scope: do not modify frozen benchmark, formal baseline, release, or accepted capability artifacts; do not add benchmark/diversity/audit work unless needed by a reproduced product problem.

## Repository and deployment boundary

- Local repository: `E:\solver`
- Checked-out branch at phase-one start: `main`; optimization work now lives on local branch `codex/solver-optimization`.
- Starting commit: `b367b6e` (`docs: add project structure summary`)
- Starting worktree: clean; `main` and `origin/main` pointed at the same displayed commit.
- The former local-only boundary was lifted only for the explicitly authorized P8-05 release. The release push/tag/deployment are complete; future remote or production actions again require explicit scope.
- `.gitea/workflows/deploy.yml` deploys runtime changes on a push to `main`. It now publishes an explicit static-runtime allowlist and emits `deployment.json`; documentation/evidence-only pushes are ignored.

## Runtime and architecture

- Static browser application using native JavaScript ES modules; there is no compilation or bundling step.
- `main.js` owns UI state and starts Web Workers.
- `shapeSolver.js` implements the recipe solver and reachable-space explorer.
- `shapeSolver_web.js` is currently byte-identical to `shapeSolver.js`; both SHA-256 hashes were `869AA2E4B0D9F73534FCD43F5C51AA520EECFA1691666774E558092008E66294` at the starting commit.
- `shapeOperations.js` contains the shape model, physical operations, target extraction, and similarity heuristic.
- `mixingSolver.js` implements the separate color-mixing search.
- The existing Node test suite imports `shapeSolver.js` directly after installing a minimal `self.postMessage` stub.

## Solver algorithm

- The recipe solver is a level-by-level, heuristic, bounded search over inventories (multisets) of shape/throughput tokens.
- A state key is the sorted list of token/count pairs; `visited` prevents an accepted frontier state from being expanded again.
- Each level is generated into `BoundedStateCollector`, a fixed-capacity min-heap retaining the best unique states by average target similarity.
- Operations are unary or binary. Painter and Crystal Generator restrict colors to target-relevant colors. Optional splitting represents throughput in token identity.
- Parent-linked compact traces are replayed only when a goal is found.
- The search is deliberately incomplete when the frontier is bounded: pruning can discard every path to a valid solution.
- Hard safety limits currently include 5,000 frontier states, 500,000 visited states, 5,000,000 generated candidates, 150,000 interned shapes, and 120 seconds.

## Build, test, and local verification

- Runtime used for the initial baseline: Node.js `v24.21.0`, npm `11.19.0`.
- Test command: `npm test` (equivalent to `node --test`).
- Coverage diagnostic: `node --test --experimental-test-coverage`.
- Static syntax verification: run `node --check` for every Git-tracked `.js` and `.mjs` file.
- Real-browser integration command: `npm run test:browser-worker`; it starts a loopback-only static server and a disposable installed Chrome/Chromium/Edge profile, and now covers the production UI path as well as Worker lifecycle.
- Production capability verification command: `npm run verify:production`; it checks all 159 frozen members through the current public entry without modifying the frozen artifacts.

## Important risks and facts

- Current automated tests are concentrated on `shapeSolver.js`; operation physics, Explorer, mixing, validation, rendering, UI, and real Worker integration have little or no direct automated coverage.
- `shapeSolver.js` and `shapeSolver_web.js` are duplicate sources and must remain synchronized unless a later explicit architectural decision removes the duplication.
- Browser UI defaults to 3,000 states per level, while the solver clamps the absolute frontier to 5,000.
- Any future benchmark must report solver work counters along with time so a faster but behaviorally different search is not mistaken for an implementation speedup.
- Baseline defects involving legal consume-with-no-output transitions and mixed four-part/six-part binary inputs are fixed in the current working tree. Legal `[]` output is distinct from invalid-input `null`, and only `InvalidOperationInputs` is isolated.
- The current working tree also contains retained E-001 lazy candidate materialization and E-002 numeric operation-output cache keys. These changes remain uncommitted on `codex/solver-optimization` and are documented in `EXPERIMENTS.md`.
- Beam pruning is heuristic rather than a correctness-preserving bound. A returned path can be replayed, but an exhausted/pruned search is not proof that no solution exists.
- Splitting dominated the baseline retained frontier: the recorded stress workload reached 5,000,000 generated candidates at depth 645 with a frontier cap of only 100. Retained E-003 resolves that recorded case but does not prove other splitting searches complete.

## Profiled performance shape

- The largest sampled self-time sites in the recorded CPU profile were state-key construction (12.24%), cache `Map.get` calls (10.42%), garbage collection (9.03%), bounded collector insertion (7.49%), inventory `Map` cloning (4.72%), and cached operation lookup/generation (4.14%).
- This matches the hot loop: every candidate clones an inventory and sorts/stringifies a complete state key before duplicate rejection.
- Binary operation enumeration is quadratic in the number of distinct inventory tokens per state and happens across up to 5,000 frontier states.
- Fresh-process approximate peak RSS rose from about 36 MiB before solve to 144 MiB for W1 (cap 1,000), 241 MiB for W2 (cap 5,000), and 262 MiB for W5 (splitting stress). Post-GC heap near 5 MiB indicates high transient allocation/GC pressure rather than a retained-heap leak in these runs.
- Explorer is a separate unbounded risk: it uses linear shape lookup inside nested expansion, has no solver-equivalent budgets, and its non-commutative Stacker traversal is incomplete in one input direction.
- Post-E-002 W2 profiling moved the dominant measured work toward operation physics: `shapeOperations.js` represented about 43% of leaf samples, `shapeSolver.js` about 46%, and GC 8.48%. No further equivalent micro-optimization was selected; details are in `EXPERIMENTS.md`.
- A test-only bounded oracle independently models integer throughput, goals, successor enumeration, exhaustive BFS, and public-path replay. The P5-07 cap-2 fixture now exercises a reference-proven Split-required solution under real unique-state beam pruning: E-003 on/off both replay at reference depth while retaining different semantic state sets. This is a bounded positive gate, not a global completeness claim.
- Retained E-003 adds an equal-primary-score coarse-flow tie-break only in splitting mode. It carries an incremental throughput-square total and leaves non-splitting ordering unchanged.
- Current W5 deterministically solves at depth 9 with 735 states and 21,777 candidates instead of reaching the 5,000,000-candidate limit at depth 645. The path is replay-valid and uses no Splitter or unequal-rate discard.
- W1-W5 are diagnostic workloads from one shared shape family, not representative real-world workload evidence. W4 prunes heavily and is only `not found after pruning`, not exhaustive no-solution.

## Latest recovery verification

- Branch/HEAD: `codex/solver-optimization` at `b367b6e`; the complete optimization batch is still in the working tree and no later commit exists.
- Modified tracked files: `i18n.js`, `main.js`, `operationGraph.js`, `package.json`, `shapeSolver.js`, `shapeSolver_web.js`, and `tests/shapeSolver.test.mjs`.
- Untracked project artifacts include the optimization documents, official corpus/manifest/results, oracle/helper tests, diagnostic and official harnesses, and the bounded nested-Splitter discovery tool.
- `npm test`: 36/36 passed on 2026-09-14 after P5-07 and P5-08 classification/latch coverage.
- Quick W1 benchmark: solved at depth 6 with 3,612 states and 106,816 generated candidates, matching the recorded logical signature. The single recovery run is not a new timing baseline.
- All 17 tracked and untracked JavaScript/module syntax checks passed; `git diff --check` passed apart from informational line-ending warnings.
- `shapeSolver.js` and `shapeSolver_web.js` are byte-identical with SHA-256 `D904D24D45F47652963254B411097278011D4BE1F1E50C2454C887186E6B4FE9`.
- The additive `shapeSolverTestOnly` export can disable E-003 and collect exact beam diagnostics for tests. Existing Worker messages, the nine-argument `shapeSolver(...)` call, and normal result objects are unchanged; normal solves do not build semantic diagnostic keys.
- P5-07's deterministic nested/multiple-Splitter discovery reached its fixed 1,000,000-transition budget in about 5.5 seconds without a witness. It fully covered Rotator CW+Swapper, completed only the `----RuCu` seed in the Rotator CW+Swapper+Rotator 180 tier, and did not reach Cutter/Stacker. The result is inconclusive and the nested-splitting evidence gap remains open.
- P5-08 adds exact additive `outcome` and `beamPruned` fields to every non-cancel recipe result. Outcomes are `solved`, `limit`, `not-found-pruned`, or `exhausted`; solved/limit take precedence while `beamPruned` records whether any new unique state was rejected or evicted by the beam.
- Production tracks an exact boolean latch rather than a misleading event total. Before the first confirmed unique prune it materializes only enough score-rejected candidates to exclude visited/retained duplicates; after the latch is true, lazy rejection resumes. Test diagnostics still collect the exact event partition.
- W1-W5 retained all prior depth/state/candidate/signature expectations. All five observed `beamPruned=true`; W4 alone is a no-result and is now truthfully `not-found-pruned` at depth 21 / 17,155 states / 139,718 candidates.
- New-session recovery on 2026-09-14 re-read every optimization document, inspected the complete tracked diff and untracked inventory, confirmed the same branch/HEAD and byte-equal solver sources, and reran `npm test` at 36/36 before P5-09 edits.
- P5-09 is complete under D-024. Test-only injected budgets preserve all production defaults and cover exact generated/visited/shape/time boundaries in a fresh child process under a parent watchdog. Initialization shape overflow is now a clean limit, and attempted-action time checks include invalid binary pairs.
- Post-P5-09 verification: `npm test` passes 37/37; all 19 JavaScript/module files pass syntax checks; one-run W1-W5 retain exact logical signatures; `git diff --check` has only informational line-ending warnings. Solver copies are byte-identical at SHA-256 `145F706118D4A7B50725011B2AA4FEE3F106AD0AA532A418B695E73B00D6819A`.
- P5-10 freezes UI cancellation as immediate parent-side Worker termination. A shared one-shot controller detaches handlers before callbacks, suppresses stale events after cancellation, unifies result/error/cancel cleanup, and handles constructor, send, native, and message-deserialization failures.
- Recipe and Explorer exceptions use a terminal Worker error envelope. P5-11 now isolates mixed-part `InvalidOperationInputs` per physical call, while non-domain exceptions retain the same terminal cleanup path.
- Post-P5-10 verification: `npm test` passes 43/43; the required real Chrome module-Worker and production `/en/` UI lifecycle harness passes, including acknowledgement-before-termination and completed restarts; quick W1 retains depth 6 / 3,612 states / 106,816 candidates; all 24 JavaScript/module files pass syntax checks; `git diff --check` has only informational line-ending warnings. Solver copies are byte-identical at SHA-256 `1F25E23D2703896BF55C2B9AE5F2D41E2F6A014CCD6748D0E05A82A916EA8D2E`.

## Official workload snapshot

- `benchmarks/manifest.json` v1 freezes 105 valid, unique official targets: Hard 53 (12 main, 41 side) and Insane 52 (12 main, 40 side).
- All current targets have four parts per layer. Hard spans two to four layers; Insane spans three to five layers. Hard contains 18 targets with pins and 18 with crystals.
- The Hard split is fixed and source-stratified: 32 development, 11 validation, and 10 holdout. No holdout solve outcome has been run or inspected by the optimizing Agent.
- The standardized workload derives inputs with the UI-default color extraction while withholding color, pins, and crystals; all operations, exact orientation, splitting, cap 3,000, and suite layer limits are used. This is an official-goal workload, not a full saved-game/resource-patch replay.
- Corpus SHA-256: hard_main `9E41FBF8...AB7`, hard_side `2107E06D...CE8`, insane_main `8FF3F305...22EB`, insane_side `3CB8138D...37EE`; manifest `F400BD27...63A0C`.
- Time-bounded official baseline artifacts now exist for all 32 Hard development cases, all 11 Hard validation cases, and all 52 Insane stress cases. No Hard holdout case appears in any result artifact.
- At a 10-second watchdog, Hard development recorded 10 solved / 16 generated-state limit / 6 watchdog, and validation recorded 4 / 6 / 1. At a 5-second watchdog, Insane recorded 4 solved / 11 generated-state limit / 37 watchdog. All 18 solved paths replayed valid; no invalid/unsupported replay or process error was recorded.
- Those three immutable artifacts predate P5-08 and identify solver hash `C820FC50...01BE`. They remain the accepted time-bounded snapshot; do not call them a run of current `1F25E23D...D2E` code. A later non-holdout `hard-main-003` schema smoke solved at the same depth/work signature and replayed valid, but it is not a suite rerun.

## Explorer audit checkpoint

- P5-01's read-only findings were repaired by P5-10/P5-11. Explorer is explicitly a reusable-input, expression-height shape closure rather than finite-inventory recipe reachability.
- Ordered Stacker covers both directions and self-pairs; Swapper is commutative; unchanged siblings cannot suppress novel outputs; mixed-part invalid calls are isolated; Painter and Crystal Generator use the full nine-code color domain; explicit depth zero remains zero.
- Empty outputs and pure cycles do not enter the graph. Productive calls commit atomically under 25,000 attempts, 3,000 ms, 128 shapes, 256 operations, 768 edges, and 1 MiB serialized-result limits. Limited runs return localized marked partial graphs.
- A separate reference enumerator and tiny injected budgets pass 10 focused Explorer tests. Real Chrome verifies mixed-part completion, a rendered 128-shape partial graph, one-shot cleanup, stale suppression, cancellation, terminal error recovery, and restart.
- P5-11 closeout: full suite 198/198; production 159/159 with exact E-014 paths; W1 depth 6 / 3,612 states / 106,816 candidates; syntax 120/120; Solver copies byte-identical at `24388AD1...ED2AD`; GPT-6 Astra Medium returned PASS with no escalation.
- P8-01 recovery reconciliation on 2026-10-02 confirmed the same branch/HEAD and working-tree inventory, corrected the stale P5-11 experiment status and omitted `operationGraph.js` inventory entry, passed the full suite 198/198, and passed production verification 159/159 with exact E-014 paths and zero resource reuse. Solver copies remain byte-identical at `24388AD1...ED2AD`; `git diff --check` has only line-ending notices. No runtime code or frozen artifact changed.
- P8-04 RC closeout on 2026-10-02 accepted `hard-capable-rc-v1:3e94ef55d6bcb09a4a74e7777516ae547ee02b7168ca566b2e0963dde80e5f17`. The identity binds the 56-file static runtime snapshot while explicitly recording the intentionally dirty working tree. Current regression checks passed 198/198, syntax 120/120, the browser-safe static-graph test, Solver parity, composite trust-chain reconstruction, frozen P8-03 harness/result hashes, and diff hygiene. P8-04 changed documentation/evidence only and did not rerun a Solver benchmark or browser performance distribution.

## Hard 53×3 formal Solver baseline checkpoint

- Status: `FORMAL SOLVER BASELINE: PASS`. Baseline ID `hard-53x3-solver-baseline-v1`; canonical hash `a23979099a2ae0dc7c8fa0a77c89ffa77d23fc82170e38690de000b708082661`.
- Frozen identities: benchmark `5836350ed30779f76fa32a6d4e9dce3628f7b5a554dfc4cb4e512c3b1ffe72db`; final selection `6e3efdece360e8dd338a49dd3edd8fe10620b288aa161d35a8d01ab966e1b47f`; Solver `68f2be34f9737204a69f1db2c83463c76e9a3110732f829da916ae5d14aba873`; config `2ed7ea7b1d6af5d8c81e7b4a3baa9277a41cfb8c460947b8664706058ddab009`.
- Complete run: 159/159 explicit outcomes with no reruns or configuration adjustment. Results were 0 solved, 106 candidate-cap, 52 shape-universe-cap, and one internal solver timeout; all other terminal classes were zero. Target level was 0 at 3/3, 2/3, and 1/3 solved, and 53 at 0/3.
- Artifacts: `benchmarks/solver-baselines/hard-53x3-v1/` contains the frozen config, 159 per-instance records, combined results, aggregates, failure landscape, identity, report, and resume state. Membership hash is `2d575703...ade3`; result hash is `b5280ee...d987`.
- Verification: composite 14/14 and trust chain 159/159; baseline tests 5/5; full repository suite 112/112; Chrome Worker lifecycle PASS; syntax 60/60; deterministic reconstruction and all identity checks PASS. GPT-6 Astra Medium independently audited the method and artifacts and returned PASS with no blocking issue.
- Purity: no Solver search-semantic modification and no benchmark source mutation occurred. The runner/instrumentation is additive. Current Solver copies remain byte-identical at SHA-256 `1F25E23D...D2E`.
- Measurement limits: Node subprocess latency/RSS are not browser Worker measurements; `statesExplored` is accepted/visited rather than exact expanded count; frontier values are sampled; unavailable counters remain null. The released composite exposed the former manifest-v1 Hard holdout, so future work must not call it untouched.

## Next task

P8-05 is `PASS / STOPPED`. There is no automatically authorized next task. Any later release, deployment, Solver work, benchmark, optimization, migration, or feature requires a separate explicit milestone.

## P8-05 End-to-end Hard-capable Release

- Status: `PASS / STOPPED` on 2026-10-02 under D-073.
- Release identity: annotated tag `hard-capable-v1` and deployment both point to `f62683a3be7e826c8c764afcee4977114b15a9f0`; RC binding remains `hard-capable-rc-v1:3e94ef55d6bcb09a4a74e7777516ae547ee02b7168ca566b2e0963dde80e5f17`.
- Remote/CI: `origin/main` and the tag were pushed successfully. Gitea Actions run 21 / number 7 completed with `success` at the release SHA.
- Production: `https://shapez2.ysc.icu/solver/`; `/deployment.json` reports the release SHA, `refs/heads/main`, and run 21. The public `/en/` page returns 200.
- Content: all 56 frozen RC runtime hashes and all four required `constructive/` dependency hashes match production. A CRLF-to-LF packaging mismatch found after the first deployment was repaired mechanically with `.gitattributes`; no runtime semantic changed.
- Smoke: the real online page and production module Worker solved the 52-step interior-Crystal Hard case twice at depth/state count 52, restored the Solve button, and rendered the graph. Browser console errors were zero; only three existing third-party warnings remained.
- Final local gates: 198/198 tests, production 159/159 with replay and exact E-014 paths, 120/120 syntax, byte-identical Solver copies, and local real-Chrome lifecycle PASS.
- Scope: 549-file accepted batch plus a six-file byte-preservation packaging commit. Multi-gigabyte raw `.states.ndjson`, local temporary directories, and `node_modules` were excluded; frozen summaries, benchmark, baseline, verdicts, and RC evidence were retained.
- Evidence: `benchmarks/integration/hard-capable-release-v1/`.

## P8-04 Hard-capable Release Candidate

- Status: `PASS / STOPPED` on 2026-10-02 under D-072.
- Identity: `hard-capable-rc-v1:3e94ef55d6bcb09a4a74e7777516ae547ee02b7168ca566b2e0963dde80e5f17`; 56 static runtime files, content-addressed because the accepted batch remains uncommitted on `codex/solver-optimization` at base `b367b6e`.
- Capability: frozen P8-03 evidence retains production 159/159, independent replay, exact E-014 paths, constructive routing, all 53 targets, and zero resource reuse.
- Product gates: P6-15 browser-safe boundary, P7-02/P8-03 lifecycle and error recovery, frozen 60/60 browser readiness, and the absolute 100 ms responsiveness gate all remain PASS.
- Current-tree closeout: full suite 198/198; syntax 120/120; static browser-safe regression PASS; Solver copies byte-identical at `24388AD1...ED2AD`; P8-03 harness/result hashes exact; diff check has line-ending notices only.
- Boundary: P8-04 added only `docs/optimization/RELEASE_CANDIDATE.md`, the RC report/verdict, and durable status updates. Frozen benchmark, formal baseline, E-014 frontier, P8-02 historical failure, P8-03 acceptance, and all historical verdicts remain unchanged.
- Evidence: `benchmarks/integration/hard-capable-release-candidate-v1/`; notes and debt: `docs/optimization/RELEASE_CANDIDATE.md`.

## P8-03 Hard UI responsiveness repair

- Status: `PASS / STOPPED` on 2026-10-02. Chrome trace isolated the reproduced 118.4 ms diagnostic gap to repeated main-thread Cytoscape reconstruction and first paint after result delivery; Worker computation stayed on its dedicated thread.
- Repair: one event-loop yield separates result delivery from rendering, and solver-to-solver renders reuse one Cytoscape instance while atomically replacing all graph elements and the deterministic preset layout. Solver semantics, paths, graph data/visuals, mix graphs, Explorer, workloads, and the gate remain unchanged.
- Formal acceptance: 60/60 exact stable results, 60/60 Worker heap coverage, maximum page drift 0.377 MiB, maximum wall drift 1.3246, and timer maxima 31.6/97.1/30.5 ms for ordinary/Hard/W1. No timer gap exceeded 100 ms.
- Verification: lifecycle/UI PASS headless and visible; full 198/198; production 159/159 exact E-014 paths with zero reuse; syntax 120/120; Solver parity `24388AD1...ED2AD`; result SHA-256 `CCB6CB6F...9C19`.
- Evidence: `benchmarks/integration/hard-ui-responsiveness-attribution-v1/` and `benchmarks/integration/hard-ui-responsiveness-fix-v1/`.

## P8-02 real-browser Hard performance and stress acceptance

- Status: `NEEDS-FIX / STOPPED` on 2026-10-02. No Solver search semantic, production runtime, Worker payload, layout, or frozen benchmark changed. The only harness edit replaced stale hard-coded task/date metadata before the complete formal rerun.
- Protocol: Chrome `154.0.8037.59`; two fresh profiles; two warmups and ten measured repetitions per profile/workload; 60 measured solves across ordinary constructive, 52-step interior Crystal, and exact W1. A separate lifecycle pass ran once headless and once visible/headful.
- Correctness/stability: 60/60 exact expected results with stable paths. W1 retained depth 6 / 3,612 states / 106,816 candidates. Maximum second-half/first-half Worker wall ratio was 1.0195.
- Cold/warm and memory: fresh-page first/repeat Hard wall times were 41.6/33.2 ms headless and 47.6/48.1 ms headful. Worker heap coverage was 60/60; maximum page post-GC drift was 0.71 MiB against 5 MiB.
- Cancellation/release: both lifecycle modes detached all handlers before one-shot termination, suppressed stale delivery, restored the UI, and immediately recovered to stable solves; every terminal Worker in each six-Worker sequence cleaned up exactly once.
- Failure: the Hard workload's timer gap exceeded 100 ms in 3/20 runs (114.0, 115.9, and 111.1 ms). Ordinary and W1 maxima were 51.0 and 45.9 ms. The per-run gate therefore fails despite passing medians and all other checks.
- Verification: full 198/198; production 159/159 exact E-014 paths with zero resource reuse; syntax 120/120; Solver copies byte-identical at `24388AD1...ED2AD`; result SHA-256 `81829CAF...FF18`.
- Evidence: `benchmarks/integration/hard-browser-production-readiness-v1/`.

## P7-03 repeated real-browser performance acceptance

- Status: `NEEDS-FIX / STOPPED` on 2026-10-01. No Solver, production UI, Worker payload, frozen benchmark, or accepted capability artifact changed.
- Protocol: two fresh Chrome profiles; three real-page workloads; two warmups and ten measured runs per profile/workload; 60 measured solves total.
- Correctness: 60/60 completed with exact frozen route/outcome/path/work expectations. W1 remained depth 6 / 3,612 states / 106,816 candidates. Every workload was path-stable across profiles and repetitions.
- Memory/drift: Worker heap coverage was 60/60. The largest post-GC page-heap increase was 1.60 MiB against a 5 MiB gate; the largest second-half/first-half wall median ratio was 1.191 against a 2.0 gate.
- Responsiveness failure: ordinary construction exceeded 100 ms in 3/20 runs (max 111.3 ms); interior Crystal exceeded it in 19/20 (max 260.7 ms); W1 was 0/20 (max 70.8 ms). Evidence points to terminal page rendering/handling, not Worker search, but does not yet fully attribute CPU cost.
- Evidence: `tests/browser/productPerformance.browser.mjs` and `benchmarks/integration/browser-performance-v1/`.

## P7-02 real-UI lifecycle and recovery acceptance

- Status: `PASS / STOPPED` on 2026-10-01. No Solver, Worker lifecycle implementation, production UI behavior, or frozen artifact changed.
- Real-page sequence: production bounded search exposed visible progress; cancellation restored the action/status state; two following solves completed with identical paths; a real mixed four/six-part Explorer request produced a terminal visible error; the corrected Explorer request completed on the same page.
- Cleanup evidence: all five native module Workers terminated exactly once after `onmessage`, `onerror`, and `onmessageerror` were detached. Captured callbacks invoked after cancellation and terminal error were inert and did not mutate the UI.
- Repetition: the complete sequence passed twice in fresh Chrome profiles. The observations used production payloads and native Workers; instrumentation only recorded messages/termination and delivered captured callbacks after cleanup.
- Durable evidence: `tests/browser/workerLifecycle.browser.mjs` and `benchmarks/integration/product-lifecycle-v1/`. This is product correctness evidence, not a browser performance distribution.

## P7-01 real-webpage production-path acceptance

- Status: `PASS / STOPPED` on 2026-09-30. No Solver architecture or search-semantic change was made.
- Scope: the real `/en/` page was configured through its visible controls with the nontrivial interior-Crystal target `RrcrRrRr:RgcrRgRg:--cr----`, four `RuRuRuRu` inputs, all ten operations, four layers, 3,000 states/level, clean painting enabled, and orientation/splitting/waste controls disabled.
- Direct route evidence: a passive page-side listener observed the unmodified production module Worker's terminal results. Both UI-triggered runs reported `solverRoute: constructive-hybrid`, `interiorCrystalStage: full-height-column-extraction`, `outcome: solved`, depth/path length 52.
- Product evidence: both runs restored the action button to `Solve`, left the status in `done`, rendered the solved status and graph, and hid the empty placeholder. The second run completed from the cleaned state and returned the identical operation path.
- Performance evidence: Chrome `153.0.8010.53` headless on the local acceptance machine observed Worker-response wall times of 43.6 ms and 82.6 ms. These two observations prove responsiveness for this acceptance case; they are not a benchmark distribution, regression threshold, or permission to change search semantics.
- Regression evidence: real Chrome lifecycle plus UI path gate PASS; production verification 159/159 solved/replay-valid/constructive-routed/exact-E-014 paths with zero resource reuse; full suite 188/188; syntax 118/118; Solver copies byte-identical at SHA-256 `876A3E5F494ECB8EDD4392506FECF5BFC7F383A42162F3599A1A4A110CBD9191`.

Current-session result: P6-14/E-015 is `REJECT / STOPPED`. Frozen PCHA-A transferred E-014 capability through Node public `shapeSolver` at stable 159/159 with exact E-014 paths and valid replay, but the static import graph made the real Chrome module Worker unloadable through Node-only `node:` dependencies. This violates correctness and benchmark-independent production viability. The activation was rolled back; Chrome lifecycle, W1 signature, E-014 focused tests, and Solver source parity pass again.

### Previous checkpoint

Development ROI Audit 已被采纳。E-004 当前 deferred-interning 路线正式关闭；保留 profiling / observer / boundary 资产，但停止补前置证据。该检查点的 P5-11 尚 pending；它后来已在不改 Solver 主线的前提下由 D-068 完成。工程正确性与 Solver capability 分开记账：tests/audit/profiling PASS 只是门槛，不单独计为 capability progress。

P6-04/E-005 已完成并按永续 Agent 停止条件停止。最终判定为 `PROVISIONAL`：TCG-A 与 TCG-B 均稳定 solved 2/159，覆盖 1 个 target；所有首次与独立复测解均 replay-valid，但未达到 3/159 且至少 2 targets 的 ACCEPT 门槛。未运行第三配置，未加入 target 特例，也未启动第二个 architecture experiment。

New-session result: P6-06/E-007 is `ACCEPT / STOPPED` under D-038. GDCS-A stably solved 78/159 across 26 targets; all first-pass and independent-repeat paths replayed valid. It adds 76 stable members and 25 targets beyond E-005, so the current capability frontier is 78/159 across 26 targets. No second architecture experiment starts in this session.

P6-07/E-008 is `ACCEPT / STOPPED` under D-040. PGDCS-A stably solved 103/159 across 35 targets; all first-pass and independent-repeat paths replayed valid. It preserves E-007's 78 members and adds 25 members across nine targets. The active capability frontier is 103/159 across 35 targets.

Current session result: P6-08/E-009 is `ACCEPT / STOPPED` under D-042. CSGDCS-A stably solved 112/159 across 38 targets, preserved all 103 E-008 members, and added nine members across three targets. All first-pass and repeat paths replayed valid. The active capability frontier is now 112/159 across 38/53 targets; no second architecture experiment starts in this session.

Continuation-session result: P6-09/E-010 is `ACCEPT / STOPPED` under D-044. MPCGDCS-A stably solved 117/159 across 40 targets, preserved all 112 E-009 members, and added five members across two targets. All first-pass and repeat paths replayed valid. The active frontier is now 117/159 across 40/53 targets; no second architecture experiment starts in this session.

Current-session result: P6-10/E-011 is `ACCEPT / STOPPED` under D-046. TIPGDCS-A stably solved 126/159 across 43 targets, preserved all 117 E-010 frontier members, and added nine members across three targets. All first-pass and repeat paths replayed valid and were path-identical. The active frontier is now 126/159 across 43/53 targets; no second architecture experiment starts in this session.

Current-session result: P6-11/E-012 is `ACCEPT / STOPPED` under D-048. SOGDCS-A stably solved 144/159 across 48 targets, preserved all 126 E-011 frontier members, and added 18 members across seven target IDs, including five fully newly covered targets. All 144 first-pass and repeat paths replayed valid and were path-identical. The active frontier is now 144/159 across 48/53 targets; no second architecture experiment starts in this session.

Current-session result: P6-12/E-013 is `ACCEPT / STOPPED` under D-050. UCRPGDCS-A stably solved 156/159 across 52 targets, preserved all 144 E-012 frontier members, and added 12 members across four newly covered target IDs. All 156 first-pass and repeat paths replayed valid and were path-identical. The active frontier is now 156/159 across 52/53 targets; no second architecture experiment starts in this session.

## P6-12 broader-Crystal resource-pool checkpoint

- Status: `ACCEPT / STOPPED`; formal baseline binding `a23979099a2ae0dc7c8fa0a77c89ffa77d23fc82170e38690de000b708082661`.
- Architecture: unchanged E-012 delegation plus one entry route from `unsupported-crystal-layout` to the already-existing finite public-token physical-mask Crystal constructor. Allocator, planner, operations, limits, and production Solver remain unchanged.
- UCRPGDCS-A first pass/repeat: 156/156 first-pass solves replay-valid; all 156 repeated and replayed valid with identical complete paths. Outcomes were 156 solved and three exhausted, with no limit/error/watchdog/invalid replay.
- Capability: all 144 E-012 members preserved; +12 stable members and +4 targets (`hard-main-008`, `hard-side-032`, `hard-side-034`, `hard-side-040`); frontier becomes 156/159 across 52/53 targets.
- Boundary: only `hard-main-010:F1/F2/F3` remain exhausted because the unchanged planner has no canonical half-scaffold for one spatial half. No impossibility claim is made.
- Artifacts: `benchmarks/experiments/unsupported-crystal-resource-pool-v1/`; identities are recorded in `REPORT.md` and `verdict.json`.
- Verification: focused 5/5; full suite 178/178 before formal and at closeout; 312/312 valid formal replays; exact membership/count/repeat/frontier/path/hash audit PASS; syntax 104/104; quick W1 exact logical signature; production Solver sources unchanged and byte-identical.
- Stop: no tuning, planner expansion, fallback, target-specific route, production integration, or E-014 in this session.

## P6-11 shared-occurrence resource-pool checkpoint

- Status: `ACCEPT / STOPPED`; formal baseline binding `a23979099a2ae0dc7c8fa0a77c89ffa77d23fc82170e38690de000b708082661`.
- Architecture: unchanged E-011 delegation plus a resource-mismatch-only stage that losslessly partitions public starting tokens, retains every non-empty Cutter output as a finite live token, and supplies target-derived ordinary/Pin/Crystal/mixed builders without resource reuse or benchmark metadata.
- SOGDCS-A first pass/repeat: 144/144 first-pass solves replay-valid; all 144 repeated and replayed valid with identical complete paths. Outcomes were 144 solved and 15 unsupported-domain, with no exhausted/limit/error/watchdog/invalid replay.
- Capability: all 126 E-011 members preserved; +18 stable members across seven target IDs; five fully new targets (`hard-main-009`, `hard-main-011`, `hard-side-037`, `hard-side-038`, `hard-side-039`); frontier becomes 144/159 across 48/53 targets.
- Boundary: 15 broader Crystal layouts remain unsupported across `hard-main-008`, `hard-main-010`, `hard-side-032`, `hard-side-034`, and `hard-side-040`. No impossibility claim is made.
- Artifacts: `benchmarks/experiments/shared-occurrence-goal-decomposed-v1/`; identities are recorded in `REPORT.md` and `verdict.json`.
- Verification: focused 6/6; full suite 173/173 before formal and at closeout; 288/288 valid formal replays; artifact membership/count/repeat/frontier/path/hash audit PASS; syntax 100/100; quick W1 exact logical signature; production Solver sources unchanged and byte-identical.
- Stop: no tuning, fallback, broader Crystal extension, production integration, or E-013 in this session.

## P6-10 resource-accounted isolated-Pin checkpoint

- Status: `ACCEPT / STOPPED`; formal baseline binding `a23979099a2ae0dc7c8fa0a77c89ffa77d23fc82170e38690de000b708082661`.
- Architecture: unchanged E-010 delegation plus a generic isolated-Pin primitive built from globally distinct exact/sacrificial resources, a full-height protected Crystal scaffold, lossless Cutter isolation, and Pin Pusher breakage. No benchmark identity or witness reaches candidate code.
- TIPGDCS-A first pass/repeat: 126/126 first-pass solves replay-valid; all 126 repeated and replayed valid with identical complete paths. Outcomes were 126 solved, 15 unsupported-domain, and 18 exhausted with no limit/error/watchdog/invalid replay.
- Capability: all 117 E-010 members preserved; +9 stable members across `hard-main-007`, `hard-side-029`, and `hard-side-036`; frontier becomes 126/159 across 43/53 targets.
- Boundary: 15 broader Crystal layouts remain unsupported; 18 resource mismatches remain, including all three `hard-side-038` families that cannot satisfy this construction's distinct exact-and-sacrificial demand set. No impossibility claim is made.
- Artifacts: `benchmarks/experiments/isolated-pin-goal-decomposed-v1/`; identities are recorded in `REPORT.md` and `verdict.json`.
- Verification: focused 6/6; full suite 167/167 before formal and at closeout; 252/252 valid formal replays; artifact membership/count/repeat/path/hash audit PASS; syntax 95/95; quick W1 exact logical signature; production Solver sources unchanged and byte-identical.
- Stop: no tuning, fallback, resource-mismatch repair, broader Crystal extension, production integration, or E-012 in this session.

## P6-09 mixed Pin/Crystal support-safe checkpoint

- Status: `ACCEPT / STOPPED`; formal baseline binding `a23979099a2ae0dc7c8fa0a77c89ffa77d23fc82170e38690de000b708082661`.
- Architecture: public-input target decomposition into support-safe halves/columns, globally distinct resource matching, protected sacrificial Crystal staging, suffix-before-Pin transitions, and exact canonical Stack/Swapper recomposition. Non-mixed targets delegate unchanged to E-009; terminal isolated-Pin construction remains excluded.
- MPCGDCS-A first pass/repeat: 117/117 first-pass solves replay-valid; all 117 repeated and replayed valid. Outcomes were 117 solved, 21 unsupported-domain, and 21 exhausted with no limit/error/watchdog/invalid replay.
- Capability: all 112 E-009 members preserved; +5 stable members across `hard-main-012` and `hard-side-031`; frontier becomes 117/159 across 40/53 targets.
- Boundary: `hard-main-007` and `hard-side-029` require the excluded terminal isolated-Pin branch; `hard-main-011` and `hard-side-031:F3` exhaust distinct-resource matching. Other earlier Crystal/resource/isolated-Pin gaps remain unresolved.
- Artifacts: `benchmarks/experiments/mixed-pin-crystal-goal-decomposed-v1/`; identities are recorded in `REPORT.md` and `verdict.json`.
- Verification: focused 6/6; full suite 161/161 before/after formal; 234/234 valid formal replays; artifact audit PASS; production Solver sources unchanged.
- Stop: no tuning, fallback, terminal isolated-Pin completion, unrelated repair, production integration, or E-011 in this session.

## P6-08 Crystal-scaffold goal-decomposed checkpoint

- Status: `ACCEPT / STOPPED`; formal baseline binding `a23979099a2ae0dc7c8fa0a77c89ffa77d23fc82170e38690de000b708082661`.
- Architecture: exact dense single-color Crystal-to-Pin scaffold reversal, physical PGDCS scaffold construction, and one verified Crystal Generator step using only public input. Non-Crystal targets preserve the frozen E-008 path.
- CSGDCS-A first pass/repeat: 112/112 first-pass solves replay-valid; all 112 repeated and replayed valid. Outcomes were 112 solved, 30 unsupported-domain, and 17 exhausted with no limit/error/watchdog/invalid replay.
- Capability: all 103 E-008 members preserved; +9 stable members across `hard-side-030`, `hard-side-033`, and `hard-side-035`; frontier becomes 112/159 across 38/53 targets.
- Boundaries: final-Pin, sparse, mixed-color, and multi-stage Crystal layouts remain outside scope; resource mismatches and isolated-Pin layouts remain unresolved. No production integration occurred.
- Artifacts: `benchmarks/experiments/crystal-scaffold-goal-decomposed-v1/`; hashes are recorded in its `REPORT.md` and `verdict.json`.
- Verification: focused 7/7, full suite 155/155 before/after formal, 224/224 valid replays, artifact audit PASS, syntax 87/87, quick W1 exact signature, production Solver source parity PASS.
- Stop: no tuning, fallback, broader Crystal domain, isolated-Pin/resource-mismatch repair, production integration, or E-010 in this session.

## P6-07 Pin-aware goal-decomposed checkpoint

- Status: `ACCEPT / STOPPED`; formal baseline binding `a23979099a2ae0dc7c8fa0a77c89ffa77d23fc82170e38690de000b708082661`.
- Architecture: target-derived pure-Pin columns/support regions, bounded physical atom extraction, augmenting-path distinct-resource matching, terminal-Pin overflow, and physical Pin Pusher/Stacker assembly. The standalone solver receives only public input and no target identity, witness, construction metadata, structural tag, benchmark recipe, or prior path.
- PGDCS-A first pass: 103 SOLVED / 39 UNSUPPORTED_DOMAIN / 17 EXHAUSTED / 0 LIMIT / 0 ERROR / 0 WATCHDOG. Every solution replayed valid.
- Repeat: all 103 first-pass solves repeated in independent fresh processes and replayed valid again. Stable coverage is 103/159 and 35/53 targets.
- Capability: +25 stable members and +9 targets beyond E-007; frontier becomes 103/159 across 35 targets. This exceeds every predeclared ACCEPT requirement.
- Boundaries: Crystal-bearing members are outside the frozen stage; isolated-Pin layouts are unsupported; resource mismatches are not impossibility proofs. The architecture is not integrated into the production Worker/API.
- Artifacts: `benchmarks/experiments/pin-goal-decomposed-v1/`; identities are solver `6ccf166b...230f7`, config `48b5b5bf...242bc`, first pass `a835cc09...7c508`, repeat `060d1d17...49131`, and summary `84b087d4...cdd15`.
- Verification: focused 6/6; full suite 148/148 before formal and after closeout; 206/206 formal solution returns replay-valid; artifact identity/membership/count/repeat/hash audit PASS; syntax 83/83; quick W1 exact depth/state/candidate signature; production Solver copies byte-identical at `EE558425...18A37`; diff check clean apart from line-ending warnings.
- Stop: no tuning, fallback configuration, Crystal/isolated-Pin extension, production integration, or E-009 in this session.

## P6-06 goal-decomposed constructive-synthesis checkpoint

- Status: `ACCEPT / STOPPED`; formal baseline binding `a23979099a2ae0dc7c8fa0a77c89ffa77d23fc82170e38690de000b708082661`.
- Architecture: deterministic target-cell decomposition, bounded physical source extraction, augmenting-path distinct-resource matching, and exact layer-first/column-first physical assembly. The standalone solver receives only public input and no target identity, witness, construction metadata, structural tags, benchmark recipe, or prior path.
- GDCS-A first pass: 78 SOLVED / 78 UNSUPPORTED_DOMAIN / 3 EXHAUSTED / 0 LIMIT / 0 ERROR / 0 WATCHDOG. Every solution replayed valid.
- Repeat: all 78 first-pass solves repeated in independent fresh processes and replayed valid again. Stable coverage is 78/159 and 26/53 targets.
- Capability: +76 stable members and +25 targets beyond E-005; frontier becomes 78/159 across 26 targets. This exceeds all predeclared ACCEPT requirements.
- Boundaries: special Pin/Crystal targets were outside the frozen first-stage domain. The three `hard-side-039` members exhausted distinct-resource matching and are not proved unsolvable. The architecture is not integrated into the production Worker/API.
- Artifacts: `benchmarks/experiments/goal-decomposed-v1/`; identities are solver `fdb28670...bcf26`, config `451d3b75...d6137`, first pass `0adf209c...6d208`, and repeat `7baac62e...a7106`.
- Verification: focused 8/8; full suite 142/142 before formal and after closeout; syntax 79/79; artifact identity/count/repeat audit PASS; quick W1 exact signature; production Solver copies byte-identical at `EE558425...18A37`; diff check clean apart from line-ending warnings.
- Stop: no tuning, fallback configuration, special-target extension, production integration, or E-008 in this session.

## P6-05 bounded best-first plan-synthesis checkpoint

- Status: `REJECT / STOPPED`; formal baseline binding `a23979099a2ae0dc7c8fa0a77c89ffa77d23fc82170e38690de000b708082661`.
- Architecture: deterministic global best-first plan nodes plus a bounded priority-ranked binary partner pool, resource-disjoint masks, and ordinary/Pin/Crystal operation physics. Solver code receives no benchmark identity, witness, or construction metadata.
- BFPS-A: 1 SOLVED / 158 LIMIT; its sole replay-valid 10-operation `hard-main-001:F2` solution repeated in a fresh process. Limits split 143 time / 15 expanded-node.
- BFPS-B: 0 SOLVED / 159 LIMIT; all limits were time. No repeat was needed because the solved set was empty.
- Capability: zero stable new members, zero stable new targets, no increment over E-005. Wider best-first search was non-monotonic: B lost A's known member while doing fewer median attempts within twice the wall budget.
- Correctness: small-domain gate 7/7 and final full suite 134/134; artifact identity/count audit PASS; 75/75 JavaScript/module syntax checks PASS; Solver copies remain byte-identical at `EE558425...18A37`; no formal ERROR, WATCHDOG, or invalid replay. Engineering PASS does not change the REJECT verdict.
- Artifacts: `benchmarks/experiments/best-first-plan-v1/`; standalone code is retained only for reproducibility and is not integrated into production Solver.

Every future comparison must identify baseline canonical hash `a23979099a2ae0dc7c8fa0a77c89ffa77d23fc82170e38690de000b708082661`.

## P6-04 target-conditioned candidate-generation checkpoint

- Status: `PROVISIONAL / STOPPED`.
- Architecture: a resource-disjoint construction chart generates target-compatible fragments and assemblies directly from the public Solver input. Candidate code receives no targetId, family slot, witness, construction metadata, structural tags, or benchmark recipe.
- TCG-A: 2 SOLVED / 70 LIMIT / 78 UNSUPPORTED_DOMAIN / 9 EXHAUSTED.
- TCG-B: 2 SOLVED / 71 LIMIT / 78 UNSUPPORTED_DOMAIN / 8 EXHAUSTED.
- Stable capability: `hard-main-001:F1` and `hard-main-001:F2`, both nine operations, both solved again in independent fresh processes. Stable member coverage is 2/159 and target coverage is 1/53.
- Correctness gates: all eight solution returns across both configurations' first-pass/repeat runs replay-valid; small-domain gate 7/7; full suite 127/127; no formal ERROR or WATCHDOG.
- Boundary: this is nonzero capability progress over 0/159, but not ACCEPT. Tests/audit/replay PASS do not add capability credit. Artifacts: `benchmarks/experiments/target-conditioned-v1/`.
- Stop at that experiment checkpoint: no further configuration, E-005 extension, E-004 evidence work, or second architecture experiment starts in that round. P5-11 stayed separate and was later completed under D-068.

## Hard 53×3 architecture profiling checkpoint

- Status: `ARCHITECTURE PROFILING: PASS`; `FIRST OPTIMIZATION: NOT YET JUSTIFIED`.
- A fixed 16-instance sample covered candidate caps, shape-universe caps, every requested mechanism, all three `hard-side-021` families, and the sole timeout as a control. Fifteen cap-driven cases reproduced their frozen logical signatures exactly; timeout profiling is descriptive only.
- Formal per-instance candidates/states ratios are 18.44 / 233.93 / 729.67 / 1,155.54 at min/median/p90/max. Exact sampled candidate-cap branching spans about 22–1,503 candidates per expanded state, demonstrating both dense local branching and deep attrition.
- Stacker+Swapper contribute 54.91% of raw attempts and 69.20% of created operation-output shapes. Sampled duplicate full-state/output-shape rates are only 3.394%/2.463%, so duplicate-output suppression is not the leading explanation.
- Shape-cap profiles created 1,199,836 shapes, 86.48% never expanded; pairwise operations caused 71.52% of births. This proves eager pre-retention interning consumes the budget, not that deferred identity is search-equivalent.
- E-004 was designed but not run. Astra Medium blocked implementation because shape IDs affect operation/output and tie ordering, D-024 counts all distinct outputs, current diagnostics perturb lazy behavior, and descriptor memory was unmeasured. No High escalation and no second experiment occurred.
- Test-only profiling changed neither the public nine-argument API nor Worker protocol. Full tests pass 114/114; focused profile/baseline tests pass 7/7; Solver copies are byte-identical at SHA-256 `35D0D9265CA3E88A91152993CB9C5137D77DE548967B503834465AE743C9CD69`.
- Detailed conclusions are in `ARCHITECTURE_PROFILING.md`; machine-readable aggregate and records are under `benchmarks/profiling/hard-53x3-architecture-v1/`. Frozen baseline artifacts remain unchanged.

## P6-03 retained-candidate observer checkpoint

- Status: `P6-03 GATE: BLOCKED`; E-004 remains `BLOCKED / NOT RUN`. Test-only observer infrastructure and results are retained.
- The passive observer does not invoke a ranking loser's lazy factory solely for observation. Small ordered fixtures and all exercised D-024 boundaries pass without changing the public Solver API or Worker protocol.
- The fixed eight shape-cap cases match the formal baseline exactly in plain and observer runs. Operation-output births/materialized/unmaterialized are 1,199,836 / 329,188 / 870,648; final-retained/expanded identities are 165,168 / 162,224. D-024 still charges 1,200,000 slots.
- The 72.5639% unmaterialized count is not Shape-object savings: similarity scoring may parse a Shape before ranking. Descriptor payload is a string-size proxy, and observer RSS is additive overhead rather than deferred-backend net memory.
- The ordered event seam is not yet a complete frozen oracle for colored operations, Splitter/coarseness, target-layer bonuses, cache FIFO/eviction, and all initialization paths. No deferred backend was implemented.
- Verification: focused 9/9, full 120/120, W1 exact logical signature, 67 syntax checks, matching Solver SHA-256 `EE558425...18A37`, and diff check with only line-ending warnings. Astra Medium independently returned `BLOCKED` with no High escalation.
- Report: `docs/optimization/P6_03_OBSERVER.md`; machine-readable artifacts: `benchmarks/profiling/hard-53x3-p6-03-v1/`.
