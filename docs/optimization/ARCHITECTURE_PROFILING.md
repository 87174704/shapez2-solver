# Hard 53×3 Architecture Profiling

Status: `ARCHITECTURE PROFILING: PASS`  
Optimization decision: `FIRST OPTIMIZATION: NOT YET JUSTIFIED`

This report is bound to benchmark canonical identity `5836350ed30779f76fa32a6d4e9dce3628f7b5a554dfc4cb4e512c3b1ffe72db` and formal Solver baseline canonical identity `a23979099a2ae0dc7c8fa0a77c89ffa77d23fc82170e38690de000b708082661`. The frozen baseline artifacts were not modified.

## Profiling method and artifacts

- A deterministic 16-instance stratified sample covers seven candidate-cap cases, eight shape-universe-cap cases, and the sole timeout as a control.
- Candidate-cap coverage includes ordinary, pin, crystal, mixed pin+crystal, and Swapper-related cases, including low-, middle-, and high-state examples.
- Shape-universe coverage includes ordinary, pin, crystal, and Swapper-related cases at shallow and deep terminal depths.
- All three `hard-side-021` families are included. `hard-side-035:F3` is control-only.
- Test-only instrumentation records exact expanded-state and operator funnels, shape lifecycle, and deterministic shadow duplicate samples every 256 expanded states. It does not change the production API, Worker protocol, or search decisions when profiling is disabled.
- Machine-readable inputs and aggregate are `benchmarks/profiling/hard-53x3-architecture-v1/sample.json` and `analysis.json`; per-instance summaries and expanded-state NDJSON live below `records/`. The 16 NDJSON files contain 1,255,052 rows and are retained as raw profiling data.
- Fifteen cap-driven profiles exactly matched formal baseline status, depth, visited states, and candidate count. The timeout control reached the same internal time limit but cannot provide wall-clock logical parity because profiling work advances the production clock.

The fixed sample is:

| Cohort | Instances |
| --- | --- |
| Candidate cap | `hard-main-003:F1`, `hard-main-007:F1`, `hard-side-017:F3`, `hard-side-040:F1`, `hard-side-021:F1`, `hard-side-021:F2`, `hard-side-021:F3` |
| Shape-universe cap | `hard-side-041:F3`, `hard-side-013:F2`, `hard-side-036:F1`, `hard-side-028:F1`, `hard-main-010:F1`, `hard-side-035:F1`, `hard-side-036:F2`, `hard-main-002:F2` |
| Timeout control | `hard-side-035:F3` |

## Formal candidate/state ratios

These ratios were calculated per formal baseline instance as `candidatesGenerated / statesExplored`; no ratio was inferred by dividing aggregate medians.

| Cohort | Count | Min | Median | p90 | Max |
| --- | ---: | ---: | ---: | ---: | ---: |
| All formal instances | 159 | 18.44 | 233.93 | 729.67 | 1,155.54 |
| Candidate cap | 106 | 22.21 | 323.09 | 730.73 | 1,155.54 |
| Shape-universe cap | 52 | 20.90 | 46.17 | 62.06 | 979.58 |
| Timeout | 1 | 18.44 | 18.44 | 18.44 | 18.44 |

Ninety-six of 159 instances exceeded 100 candidates per visited state; 86 exceeded 200, including 83 candidate-cap cases. Because the production baseline counter counts accepted/visited states rather than exact expansions, the profiling sample also records exact expanded states. Within the seven candidate-cap profiles, candidates per expanded state ranged from 22.44 to 1,503.31, with median 361.06. The distribution is not one mechanism: some cases are dense branching at shallow depth, while `hard-side-021:F1/F2` are long, relatively low-branching attrition searches.

## Candidate and operator funnel

Across the 16 profiles:

- 74,827,903 raw operation attempts produced 70,055,104 legal successors from 1,255,052 exact expanded states.
- 60,876,293 of 70,055,097 collector-considered successors (86.90%) lost at the ranking precheck before inventory cloning and state-key construction.
- 9,178,804 candidates were materialized. Of these, 5,644,807 (61.50%) were already visited or retained duplicates; 3,533,997 were admitted, and 2,204,058 later evicted.
- Operation caching avoided physics on 67,139,231 attempts; 7,688,672 physical executions remained. These counters are work proxies, not a wall-time attribution. Profiling overhead makes its wall time unsuitable for a formal speed comparison.

The requested cost decomposition is therefore reported as a counter proxy rather than a misleading instrumented wall-time split:

| Phase | Observable proxy | Sample total / interpretation |
| --- | --- | --- |
| Shape-universe construction | New interned operation outputs | 1,847,737; lifecycle and depth/operator histories are retained per record |
| Candidate enumeration | Raw operation attempts | 74,827,903 |
| Legality/resource/identity filtering | Raw attempts not becoming successors; pair self/resource skips | 4,772,799 after an attempt, plus 7,492,798 theoretical pair skips before an attempt |
| Operation physics | Cache misses / physical executions | 7,688,672; cache hits avoided 67,139,231 executions |
| State canonicalization | Inventory clones / state-key builds | 9,178,804 / 9,178,820, including the 16 initial states |
| Dedup | Visited + retained duplicates after materialization | 5,644,807 |
| Similarity/ranking | Considered / ranking pre-reject | 70,055,097 / 60,876,293 |
| Frontier management | Admitted / evicted / final retained | 3,533,997 / 2,204,058 / 1,282,198 |
| Replay/verification | Solved paths in this sample | Zero; all sampled searches ended at a limit, so replay is not a material search-cost phase here |
| Miscellaneous | Not separable without perturbing timing | Goal checks, progress, allocation, GC, and instrumentation; no fabricated percentage is assigned |

This table establishes order of magnitude, not CPU attribution. A future performance experiment needs paired non-profiled timing and peak RSS after its semantics gate passes.

The dominant raw-attempt sources were:

| Operator | All | Candidate-cap | Shape-universe-cap |
| --- | ---: | ---: | ---: |
| Stacker | 36.34% | 39.82% | 35.12% |
| Swapper | 18.57% | 20.25% | 17.89% |
| Crystal Generator | 6.10% | 5.48% | 6.21% |
| Each Rotator / Cutter / Half Destroyer / Pin Pusher | about 5.80% | about 4.86% | about 6.21% |
| Painter | 4.16% | 5.29% | 3.54% |

Stacker plus Swapper accounted for 54.91% of all raw attempts, 58.29% of successors, and 69.20% of operator-created shapes. In candidate-cap profiles the shares rose to 60.07%, 61.46%, and 71.93%. The two pairwise operators considered 48,585,115 theoretical pairs and attempted 41,091,426 of them after resource/self-pair restrictions. This establishes near-exhaustive pair enumeration as a causal source of work, but it does not yet identify a sound way to skip necessary pairs.

## Duplicate generation

Deterministic shadow measurement sampled 4,910 expanded states and 276,504 candidates:

- duplicate full state: 3.394%;
- duplicate output shape: 2.463%;
- Stacker duplicate output: 2.621%;
- Swapper duplicate output: 0.122%;
- duplicate resource signature: 93.240%, but that signature intentionally omits the produced shape and is not a duplicate-state measure.

The sampling is deterministic rather than random, so these values are exact for the observed sampled states and are not confidence intervals for the corpus. They nevertheless contradict a simple “pairwise explosion is mostly identical outputs” hypothesis. Generation-before-dedup exists, but output-level pre-generation dedup alone has low observed leverage.

## Shape-universe growth and target-relevance proxies

The 16 profiles created 1,847,737 operator-output shapes. Weighted by created shape, 84.84% were never consumed by an expanded state and 84.65% never appeared in a final retained state. In the eight shape-cap profiles, 1,199,836 shapes were created; 86.48% were never expanded and 86.23% were never final-retained. Stacker and Swapper caused 71.52% of those shape births.

The current architecture interns an operation output before ranking and retention decide whether its successor matters. That ordering causally explains why losing candidates consume the global shape budget. It does not prove that delaying interning preserves observable search order or reduces total memory.

Color mismatch, excess target-layer count, and related target-relevance counters were recorded only as descriptive proxies. They are not a sound ancestry proof and must not be converted directly into pruning rules.

## Family contrast: hard-side-021

All three families reached the candidate cap, but the formal costs differ sharply:

| Family | Wall time | States | Depth | Candidates |
| --- | ---: | ---: | ---: | ---: |
| F1 | 67.672 s | 225,101 | 76 | 5,000,000 |
| F2 | 49.855 s | 177,155 | 60 | 5,000,000 |
| F3 | 3.698 s | 21,292 | 8 | 5,000,000 |

F1 therefore used about 18.3× the wall time and 10.57× the states of F3. Exact profiling shows raw attempts per expanded state of 22.66, 29.01, and 278.87 respectively. The contrast is caused by different search shapes: F1/F2 repeatedly carry a broad frontier through many depths, while F3 exhausts the same candidate budget through dense shallow branching. A common terminal label is not an architecture cluster.

## Architecture-oriented failure taxonomy

| Cluster | Observable signature | Affected evidence | Suspected cause | Strength / leverage / risk |
| --- | --- | --- | --- | --- |
| C1 — dense pair-enumeration branching | Hundreds to >1,500 raw attempts per exact expansion; shallow cap | Candidate-cap profiles; 83/159 formal cases exceed 200 candidates per visited state and hit candidate cap | Near-exhaustive Stacker/Swapper operand-pair enumeration before ranking | Strong causal attribution of work and highest coverage; no proven safe pair-elision rule; high correctness risk |
| C2 — deep frontier attrition | Low attempts per expansion, many depths and states, eventual candidate/time cap | `hard-side-021:F1/F2`; low-ratio shape-cap and timeout cases | Many retained states survive across depth even without dense local branching | Strong signature, mechanism still composite; likely needs ranking/frontier evidence; high semantic risk |
| C3 — eager shape-universe pollution | Shape cap plus 86.48% created shapes never expanded | All eight profiled shape-cap cases; 52/159 formal shape caps | Operation outputs are globally interned before ranking/retention | Strong causal link to budget consumption; potentially general; ordering and memory equivalence unresolved |
| C4 — post-ranking state duplication | 61.50% of materialized candidates duplicate visited/retained states | All sampled cohorts | State identity is built only after ranking materialization | Exact funnel evidence, but only 13.10% of considered candidates materialize; medium leverage and ordering risk |
| C5 — duplicate operation outputs before dedup | 2.46% sampled output duplication; Stacker 2.62%, Swapper 0.12% | Deterministically sampled states | Multiple operand/order paths occasionally converge | Measured but low leverage; not selected |

Clusters overlap and their counts must not be added. C1 has the largest formal coverage and remains the first suspected bottleneck. C3 has the clearest budget-coupling mechanism and produced the first concrete architecture experiment design, but its semantic equivalence is not yet established.

## E-004 design and Astra audit

`E-004` was drafted as deferred operation-output shape interning: cache immutable output descriptors and assign global shape identities only when a goal check or collector materialization requires them. The intended primary metrics were shape-universe births, candidate count, states, depth, wall time, and peak RSS. A provisional mechanism gate was at least a 50% reduction in interned operation-output shapes on the shape-cap sample with exact common-prefix search equivalence; rollback would occur on any replay, outcome, ordered-candidate, frontier, budget-boundary, or memory regression.

GPT-6 Astra Medium returned **BLOCKED** before implementation:

1. Shape IDs currently affect commutative operand ordering, Swapper output order, Map insertion order, equivalent-input grouping, candidate enumeration, and beam tie order. Deferring IDs can therefore change the search even if final semantic sets match.
2. D-024 defines every distinct operation output as consuming a shape slot. E-004 would change that frozen resource policy, so it is not yet a behavior-preserving implementation optimization.
3. Existing diagnostic mode materializes ranking losers and cannot measure the counterfactual benefit of lazy interning without perturbing it.
4. Descriptor/string storage could replace rather than remove memory; peak RSS and browser-Worker memory must be measured.
5. Required equivalence evidence includes ordered inventory/frontier/candidate traces at the exact operation boundary, not only sorted semantic-state sets.
6. Goal-before-cap, partial multi-output overflow, target-layer bonuses, null versus empty outputs, numeric-cache safety, FIFO tie behavior, and time checks need explicit gates.

No Astra High escalation was needed: the Medium audit found concrete unresolved engineering and semantics issues rather than an ambiguous judgment. No Solver optimization was implemented, and no second experiment was started.

## Decision and next evidence

Profiling supports two root-cause statements: near-exhaustive pair enumeration is the dominant source of candidate attempts, and pre-retention interning is the direct mechanism by which losing successors consume the shape universe. It does **not** yet support a sound, general candidate-elision rule or prove that deferred identity assignment preserves ordered search semantics.

The next task is not another heuristic tweak. Build a non-materializing retained-candidate observer and an ordered trace oracle that freezes operand order, output order, score/tie order, frontier/inventory iteration, and D-024 boundary behavior. Use it to measure the counterfactual shape births and to determine whether identity can be separated from shape-budget accounting without altering the search. Only then may E-004 move from `BLOCKED / NOT RUN` to an implementation experiment. Candidate-pair reduction remains the higher-coverage bottleneck and requires a separate proof-quality dominance or lower-bound argument before any pair is skipped.
