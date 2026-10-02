# Resume

Last updated: 2026-10-02 (Asia/Shanghai)

Model/Agent selection is governed only by `docs/optimization/WORKFLOW.md`; historical model labels elsewhere are not current routing policy.

## Hard 53×3 release checkpoint

The frozen selection is formally released as provenance-preserving composite `hard-53x3-stage-v1`, manifest schema v4/revision `hard-53x3-stage-v1-manifest-r1`, canonical identity `5836350ed30779f76fa32a6d4e9dce3628f7b5a554dfc4cb4e512c3b1ffe72db`. It binds final-selection identity `6e3efdece360e8dd338a49dd3edd8fe10620b288aa161d35a8d01ab966e1b47f` and resolves provenance/replay/expansion/fingerprint at 159/159 from six immutable sources. Composite tests passed 14/14, the full repository suite passed 107/107, and GPT-6 Astra Medium returned PASS with no critical unresolved issue. No Solver baseline or optimization was started in this release task.

## Hard 53×3 formal Solver baseline checkpoint

The formal baseline is complete and frozen as `hard-53x3-solver-baseline-v1`, canonical hash `a23979099a2ae0dc7c8fa0a77c89ffa77d23fc82170e38690de000b708082661`. It binds Solver identity `68f2be34f9737204a69f1db2c83463c76e9a3110732f829da916ae5d14aba873`, config hash `2ed7ea7b1d6af5d8c81e7b4a3baa9277a41cfb8c460947b8664706058ddab009`, exact membership hash `2d575703b6f014a18280368e3924a9f9e08697aacec5579f6e1ab536591aade3`, and result hash `b5280ee921365f7dcbaaaed900aba040c49e3b3dedcd89c9af181f659ee0d987` to the released benchmark identities above.

All 159 instances ran once with frozen configuration and explicit outcomes: 0 solved, 106 candidate-cap, 52 shape-universe-cap, one internal solver timeout, and zero state-cap, memory-limit, search-exhausted, or error. All 53 targets were 0/3 solved. Artifacts live at `benchmarks/solver-baselines/hard-53x3-v1/`; `REPORT.md` is the summary and the JSON files plus 159 records are authoritative. No Solver semantic modification or benchmark mutation occurred. GPT-6 Astra Medium independently returned PASS with no blocking issue; no High escalation was needed.

## Current phase

P8-05 **End-to-end Hard-capable Release** is `PASS / STOPPED`. Release `hard-capable-v1`, annotated tag `hard-capable-v1`, Gitea Actions run 21, and the production identity endpoint all bind to commit `f62683a3be7e826c8c764afcee4977114b15a9f0`. Production at `https://shapez2.ysc.icu/solver/` matches all 56 frozen RC runtime hashes and all four required constructive dependency hashes. The online page/Worker solved the nontrivial 52-step interior-Crystal case twice and restored the UI lifecycle. No Solver, benchmark, capability, feature, migration, or optimization change occurred.

P8-04 **Hard-capable Release Candidate closeout** remains `PASS / STOPPED`. The accepted candidate is `hard-capable-rc-v1:3e94ef55d6bcb09a4a74e7777516ae547ee02b7168ca566b2e0963dde80e5f17`, bound unchanged by P8-05.

P6-14/E-015 is complete and stopped with a `REJECT` verdict under D-054. Frozen PCHA-A solved 159/159 through Node public `shapeSolver` in both first pass and independent repeat; all 318 paths replayed valid, all 159 repeats were path-identical, all 159 paths exactly matched E-014 repeat, and resource reuse was zero. However, the static production import graph reaches Node-only `node:fs/promises` and `node:crypto`, so the real Chrome module Worker could not start. This predeclared correctness failure overrides formal capability success. The production activation was rolled back; the E-014 standalone frontier remains 159/159.

P6-13/E-014 is complete and stopped with an `ACCEPT` verdict under D-052. Frozen ICCDCS-A stably solved 159/159 across all 53 targets, preserved all 156 E-013 frontier members, and added `hard-main-010:F1/F2/F3`. All 159 first-pass and all 159 repeat paths replayed valid and were path-identical across fresh processes; no path reused a public or derived token. The frozen formal Hard failure distribution is empty. This is complete artifact coverage, not a general completeness proof.

P6-12/E-013 is complete and stopped with an `ACCEPT` verdict under D-050. Frozen UCRPGDCS-A stably solved 156/159 across 52 targets, preserved all 144 E-012 frontier members, and added all three families of `hard-main-008`, `hard-side-032`, `hard-side-034`, and `hard-side-040` (12 members total). All 156 first-pass and all 156 repeat paths replayed valid and were path-identical across fresh processes. The active capability frontier is now 156/159 across 52/53 targets. Only `hard-main-010:F1/F2/F3` remain exhausted.

P6-11/E-012 is complete and stopped with an `ACCEPT` verdict under D-048. Frozen SOGDCS-A stably solved 144/159 across 48 targets, preserved all 126 E-011 frontier members, and added all 18 former resource-mismatch members across seven target IDs. Five targets became fully newly covered: `hard-main-009`, `hard-main-011`, `hard-side-037`, `hard-side-038`, and `hard-side-039`. All 144 first-pass and all 144 repeat paths replayed valid and were path-identical across fresh processes. The active capability frontier is now 144/159 across 48/53 targets.

P6-10/E-011 is complete and stopped with an `ACCEPT` verdict under D-046. Frozen TIPGDCS-A stably solved 126/159 across 43 targets, preserved all 117 E-010 frontier members, and added nine members across `hard-main-007`, `hard-side-029`, and `hard-side-036`. All 126 first-pass and all 126 repeat paths replayed valid and were path-identical across fresh processes. The active capability frontier is now 126/159 across 43/53 targets.

The Development ROI Audit supersedes the former next-step recommendation. E-004's current deferred-interning route is closed; its profiling/observer assets remain, but no more prerequisite evidence will be built for it. P5-11 later completed as a separate Explorer correctness/resource task without changing the Solver mainline.

P6-07/E-008 is complete and stopped with an `ACCEPT` verdict. The sole frozen PGDCS-A configuration stably solved 103/159 members across 35 targets; all 103 first-pass paths replayed valid and all 103 repeated in independent fresh processes with valid replay. It preserves E-007's 78 members and adds 25 members across nine targets, so the active capability frontier is now 103/159 across 35/53 targets.

P6-08/E-009 is complete and stopped with an `ACCEPT` verdict under D-042. Frozen CSGDCS-A stably solved 112/159 across 38 targets, preserved all 103 E-008 frontier members, and added nine members across `hard-side-030`, `hard-side-033`, and `hard-side-035`. All 112 first-pass and 112 repeat paths replayed valid. The active capability frontier is now 112/159 across 38/53 targets.

P6-09/E-010 is complete and stopped with an `ACCEPT` verdict under D-044. Frozen MPCGDCS-A stably solved 117/159 across 40 targets, preserved all 112 E-009 frontier members, and added five members across `hard-main-012` and `hard-side-031`. All 117 first-pass and 117 repeat paths replayed valid. The active capability frontier is now 117/159 across 40/53 targets.

## Verified repository state

- Branch/HEAD: local `codex/solver-optimization` at release commit `f62683a3be7e826c8c764afcee4977114b15a9f0`; `origin/main` and annotated tag `hard-capable-v1` point to that commit. Gitea Actions run 21 deployed it successfully.
- Latest P7-02 checkpoint: reconfirmed on 2026-10-02 in Chrome `154.0.8037.59`, once headless and once visible/headful, using fresh profiles and the real `/en/` page/native module Workers. Visible progress, cancel/immediate restart, six-Worker cleanup, stale-callback isolation, consecutive path stability, malformed Worker error recovery, mixed-part invalid-call isolation, bounded partial rendering, and button/status cleanup all passed. Evidence: `benchmarks/integration/product-lifecycle-v1/`.
- Latest P7-01 checkpoint: real `/en/` UI constructive route PASS twice with identical 52-step paths and complete render/button cleanup; Chrome wall observations 43.6/82.6 ms; production verification 159/159; full suite 188/188; syntax 118/118; Solver parity `876A3E5F...9191`.
- Latest P6-15 checkpoint: current public Solver 159/159 solved, replay-valid, constructive-routed, and exact-path-equal to E-014 across 53/53 targets with zero token reuse; real Chrome module Worker lifecycle plus constructive solve PASS; production graph 16/16 local browser-safe runtime modules with no benchmark imports; full suite 188/188; syntax 118/118; W1 signature unchanged; Solver parity SHA-256 `876A3E5F...191`.
- Release scope: the previously tracked modifications and untracked runtime/test/evidence batch are committed. Raw `.states.ndjson` profiling streams, `.codex-temp-*`, and `node_modules` remain excluded. The final status-only follow-up does not change the deployed runtime.
- P8-01 recovery reconciliation on 2026-10-02: branch/HEAD and the complete working-tree inventory were rechecked; the stale P5-11 `in progress` experiment label and tracked-file inventory were corrected. `npm test` passed 198/198, `npm run verify:production` passed 159/159 with exact E-014 paths and zero resource reuse, Solver copies remained byte-identical at SHA-256 `24388AD1...ED2AD`, and `git diff --check` reported only line-ending notices. No runtime code, frozen artifact, benchmark, or Solver semantic changed.
- P8-02 browser readiness on 2026-10-02: Chrome `154.0.8037.59`; 60/60 exact measured solves and stable paths; 60/60 Worker heap coverage; maximum page drift 0.71 MiB; maximum wall drift 1.0195; headless/headful cancellation and recovery PASS; full 198/198; production 159/159; syntax 120/120; Solver parity `24388AD1...ED2AD`. The Hard workload breached the 100 ms responsiveness gate in 3/20 runs, max 115.9 ms, so the verdict is `NEEDS-FIX / STOPPED`. Evidence: `benchmarks/integration/hard-browser-production-readiness-v1/`.
- P8-04 RC closeout on 2026-10-02: current full suite 198/198; syntax 120/120; browser-safe static graph PASS; Solver parity `24388AD1...ED2AD`; composite trust chain PASS; P8-03 harness `104888D6...12F3` and results `CCB6CB6F...9C19` exact; diff hygiene PASS apart from line-ending notices. The existing dirty working tree is explicitly part of the content-addressed identity, not hidden behind a clean-tree claim.
- The working diff contains C-001, retained E-001/E-002/E-003, P5-08 result/UI classification, test-only P5 infrastructure, standalone E-005 through E-014, and rejected/rolled-back E-015 artifacts. Preserve unrelated/user changes and do not assume any uncommitted batch is disposable.
- Latest E-015 checkpoint: Node formal first pass/repeat were 159/159 with 318/318 replay-valid returns, 159/159 identical repeats, exact equality to E-014 paths, and zero resource reuse. The candidate failed the real Chrome Worker gate because its static import graph contains Node-only modules; rollback restored full suite 184/184, Chrome lifecycle PASS, syntax 111/111, W1 exact signature, artifact/hash audit PASS, and Solver SHA-256 `EE558425...18A37`. Formal artifacts live at `benchmarks/experiments/production-constructive-hybrid-v1/`.
- Latest E-014 checkpoint: `npm test` passed 184/184 before formal execution and again at closeout; its focused interior-Crystal gate passed 6/6; formal first pass and repeat contain 318/318 replay-valid solution returns with 159/159 path-identical repeats. All 156 delegated paths also exactly match the frozen E-013 repeat paths. The E-014 membership/frontier/path/resource/hash audit passed; syntax passed 109/109; quick W1 retained its exact logical signature. The earlier real Chrome Worker lifecycle checkpoint remains PASS against module Workers and the production `/en/` UI.
- Quick W1 passed at depth 6 with 3,612 states and 106,816 generated candidates. The one-run wall time is not a new performance baseline.
- Latest closeout: all 111 tracked/untracked `.js`/`.mjs` files passed `node --check`; `git diff --check` passed apart from informational LF/CRLF warnings.
- `shapeSolver.js` and `shapeSolver_web.js` are byte-identical at SHA-256 `EE558425BBC1761C5F01B82BB72D02F4D7DD611208C083D7355827600E518A37`.
- Formal-baseline verification on 2026-09-24/26: baseline tests 5/5, full repository suite 112/112, composite tests 14/14, trust chain 159/159, real Chrome Worker lifecycle PASS, syntax 60/60, deterministic artifact reconstruction PASS, and `git diff --check` PASS apart from informational line-ending warnings.
- The released 53×3 composite includes every Hard target. The former manifest-v1 Hard holdout is therefore observed and must not be described as untouched in future optimization claims.

## P5-05 official baseline

- Manifest v1 contains 105 valid unique official goals: Hard 53 and Insane 52. Hard remains frozen as 32 development / 11 validation / 10 holdout.
- Results exist at `benchmarks/results/official-hard-development-v1-10s.json`, `official-hard-validation-v1-10s.json`, and `official-insane-stress-v1-5s.json`.
- Hard development: 10 solved / 16 generated-state limit / 6 watchdog. Hard validation: 4 / 6 / 1. Insane stress: 4 / 11 / 37 under its 5-second watchdog. No natural-unsolved or error result was recorded.
- All 18 solved paths replayed valid; none was invalid or unsupported. No Hard holdout case appears in any result file.
- The reports embed exact snapshot hashes. They use pre-P5-08 solver hash `C820FC50...01BE`; current code is `1F25E23D...D2E`. Do not relabel these immutable artifacts as a current-source rerun or repeat the expensive suites without a task-specific reason. A current non-holdout one-case classification-v2 smoke preserved its depth/work signature and replay validity.

## P5-07 accepted gate and open boundary

- The additive `shapeSolverTestOnly` export leaves existing Worker messages, the positional `shapeSolver(...)` API, and normal results unchanged. Diagnostic mode alone materializes semantic keys/beam losers and is forbidden for timing claims.
- Cap-2 fixed gate: reference depth 3, 14 states, 21 transitions, max width 8; no-split naturally exhausts. E-003 on/off both replay at depth 3. On: 5 states/15 candidates, one unique reject and one eviction. Off: 5/18, seven unique rejects. Retained depth-2 semantic sets differ and exact-primary coarseness ties occur.
- Oracle transition budgets are exact and recognize a goal generated on the final permitted transition. The discovery tool has a hard parent watchdog, automatic replay, invalid-path failure, and coverage reporting.
- The final deterministic discovery reached 1,000,000 transitions in about 5.5 seconds without a nested/multiple-Splitter witness. It completed Rotator CW+Swapper, only the `----RuCu` seed of the Rotator 180 tier, and no Cutter/Stacker tier. This is inconclusive and the gap remains open.
- Independent Sol High review accepted P5-07 as done. Future recipe semantic experiments need their own predeclared gate and cannot claim nested/global completeness from P5-07.

## P5-01/P5-11 Explorer closure checkpoint

- P5-11 is `PASS / STOPPED` under D-067/D-068. Explorer is a reusable-input expression-height closure, not finite-inventory recipe reachability.
- Both Stacker orders and self-pairs, Swapper commutativity, novel multi-output siblings, mixed-part invalid-call isolation, full Painter/Crystal colors, empty/cycle suppression, and explicit depth zero are covered by a separate reference closure and focused regressions.
- Production limits are 25,000 attempts, 3,000 ms, 128 shapes, 256 operation nodes, 768 edges, and 1 MiB serialized result. Calls commit atomically; limited runs return `outcome:"limit"`, exact reason/counters/depths, and a localized rendered partial graph.
- Cancellation remains immediate parent-side `terminate()`. Real Chrome passed mixed-part completion, bounded partial rendering, cleanup, stale suppression, cancellation, terminal errors, and restart.
- Closeout: focused Explorer/Worker 16/16 during audit, full suite 198/198, Chrome PASS, production 159/159 exact E-014 paths, W1 exact logical signature, syntax 120/120, byte-identical Solver copies at `24388AD1...ED2AD`. GPT-6 Astra Medium returned PASS with no blocker or escalation.

## P5-08 accepted classification

- Every non-cancel recipe result now has additive `outcome` and exact `beamPruned`. Outcomes are `solved`, `limit`, `not-found-pruned`, and `exhausted`; solved/limit retain precedence.
- Production exposes only a boolean latch. It materializes enough precheck losers to exclude visited/retained duplicates until the first unique beam loss, then preserves lazy rejection. Exact reject/evict/duplicate event totals remain test-only.
- Progress no longer reports `consideredCount - size` as a prune count. UI has separate bilingual messages for natural exhaustion and pruned no-result. W4 is `not-found-pruned` and retains depth 21 / 17,155 states / 139,718 candidates.
- Official harness schema v2 splits exhausted/pruned while preserving aggregate unsolved compatibility and distinct limits/watchdogs/cancellation/errors. Historical reports remain unchanged.
- Formal W1-W5 (2 warmups/5 runs) passed exact logical signatures with no observed timing regression. Non-holdout `hard-main-003` solved/replayed under schema v2. Independent Sol High review accepted P5-08.

## Required recovery procedure

On every new session, do not trust this file alone:

1. Read all files in `docs/optimization/`, the benchmark manifest documentation, and result summaries without loading all raw shape codes unless needed.
2. Inspect branch/HEAD, `git status --short --branch`, complete tracked diff, untracked files, and recent commits.
3. Reconcile every `in_progress` task with actual code, tests, and artifacts; repository evidence wins over documents.
4. Run proportionate tests/signature checks. Reuse the official baseline and other expensive verified artifacts when their recorded identity is adequate.
5. Keep both solver copies byte-identical and update state/experiment/decision/resume documents at each natural checkpoint.

## Completed P5-09 checkpoint

- D-024 is implemented. Defaults and the public solver/Worker protocol remain unchanged; only `shapeSolverTestOnly(...)` accepts validated smaller limits and a deterministic finite monotonic clock.
- The depth-two Rotator boundary probe establishes generated 1/2/3, visited 1/2/3, and shape 2/3/4 as one-less/exact/one-more cases. Exact and one-more solve at the same depth/work/path; one-less returns the corresponding limit. Shape budget 1 returns a clean initialization limit.
- The mixed four/six-part Swapper probe records one invalid attempted action and zero generated candidates. Elapsed time below/equal/above the injected budget classifies as exhausted/time-limit/time-limit, and the state-tail check covers a run below the periodic attempt cadence.
- The probe runs in a fresh child process under a 3-second watchdog. `npm test` passes 37/37; all 19 JavaScript/module syntax checks pass; one-run W1-W5 retain exact logical signatures; both solver copies match at SHA-256 `145F7061...D6819A`.

## Next step

P8-05 is `PASS / STOPPED`. No next task is automatically authorized. Preserve release `hard-capable-v1`, its RC binding, the deployment identity, and all frozen evidence until the owner explicitly scopes later work.

## P8-05 PASS checkpoint

- Release: `hard-capable-v1`; commit/tag `f62683a3be7e826c8c764afcee4977114b15a9f0`; RC `hard-capable-rc-v1:3e94ef55d6bcb09a4a74e7777516ae547ee02b7168ca566b2e0963dde80e5f17`.
- Push/CI: `origin/main` and tag push PASS; Gitea Actions run 21 / number 7 completed successfully at the release SHA.
- Deployment: `https://shapez2.ysc.icu/solver/`; production identity endpoint reports the release SHA/ref/run, and release metadata reports the tag/RC identity.
- Production content: 56/56 frozen RC hashes and 4/4 constructive dependency hashes exact. `.gitattributes` fixed a release-only line-ending normalization mismatch without semantic change.
- Gates: 198/198 tests; 159/159 production capability with replay, exact E-014 paths, constructive routing, 53/53 targets, and zero reuse; 120/120 syntax; Solver parity; real installed-Chrome lifecycle PASS.
- Online smoke: public `/en/` page HTTP 200; native production Worker solved the 52-step interior-Crystal Hard case twice; depth/states 52; graph rendered; button restored; zero browser console errors.
- Evidence: `benchmarks/integration/hard-capable-release-v1/`.

## P8-04 PASS checkpoint

- RC identity: `hard-capable-rc-v1:3e94ef55d6bcb09a4a74e7777516ae547ee02b7168ca566b2e0963dde80e5f17`.
- Production evidence: 159/159 Hard members across 53/53 targets; all replay-valid; exact E-014 paths; constructive routes; zero resource reuse.
- Product evidence: browser-safe static imports, headless/headful Worker/UI lifecycle, terminal error recovery, frozen 60/60 readiness, and 97.1 ms maximum against the 100 ms gate.
- Current tree: 198/198 tests, 120/120 syntax, byte-identical Solver copies, frozen evidence hashes exact, and no unexpected runtime semantic delta. The tree remains intentionally uncommitted and is identified by content rather than commit SHA.
- Release notes, known limitations, non-blocking debt, and checklist: `docs/optimization/RELEASE_CANDIDATE.md` and `benchmarks/integration/hard-capable-release-candidate-v1/REPORT.md`.
- Historical boundary: the formal baseline, frozen benchmark, E-014, E-015, P8-02, P8-03, and rejected experiment verdicts retain their original meaning and content.

## P8-03 PASS checkpoint

- Attribution: real Chrome/V8 evidence captured a 118.4 ms diagnostic gap and isolated the main-thread work to a roughly 73 ms terminal message task, roughly 72 ms of synchronous Cytoscape construction, followed by first paint. Worker search remained on the dedicated Worker thread; canvas serialization and browser layout were not the blocker.
- Repair: yield one event-loop turn after terminal result delivery, suppress stale continuation by task identity, and reuse the solver Cytoscape instance while replacing all graph elements plus the deterministic preset layout. No result/graph update is skipped and no Solver, Worker payload, mix, Explorer, graph-data, or visual semantic changed.
- Frozen acceptance: original harness identity and 2-profile/2-warmup/10-run protocol; 60/60 exact results and stable paths; 60/60 Worker heap samples; maximum page drift 0.377 MiB; maximum wall drift 1.3246; every timer gap at most 100 ms. Hard max was 97.1 ms; ordinary/W1 maxima were 31.6/30.5 ms.
- No regression: lifecycle/UI PASS headless and visible; full 198/198; production 159/159 exact E-014 paths with zero reuse; syntax 120/120; byte-identical Solver copies `24388AD1...ED2AD`; raw results `CCB6CB6F...9C19`.
- Evidence: `benchmarks/integration/hard-ui-responsiveness-attribution-v1/` and `benchmarks/integration/hard-ui-responsiveness-fix-v1/`.

## P8-02 NEEDS-FIX checkpoint

- Protocol: current Chrome `154.0.8037.59`, two fresh profiles, three frozen real-page workloads, two warmups plus ten measured repetitions per profile/workload, plus one headless and one visible lifecycle run.
- Correctness and wall time: 60/60 exact results and stable paths. The representative 52-step Hard workload had Worker-result median/max 36.4/47.8 ms and UI-settled median/max 92.35/121.5 ms. Fresh-page first/repeat observations were 41.6/33.2 ms headless and 47.6/48.1 ms headful.
- Stability and memory: all 60 Workers yielded heap samples; maximum page post-GC drift was 0.71 MiB; maximum second-half/first-half Worker wall ratio was 1.0195.
- Cancellation/release: both browser modes detached all handlers before exactly one termination, suppressed stale delivery, restored UI state, and immediately completed stable follow-up solves.
- Failure: interior Crystal exceeded the 100 ms timer-gap gate in 3/20 runs (114.0, 115.9, and 111.1 ms). Ordinary and W1 maxima were 51.0 and 45.9 ms.
- Verification: full suite 198/198, production verification 159/159, syntax 120/120, byte-identical Solver copies at `24388AD1...ED2AD`; no product optimization or Solver semantic change.
- Evidence: `benchmarks/integration/hard-browser-production-readiness-v1/`; raw results SHA-256 `81829CAF...FF18`.

## P7-03 NEEDS-FIX checkpoint

- Protocol: Chrome `153.0.8010.53`, two fresh profiles, three real-page workloads, two warmups plus ten measured repetitions per profile/workload.
- Correctness: 60/60 exact route/outcome/path/work results; W1 remained depth 6 / 3,612 states / 106,816 candidates; no product or Solver code changed.
- Wall time: Worker-result medians were 39.4 ms ordinary, 40.4 ms interior Crystal, and 469.45 ms W1. UI-settled medians were 81.35, 142.3, and 504.8 ms.
- Memory/drift: all 60 Workers yielded heap samples; maximum page-heap drift was 1.60 MiB; maximum second-half/first-half median ratio was 1.191.
- Failure: timer gaps over 100 ms occurred in 3/20 ordinary and 19/20 interior-Crystal runs, max 260.7 ms; W1 remained below the threshold in all 20 runs.
- Verification: full suite 188/188, production verification 159/159, real Chrome lifecycle/UI gate PASS, syntax 119/119, Solver copies byte-identical at `876A3E5F...9191`.
- Evidence: `benchmarks/integration/browser-performance-v1/`; raw results SHA-256 `81728305...E775`.

## P6-14 REJECT checkpoint

- Status: `REJECT / STOPPED`; formal baseline binding `a23979099a2ae0dc7c8fa0a77c89ffa77d23fc82170e38690de000b708082661`.
- Node formal capability: 159/159 first pass and repeat through public `shapeSolver`, 318/318 valid replays, 159/159 identical repeats, 159/159 exact E-014 paths, 53/53 targets, zero resource reuse, empty failure distribution.
- Blocking gate: Chrome module Worker startup failed because the static constructive dependency graph imports Node-only `node:fs/promises` and `node:crypto` via `benchmark-core.mjs`.
- Verdict rationale: public Worker correctness is mandatory, so formal Node capability success is insufficient for ACCEPT or PROVISIONAL.
- Rollback: production activation removed; full suite 184/184; real Chrome lifecycle PASS; focused E-014 6/6; syntax 111/111; W1 exact depth/state/candidate signature; artifact/hash audit PASS; Solver copies byte-identical at `EE558425...18A37`.
- Artifacts: `benchmarks/experiments/production-constructive-hybrid-v1/`; exact identities and diagnosis are in `REPORT.md` and `verdict.json`.
- Stop: no tuning, browser port, dynamic-load redesign, eligibility expansion, benchmark mutation, or second architecture experiment.

## P6-13 ACCEPT checkpoint

- Status: `ACCEPT / STOPPED`; formal baseline binding `a23979099a2ae0dc7c8fa0a77c89ffa77d23fc82170e38690de000b708082661`.
- Architecture: unchanged E-013 delegation plus a generic target-derived full-height monochrome Crystal-column stage at the sole remaining half-scaffold boundary. Each new column is physically scaffolded, generated, losslessly isolated, and recomposed with an independently built ordinary remainder from the finite public pool.
- ICCDCS-A first pass/repeat: 159/159 first-pass solves replay-valid; all 159 repeated and replayed valid with identical complete paths. Outcomes were 159 solved and no failures of any class.
- Capability: all 156 E-013 members preserved; +3 stable members and +1 target (`hard-main-010:F1/F2/F3`); frontier becomes 159/159 across 53/53 targets.
- Artifacts: `benchmarks/experiments/interior-crystal-column-v1/`; exact identities are in `REPORT.md` and `verdict.json`.
- Verification: focused 6/6, full suite 184/184 before formal and at closeout, 318/318 valid formal replays, 159/159 path-identical repeats, exact membership/frontier/resource/hash audit PASS, syntax 109/109, quick W1 exact signature, production Solver parity PASS, frozen release planner hash preserved.
- Stop: no post-formal tuning, fallback, target-specific route, production integration, benchmark mutation, or second architecture experiment.

## P6-12 ACCEPT checkpoint

- Status: `ACCEPT / STOPPED`; formal baseline binding `a23979099a2ae0dc7c8fa0a77c89ffa77d23fc82170e38690de000b708082661`.
- Architecture: unchanged E-012 delegation plus one `unsupported-crystal-layout` entry into the unchanged finite public-token physical-mask Crystal constructor. No allocator, planner, operation, limit, or production Solver change occurred.
- UCRPGDCS-A first pass/repeat: 156/156 first-pass solves replay-valid; all 156 repeated and replayed valid with identical complete paths. Outcomes were 156 solved and three exhausted, with no unsupported-domain/limit/error/watchdog/invalid replay.
- Capability: all 144 E-012 members preserved; +12 stable members and +4 targets (`hard-main-008`, `hard-side-032`, `hard-side-034`, `hard-side-040`); frontier becomes 156/159 across 52/53 targets.
- Boundary: only `hard-main-010:F1/F2/F3` remain exhausted at the unchanged half-scaffold planner boundary. No impossibility claim is made.
- Artifacts: `benchmarks/experiments/unsupported-crystal-resource-pool-v1/`; exact identities are in `REPORT.md` and `verdict.json`.
- Verification: focused 5/5, full suite 178/178 before formal and at closeout, 312/312 valid formal replays, exact artifact audit PASS, syntax 104/104, quick W1 exact signature, production Solver parity PASS.
- Diagnostic disclosure: the predeclaration feasibility probe used the 15 remaining public inputs and is not a formal result; no blinded-evaluation claim is made.
- Stop: no tuning, planner change, fallback, target-specific route, production integration, or E-014 in this session.

## P6-11 ACCEPT checkpoint

- Status: `ACCEPT / STOPPED`; formal baseline binding `a23979099a2ae0dc7c8fa0a77c89ffa77d23fc82170e38690de000b708082661`.
- Architecture: unchanged E-011 delegation plus a resource-mismatch-only shared-occurrence stage. It losslessly partitions public starting tokens, retains every non-empty Cutter byproduct, preserves token linearity, and feeds target-derived canonical builders without benchmark identity, witnesses, or prior paths.
- SOGDCS-A first pass/repeat: 144/144 first-pass solves replay-valid; all 144 repeated and replayed valid with identical complete paths. Outcomes were 144 solved and 15 unsupported-domain with no exhausted/limit/error/watchdog/invalid replay.
- Capability: all 126 E-011 members preserved; +18 stable members across seven target IDs and +5 fully covered targets; frontier becomes 144/159 across 48/53 targets.
- Boundary: the remaining 15 members are broader Crystal layouts across `hard-main-008`, `hard-main-010`, `hard-side-032`, `hard-side-034`, and `hard-side-040`. No impossibility claim is made.
- Artifacts: `benchmarks/experiments/shared-occurrence-goal-decomposed-v1/`; exact identities are in `REPORT.md` and `verdict.json`.
- Verification: focused 6/6, full suite 173/173 before/after formal, 288/288 valid formal replays, artifact audit PASS, syntax 100/100, quick W1 exact signature, production Solver parity PASS.
- Stop: no tuning, fallback, broader Crystal extension, production integration, or E-013 in this session.

## P6-10 ACCEPT checkpoint

- Status: `ACCEPT / STOPPED`; formal baseline binding `a23979099a2ae0dc7c8fa0a77c89ffa77d23fc82170e38690de000b708082661`.
- Architecture: unchanged E-010 delegation plus a generic isolated-Pin primitive built from globally distinct exact/sacrificial resources, a full-height protected Crystal scaffold, lossless Cutter isolation, and Pin Pusher breakage. No benchmark identity or witness reaches candidate code.
- TIPGDCS-A first pass/repeat: 126/126 first-pass solves replay-valid; all 126 repeated and replayed valid with identical complete paths. Outcomes were 126 solved, 15 unsupported-domain, and 18 exhausted with no limit/error/watchdog/invalid replay.
- Capability: all 117 E-010 members preserved; +9 stable members across `hard-main-007`, `hard-side-029`, and `hard-side-036`; frontier becomes 126/159 across 43/53 targets.
- Boundary: 15 broader Crystal layouts remain unsupported; 18 resource mismatches remain, including all three `hard-side-038` families that cannot satisfy this construction's distinct exact-and-sacrificial demand set. No impossibility claim is made.
- Artifacts: `benchmarks/experiments/isolated-pin-goal-decomposed-v1/`; identities are recorded in `REPORT.md` and `verdict.json`.
- Verification: focused 6/6; full suite 167/167 before formal and at closeout; 252/252 valid formal replays; artifact membership/count/repeat/path/hash audit PASS; syntax 95/95; quick W1 exact logical signature; production Solver sources unchanged and byte-identical.
- Stop: no tuning, fallback, resource-mismatch repair, broader Crystal extension, production integration, or E-012 in this session.

## P6-09 ACCEPT checkpoint

- Status: `ACCEPT / STOPPED`; formal baseline binding `a23979099a2ae0dc7c8fa0a77c89ffa77d23fc82170e38690de000b708082661`.
- Architecture: target-only mixed Pin/Crystal support-safe decomposition, globally distinct public-resource matching, protected sacrificial Crystal staging, suffix-before-Pin transitions, and exact canonical Stack/Swapper recomposition. Non-mixed members delegate unchanged to E-009.
- MPCGDCS-A first pass: 117 SOLVED / 21 UNSUPPORTED_DOMAIN / 21 EXHAUSTED / 0 LIMIT / 0 ERROR / 0 WATCHDOG. Every solution replayed valid.
- Repeat: all 117 first-pass solves repeated in independent fresh processes and replayed valid again. Stable coverage is 117/159 and 40/53 targets.
- Capability: all 112 E-009 members preserved; +5 stable members and +2 targets (`hard-main-012`, `hard-side-031`).
- Boundaries: terminal isolated-Pin mixed layouts remain excluded; four additional mixed members exhaust resource matching. Sparse/mixed-color non-Pin Crystal, earlier resource mismatch, and isolated-Pin gaps remain unresolved.
- Artifacts: `benchmarks/experiments/mixed-pin-crystal-goal-decomposed-v1/`; exact hashes are in its `REPORT.md` and `verdict.json`.
- Verification: focused 6/6, full suite 161/161 before/after formal, 234/234 formal solution returns replay-valid, and artifact membership/count/repeat/frontier/hash audit PASS. Production Solver sources were unchanged.
- Stop: no tuning, fallback, terminal isolated-Pin completion, unrelated repair, production integration, or E-011 in this session.

## P6-08 Crystal-scaffold goal-decomposed checkpoint

- Status: `ACCEPT / STOPPED`; formal baseline binding `a23979099a2ae0dc7c8fa0a77c89ffa77d23fc82170e38690de000b708082661`.
- Architecture: exact target-derived Pin scaffold reversal for dense, single-color, final-Pin-free Crystal targets, frozen PGDCS scaffold construction, and one verified physical Crystal Generator step. Non-Crystal targets delegate unchanged to E-008; no benchmark identity or witness reaches the solver.
- CSGDCS-A first pass: 112 SOLVED / 30 UNSUPPORTED_DOMAIN / 17 EXHAUSTED / 0 LIMIT / 0 ERROR / 0 WATCHDOG / 0 INVALID_REPLAY.
- Repeat: all 112 first-pass solves repeated in independent fresh processes and replayed valid again. All 103 E-008 frontier members remain stable.
- Capability: +9 stable members and +3 targets (`hard-side-030`, `hard-side-033`, `hard-side-035`); frontier becomes 112/159 across 38/53 targets.
- Boundaries: 15 final-Pin, 12 sparse, and three mixed-color Crystal members remain unsupported; 11 resource mismatches and six isolated-Pin layouts remain exhausted. The architecture is not integrated into production.
- Artifacts: `benchmarks/experiments/crystal-scaffold-goal-decomposed-v1/`; identities are solver `51a129ab...7d79f`, config `62129bc1...9fe5`, first pass `c4afc5b2...433e6`, repeat `f4f1f792...bf76`, summary `1f8a2f21...5c10`.
- Verification: focused 7/7; full suite 155/155 before and after formal; 224/224 formal solution returns replay-valid; artifact audit PASS; syntax 87/87; quick W1 exact signature; production Solver copies byte-identical at `EE558425...18A37`; diff check clean apart from line-ending warnings.
- Stop: no tuning, fallback, broader Crystal stage, isolated-Pin/resource-mismatch repair, production integration, or E-010 in this session.

## P6-07 ACCEPT checkpoint

- Frozen baseline: `a23979099a2ae0dc7c8fa0a77c89ffa77d23fc82170e38690de000b708082661`; sole configuration: PGDCS-A.
- Formal first pass: 103 SOLVED / 39 UNSUPPORTED_DOMAIN / 17 EXHAUSTED / 0 LIMIT / 0 ERROR / 0 WATCHDOG / 0 INVALID_REPLAY.
- Stability: every one of 103 first-pass solutions replayed valid, solved again in a fresh process, and replayed valid again. Stable coverage is 103/159 members and 35/53 targets.
- Capability increment: all 78 E-007 frontier members are preserved; 25 members and nine target IDs are newly stable. Resulting frontier: 103/159 and 35/53.
- Scope: deterministic pure-Pin target layouts, distinct-resource matching, bounded unary extraction, terminal-Pin overflow, and physical Pin Pusher/Stacker construction using public input only. Crystal-bearing targets and isolated-Pin scaffolds remain outside PGDCS-A; resource-mismatch misses are not impossibility proofs.
- Identities: solver `6ccf166b...230f7`; config `48b5b5bf...242bc`; first pass `a835cc09...7c508`; repeat `060d1d17...49131`; summary `84b087d4...cdd15`.
- Engineering gate: focused 6/6 passed; full suite 148/148 passed before formal execution and again after closeout; artifact identity/membership/count/repeat/hash audit passed; syntax passed 83/83; quick W1 retained depth 6 / 3,612 states / 106,816 candidates. Production Solver copies remain unchanged and byte-identical at `EE558425...18A37`.
- Artifacts: `benchmarks/experiments/pin-goal-decomposed-v1/` contains frozen config, first-pass, repeat, summary, verdict, and report.

## P6-06 ACCEPT checkpoint

- Frozen baseline: `a23979099a2ae0dc7c8fa0a77c89ffa77d23fc82170e38690de000b708082661`; sole configuration: GDCS-A.
- Formal first pass: 78 SOLVED / 78 UNSUPPORTED_DOMAIN / 3 EXHAUSTED / 0 LIMIT / 0 ERROR / 0 WATCHDOG.
- Stability: every one of 78 first-pass solutions replayed valid, solved again in a fresh process, and replayed valid again. Stable coverage is 78/159 members and 26/53 targets.
- Capability increment: 76 new stable members and 25 new targets beyond E-005. Resulting frontier: 78/159 and 26/53.
- Scope: deterministic ordinary-target goal decomposition, distinct-resource matching, bounded unary extraction, and direct physical assembly using public input only. Pin/Crystal members are outside GDCS-A; `hard-side-039:F1/F2/F3` are resource-mismatch exhaustions, not impossibility proofs.
- Identities: solver `fdb28670...bcf26`; config `451d3b75...d6137`; first pass `0adf209c...6d208`; repeat `7baac62e...a7106`.
- Engineering gate: small-domain 8/8; full suite 142/142 before formal and after closeout; artifact audit PASS; syntax 79/79; quick W1 exact depth/state/candidate signature; production Solver copies byte-identical at `EE558425...18A37`; diff check clean apart from informational line-ending warnings.
- Artifacts: `benchmarks/experiments/goal-decomposed-v1/` contains frozen config, first-pass, repeat, summary, verdict, and report.

## P6-05 REJECT checkpoint

- Frozen baseline: `a23979099a2ae0dc7c8fa0a77c89ffa77d23fc82170e38690de000b708082661`.
- BFPS-A: 1 SOLVED / 158 LIMIT; stable replay-valid `hard-main-001:F2`, 10 operations, already in E-005's frontier. Failure reasons: 143 time / 15 expanded-node.
- BFPS-B: 0 SOLVED / 159 LIMIT; all 159 time. No solved member required repeat.
- Formal safety: 0 ERROR, 0 WATCHDOG, 0 invalid replay across both first passes and repeats.
- Capability accounting: 0 new stable members, 0 new targets; formal frontier unchanged at 2/159 and 1/53.
- Engineering gate: best-first small-domain tests 7/7; final repository suite 134/134; E-006 artifact identity/count audit PASS; syntax 75/75; Solver copies byte-identical at SHA-256 `EE558425BBC1761C5F01B82BB72D02F4D7DD611208C083D7355827600E518A37`; `git diff --check` clean apart from informational line-ending warnings.
- Authoritative artifacts: `benchmarks/experiments/best-first-plan-v1/configs.json`, `BFPS-A/first-pass.json`, `BFPS-A/repeat.json`, `BFPS-A/summary.json`, `BFPS-B/first-pass.json`, `BFPS-B/repeat.json`, `BFPS-B/summary.json`, `verdict.json`, and `REPORT.md`.

## P6-04 PROVISIONAL checkpoint

- Frozen config A: 2 SOLVED / 70 LIMIT / 78 unsupported ordinary-first-domain / 9 EXHAUSTED.
- Frozen config B: 2 SOLVED / 71 LIMIT / 78 unsupported / 8 EXHAUSTED.
- Stable members: `hard-main-001:F1` and `hard-main-001:F2`; both use nine operations and both replay valid in first pass and fresh-process repeat.
- Stable coverage: 2/159 members, 1/53 targets. The two configuration results overlap exactly and are not additive.
- Verification: target-conditioned small-domain suite 7/7; full repository suite 127/127; formal results contain no ERROR or WATCHDOG.
- Artifacts: `benchmarks/experiments/target-conditioned-v1/configs.json`, per-config first-pass/repeat/summary JSON, and `REPORT.md`.

## P6-02 architecture profiling checkpoint

- Sample and artifacts: `benchmarks/profiling/hard-53x3-architecture-v1/sample.json`, `analysis.json`, 16 record summaries, and per-expanded-state NDJSON. Aggregate values were independently recomputed from every record JSON.
- Formal ratio: candidates/visited states across 159 cases is min 18.44, median 233.93, p90 729.67, max 1,155.54. Exact expanded-state profiling separates dense branching from deep frontier attrition.
- Main attribution: Stacker+Swapper produce 54.91% of raw attempts and 69.20% of operator-created shapes. Full-state/output-shape duplicates in deterministic sampled states are only 3.394%/2.463%.
- Universe signal: 84.84% of all profiled operator-created shapes and 86.48% in shape-cap profiles are never expanded. Target-relevance fields are descriptive proxies only and do not authorize pruning.
- `hard-side-021`: F1/F2/F3 formal wall 67.672/49.855/3.698 seconds, states 225,101/177,155/21,292, depth 76/60/8; exact raw attempts per expansion 22.66/29.01/278.87.
- Taxonomy: C1 dense pair enumeration, C2 deep frontier attrition, C3 eager universe pollution, C4 post-ranking state duplication, C5 low-rate duplicate outputs. Counts overlap.
- E-004: deferred operation-output interning; Astra Medium blocked implementation on ordering, D-024 semantics, observer perturbation, and memory evidence. No High escalation was required.
- Verification: 15/15 cap-driven profile parity; timeout control is descriptive. Focused profile/baseline tests 7/7, full tests 114/114, baseline tests 5/5, solver-copy SHA-256 `35D0D9265CA3E88A91152993CB9C5137D77DE548967B503834465AE743C9CD69`.

## Completed P5-10 checkpoint

- D-025 freezes UI cancellation as immediate parent-side `terminate()`. The synchronous Worker loops do not process queued cancel messages while running; cooperative cancellation would require a separately reviewed scheduling redesign.
- `workerLifecycle.js` owns one-shot cleanup. Result, explicit Worker error, native error, `messageerror`, constructor/send failure, and cancel cannot terminate or callback more than once; handlers detach before UI callbacks and captured stale handlers are inert.
- Both Worker sources emit terminal errors for solve and Explorer exceptions. The mixed-part Explorer failure described at the P5-10 checkpoint cleared the task and permitted restart; P5-11 later converted that case to successful per-call invalid-input isolation.
- `npm test` passes 43/43. `npm run test:browser-worker` passes against real Chrome 152 module Workers and the production `/en/` UI, covering solve/explore cancel/restart, exception/restart, stale suppression, button restoration, and terminal cleanup.
- Quick W1 retains solved depth 6 / 3,612 states / 106,816 candidates. All 24 JavaScript/module files pass syntax checks; `git diff --check` has only line-ending warnings. Solver copies match at SHA-256 `1F25E23D...D2E`.

## P6-03 blocked checkpoint

- The retained test-only observer does not materialize an already-lazy ranking loser solely for observation. It records ordered operation/candidate/collector/frontier events, D-024 slots, and identity lifecycle sets without changing the public Solver API or Worker protocol.
- All eight fixed P6-02 shape-cap cases preserve the formal baseline outcome/depth/state/candidate/beam signature in plain and observer fresh processes. Output births were 1,199,836; 870,648 (72.5639%) never entered `materializeCandidate`; D-024 still charged 1,200,000 slots.
- This is inventory/state-key demand evidence, not Shape-object savings. Similarity scoring can parse outputs before ranking. The additive observer's fresh-process Node RSS delta was +2.79 to +56.53 MiB, median +35.46 MiB, and cannot be interpreted as a deferred-backend or browser-memory result.
- The ordered seam lacks complete frozen coverage for colored operations, Splitter/coarseness, target-layer bonuses, cache FIFO/eviction, and broader initialization. No deferred backend or production optimization was implemented.
- Verification: focused 9/9, full suite 120/120, quick W1 depth 6 / 3,612 states / 106,816 candidates, syntax 67/67, solver copies byte-identical at `EE558425...18A37`, and diff check clean apart from line-ending warnings.
- GPT-6 Astra Medium independently verified the identities, eight logical signatures, and aggregates and returned `BLOCKED`; no Astra High escalation was needed. Details: `docs/optimization/P6_03_OBSERVER.md` and `benchmarks/profiling/hard-53x3-p6-03-v1/`.
