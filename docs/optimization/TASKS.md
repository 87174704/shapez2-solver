# Optimization Tasks

Statuses: `pending`, `in_progress`, `done`, `blocked`, `rejected`.

Model labels on completed rows are historical execution records. All new assignments and any pending work use the current authority in `WORKFLOW.md`; they must not revive retired default routes.

| ID | Task | Status | Risk | Recommended model | Acceptance criteria |
| --- | --- | --- | --- | --- | --- |
| P1-01 | Protect existing Git state and record environment | done | low | Luna Low | Starting branch/commit/worktree and machine/runtime recorded |
| P1-02 | Map repository, build/test/deploy configuration | done | low | Luna Medium | Entry points, modules, commands, and local-only boundary recorded |
| P1-03 | Audit core search algorithm and correctness invariants | done | high | Sol High | Evidence-based algorithm map, pruning review, correctness risks, line references |
| P1-04 | Establish correctness baseline and coverage gaps | done | medium | Terra Medium | Reproducible test/coverage results and prioritized missing coverage |
| P1-05 | Add a reproducible solver benchmark harness | done | medium | Terra High | Stable named workloads, statistics, work counters, documented command |
| P1-06 | Capture CPU and memory profiles | done | medium | Terra High | Reproducible method plus hotspot/allocation evidence and limitations |
| P1-07 | Consolidate phase-one bottlenecks | done | high | Sol High | Ranked, evidence-backed bottlenecks without changing core algorithm |
| P1-08 | Phase-one regression checkpoint | done | low | Terra Medium | Tests, benchmark, syntax, Git diff, and all state docs updated |
| P2-01 | Obtain independent optimization proposals | done | high | Sol High (2 independent) | Ranked candidates distinguish behavior-preserving work from search-semantic changes |
| P2-02 | Design correctness fixes and regression tests | done | high | Sol High | Exact semantics, minimal change, edge cases, and test oracle reviewed |
| P2-03 | Fix empty-output consume transition | done | high | Terra High after Sol design | Regression fails before/fixes after; path replay, waste semantics, full tests pass |
| P2-04 | Isolate incompatible binary input pairs | done | high | Terra High after Sol design | Mixed 4/6-part search skips invalid pair without masking unrelated errors |
| P2-05 | Audit splitting multi-target goal allocation | done | high | Sol High | Constructive proof/test or documented proof of correctness |
| P2-06 | Rank phase-two experiment backlog | done | high | Sol High | Benefit/risk/cost/verifiability/rollback matrix recorded in decisions |
| P2-07 | Run first behavior-preserving performance experiment | done | medium | Terra High | E-001 kept; strict signatures and CPU/memory evidence recorded |
| P2-08 | Phase-two checkpoint | done | medium | Terra Medium | 10/10 tests, W1-W5 signatures, syntax/hash/diff review passed |
| P3-01 | Attribute post-E-001 cache hotspot | done | medium | Terra High | Per-cache call/hit/miss/eviction evidence on W1-W3/W5 recorded |
| P3-02 | Run E-002 numeric operation-cache key experiment | done | medium | Terra High | Kept; collision-free key, strict signatures, formal and paired A/B complete |
| P3-03 | Re-profile after E-002 and select E-003 or stop equivalent tuning | done | medium | Terra High | CPU hotspots compared; equivalent tuning stopped because no material target remains; no new RSS claim made |
| P4-01 | Design splitting correctness and solution-quality oracle | done | high | Sol High | Exact domain, independent BFS/goal/replay semantics, metrics, fixtures, limits, and gates recorded in `ORACLE.md` |
| P4-02 | Implement the approved oracle and adversarial fixtures | done | medium-high | Terra High after Sol design | Test-only integer BFS/replay accepted; 20/20 tests, exact matrix, fixed beam fixture, W1 signature, syntax and hashes pass |
| P4-02a | Add fixed Split-required oracle fixtures | done | high | Luna search + Sol proof + Terra tests | Three strict Swapper counterexamples require Splitter across insensitive, sensitive, and multi-target modes; cap 100/5,000 paths replay at reference depth |
| P4-03 | Rank splitting search-semantic experiments | done | high | Sol High | Coarse-flow equal-score tie-break ranked first; exact hypothesis, scope, gates, and rollback criteria recorded |
| P4-04 | Run E-003 coarse-flow tie-break experiment | done | high | Terra High after Sol design + Sol review | Kept; 27/27 tests, oracle gates, exact non-splitting signatures, and W5 depth-9/21,777-candidate solution pass |
| P4-05 | Phase-four regression checkpoint | done | medium | Terra High + primary acceptance | Full tests, formal W1-W5, replay, syntax, hashes, diff and state docs updated |
| P5-00 | Absorb the independent Astra audit and correct evidence boundaries | done | high | Primary | C-01/H-01 through H-05/M-02/M-03 are mapped to tasks; W4, oracle, replay, and E-003 claims match measured evidence |
| P5-01 | Audit and isolate Explorer correctness/resource risks | done | high | Sol High | Shape-closure contract proposed; reverse Stacker, multi-output, mixed-part, colors, budgets, lookup, cancellation, cleanup, and browser risks recorded before edits |
| P5-02 | Freeze official-workload taxonomy, configuration, and Hard data split | done | medium | Luna Low + Primary | Manifest v1 has 105 validated unique cases; Hard is frozen at 32 development/11 validation/10 holdout; configuration and contamination rule are documented in `BENCHMARKS.md` |
| P5-03 | Build the official Hard/Insane benchmark harness | done | medium | Terra High | Fresh-process cases, IPC watchdog progress, source/manifest identity, filters/holdout gate, JSON artifact, work/time/RSS/replay and aggregate reporting pass review |
| P5-04 | Extend continuous path replay to the complete recipe operation set | done | high | Terra High after Sol semantics check | Replay covers all ten operations plus Splitter, exact color params and cleanPainting; solved official cases automatically report valid/invalid and invalid replay fails the harness |
| P5-05 | Record the first official-workload baseline | done | medium-high | Terra High | Hard development/validation and bounded Insane stress JSON results are saved; no Hard holdout outcome was run; watchdog and solver limits remain distinct |
| P5-06 | Design the missing E-003 pruning/completeness gate | done | high | Sol High | Existing P4-02a witness at cap 2 satisfies splitting/unique-pruning/E-003-participation/Split-required BFS conditions; test seam, nested discovery, and revert criteria are fixed |
| P5-07 | Implement and run the E-003 A/B oracle gate | done | high | Terra High after Sol design + Sol acceptance | Cap-2 Split-required A/B gate passes; bounded nested discovery is truthfully inconclusive at 1M transitions; hard watchdog, replay, coverage, and exact oracle limits pass independent Sol review |
| P5-08 | Add truthful beam-pruning and no-result classification | done | high | Sol High design + Terra implementation | Exact boolean latch excludes duplicate/visited rejections; result/UI/harness distinguish exhausted, not-found-pruned and limits; 36/36 plus W1-W5 pass Sol review |
| P5-09 | Verify recipe resource-limit boundaries | done | high | Terra High after Sol test design | Injected small limits cover before/equal/over generated, visited, shape, and time budgets plus invalid-pair-heavy work; external watchdog prevents long/OOM tests |
| P5-10 | Verify Worker cancellation and lifecycle | done | high | Sol High + Terra/browser verification | Terminate-based solve/explore cancellation, cancel/error restart, stale suppression, one-shot termination, cleanup, and real Chrome/UI behavior are covered |
| P5-11 | Specify and repair Explorer closure/resource semantics | done | high | Primary + GPT-6 Astra Medium audit | PASS / STOPPED: reusable-input reference closure, full colors, invalid-call isolation, atomic attempt/time/shape/op/edge/serialization limits, localized partial-result UI, real Chrome lifecycle, full regressions, and independent audit pass |
| P6-01 | Establish the released Hard 53×3 formal Solver baseline and failure landscape | done | high | GPT-5.6 Sol High orchestration + GPT-6 Sol/Luna workers + GPT-6 Astra Medium audit | Release trust chain, frozen config, 159/159 classified outcomes, canonical identity, aggregates, failure landscape, tests, and independent audit all pass without Solver semantic edits |
| P6-02 | Profile the first architecture bottleneck selected from formal failure clusters | done | high | GPT-5.6 Sol High orchestration + GPT-6 Luna mechanical analysis + GPT-6 Sol instrumentation + GPT-6 Astra Medium audit | Fixed 16-case sample, exact operator/candidate/shape funnels, architecture taxonomy, formal per-instance ratios, logical parity, tests, and audit are recorded; no optimization was justified or implemented |
| P6-03 | Prove an order-stable, non-materializing gate for deferred shape identity and quantify its counterfactual benefit | blocked | high | GPT-5.6 Sol High orchestration + GPT-6 Sol implementation + GPT-6 Astra Medium audit | Passive observer, 8-case measurement, and boundary fixtures pass, but complete ordered equivalence and pre-ranking Shape-object/storage demand remain unproven; E-004 stays blocked |
| P6-04 | Run E-005 target-conditioned candidate generation on the formal 159 | done | high | Primary | PROVISIONAL: both frozen configs stably solve the same replay-valid 2/159 from one target; below the 3/159 and two-target ACCEPT gate; experiment stopped |
| P6-05 | Run E-006 bounded best-first plan synthesis on the formal 159 | rejected | high | Primary | REJECT: BFPS-A stably reproduces only prior-frontier `hard-main-001:F2`; BFPS-B solves 0/159; no stable new member and no invalid replay/error/watchdog |
| P6-06 | Run E-007 goal-decomposed constructive synthesis on the formal 159 | done | high | Primary | ACCEPT: 78/159 stable replay-valid solves across 26 targets; 76 members and 25 targets beyond the prior frontier; experiment stopped |
| P6-07 | Run E-008 Pin-aware goal-decomposed constructive synthesis on the formal 159 | done | high | Primary | ACCEPT: 103/159 stable replay-valid solves across 35 targets; +25 members and +9 targets beyond E-007; experiment stopped |
| P6-08 | Run E-009 Crystal-scaffold goal-decomposed constructive synthesis on the formal 159 | done | high | Primary | ACCEPT: 112/159 stable replay-valid solves across 38 targets; all 103 E-008 members preserved; +9 members and +3 targets; experiment stopped |
| P6-09 | Run E-010 mixed Pin/Crystal support-safe goal-decomposed constructive synthesis on the formal 159 | done | high | Primary | ACCEPT: 117/159 stable replay-valid solves across 40 targets; all 112 E-009 members preserved; +5 members and +2 targets; experiment stopped |
| P6-10 | Run E-011 resource-accounted isolated-Pin constructive synthesis on the formal 159 | done | high | Primary | ACCEPT: 126/159 stable replay-valid solves across 43 targets; all 117 E-010 members preserved; +9 members and +3 targets; experiment stopped |
| P6-11 | Run E-012 shared-occurrence resource-pool constructive synthesis on the formal 159 | done | high | Primary | ACCEPT: 144/159 stable replay-valid solves across 48 targets; all 126 E-011 members preserved; +18 members across 7 target IDs and +5 fully covered targets; experiment stopped |
| P6-12 | Run E-013 broader-Crystal resource-pool activation on the formal 159 | done | high | Primary | ACCEPT: 156/159 stable replay-valid solves across 52 targets; all 144 E-012 members preserved; +12 members and +4 targets; experiment stopped |
| P6-13 | Run E-014 interior Crystal-column decomposition on the formal 159 | done | high | Primary | ACCEPT: 159/159 stable replay-valid solves across all 53 targets; all 156 E-013 members preserved; +3 `hard-main-010` members; experiment stopped |
| P6-14 | Run E-015 production constructive-hybrid activation on the formal 159 | rejected | high | Primary | REJECT: Node public entry solved stable 159/159 with exact E-014 paths, but static Node-only planner imports prevented the real Chrome module Worker from starting; production activation rolled back and experiment stopped |
| P6-15 | Browser-safe production integration of the frozen E-014 architecture | done | high | Primary | PASS / STOPPED: real Chrome module Worker executes the constructive route; current public entry is 159/159 replay-valid with exact E-014 paths; production graph has no Node or benchmark-tooling imports; full suite 188/188 |
| P7-01 | Verify the real webpage uses the accepted production Solver path | done | high | Primary | PASS / STOPPED: `/en/` UI completed the 52-step interior-Crystal solve twice through `constructive-hybrid`, rendered the graph/status, restored the action button, and returned an identical path; observed Chrome wall times were 43.6/82.6 ms |
| P7-02 | Exercise real-UI solve lifecycle and recovery as a product sequence | done | high | Primary | PASS / STOPPED: visible progress, cancellation, stale suppression, two path-stable completed solves, terminal Explorer error cleanup, and same-page recovery passed twice in real Chrome with production Worker payloads |
| P7-03 | Measure repeated real-browser performance and responsiveness | done | medium-high | Primary | NEEDS-FIX / STOPPED: 60/60 correct path-stable solves with complete memory/drift evidence; ordinary render exceeded 100 ms in 3/20 and interior-Crystal render in 19/20, max 260.7 ms |
| P7-04 | Close product acceptance and release-readiness risks | done | high | Primary + GPT-6 Astra Medium final audit | PASS / STOPPED: deterministic preset solver-DAG layout passes 60/60 correctness and all responsiveness/memory/drift gates; full regressions, production 159/159, and independent final audit pass |
| P8-01 | Recover repository state and reconcile durable closeout records | done | low | Primary | Branch/HEAD, working-tree inventory, stale task status, Solver parity, full 198/198 suite, production 159/159 verification, and diff hygiene are reconciled without runtime or frozen-artifact changes |
| P8-02 | Re-accept real-browser Hard performance and stress readiness | done | medium-high | Primary | NEEDS-FIX / STOPPED: 60/60 correctness, cold/warm timing, memory/drift, cancellation/restart, and lifecycle gates pass, but the 52-step Hard workload exceeds the frozen 100 ms timer-gap gate in 3/20 runs, max 115.9 ms |
| P8-03 | Attribute and repair the Hard UI responsiveness blocker | done | high | Primary | PASS / STOPPED: Chrome trace attributes the breach to repeated solver Cytoscape reconstruction/first paint; one-turn separation plus solver-instance reuse passes the unchanged 60-run gate at 97.1 ms max with full lifecycle, memory, 198/198, and 159/159 verification |
| P8-04 | Close the Hard-capable Release Candidate from frozen evidence | done | medium | Primary | PASS / STOPPED: content-addressed `hard-capable-rc-v1` binds the 56-file runtime snapshot, 159/159 replay/path continuity, browser-safe/lifecycle/readiness/100 ms gates, current 198/198 and 120/120 checks, release notes, limitations, debt, and immutable historical verdicts without runtime or remote release actions |
| P8-05 | Publish the end-to-end Hard-capable Release | done | high | Primary | PASS / STOPPED: commit/tag `f62683a3...`, Gitea Actions run 21, production identity/hash verification, online 52-step Worker/UI smoke, and RC binding all pass; only release-mechanical packaging fixes were made |

## Gate

P1-03 through P1-08 are complete. The next phase must rank candidate changes by expected gain, correctness risk, implementation cost, verifiability, and rollback difficulty before implementing any experiment.

## Phase-one findings in priority order

1. Correctness blockers: empty-output transitions are dropped; incompatible 4-part/6-part binary pairs abort the search.
2. Algorithmic explosion: splitting can consume the entire 5,000,000-candidate budget even with a frontier of 100.
3. Candidate materialization: inventory cloning plus full sort/string state-key construction occurs before duplicate rejection and drives CPU/GC.
4. Binary operation expansion: O(m²) input-pair enumeration multiplies the candidate/keying cost.
5. Frontier scaling: cap 5,000 roughly doubles fresh-process peak RSS increase versus cap 1,000 and returns a different, shorter path, so performance/quality tradeoffs must remain visible.
6. Explorer correctness/resource isolation: unbounded enumeration, linear lookup in inner loops, and missing reverse Stacker expansion require a separate review.

## Phase-two ranked experiment backlog

| Rank | Candidate | Expected benefit | Correctness risk | Cost | Verifiability | Rollback |
| ---: | --- | --- | --- | --- | --- | --- |
| 1 | Score precheck and lazy candidate materialization | high | low-medium | medium | very high; strict W1-W5 signatures | easy |
| 2 | Canonical ordered state vector and incremental key | high | low-medium | medium | high; shadow old/new key | easy |
| 3 | Collision-free operation-cache key representation | medium | low-medium | low-medium | high | easy |
| 4 | Binary compatibility/no-op prefilter while preserving enumeration | medium | low | low-medium | high | easy |
| 5 | Material lower-bound pruning | medium-high | medium; changes beam occupancy | medium | medium-high | easy |
| 6 | On-demand splitting macro edges | very high on W5 | high | very high | medium | medium |
| 7 | Split quotas/fragmentation penalty/coarse-flow tie-break | very high on W5 | high; changes search heuristic | low-medium | medium | easy |

Candidates 1-4 are intended to preserve logical search behavior. Candidates 5-7 change retained states, work counters, or path quality and require explicit algorithm experiments after the equivalent optimizations.

## Phase-three conclusion

P3-03 found no sufficiently large behavior-preserving hotspot after E-002. Equivalent micro-tuning is closed unless new profiling evidence changes that conclusion. The P4-01/P4-02 oracle gate has passed; P4-03 must now rank semantic experiments before any production change.

## Phase-four experiment ranking

1. Coarse-flow tie-break only when primary similarity scores are exactly equal: very high expected W5 benefit, medium quality risk, low-medium cost, high verifiability, easy rollback.
2. Split quota/per-state restriction: very high benefit but high correctness risk because it deletes legal edges.
3. On-demand splitting macro edges: potentially very high benefit, but high semantic risk and very high implementation/verification cost.
4. Formally admissible material lower bound: low-medium expected W5 benefit; no experiment without a proof of admissibility.
5. Fragmentation penalty that can override unequal primary scores: high benefit but high search-quality risk; consider only after the pure tie-break result.

Unequal-throughput restriction and residual preservation are isolated product/semantic decisions, not performance candidates.

E-003 remains retained. Its original acceptance evidence was insufficient for the critical bounded-beam case identified by Astra, but P5-06/P5-07 now add a cap-2 fixture that simultaneously requires splitting, prunes unique states, changes retained membership, and observes an E-003 ordering decision while both A/B paths replay at reference depth. The nested/multiple-Splitter gap remains open. P5-10 and P5-11 have now completed the Explorer lifecycle and closure/resource gates without changing recipe Solver semantics.

## Phase-five checkpoint

- P5-07 now supplies the missing cap-2 Split-required/pruned E-003 A/B gate. It does not prove nested/multiple-Splitter completeness: the fixed discovery budget found no qualifying witness and covered only the complete Rotator CW+Swapper tier plus a prefix of the Rotator 180 tier.
- P5-05's three official time-bounded baseline artifacts are complete and contain no Hard holdout cases. Their source identity is frozen inside each JSON report.
- P5-01's read-only Explorer audit, P5-10 lifecycle repair, and P5-11 closure/resource repair are complete. Explorer is a bounded reusable-input shape closure and remains distinct from recipe reachability.
- UI cancellation remains parent-side `terminate()`. A new recipe search-semantic experiment is not blocked by Explorer work, but still requires its own predeclared correctness/quality gate and may not claim nested-splitting evidence.

## Phase-seven product checkpoint

- This section superseded historical “next active priority” wording through the P7 closure. P5-11 was later explicitly resumed and completed under D-067/D-068 without reopening Solver-product work.
- P7-01 is `PASS / STOPPED`: the real `/en/` page—not only a direct Worker harness—completed the accepted nontrivial constructive path twice, exposed the production route to a passive observer, rendered successfully, and cleaned up for the consecutive run.
- P7-02 is `PASS / STOPPED`: one real-page sequence exposed production progress, cancelled and cleaned up a Worker, rejected captured stale callbacks, completed two path-identical bounded solves, recovered from a real terminal Explorer error, and completed Explorer again on the same page. The gate passed twice in fresh Chrome profiles without test-only Solver semantics.
- P7-03 is `NEEDS-FIX / STOPPED`: correctness, paths, Worker/page memory, and repeated-run drift passed, but real-page terminal rendering breached the 100 ms responsiveness gate. P7-04 is next and must treat this as a product/UI release-readiness issue, not authorization for Solver architecture research.
- P7-04 is `PASS / STOPPED`: deterministic preset solver-DAG rendering closed the reproduced long-task issue with a 96.4 ms worst frozen timer gap; full regressions, production 159/159, and independent final audit passed. Its no-auto-start checkpoint was honored until the later explicit P5-11 continuation instruction.
- P8-02 is `NEEDS-FIX / STOPPED`: the explicitly requested current-source re-acceptance preserved 60/60 exact results, stable paths, memory/drift, cancellation cleanup, and headful recovery, but the representative 52-step Hard graph breached 100 ms in 3/20 measured runs (max 115.9 ms). No product optimization or Solver semantic change was made, and Hard-capable RC closeout did not start.
- P8-03 is `PASS / STOPPED`: the attributed renderer-reuse repair passed the unchanged gate at 97.1 ms maximum and supplies the current frozen browser-readiness evidence without rewriting P8-02.
- P8-04 is `PASS / STOPPED`: `hard-capable-rc-v1` is established as a local content-addressed candidate. No commit, push, deploy, remote CI/CD, Solver, benchmark, or optimization follows automatically.
