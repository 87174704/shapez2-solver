# Optimization Decisions

## D-001: Preserve the local-only deployment boundary

- Status: accepted
- Decision: This effort may read/modify/test/benchmark/profile/commit locally, but it must not push, trigger remote CI/CD, use SSH, or change production.
- Reason: Deployment remains an explicit user decision.

## D-002: Freeze core algorithm changes during phase one

- Status: accepted
- Decision: Establish correctness, benchmark, and profiling evidence before modifying the search algorithm.
- Reason: The solver is a heuristic bounded search whose performance and completeness are tightly coupled; unmeasured changes can silently alter behavior.

## D-003: Treat search work counters as benchmark correctness signals

- Status: accepted
- Decision: Compare depth, states explored, generated states, result kind, and a stable solution signature alongside runtime.
- Reason: Runtime alone cannot distinguish an implementation improvement from more aggressive pruning or changed search order.

## D-004: Keep duplicate worker sources synchronized during this effort

- Status: provisional
- Decision: Any later retained solver edit must either update both `shapeSolver.js` and `shapeSolver_web.js` identically or explicitly eliminate the duplicate through a separately reviewed architectural change.
- Reason: They are byte-identical at baseline, and silent drift would make browser and test behavior diverge.

## D-005: Use tiered, behavior-aware benchmarks

- Status: accepted
- Decision: Keep W1 as the default quick regression, W1-W4 as the standard full suite, and the 5,000,000-candidate W5 splitting case as explicit stress only. Assert deterministic work/result signatures but never hard-fail on wall time.
- Reason: This provides routine feedback without making normal tests take minutes, and it exposes search-order changes separately from implementation speed.

## D-006: Correctness defects precede performance optimization

- Status: accepted for the next phase
- Decision: Before retaining performance changes, add regression coverage and minimally fix empty-output transitions and incompatible binary-pair exception isolation. Separately define the intended Explorer behavior before optimizing it.
- Reason: Both solver issues are deterministic false-negative/abort defects. Optimizing the current hot loop first would make an incorrect baseline faster and complicate later validation.

## D-007: Represent legal zero output separately from invalid operation input

- Status: accepted and implemented
- Decision: A cached output array, including `[]`, means a legal operation; `[]` is a consume-with-no-output transition. `null` is reserved for an `InvalidOperationInputs` pair and only that exception type is isolated. Other exceptions remain visible. Consume-only successors are safely skipped when `preventWaste=false` and retained when it is true.
- Reason: This fixes the confirmed waste-removal false negative without expanding ordinary benchmark searches, and it does not weaken error visibility.

## D-008: Do not replace splitting goal allocation with general matching

- Status: accepted
- Decision: Keep the existing greedy allocation while acceptable target sets are singleton shapes or complete rotation orbits.
- Reason: Rotation orbits are identical or disjoint, never partially overlapping, so the classic greedy counterexample cannot occur. Revisit if wildcard, reflection, or target-specific substitution semantics are introduced.

## D-009: First performance experiment is lazy candidate materialization

- Status: accepted and retained
- Decision: Move the beam score rejection before inventory Map cloning and full state-key construction, while preserving candidate sequence, goal checks, limits, enumeration order, result signatures, and work counters. Do not combine this with incremental keys or splitting heuristic changes.
- Reason: Independent reviews converged on this change. It improved W1-W3 median wall time by 27-30%, reduced W5 time by 60.5% with identical logical work, and reduced state-key/clone CPU shares by roughly three quarters under strict behavioral verification.

## D-010: Treat splitting changes as search-semantic changes

- Status: accepted
- Decision: Quotas, fragmentation penalties, coarse-flow tie-breaks, unequal-throughput restrictions, and on-demand macro edges must not be presented as equivalent implementation optimizations.
- Reason: They change beam occupancy, path depth, or the set/order of generated states. W5's depth-645 plateau is real algorithmic explosion, but resolving it requires separate correctness and solution-quality criteria.

## D-011: Reject direct cache-helper inlining as E-002

- Status: rejected after measurement
- Decision: Do not replace `getCachedValue` with direct `.get` calls as an optimization.
- Reason: Seven alternating fresh-process W2 comparisons showed no improvement (median +2.4%, mean +0.7%). The profiler label mostly attributes underlying Map lookup cost to the wrapper.

## D-012: E-002 uses collision-free numeric operation-cache keys

- Status: accepted and retained
- Decision: Replace only operation-output cache string construction with a safe-integer key. Retain one flat Map, the global 75,000-entry FIFO policy, lookup/insertion timing, commutative canonicalization, and all search ordering.
- Reason: W5 performs 5,058,406 operation-cache lookups at 99.87% hit rate yet previously constructed about 84.9 million key characters. Formal B improved W2/W3 by roughly 8-9%; alternating fresh-process A/B improved W1/W2/W4 medians by 14.1%/8.0%/7.7%. All logical results remained identical and no reliable memory regression appeared.

## D-013: Stop equivalent micro-tuning after E-002

- Status: accepted
- Decision: Do not start a behavior-preserving E-003 from the current profile. In particular, do not precompute per-input similarity without new evidence. Move next to correctness and solution-quality oracles for explicit splitting search-semantic experiments.
- Reason: post-E-002 W2 profiling shows no remaining dominant state-materialization hotspot. Operation physics accounts for roughly 43% of leaf samples, GC for 8.48%, and the 6.92% cache leaf is dominated by real operation-output lookup. `getCachedSimilarity` itself is only 0.63%, so the proposed precompute has an evidence ceiling near measurement noise and would alter cache population timing.

## D-014: Require an independent bounded oracle before splitting semantic changes

- Status: accepted
- Decision: Implement the P4 oracle in test-only code using integer throughput, independent state/goal/enumeration logic, guarded exhaustive BFS, and public-path replay. It may share physical operations but not production search machinery. No splitting heuristic or reachability change proceeds until P4-02 passes.
- Reason: the production search is deliberately beam-bounded, and splitting candidates change completeness and path quality in ways fixed benchmark signatures cannot validate. A small exact domain can expose false negatives and depth gaps without making a global completeness claim.

## D-015: First splitting experiment uses an equal-score coarse-flow tie-break

- Status: accepted and retained
- Decision: The first production splitting experiment will change only ordering among exactly equal primary similarity scores when splitting is enabled, preferring greater throughput-weighted mean stream size. It will not remove edges, change the primary score, or alter primitive operation semantics.
- Metric: `coarseness = Σ(count × throughput²) / Σ(count × throughput)`. A split `q -> q/2 + q/2` strictly lowers the numerator while preserving the denominator; Cutter output multiplicity does not create a false improvement.
- Reason: eager Splitter successors preserve primary similarity and are generated before physical operations, so the existing sequence tie-break can let fragmentation dominate W5's cap-100 frontier and amplify later pair enumeration.
- Gate: first add fixed Split-required oracle fixtures. Then require exact-domain replay/completeness/depth, no worsening of the fixed cap-1 beam fixture, unchanged W1/W2/W4 logical signatures, solved W3 at depth no greater than 7, and a replay-valid solved W5 result below 1,000,000 generated candidates.

P4-02a satisfied the direct safety gate with a strict counterexample family based on `CuRuCuRu -> CuRuRuCu`: no-split reference search exhausts, while Splitter/Rotator CW/Swapper solves at depth 3 with equal-rate inputs and no discard. Sensitive and independent multi-target variants also pass at cap 100. A nested multi-level Split-required fixture remains a coverage limitation, so any loss or depth increase in these simpler cases is an immediate revert signal.

The retained implementation passed 27/27 tests, multi-element heap ordering and throughput-square formula checks, the bounded exact/beam/Split-required oracle gates, exact non-splitting signatures, and formal W1-W5 validation. W5 changed from a 5,000,000-candidate limit at depth 645 to a replay-valid solution at depth 9 with 21,777 candidates.

## D-016: Swapper path replay compares an unordered output multiset

- Status: accepted
- Decision: The test oracle treats Swapper output order as irrelevant while preserving shape multiplicity and binding each public output ID to its declared shape. Stacker and unary operations, including Cutter, remain order-sensitive in replay.
- Reason: reversing Swapper inputs reverses the physical output array but preserves the output shape multiset. Production inventory and goal semantics are multisets, and the current graph/API has no output-lane contract. Requiring array-position equality produced a false invalid-path diagnosis during E-003 screening.

## D-017: Astra audit reopens the E-003 validation gate

- Status: accepted
- Decision: Retain the current E-003 code provisionally, but do not treat the previous P4 gate as adequate evidence for bounded-beam completeness or quality. Before another recipe search-semantic optimization, require a fixed test with splitting enabled, actual unique-state beam pruning, a Split-required reference solution, and an observed E-003 ordering decision. Also require a multiple/nested-Splitter witness or explicitly keep that gap open.
- Reason: the cap-1 beam fixture disables splitting, the Split-required fixtures never fill their cap, and W3/W5 solve without using Splitter. Passing those checks cannot expose a required fine-flow state displaced by the new tie-break. This is an evidence failure, not proof that E-003 currently returns an invalid path.

Sol High design review found a minimal positive gate without changing the fixture family: run the existing `CuRuCuRu -> CuRuRuCu` Split-required case at cap 2. Independent BFS finds the shortest depth 3 and naturally exhausts without splitting. Read-only A/B instrumentation found both modes replay-valid at depth 3, while E-003 changes the retained semantic state set, participates in at least three exact-primary ties, and observes unique beam rejection/eviction. This gate must be automated with test-only diagnostics. It does not close the nested/multiple-Splitter risk: a deterministic bounded search must freeze the first qualifying witness regardless of whether it favors E-003.

## D-018: Separate diagnostic, official Hard, and Insane stress benchmarks

- Status: accepted
- Decision: Keep W1-W5 unchanged as diagnostic/regression/pathological workloads. Treat official `hard_main`/`hard_side` goals as the real-world Hard suite and `insane_main`/`insane_side` as a stress/complexity suite. Do not use W1-W5 as a proxy for the official workload distribution or use Insane solve rate as a universal pass criterion.
- Reason: W1-W5 share the same target and starting inventory and differ mainly by beam/operation/splitting settings. The official corpora add multi-layer, colored, pin/crystal, and six-part targets and therefore measure materially different branches and growth behavior.

## D-019: Freeze Hard data before heuristic tuning

- Status: accepted; manifest v1 verified
- Decision: Stratify each Hard source file independently by SHA-256 order and allocate 60%/20%/20% with the largest-remainder method, producing 32 development, 11 validation, and 10 holdout cases. Persist each case assignment in `benchmarks/manifest.json`. Development may guide optimization, validation is for declared stage gates, and holdout is not run by the optimizing Agent. If holdout outcomes are inspected and used to tune, those outcomes are permanently marked contaminated and cannot support a later independent holdout claim.
- Reason: E-003 used W5 for discovery and acceptance. A frozen untouched set is needed to distinguish regression evidence from iterative benchmark fitting.

## D-020: No-result and memory labels must reflect what was measured

- Status: accepted
- Decision: A bounded search that pruned unique states is reported as `not-found-pruned`, not exhaustive no-solution. Process `maxRSS` is an approximate per-process high-water value only when each case runs in a fresh process; same-process deltas are not per-workload peak memory.
- Reason: Astra observed 79,888 beam discard/eviction events in W4, so its old exhaustive label was false. Node's process high-water RSS accumulates across workloads and cannot be safely attributed to one later in-process case.

## D-021: Accept the bounded P5-07 E-003 gate while keeping nested splitting open

- Status: accepted
- Decision: Treat the cap-2 Split-required A/B fixture as sufficient evidence that E-003 participates under actual unique-state beam pruning without invalidating or deepening that fixed one-split solution. Accept the bounded nested discovery as inconclusive after its frozen 1,000,000-transition prefix found no witness; do not expand the budget merely to obtain a favorable case.
- Evidence boundary: the discovery fully covered Rotator CW+Swapper, only the `----RuCu` seed of the next Rotator 180 tier, and no Cutter/Stacker tier. It supplies no nested/multiple-Splitter completeness evidence. A later recipe semantic experiment must declare its own replay, quality, and rollback gates.
- Reason: This repairs Astra's concrete missing-gate finding without converting a bounded positive fixture or a negative search prefix into a global claim.

## D-022: Treat Explorer as a separate shape-closure product with its own contract

- Status: provisional pending parameter/product choices
- Decision: Explorer is not finite-inventory recipe reachability. Its intended closure depth is expression-tree height; starting shapes are reusable; each layer enumerates calls with at least one operand from the prior frontier; non-commutative input orders are distinct; and every novel output of a multi-output call enters the closure even when a sibling is unchanged. Invalid input combinations are isolated per call.
- Confirmed implementation gaps: reverse old/new Stacker order is omitted; an unchanged sibling suppresses novel outputs; mixed four/six-part binary inputs abort the run; colored operations are red-only; depth zero falls back to 999; resource/partial-result classification is absent; lookup/reparse cost amplifies expansion; error status does not terminate/clean up the UI Worker.
- Open choices: approved Painter/Crystal color domain, whether empty shapes and pure cycles appear in the graph, whether Swapper lanes matter, and whether a limited run returns a marked partial graph.
- Gate: no Explorer performance edit proceeds before reference-closure fixtures and explicit semantics. Resource and terminal-message budgets precede lookup tuning; real Worker/browser cancellation, rendering, and cleanup remain part of P5-10/P5-11 verification.

## D-023: Publish exact beam pruning as a boolean, not a misleading count

- Status: accepted and implemented
- Decision: Add backward-compatible `outcome` and `beamPruned` fields to recipe results. `solved` and `limit` retain precedence; only a naturally finished run with confirmed unique-state beam loss is `not-found-pruned`, and only a naturally finished run with none is `exhausted`.
- Implementation: before the boolean latch is true, a score-rejected candidate is keyed only to distinguish visited/retained duplicates from a new state. A confirmed unique rejection or eviction latches true; later losers remain lazy. Exact event counts stay test-only because publishing them would require materializing every rejected candidate and undermine E-001.
- Reporting: progress displays only that beam pruning has occurred. W4 and official schema v2 use the new taxonomy; solver limits, watchdogs, cancellation, and errors remain distinct. Historical JSON artifacts are immutable snapshots.
- Reason: `consideredCount - collector.size` mixes duplicate rejection with real beam loss and cannot support completeness wording. The latch gives the strongest exact production claim needed for truthful no-result classification with bounded added work.

## D-024: Freeze recipe limit-boundary semantics behind a test-only injection seam

- Status: accepted and implemented
- Decision: Production limits and the public nine-argument `shapeSolver(...)` API remain unchanged. `shapeSolverTestOnly(...)` may inject smaller positive integer state/generated/shape limits, a non-negative time limit, a deterministic monotonic clock, and a positive operation-attempt time-check interval. Invalid overrides fail fast instead of silently weakening a safety limit.
- Generated candidates: increment once for every legal successor passed to `enqueueSuccessor`. A goal produced by the candidate exactly at the configured budget wins; otherwise reaching the budget returns `limit/generated-states`. This preserves the existing goal-before-limit ordering and never processes a candidate beyond the budget.
- Visited states: the initial state counts as one. A next frontier that makes `visited + frontier` exactly equal to the budget is accepted; a frontier that would exceed it returns `limit/visited-states` before those states enter `visited`. A generated goal may still win before beam admission because solved paths are validated independently of retained frontier membership.
- Shape universe: every distinct interned target, accepted rotation, target layer, starting shape, and operation output consumes one slot. Exactly the configured number is allowed; the first new shape beyond it returns `limit/shape-universe`. Initialization overflow must return a normal limit result with no malformed/null token.
- Time: elapsed time below the budget continues and elapsed time equal to or above it returns `limit/time`. Check at each expanded state and every configured number of attempted actions, including mixed-part invalid pairs and legal no-output/no-op calls. The production interval remains 2,048. A synchronous physical operation cannot be preempted, but its completed attempt must participate in the next interval check.
- Result contract: all resource stops retain P5-08 precedence (`outcome: "limit"`, exact `limitReason`, and historical `beamPruned`). Boundary tests use tiny injected limits in a subprocess with an external watchdog; they do not approach the production 120-second or memory limits.
- Reason: Small deterministic budgets make off-by-one and classification behavior reproducible without long/OOM tests, while counting attempted actions closes the known time-check blind spot for invalid-pair-heavy work.

## D-025: Worker cancellation is terminate-based and every terminal path is one-shot

- Status: accepted and implemented
- Decision: UI cancellation immediately detaches the Worker handlers and calls `terminate()`. It does not depend on a `cancel` message being processed. The Worker-side cancel action remains a compatibility path, not a claim of cooperative interruption during synchronous search.
- Lifecycle: a small shared controller owns one Worker task. Result, explicit protocol error, native error, message deserialization error, synchronous send failure, cancellation, and constructor failure all converge on one idempotent terminal path. For an existing Worker, handlers are detached and termination occurs before UI callbacks. Under the UI invariant that a slot is cancelled before replacement, late captured callbacks observe an inactive task and cannot update status, render stale results, or clear the replacement. This is per-task isolation, not a general generation-token system.
- Error protocol: recipe solve and Explorer exceptions use the same terminal `{ type: "error" }` envelope. Explorer errors are no longer non-terminal status updates. This is lifecycle repair only; mixed-part Explorer closure behavior remains a P5-11 defect.
- Cleanup claim: verified cleanup means inactive UI task reference, restored action button, detached listeners, and at most one `terminate()` call. It is not a synchronous GC or RSS reclamation claim.
- Reason: the current solver and Explorer are synchronous CPU loops and do not yield a task turn in which a queued cancel message could run. Parent-side termination is the only reliable immediate cancellation mechanism without a separate cooperative scheduling redesign and performance review.

## D-026: Freeze the Hard 53×3 formal Solver baseline before optimization

- Status: accepted and complete
- Decision: `hard-53x3-solver-baseline-v1` is the sole formal comparison point for the next Solver optimization phase. It binds released benchmark identity `5836350...2db`, final-selection hash `6e3efde...47f`, Solver identity `68f2be3...a873`, configuration hash `2ed7ea7...b009`, exact 159-member membership, and result hash `b5280ee...d987` into baseline canonical hash `a239790...2661`.
- Method: validate the frozen release before execution; freeze the repository/runtime/configuration identity; run every member exactly once with sequential fresh-process isolation; preserve actual terminal causes; store unavailable metrics explicitly; rebuild deterministic artifacts without rerunning cases; independently audit membership, classifications, aggregates, and hashes.
- Evidence boundary: Node subprocess latency and RSS are not Chrome Worker measurements. Production `statesExplored` counts accepted/visited states rather than exact expanded states, and frontier measurements are sampled. These limitations are recorded rather than estimated away.
- Contamination rule: no benchmark source, witness, input, family, limit, heuristic, ranking, pruning, candidate generation, or Solver representation may be changed and relabeled as this baseline. Any future comparison must cite this exact canonical identity or establish a new baseline.

## D-027: Treat former Hard holdout targets as observed after composite release

- Status: accepted
- Decision: the released 53×3 composite authorizes and includes all 53 Hard targets, so the former manifest-v1 Hard holdout is no longer untouched after the formal baseline. Future optimization or validation reports must not make an unobserved-holdout claim for those targets.
- Consequence: this does not invalidate the released composite or formal baseline. It changes only the evidence boundary for future generalization claims; a new untouched evaluation set would require a separately frozen release and explicit authorization.

## D-028: Cluster architecture failures by mechanism, not terminal label

- Status: accepted
- Decision: use five overlapping, evidence-derived clusters for the next optimization phase: dense pair-enumeration branching, deep frontier attrition, eager shape-universe pollution, post-ranking state duplication, and low-rate duplicate operation outputs. Do not add cluster counts or equate a shared candidate-cap label with one mechanism.
- Evidence: exact 16-case instrumentation shows candidate-cap cases ranging from about 22 to 1,503 candidates per expanded state. `hard-side-021:F1/F2/F3` all hit the candidate cap but have raw attempts per expansion of 22.66/29.01/278.87 and formal depths 76/60/8. Stacker+Swapper cause 54.91% of all raw attempts, while 84.84% of created shapes are never expanded.
- Consequence: C1 is the first suspected bottleneck by formal coverage and work magnitude. C3 is a separately proven budget-coupling mechanism. Neither observation authorizes unsound pair pruning or target-relevance pruning.

## D-029: Block E-004 until shape identity and budget accounting are order-stable

- Status: accepted
- Decision: do not implement deferred operation-output interning in this round. E-004 remains `BLOCKED / NOT RUN` until a non-materializing retained-candidate observer and ordered trace oracle prove equivalence through operand ordering, output ordering, scores/ties, inventory/frontier iteration, goals, and every D-024 boundary.
- Reason: current shape IDs influence Swapper/commutative ordering and Map iteration, and D-024 explicitly counts every distinct operation output against the shape cap. Delayed identity is therefore not yet a behavior-preserving storage change. Existing diagnostic materialization cannot measure its counterfactual benefit without changing the work it observes.
- Audit: GPT-6 Astra Medium found these issues before implementation and also required descriptor/RSS/browser-memory accounting. The issues are concrete; no Astra High escalation is warranted.
- Consequence: this round ends after profiling. P6-03 must establish the missing observer/proof gate; it may reject E-004 without touching Solver search semantics. No second optimization experiment starts.

## D-030: Separate deferred identity storage from D-024 shape-budget slots

- Status: accepted for P6-03 instrumentation design
- Decision: P6-03 will quantify two distinct counterfactuals. The behavior-preserving form may defer heavyweight identity/object materialization but must reserve a deterministic ordering identity and charge every distinct operation output against the D-024 shape budget at the same attempt and in the same output order. A form that does not charge ranking-loser outputs may be measured only as a search/resource-semantic counterfactual and cannot be called E-004 equivalence.
- Observer constraint: test-only hooks may record facts already produced by the search, but may not invoke a lazy candidate factory or construct loser inventories/keys solely for observation. Full ordered traces are limited to small fixtures; formal-sample runs use streaming digests and bounded counters.
- Reason: current shape IDs participate in operand canonicalization, token/state ordering, cache keys, and frontier history, while the frozen limit contract counts every distinct output. Conflating storage deferral with budget deferral would manufacture a shape-cap improvement by changing the accepted semantics.

## D-031: Retain the P6-03 observer but keep E-004 blocked

- Status: accepted
- Decision: keep the passive test-only observer, ordered event seam, exact boundary fixtures, fixed eight-case runner, and machine-readable results. Mark the overall P6-03 proof gate blocked and leave E-004 `BLOCKED / NOT RUN`.
- Evidence: 8/8 shape-cap cases preserve the formal baseline logical signature. Of 1,199,836 operation-output births, 870,648 never enter candidate materialization, but all 1,200,000 D-024 slots remain charged. The additive observer ledger raises fresh-process Node peak RSS by a descriptive median 35.46 MiB.
- Reason: outputs require similarity and potentially parsed Shape objects before ranking, so candidate non-materialization is not equivalent to object/storage non-materialization. The ordered event seam also lacks a complete frozen oracle for several identity-sensitive paths. No compliant cap extension or net memory benefit is proven.
- Consequence: do not implement E-004, do not reclassify budget deferral as a behavior-preserving change, and do not start another Solver architecture experiment automatically. Further work requires a separately selected evidence task or an explicit decision to review resource semantics.

## D-032: Close E-004 and separate engineering correctness from Solver capability

- Status: accepted
- Decision: formally close the current E-004 deferred-interning route. Retain its profiling, passive observer, ordered-event, and boundary-test assets, but do not add more prerequisite proof or observer infrastructure for deferred interning.
- Capability accounting: tests, audits, profiling parity, replay checks, and engineering-correctness PASS results remain required gates, but none of them alone counts as Solver capability progress. Capability progress requires new replay-valid solves on the frozen formal 159 membership.
- Scope at this historical checkpoint: P5-11 remained pending as an independent Explorer correctness/resource task outside the Solver mainline. D-068 later completed it without reopening Solver work.
- Reason: the Development ROI Audit found that further E-004 evidence work would extend an implementation-equivalence argument without addressing the formal capability result of 0/159.

## D-033: Run one target-conditioned candidate-generation architecture experiment

- Status: accepted and predeclared
- Decision: P6-04/E-005 is the only architecture experiment authorized in this round. It may change search order, representation, candidate admission, and ranking while preserving game operations, finite input-resource consumption, configuration semantics, and replay correctness.
- Information boundary: the experiment implementation receives only the ordinary Solver input contract: target shape codes, starting shape codes, enabled operations, and rule/resource parameters. It must not receive or inspect hidden witnesses, construction metadata, target identifiers, family slots, structural tags, or benchmark-specific shape-code recipes.
- Architecture: use target/subgoal-conditioned candidate generation over resource-disjoint construction plans. Target-derived compatibility is computed generically from target cells, rotations, layer placement, paintability, and operation physics. A resource mask prevents a starting item from being consumed twice; returned plans are accepted only after the independent production replay validator succeeds.
- Formal configurations: at most the two configurations frozen in `benchmarks/experiments/target-conditioned-v1/configs.json` may run. TCG-A is strict; TCG-B is the single predeclared broader fallback. No parameter adjustment is allowed after seeing a formal result.
- Success gate: `ACCEPT` requires at least three stable solved members among the formal 159, covering at least two target IDs, with every solution replay-valid and the same members solved again in independent fresh processes. A smaller nonzero result is `PROVISIONAL`; zero after both configurations is `REJECT`. Any invalid replay is a hard rejection.
- Stop rule: after E-005 receives ACCEPT, PROVISIONAL, or REJECT, stop and report. Do not begin a second architecture experiment. If both configurations are 0/159, stop this implementation route rather than adding observer, audit, or proof infrastructure.

## D-034: Stop E-005 as PROVISIONAL

- Status: accepted
- Decision: classify E-005 as `PROVISIONAL` and stop. TCG-A and TCG-B each stably solved 2/159, both from `hard-main-001`; the result is nonzero capability progress but misses the predeclared ACCEPT requirement of at least 3/159 across at least two targets.
- Correctness: all eight solution returns across both configurations' first-pass and repeat runs were replay-valid. The small-domain oracle/replay suite passed, the full repository suite passed 127/127, and neither formal configuration produced an ERROR or WATCHDOG. These are correctness gates, not additional capability credit.
- Capability accounting: formal member capability moves from 0/159 to a demonstrated stable 2/159 for this architecture, and target coverage from 0/53 to 1/53. The two configurations solve the same members, so results are not added together.
- Consequence at this historical checkpoint: do not add a third configuration, target-specific rule, witness-derived recipe, or more E-005 observer/proof infrastructure. Do not begin a second architecture experiment in this round. P5-11 then remained separate and was later completed under D-068.

## D-035: Run E-006 as a new best-first plan-synthesis architecture

- Status: accepted and predeclared
- Decision: P6-05/E-006 is the only architecture experiment authorized in the new 2026-09-28 session. It replaces E-005's monotonic admission and cost-bucket scheduling with deterministic global best-first scheduling and a bounded high-value binary-partner pool. It may support ordinary, Pin, and Crystal targets through the existing operation physics, but may not inspect benchmark metadata or witnesses.
- Reason: E-005's larger fallback budget did not broaden its two-member solution set, while 133 of its two formal runs ended at candidate or chart limits. Architecture profiling already identifies pair enumeration and deep attrition as higher-coverage mechanisms. A scheduling/pairing change directly tests both mechanisms without reviving the closed E-004 route.
- Frozen evaluation: at most BFPS-A and BFPS-B from `benchmarks/experiments/best-first-plan-v1/configs.json`; B runs only if A misses ACCEPT. First-pass solutions are repeated in fresh processes and independently replayed. No tuning follows a formal observation.
- Capability verdict: ACCEPT requires stable >=3/159 across >=2 targets and at least one member outside E-005's two-member set. PROVISIONAL requires a stable new member below that bar. No stable new member is REJECT. Any invalid replay is a hard rejection.
- Stop rule: issue the formal verdict and stop this session's architecture work. Tests, profiling, infrastructure, and documentation remain gates rather than capability progress.

## D-036: Reject and stop E-006

- Status: accepted
- Decision: classify P6-05/E-006 as `REJECT / STOPPED`. BFPS-A stably solves one prior-frontier member and no new member; BFPS-B solves none. There is no stable capability increment over E-005's 2/159, one-target frontier.

## D-037: Run one goal-decomposed constructive synthesis experiment

- Context: E-005 established narrow capability but remained dominated by forward candidate-attempt caps; E-006 replaced admission with best-first scheduling and still added no formal member while spending nearly all runs at the wall limit. The frozen public inputs are finite resource multisets and targets expose exact spatial requirements.
- Decision: P6-06/E-007 will test deterministic target decomposition, global distinct-resource matching, bounded unary extraction, and direct physical assembly as one new architecture. It may use target shape contents and starting resources but no benchmark identity, witness, construction metadata, structural tag, or prior path.
- Frozen scope: one configuration, `GDCS-A`, from `benchmarks/experiments/goal-decomposed-v1/configs.json`; ordinary non-splitting/non-waste targets only for this first stage. Every formal solution is independently replayed and repeated in a fresh process.
- Capability gate: ACCEPT requires stable >=3/159 across >=2 targets with >=1 member outside E-005. A smaller stable new set is PROVISIONAL; no stable new member is REJECT; invalid replay or resource reuse is a hard rejection.
- Stop rule: formal observation freezes the implementation/configuration. Record the first reachable verdict and stop without tuning or starting another architecture experiment.

## D-038: Accept and stop E-007

- Evidence: the sole frozen GDCS-A configuration solved 78/159 first-pass members across 26 targets. Every returned path replayed valid; every solved member independently repeated in a fresh process and replayed valid again. There were no limits, errors, watchdogs, or invalid replays.
- Decision: classify P6-06/E-007 as `ACCEPT / STOPPED`. It adds 76 stable members and 25 target IDs beyond the prior 2/159, one-target frontier, resulting in 78/159 across 26 targets.
- Boundary: the accepted implementation is a standalone experimental architecture for ordinary targets. It does not solve Pin/Crystal targets, does not prove the three resource-mismatch cases impossible, and is not yet integrated into the production Worker/API. These boundaries do not reduce the formal capability verdict.
- Stop: do not tune E-007, add a special-target stage, integrate production, or start E-008 in this session.
- Correctness: BFPS-A's first-pass and repeat solution both replay valid. Neither configuration records ERROR, WATCHDOG, or invalid replay; the 7/7 architecture gate and 134/134 repository suite pass. These facts establish a clean negative experiment but add no capability.
- Mechanism finding: global best-first scheduling plus a ranked partner pool does not solve the C1/C2 failure clusters under the frozen bounds. BFPS-B's larger pool makes each expansion more expensive, lowers median attempts and expansions within twice the wall budget, loses A's known solution, and adds no new solve. More budget is not monotonic capability for this scheduling policy.
- Consequence: retain the standalone implementation, tests, runner, and immutable results for reproducibility, but do not integrate E-006 into the production Solver, tune its priorities/pool sizes, add a third configuration, or count Pin/Crystal small-fixture support as formal capability. Stop without starting another architecture experiment.

## D-039: Run one Pin-aware goal-decomposed constructive-synthesis experiment

- Status: accepted and predeclared on 2026-09-28 before implementation or formal E-008 execution.
- Context: E-007 stably solves 78/159 across 26 targets and leaves exactly 78 Pin/Crystal members unsupported plus three ordinary resource-mismatch members. The frozen corpus contains 39 pure-Pin members across 13 targets. Existing benchmark-generation evidence establishes generic Pin column/support-region mechanics, but E-008 must rediscover and execute plans solely from public Solver input and may not consume generation witnesses or metadata.
- Decision: P6-07/E-008 is the only architecture experiment authorized in this session. It extends deterministic goal decomposition with target-derived Pin-column/support-region planning, global distinct-resource matching for exact and sacrificial atoms, bounded unary extraction, and physical Pin Pusher/Stacker construction. Ordinary targets use the frozen E-007 constructive stage; Crystal-bearing targets remain explicitly outside this first Pin stage.
- Information boundary: Solver code receives only target shape codes, starting shape codes, enabled operations, and public rule parameters plus the frozen experiment limits. It receives no target ID, family slot, source identity, witness, construction metadata, structural tag, benchmark recipe, or prior path. Parent-only IDs may bind result artifacts but are never sent to candidate selection.
- Frozen evaluation: one configuration, `PGDCS-A`, in `benchmarks/experiments/pin-goal-decomposed-v1/configs.json`. Run all 159 members once in fresh processes, independently replay every returned solution, then repeat every first-pass replay-valid solve under the identical configuration. Formal observation freezes implementation and configuration.
- Capability verdict: `ACCEPT` requires at least three stable replay-valid members outside the E-007 78-member set spanning at least two target IDs. `PROVISIONAL` requires at least one stable new member but misses ACCEPT. `REJECT` applies if there is no stable new member, or immediately on invalid replay/resource reuse. Tests and engineering checks add no capability credit.
- Stop rule: after the first reachable ACCEPT/PROVISIONAL/REJECT verdict, record it and stop. Do not add Crystal support, tune Pin construction, introduce a fallback config, integrate production, or start E-009 in this session.

## D-040: Accept and stop E-008

- Status: accepted.
- Evidence: frozen PGDCS-A solved 103/159 first-pass members across 35 targets. Every solution replayed valid, all 103 solved members repeated in independent fresh processes, and every repeat replayed valid. The E-007 78-member set is preserved exactly.
- Decision: classify P6-07/E-008 as `ACCEPT / STOPPED`. It adds 25 stable members and nine target IDs beyond the 78/159, 26-target frontier, resulting in 103/159 across 35/53 targets.
- Failure distribution: 39 Crystal-bearing members remain explicitly unsupported; 11 members exhaust distinct-resource matching; six require the excluded isolated-Pin mechanism. There were no limits, errors, watchdogs, or invalid replays. Misses are not impossibility proofs.
- Stop: no post-formal tuning, fallback configuration, Crystal or isolated-Pin extension, production integration, or E-009 in this session.

## D-041: Run one Crystal-scaffold goal-decomposed experiment

- Status: accepted and predeclared on 2026-09-29 before implementation or formal E-009 execution.
- Context: E-008 raises the stable formal frontier to 103/159 across 35 targets. Crystal-bearing targets are now the largest remaining class at 39 members across 13 targets. The public Crystal Generator has an exact reverse for dense, single-color, Pin-free final layouts: replace every target Crystal with a Pin, physically construct that scaffold, then generate the common Crystal color.
- Decision: P6-08/E-009 is the only architecture experiment authorized in this session. It adds a generic exact Crystal-scaffold reversal in front of the frozen PGDCS component. Non-Crystal inputs delegate unchanged. Sparse, mixed-color, final-Pin, isolated-Pin, resource-mismatch, and multi-stage Crystal layouts remain outside the frozen experiment.
- Information boundary: solver code sees only target codes, starting shape codes, enabled operations, public rule parameters, and frozen limits. It receives no formal member identity, source identity, witness, construction metadata, benchmark recipe, or prior path.
- Frozen evaluation: sole configuration `CSGDCS-A`; all 159 members run in fresh processes, every returned path is independently replayed, and every first-pass replay-valid solve repeats in another fresh process. Formal observation freezes code and configuration.
- Capability verdict: ACCEPT requires preservation of all 103 E-008 stable members plus at least three stable replay-valid new members across at least two new target IDs. PROVISIONAL requires a smaller nonzero stable increment with frontier preservation. No stable increment, any frontier loss, invalid replay, or resource reuse is REJECT. Engineering checks add no capability credit.
- Stop rule: after the formal verdict, stop without tuning, fallback configuration, sparse/mixed-color extension, production integration, or E-010.

## D-042: Accept and stop E-009

- Status: accepted.
- Evidence: frozen CSGDCS-A solved 112/159 first-pass members across 38 targets. Every solution replayed valid, all 112 solved members repeated in independent fresh processes, and every repeat replayed valid. All 103 E-008 frontier members were preserved.
- Decision: classify P6-08/E-009 as `ACCEPT / STOPPED`. It adds nine stable members across three target IDs (`hard-side-030`, `hard-side-033`, and `hard-side-035`), resulting in a frontier of 112/159 across 38/53 targets.
- Failure distribution: 30 Crystal layouts remain outside the frozen exact reversal (15 final-Pin, 12 sparse, three mixed-color); 11 resource mismatches and six isolated-Pin layouts remain exhausted. There were no limits, errors, watchdogs, invalid replays, or frontier losses.
- Stop: no post-formal tuning, fallback configuration, sparse/mixed-color extension, isolated-Pin/resource-mismatch repair, production integration, or E-010 in this session.

## D-043: Run one mixed Pin/Crystal support-safe goal-decomposed experiment

- Status: accepted and predeclared on 2026-09-29 before E-010 implementation or formal execution.
- Context: E-009 raises the stable frontier to 112/159 across 38 targets. The largest coherent next public-input capability class is the 15 final-Pin Crystal members across five targets. Existing canonical-mechanics evidence identifies a generic construction topology: construct protected Crystal-bearing spatial components before their supporting Pins, then use support-safe Stack or Swapper recomposition so Gravity does not destroy detached Crystal.
- Decision: P6-09/E-010 is the only architecture experiment authorized in this session. It adds target-derived mixed Pin/Crystal half/column decomposition, protected sacrificial Crystal staging, Crystal-suffix-to-Pin transitions, and support-safe recomposition above the frozen E-009 component. Non-mixed inputs delegate unchanged to E-009. The first stage excludes terminal isolated-Pin construction, sparse non-mixed Crystal repair, mixed-color non-Pin Crystal repair, resource-mismatch repair, and production integration.
- Information boundary: solver code sees only target shape codes, starting shape codes, enabled operations, public rule parameters, and the frozen experiment limits. Target-only structural planning may reuse canonical operation helpers, but receives no target ID, family slot, source identity, witness, construction metadata, benchmark recipe, prior path, or generated-instance tag.
- Frozen evaluation: sole configuration `MPCGDCS-A` in `benchmarks/experiments/mixed-pin-crystal-goal-decomposed-v1/configs.json`. Run all 159 members in fresh processes, independently replay every returned path, then repeat every first-pass replay-valid solve under the identical configuration. Formal observation freezes code and configuration.
- Capability verdict: `ACCEPT` requires preservation of all 112 E-009 stable members plus at least three stable replay-valid new members spanning at least two newly covered target IDs. `PROVISIONAL` requires a smaller nonzero stable increment with frontier preservation. No stable increment, any frontier loss, invalid replay, or starting-resource reuse is `REJECT`. Tests and engineering checks add no capability credit.
- Stop rule: record the first reachable formal verdict and stop. Do not tune E-010, add the terminal isolated-Pin branch, repair other failure classes, introduce a fallback configuration, integrate production, or begin E-011 in this session.

## D-044: Accept and stop E-010

- Status: accepted.
- Evidence: frozen MPCGDCS-A solved 117/159 first-pass members across 40 targets. Every solution replayed valid, all 117 solved members repeated in independent fresh processes, and every repeat replayed valid. All 112 E-009 frontier members were preserved.
- Decision: classify P6-09/E-010 as `ACCEPT / STOPPED`. It adds five stable members across two target IDs: all three `hard-main-012` families and `hard-side-031:F1/F2`. The active frontier becomes 117/159 across 40/53 targets.
- Failure distribution: six mixed layouts require the excluded terminal isolated-Pin branch; four additional mixed members exhaust distinct-resource matching. The delegated remainder contains 15 unsupported non-mixed Crystal layouts, 11 earlier resource mismatches, and six isolated-Pin layouts. There were no limits, errors, watchdogs, invalid replays, or frontier losses.
- Stop: no post-formal tuning, fallback configuration, terminal isolated-Pin completion, other failure-class repair, production integration, or E-011 in this session.

## D-045: Run E-011 as the sole new architecture experiment

- Status: accepted and predeclared on 2026-09-30 before E-011 implementation or formal execution.
- Context: E-010 is complete at 117/159 across 40 targets. Its remaining distribution has four explicit classes: 15 resource mismatches, 15 unsupported broader Crystal layouts, six mixed terminal-isolated-Pin members, and six non-Crystal isolated-Pin members. The two isolated-Pin classes share one physical construction mechanism and span four target IDs.
- Decision: P6-10/E-011 is the only architecture experiment authorized in this session. It adds a generic isolated-Pin primitive based on a fully resource-accounted sacrificial Crystal scaffold, lossless Cutter isolation, and Pin Pusher breakage. It is invoked only for the two isolated-Pin failure classes; all other members delegate through the frozen E-010 component.
- Independence and correctness: planning receives only public Solver inputs and the frozen limits. Every target and sacrificial atom must be matched globally to a distinct starting token, every returned path must replay through the independent production oracle, and the 117-member E-010 frontier must be preserved.
- Frozen gate: `TIPGDCS-A` is the sole configuration. ACCEPT requires at least three stable new members across at least two new targets with full frontier preservation; PROVISIONAL requires at least one stable new member with preservation; otherwise REJECT. Invalid replay, resource reuse, or frontier loss rejects immediately.
- Stop rule: record the first formal verdict and stop. Do not tune E-011, add a fallback, repair resource mismatches or broader Crystal layouts, integrate production, or begin E-012 in this session.

## D-046: Accept and stop E-011

- Status: accepted on 2026-09-30 after the frozen TIPGDCS-A first pass and the required independent repeat.
- Evidence: first pass and repeat both solve the same 126 members; all 252 returned solution paths replay valid, all 126 complete paths are deterministic across the two fresh-process runs, and no run returns limit, error, watchdog, or invalid replay.
- Decision: classify P6-10/E-011 as `ACCEPT / STOPPED`. It preserves every one of the 117 E-010 frontier members and adds nine stable members across three target IDs: all families of `hard-main-007`, `hard-side-029`, and `hard-side-036`. The active capability frontier becomes 126/159 across 43/53 targets.
- Failure distribution: 15 broader Crystal layouts remain unsupported and 18 members report resource mismatch. The latter contains the prior 15 mismatches plus three `hard-side-038` isolated-Pin members. No failure is promoted to an impossibility proof.
- Stop: no post-formal tuning, fallback, resource-mismatch repair, broader Crystal extension, production integration, or E-012 in this session.

## D-047: Run E-012 as the sole new architecture experiment

- Status: accepted and predeclared on 2026-09-30 before E-012 implementation or formal execution.
- Context: E-011 is complete at 126/159 across 43 targets. The 33 remaining members split into 15 unsupported broader-Crystal layouts and 18 `resource-mismatch` outcomes. The mismatch class spans eight target IDs and shares a concrete allocation defect: the frozen constructive solvers assign at most one demand to each starting token even when a legal lossless Cutter call yields multiple independently consumable non-empty outputs. The benchmark semantics and generation framework explicitly preserve these byproducts as separate live tokens.
- Decision: P6-11/E-012 is the only architecture experiment authorized in this session. `SOGDCS-A` delegates first to frozen E-011. Only an E-011 `resource-mismatch` may enter a target-ID-independent shared-occurrence stage that losslessly partitions public starting tokens, retains every non-empty byproduct, and allocates exact and sacrificial construction cells from the resulting finite live-token pool. Canonical ordinary, Pin, Crystal, and mixed Pin/Crystal builders may be selected from the public target structure. Unsupported Crystal layouts remain outside scope.
- Independence boundary: candidate code receives only the public Solver input and frozen configuration. It may not inspect target ID, family slot, source identity, witness, construction metadata, structural tags, benchmark recipe, prior path, or formal outcome. Every starting token and derived output is consumable at most once, and all returned paths must pass independent production replay.
- Frozen configuration and gates: one configuration only. Focused gates must cover genuine two-output reuse, no token reuse, disabled-operation failure, insufficient multiplicity, resource-mismatch fallback, and unchanged E-011 delegation. The complete repository suite must pass before formal observation. Formal execution uses all 159 members in fresh child processes, then repeats every first-pass replay-valid solve in fresh processes.
- Verdict: `ACCEPT` requires zero invalid replay, preservation of all 126 E-011 stable members, and at least three stable new members across at least two previously uncovered target IDs. `PROVISIONAL` requires frontier preservation plus at least one stable new member below ACCEPT. `REJECT` applies to any invalid replay, any frontier loss, or zero stable new members.
- Stop rule: formal observation freezes implementation/configuration. Record the first reachable verdict and stop. Do not tune E-012, add a fallback configuration, broaden Crystal planning, integrate production, or begin E-013 in this session.

## D-048: Accept and stop E-012

- Status: accepted on 2026-09-30 after the frozen SOGDCS-A first pass and required all-solved independent repeat.
- Evidence: first pass and repeat both solve the same 144 members; all 288 returned paths replay valid and all 144 complete paths are identical across fresh processes. All 126 E-011 frontier members are present. No run returns exhausted, limit, error, watchdog, or invalid replay.
- Decision: classify P6-11/E-012 as `ACCEPT / STOPPED`. It adds 18 stable members across seven target IDs: all families of `hard-main-009`, `hard-main-011`, `hard-side-037`, `hard-side-038`, and `hard-side-039`, plus `hard-side-021:F1/F2` and `hard-side-031:F3`. The active capability frontier becomes 144/159 across 48/53 targets, adding five fully covered targets over E-011.
- Failure distribution: the only remaining failures are the 15 pre-scoped `unsupported-crystal-layout` members, all families of `hard-main-008`, `hard-main-010`, `hard-side-032`, `hard-side-034`, and `hard-side-040`. No impossibility claim is made.
- Verification: focused gate 6/6; full suite 173/173 before formal and at closeout; artifact membership/count/repeat/frontier/path/hash audit PASS; syntax 100/100; quick W1 exact logical signature; production Solver copies unchanged and byte-identical.
- Stop: no post-formal tuning, fallback configuration, broader Crystal work, production integration, or E-013 in this session.

## D-049: Run E-013 as the sole new architecture experiment

- Status: accepted and predeclared on 2026-09-30 before E-013 implementation and formal execution.
- Context: E-012 is complete at 144/159 across 48/53 targets. Its only failures are 15 `unsupported-crystal-layout` members across five targets. The E-012 public-token resource pool already exposes target-derived physical-mask Crystal construction, but its frozen entry condition admits only `resource-mismatch`.
- Decision: P6-12/E-013 is the only architecture experiment authorized in this session. `UCRPGDCS-A` delegates first to frozen E-012 and routes only `unsupported-crystal-layout` into the unchanged shared-occurrence constructor. No allocator, planner, operation, limit, or other delegation behavior may change.
- Diagnostic disclosure: before this predeclaration, a read-only feasibility command called the existing internal constructor on the 15 remaining public inputs. Its observations support experiment selection but are not a formal pass, repeat, or verdict. The full formal protocol remains mandatory and no blinded-holdout claim will be made.
- Independence and correctness: candidate code sees only public Solver input and frozen limits; it may not inspect benchmark identity, source identity, witnesses, construction metadata, structural tags, prior paths, or formal outcomes. Every solution must preserve token linearity and replay through the independent oracle.
- Frozen evaluation and verdict: one configuration only. After focused and full-suite gates, run all 159 members in fresh processes and repeat every first-pass replay-valid solve. `ACCEPT` requires preservation of all 144 E-012 members, zero invalid replay, and at least three stable new members across at least two previously uncovered targets; a smaller nonzero increment with preservation is `PROVISIONAL`; invalid replay, frontier loss, or zero increment is `REJECT`.
- Stop rule: formal observation freezes implementation/configuration. Record the first reachable verdict and stop without tuning, planner expansion, fallback, target-specific behavior, production integration, or E-014.

## D-050: Accept and stop E-013

- Status: accepted on 2026-09-30 after the frozen UCRPGDCS-A first pass and required all-solved independent repeat.
- Evidence: first pass and repeat both solve the same 156 members; all 312 returned paths replay valid and all 156 complete paths are identical across fresh processes. All 144 E-012 frontier members are present. No run returns limit, error, watchdog, or invalid replay.
- Decision: classify P6-12/E-013 as `ACCEPT / STOPPED`. It adds 12 stable members across four target IDs: all families of `hard-main-008`, `hard-side-032`, `hard-side-034`, and `hard-side-040`. The active capability frontier becomes 156/159 across 52/53 targets.
- Failure distribution: only `hard-main-010:F1/F2/F3` remain exhausted at the unchanged generic planner's half-scaffold boundary. No impossibility claim is made.
- Verification: focused gate 5/5; full suite 178/178 before formal execution and at closeout; exact artifact membership/count/repeat/frontier/path/hash audit PASS; syntax 104/104; quick W1 exact logical signature; production Solver sources unchanged and byte-identical.
- Stop: no post-formal tuning, planner change, fallback, target-specific route, production integration, or E-014 in this session.

## D-051: Run E-014 as the sole new architecture experiment

- Status: accepted and predeclared on 2026-09-30 before E-014 implementation or formal execution.
- Context: E-013 is complete at 156/159 across 52/53 targets. The three remaining members share one public target and one failure: the generic Crystal planner cannot express an interior Crystal column through its one-cut half-scaffold topology. Replay-valid source constructions establish that multi-cut column isolation is physically feasible, while candidate code can derive the same topology from target geometry alone.
- Decision: P6-13/E-014 is the only architecture experiment authorized in this session. `ICCDCS-A` delegates first to frozen E-013. Only its half-scaffold construction failure may enter a target-derived single-color Crystal-column stage that builds full-height all-solid-minus-one-column scaffolds, generates Crystal, losslessly isolates each Crystal column, builds the ordinary remainder from distinct public resources, and recomposes disjoint components.
- Independence boundary: candidate code receives no benchmark/source identity, family slot, witness, construction metadata, structural tag, benchmark recipe, prior solution, or formal result. Historical witnesses informed the architecture choice but are not runtime inputs; no blinded claim is made. Every public and derived token remains single-use and every returned path must independently replay.
- Frozen evaluation: one configuration only, with E-013 limits unchanged. Focused gates and the complete repository suite precede formal execution. Formal execution covers all 159 exact members in fresh processes, then repeats every first-pass replay-valid solve.
- Verdict: `ACCEPT` requires the complete 156-member frontier, zero invalid replay/resource reuse, and stable replay-valid solutions for all three remaining members, yielding 159/159 across all 53 targets. One or two stable additions with frontier preservation are `PROVISIONAL`; zero additions, frontier loss, invalid replay, or resource reuse is `REJECT`.
- Stop rule: the first formal observation freezes code/configuration. Record the verdict and stop without tuning, fallback, target-specific behavior, production integration, or another architecture experiment.

## D-052: Accept and stop E-014 at the complete formal Hard frontier

- Status: accepted on 2026-09-30 after the frozen ICCDCS-A first pass and required all-solved independent repeat.
- Evidence: first pass and repeat both solve all 159 exact members; all 318 returned paths replay valid, all 159 complete paths are identical across fresh processes, all 156 E-013 frontier members are present, and no path reuses a public or derived token. No run returns exhausted, unsupported-domain, limit, error, watchdog, or invalid replay.
- Decision: classify P6-13/E-014 as `ACCEPT / STOPPED`. It adds `hard-main-010:F1/F2/F3`, raising the active capability frontier from 156/159 across 52/53 targets to 159/159 across 53/53 targets.
- Architecture boundary: the frozen formal Hard benchmark now has no unsolved member. This is complete coverage of this artifact, not a proof of general solver completeness and not authorization to mutate the frozen benchmark or overfit new targets.
- Verification: focused gate 6/6; full suite 184/184 before formal and at closeout; exact artifact membership/frontier/repeat/path/resource/hash audit PASS; syntax 109/109; quick W1 exact logical signature; production Solver sources unchanged and byte-identical.
- Stop: no post-formal tuning, fallback, target-specific behavior, production integration, or second architecture experiment in this session.

## D-053: Run E-015 as the sole new architecture experiment

- Status: accepted and predeclared on 2026-09-30 before E-015 implementation or formal execution.
- Context: E-014 completed the standalone architecture frontier at 159/159, while the frozen formal production Solver baseline remains 0/159 and the accepted cascade is not reachable through public `shapeSolver` or the Worker. The ceiling prevents a truthful new-member claim, but transferring the already validated generic capability into the real Solver entry is a measurable architecture capability increment relative to the frozen production baseline.
- Decision: P6-14/E-015 is the only major architecture experiment in this session. Run sole configuration PCHA-A: activate the unchanged E-014 cascade only in its public-parameter domain, return a successful construction, and otherwise preserve the unchanged bounded-search fallback. Keep `shapeSolverTestOnly` search-only so existing oracle/profiling semantics remain isolated.
- Independence: eligibility uses only public arguments; candidate code receives no benchmark identity, membership, witnesses, prior paths, or outcomes. Formal artifacts remain parent-side verification inputs only.
- Formal gate: require 159/159 stable replay-valid public-entry solves, exact equality with all 159 frozen E-014 repeat paths, exact resource linearity, preserved quick W1 signature, complete tests, and source-copy parity for ACCEPT. Use the predeclared PROVISIONAL/REJECT thresholds in E-015 and stop at the first verdict.
- Stop rule: no post-observation tuning, domain widening, fallback redesign, target-specific branch, benchmark mutation, or second architecture experiment.

## D-054: Reject and roll back E-015 on the public Worker gate

- Status: accepted on 2026-09-30 after the frozen PCHA-A formal run and required real-browser gate.
- Formal evidence: Node public `shapeSolver` solved 159/159 in the first pass and repeat; all 318 paths replayed valid, 159/159 repeats were identical, 159/159 paths exactly matched E-014, and no path reused a token.
- Blocking evidence: Chrome could not start the module Worker because the new static import graph reaches Node-only `node:fs/promises` and `node:crypto` imports in `benchmarks/tools/benchmark-core.mjs`. The failure occurs before the eligibility branch and therefore regresses all Worker solve/explore calls, including legacy-ineligible calls.
- Decision: classify P6-14/E-015 as `REJECT / STOPPED`. Perfect Node formal coverage cannot override the predeclared public Worker correctness gate. Roll back the two production Solver activation edits while retaining formal artifacts, runner, report, verdict, and the more diagnostic browser assertion.
- Boundary: do not port benchmark tooling into browser code, redesign imports, add dynamic loading, expand eligibility, tune the constructor, or start another architecture experiment in this session. A future experiment must first isolate browser-safe constructive runtime dependencies as its own predeclared architecture variable.

## D-055: Accept and stop browser-safe production integration

- Status: accepted on 2026-09-30 after the complete production-integration gate.
- Scope: this is an integration repair, not a new Solver architecture experiment. E-014 search semantics, PCHA-A eligibility/configuration, operation paths, and the frozen benchmark remain unchanged.
- Boundary: production now owns browser-only copies of the four constructive planners plus `constructiveSolverRuntime.js`. The public Solver graph contains 16 local runtime modules, zero `node:` or bare imports, and zero modules under `benchmarks/`. Historical benchmark generators retain their policy-pinned hashes and continue to own artifact validation, file I/O, hashing, and corpus tooling.
- Evidence: the current public entry solved 159/159 across 53/53 targets, all replay-valid, all routed through the constructive hybrid, all paths exactly equal to frozen E-014 repeat, and no token was reused. A real Chrome module Worker completed both legacy lifecycle coverage and a nontrivial interior-Crystal constructive solve. The full suite passed 188/188; quick W1 retained its exact logical signature; all 118 JavaScript/module files passed syntax checks.
- Decision: classify P6-15 as `PASS / STOPPED`. Keep E-015's historical `REJECT` immutable; this later task repairs its runtime dependency boundary without reopening architecture search.

## D-056: Switch to Product acceptance / production readiness and accept P7-01

- Status: accepted on 2026-09-30 after the real-webpage production-path gate and proportionate regression checks.
- Phase decision: the long-term phase is **Product acceptance / production readiness**. E-014 remains frozen at 159/159, and P6-15's accepted browser-safe runtime boundary remains mandatory. New Solver architecture experiments are out of scope unless a product acceptance task demonstrates a concrete capability blocker and a future experiment is separately predeclared.
- P7-01 evidence: the real `/en/` page, configured through its UI controls for a nontrivial interior-Crystal construction, completed two consecutive solves. A passive listener on the actual production Worker observed `constructive-hybrid`, the `full-height-column-extraction` stage, solved outcome, and identical 52-step paths. The page rendered the graph/solved status and restored its action state after each run.
- Performance boundary: the two Chrome `153.0.8010.53` observations were 43.6 ms and 82.6 ms to the Worker result. Record them as single-case product observations only; they are neither a formal performance baseline nor authorization to alter search semantics.
- Regression evidence: real Chrome Worker/lifecycle/UI gate PASS; production frontier verification 159/159 with replay, exact E-014 paths, constructive routing, and zero reuse; full suite 188/188; syntax 118/118; Solver source parity at `876A3E5F...9191`.
- Decision: classify P7-01 as `PASS / STOPPED`. No product fix was needed. The next unfinished same-phase task is P7-02, but it does not start during this milestone closeout.

## D-057: Accept and stop P7-02 real-UI lifecycle recovery

- Status: accepted on 2026-10-01 after two complete fresh-profile Chrome runs.
- Evidence boundary: the actual `/en/` page used native module Workers and unchanged production solve/explore payloads. A page-side wrapper only observed messages, handler detachment, and termination. Captured callbacks were invoked only after the corresponding task had terminated, to exercise the production stale-event guard without changing Solver semantics.
- Evidence at P7-02: the page displayed real bounded-search progress before cancellation; cancellation restored the button/status and detached all Worker property handlers before one-shot termination. The cancelled callback could not mutate UI state. Two following bounded solves completed, rendered, cleaned up, and returned identical paths. The then-existing mixed-part Explorer failure produced a terminal visible error, cleaned up once, rejected a stale callback, and recovered; P5-11 later repaired that closure defect.
- Decision: classify P7-02 as `PASS / STOPPED`. No production defect was reproduced and no product or Solver implementation change was needed. The durable gate is `npm run test:browser-worker`; evidence is under `benchmarks/integration/product-lifecycle-v1/`.
- Next: P7-03 is the next unfinished Product acceptance task. Browser performance measurements remain a separate ledger and cannot authorize a search-semantic change.

## D-058: Freeze the P7-03 browser measurement protocol

- Status: accepted on 2026-10-01 before harness implementation and repeated measurement.
- Decision: run two fresh Chrome profiles, each with two warmups and ten measured repetitions of three real-page solves: small constructive, accepted 52-step interior Crystal, and exact-signature W1 bounded search. Keep native production Workers, UI controls, payloads, operations, and results unchanged.
- Metrics: distinguish Worker-result time from UI-settled time; collect passive page/Worker heap evidence, main-thread timer/frame responsiveness, exact result/path/work signatures, and first-half/second-half drift. Garbage collection for retained-page comparison occurs only outside timed intervals.
- Gate: require 60/60 correct measured solves, path stability, continuous heartbeat, no timer gap above 100 ms, no per-profile/workload second-half median above 2x its first half, no per-profile retained page-heap increase above 5 MiB, and at least 80% Worker-heap coverage for bounded search. Missing evidence is `BLOCKED`; correctness or threshold failure is `NEEDS-FIX`.
- Boundary: this measurement cannot authorize a Solver semantic change. Stop after the first complete verdict and preserve raw results plus the exact environment and source identities.

## D-059: Stop P7-03 at NEEDS-FIX on real-page responsiveness

- Status: accepted on 2026-10-01 after the complete frozen 60-run protocol and proportionate regression verification.
- Passing evidence: 60/60 correct measured solves; stable paths; exact W1 depth/state/generated signature; Worker heap coverage 60/60; all page-heap drift below 5 MiB; all second-half/first-half wall medians below 2.0.
- Failing evidence: the page timer exceeded the 100 ms gate in 3/20 ordinary constructive runs and 19/20 interior-Crystal runs, reaching 260.7 ms. W1 stayed below 100 ms in all 20 runs. Worker-result time remained low for the constructive cases, so the evidence localizes the product risk to terminal UI handling/rendering, without claiming complete CPU attribution.
- Decision: classify P7-03 as `NEEDS-FIX / STOPPED`. Preserve the full raw artifact and do not tune Solver search or reinterpret the threshold. P7-04 must carry the issue into its release-readiness decision and may authorize only a separately scoped, behavior-preserving UI/render repair.

## D-060: Run one bounded shape-image cache repair for P7-04

- Evidence: P7-03 observed a 40.4 ms median Worker result but 142.3 ms median UI settlement and a 260.7 ms maximum page timer gap for the 52-step interior-Crystal path. That stable path contains 71 distinct token IDs but only 37 distinct shape codes; `renderGraph()` currently creates and serializes a new 240 px canvas for every token ID.
- Hypothesis: repeated synchronous shape rasterization is a material contributor to the terminal-render long task. Reusing the exact serialized image by shape code, render size, and color mode should preserve graph contents while reducing main-thread work.
- Single variable: add a bounded least-recently-used cache for solver-graph shape data URLs. Keep token nodes, labels, edges, Cytoscape configuration, ELK layout, Solver payloads, paths, and search semantics unchanged. The bound prevents unbounded retained-page growth; the color mode is part of the key.
- Gate: run the unchanged P7-03 harness as a new P7-04 artifact with the same two fresh profiles, two warmups, ten measured runs, three workloads, and thresholds. PASS requires 60/60 exact correctness/signatures, stable paths, 60/60 Worker heap coverage, page post-GC drift at most 5 MiB, per-profile/workload second-half wall median at most 2x first-half, and every timer gap at most 100 ms. Also require the full suite, production 159/159 verification, real Chrome lifecycle/UI gate, syntax, and byte-identical Solver copies.
- Rollback: any visual/graph correctness regression, memory/drift failure, Solver boundary change, or remaining timer gap above 100 ms rejects this repair. Do not tune cache size or add a second rendering variable after formal observation; record the result and stop or declare a separately predeclared follow-up.
- Result: `REJECT / ROLLED BACK`. All 60 correctness/path/work runs, Worker heaps, page heaps, and drift gates passed. Ordinary construction stayed below 100 ms with an 88.4 ms maximum and interior-Crystal UI settlement improved to a 97.75 ms median, but interior Crystal still produced a 268.8 ms timer gap. The cache was removed without tuning.

## D-061: Run one bounded ELK thoroughness repair for P7-04

- Evidence: P7-04a reduced synchronous UI settlement but left the interior-Crystal timer gap essentially unchanged and larger than settlement, localizing the remaining blocker to work that continues after `renderGraph()` returns. The only such solver-graph stage is the asynchronous ELK layered layout, currently configured with thoroughness 20 for every graph size.
- Hypothesis: thoroughness 20 over-processes the 123-node/133-edge accepted graph for an interactive result view. Freezing ELK layered thoroughness at 1 should preserve every node, edge, image, label, direction, spacing rule, interaction, and Solver result while bounding the layout long task below 100 ms.
- Single variable: change only `elk.layered.thoroughness` from `20` to `1`. Keep the ELK algorithm, direction, routing, alignment, spacing, graph topology, renderer, Worker lifecycle, and Solver untouched.
- Gate: the real Chrome lifecycle/UI gate must still render the graph and pass consecutive-run behavior. Then run the unchanged two-profile/60-run P7-03 protocol into a distinct P7-04b artifact. ACCEPT requires all original correctness, stable-path, work-signature, heap, drift, and every-gap-at-most-100-ms gates, followed by full tests, production 159/159 verification, syntax, and Solver parity.
- Rollback: any missing graph, lifecycle/correctness/memory/drift regression, or timer gap above 100 ms rejects and rolls back this exact value. Formal observation freezes the value; no intermediate thoroughness tuning or second layout variable is allowed.
- Result: `REJECT / ROLLED BACK`. All 60 exact correctness/path/work results, 60/60 Worker heaps, page heaps, and drift gates passed. Ordinary construction remained below the gate at 81.0 ms maximum, and interior Crystal improved from the P7-04a 268.8 ms maximum to 163.5 ms, but still failed the 100 ms gate in the formal run. Thoroughness was restored to 20 without tuning.

## D-062: Replace only the solver-result layout with Cytoscape breadth-first

- Evidence: P7-04b proved that the ELK layout long task remains above 100 ms even at minimum tested thoroughness. The solver result graph is a directed acyclic construction graph, for which Cytoscape's built-in breadth-first layout is explicitly intended. The built-in discrete layout also avoids the adapter's bundled main-thread ELK computation; the adapter source constructs `new ELK()` without a Worker option, so the currently loaded integration cannot move this work off-thread by configuration alone.
- Hypothesis: using the built-in linear hierarchy layout for solver-result graphs will preserve the complete graph and directional hierarchy while eliminating the ELK long task. ELK remains unchanged for mix graphs; Explorer remains unchanged.
- Single variable and frozen configuration: solver-result graph layout only changes from `elk/layered` to `breadthfirst` with `directed:true`, `circle:false`, `grid:false`, `spacingFactor:1.5`, overlap avoidance, the existing fit/padding/label-dimension policy, and a deterministic coordinate transform for LR/RL/TB/BT. The active solver-graph layout builder is also reused by the existing direction/re-layout control. Node/edge data, rendering, images, labels, interactions, Solver paths, and all Worker/Solver behavior remain unchanged.
- Gate: existing real Chrome lifecycle/UI checks must confirm graph content and consecutive-run behavior before formal observation. Then the unchanged P7-03 two-profile/60-run protocol runs into a distinct P7-04c artifact. ACCEPT requires every prior correctness/path/work/heap/drift gate and every timer gap at most 100 ms, followed by full tests, production 159/159 verification, syntax, diff checks, and Solver parity.
- Rollback: any graph/lifecycle/correctness/memory/drift regression or timer gap above 100 ms rejects and rolls back breadth-first layout. Do not add image caching, change spacing, or tune another layout option after formal observation.
- Result: `REJECT / ROLLED BACK`. The real Chrome lifecycle/UI gate and all 60 formal correctness/path/work, heap, and drift gates passed. Page retained heap was materially lower than the ELK runs, but synchronous solver rendering produced a 151.5 ms median and 168.5 ms maximum interior-Crystal timer gap. Breadth-first was removed without option tuning.

## D-063: Combine the two frozen, independently validated render mechanisms

- Evidence: P7-04a showed exact bounded image reuse reduces synchronous solver-graph settlement while preserving every gate; P7-04c showed the frozen breadth-first layout preserves the graph/lifecycle, removes the later ELK task, and lowers retained page heap. Each failed because the other cost remained. Their settings are already frozen and no new parameter search is needed.
- Hypothesis: combining the unchanged 256-entry exact image LRU from P7-04a with the unchanged solver-only breadth-first builder from P7-04c will remove both reproduced contributors and keep every main-thread gap below 100 ms.
- Change boundary: apply exactly those two previously observed implementations together. The cache key remains color mode + size + shape code and the capacity remains 256. The breadth-first options/transforms remain exactly as P7-04c. No chunking, spacing/cache tuning, graph-data change, mix/Explorer change, Worker change, or Solver change is allowed.
- Gate: real Chrome lifecycle/UI first, then one unchanged two-profile/60-run protocol in a distinct P7-04d artifact. ACCEPT and rollback conditions remain the complete P7-03 correctness/path/work/heap/drift/every-gap-at-most-100-ms gate plus closeout full tests, production 159/159, syntax, diff, and Solver parity.
- Result: `REJECT / ROLLED BACK`. All lifecycle and 60/60 formal correctness/path/work/heap/drift gates passed. Ordinary construction reached only 55.9 ms maximum and interior Crystal improved again to a 111.0 ms median / 126.2 ms maximum timer gap, but the strict 100 ms gate still failed. Both components were removed without tuning.

## D-064: Stage the frozen solver-graph pipeline across browser tasks

- Evidence: P7-04d removed the known redundant image and ELK costs but one combined Cytoscape creation/layout task still reached 126.2 ms. Further algorithm/parameter tuning is closed. The remaining repair is scheduling: preserve the exact frozen cache and breadth-first result while avoiding one indivisible main-thread task.
- Hypothesis: prepare at most eight solution steps per animation frame, initialize Cytoscape hidden with preset positions, yield one frame, then run the same frozen breadth-first layout and reveal the complete graph. This should preserve final graph data/layout while allowing timers and frames to run between expensive stages.
- Product behavior: Solver completion cleans up the Worker immediately, disables the Solve button only while the graph is being finalized, and publishes the existing solved status only after the complete laid-out graph is visible. A generation token suppresses stale staged work if another graph type/rerender supersedes it. No partial/overlapping graph is exposed.
- Frozen implementation: exact P7-04d cache and breadth-first settings; batch size eight; `requestAnimationFrame` boundaries after each batch and between preset Cytoscape initialization and final layout. No parameter tuning, new status text, Solver/Worker protocol change, graph-data change, or mix/Explorer change.
- Gate: real Chrome lifecycle/UI first, then the unchanged two-profile/60-run protocol in a distinct P7-04e artifact. ACCEPT requires the complete P7-03 correctness/path/work/heap/drift/every-gap-at-most-100-ms gate plus full tests, production 159/159, lifecycle/UI, syntax, diff, and Solver parity. Any stale-render, button-state, graph, or threshold failure rejects and rolls back the whole staged pipeline.
- Result: `REJECT / ROLLED BACK`. Lifecycle and all 60 correctness/path/work/heap/drift gates passed, but the final synchronous breadth-first `run()` remained a long task. Interior Crystal reached 160.4 ms median / 236.9 ms maximum; ordinary construction also had one 108.8 ms gap. The staged pipeline and temporary UI-finalization state were removed exactly.

## D-065: Use deterministic preset coordinates for solver result DAGs

- Evidence: five attempts preserved graph correctness but every generic ELK/breadth-first execution breached 100 ms. Solver paths already provide a topologically ordered DAG with stable token IDs, so a general layout search is unnecessary for this view.
- Hypothesis: one linear pass can assign each starting shape rank 0, each operation one rank after its deepest input, and each output one rank after its operation; grouping nodes by rank with fixed non-overlapping spacing yields a complete deterministic hierarchy in O(nodes+edges). Cytoscape `preset` then applies positions without a layout algorithm long task.
- Frozen configuration: solver-only preset ranks; 160 px between dependency ranks; 120 px between nodes within a rank, centered about zero; deterministic insertion order; LR/RL/TB/BT coordinate transforms. Reuse the exact 256-entry image LRU already validated for visual identity and bounded retention. Manual solver direction changes reuse the same rank map. Mix/Explorer retain existing layouts.
- Gate: real Chrome lifecycle/UI first, then unchanged two-profile/60-run protocol in `benchmarks/integration/browser-preset-layout-v1/`. ACCEPT requires all original exact result/path/work, heap, drift, and every-gap-at-most-100-ms gates plus full tests, production 159/159, lifecycle/UI, syntax, diff, and Solver parity. Any graph, overlap-by-coordinate, direction, interaction, or threshold regression rejects and rolls back.
- Result: `PASS / STOPPED`. All 60 exact results and stable paths passed; Worker heap coverage was 60/60; memory/drift passed; maximum timer gaps were 41.8 ms ordinary, 96.4 ms interior Crystal, and 41.3 ms W1. Full suite 188/188, production 159/159, real Chrome lifecycle/UI, syntax 119/119, Solver parity, and diff checks passed.

## D-066: Accept P7-04 and close Product acceptance

- Independent audit: GPT-6 Astra Medium returned PASS with no blocking code, algorithm, evidence, or claim issue and no Astra High escalation. It dynamically validated all 159 frozen E-014 paths (28,268 nodes / 28,104 edges), four direction transforms, manual relayout, unique coordinates, strict dependency progression, bounded LRU behavior/key isolation, every raw result/protocol field, hashes, and production 159/159.
- Claim boundary: the responsiveness PASS is for the frozen workloads, machine, and Chrome 154 run. Interior Crystal's 96.4 ms maximum has only 3.6 ms margin. Fixed coordinates guarantee unique node centers and dependency direction, not optimal edge crossings or pixel-perfect label layout. The cache is bounded by entries, not exact bytes.
- Decision: classify P7-04 and the Product acceptance / production readiness phase as `PASS / STOPPED`. The accepted change is limited to solver-result visualization; E-014 capability, P6-15 browser-safe Worker boundary, Solver semantics, mix graphs, Explorer, and all frozen artifacts remain unchanged. Do not start P5-11 or another major task automatically from this closure checkpoint.

## D-067: Freeze the P5-11 Explorer closure and bounded-partial-result contract

- Status: accepted for implementation on 2026-10-01 after an explicit project-continuation instruction.
- Product meaning: Explorer enumerates reusable-input shape closure by expression-tree height, not finite-inventory recipe reachability. A depth layer evaluates exactly the calls having at least one operand first discovered in the preceding layer. Binary inputs may reuse the same shape; Swapper input order and output lanes are immaterial; Stacker input order is distinct.
- Color/empty/cycle semantics: Painter and Crystal Generator enumerate every distinct code in `COLOR_CODES`. Empty outputs are absence and do not become graph nodes or later operands. A call is recorded only when it discovers at least one new non-empty shape; only those novel outputs are linked, so unchanged siblings cannot suppress novel siblings and pure cycles do not inflate the graph.
- Error semantics: `InvalidOperationInputs` rejects only that physical call. Any other exception remains a terminal Worker error. Missing depth retains the existing large default, but explicit depth zero returns the starting-shape closure without executing an operation.
- Resource contract: production permits at most 25,000 physical attempts, 3,000 ms, 128 shape nodes, 256 operation nodes, 768 edges, and 1 MiB of serialized result. The shape bound also protects the renderer's per-shape 240 px canvas/texture work. Each call is committed atomically only if all node/edge/serialization limits permit it. A stop returns the accumulated graph with `outcome: "limit"`, `complete: false`, an exact `limitReason`, counters, the last fully completed depth, and the interrupted depth. Natural closure/depth completion returns `outcome: "complete"` and `complete: true`.
- Gate: an independent small reference enumerator must match production closure by depth and explicitly cover reverse old/new Stacker, reusable self-pairs, an unchanged multi-output sibling, and mixed four/six-part invalid-call isolation. Tiny injected limits must prove exact boundary/classification behavior. Then require Worker protocol/UI limited-result handling, real Chrome lifecycle, full tests, syntax, byte-identical Solver copies, and unchanged quick W1/production verification.
- Boundary: this task does not change recipe Solver semantics, accepted capability paths, frozen benchmarks, mix graphs, or terminate-based cancellation. Lookup/reparse removal is allowed only inside the newly bounded Explorer after the semantic and resource gates exist.

## D-068: Accept and stop P5-11

- Status: accepted on 2026-10-01 after implementation, final regression gates, and independent GPT-6 Astra Medium audit.
- Correctness: the production closure matches a separate expression-height reference on fixed small domains; reverse Stacker, reusable self-pairs, unchanged multi-output siblings, mixed-part invalid-call isolation, all colors, empty/cycle policy, and depth zero have direct regressions.
- Resources/product: the D-067 limits return atomic, classified partial graphs. Real Chrome completed mixed-part exploration, rendered the 128-shape limited graph, and passed cleanup, stale-event, cancellation, terminal-error, and restart behavior. Limit status remains correctly localizable after a language change.
- Audit: Astra Medium identified two bounded issues—empty seeds checked after admission and an eagerly translated limit reason. Both were fixed with regression evidence. The final audit returned PASS with no unresolved blocker or escalation.
- Verification: full suite 198/198; production 159/159 with exact accepted paths and no reuse; W1 exact logical signature; syntax 120/120; byte-identical Solver copies at `24388AD1...ED2AD`; diff check clean apart from line-ending notices.
- Decision: classify P5-11 as `PASS / STOPPED`. Preserve the independent Explorer product boundary and do not infer any new recipe Solver capability or completeness claim. No subsequent major task starts automatically.

## D-069: Treat the 2026-10-02 continuation as a recovery reconciliation checkpoint

- Authority: the project owner explicitly requested continuation from the repository state under the durable Agent workflow, superseding the prior no-auto-start pause only for recovery and evidence-based next-step selection.
- Evidence: repository state and closeout artifacts show P5-11 and Product acceptance already complete. The only concrete inconsistency found was documentation drift: `EXPERIMENTS.md` retained P5-11's pre-implementation `in progress` label and the current tracked-file inventory omitted `operationGraph.js`.
- Verification: the complete Node suite passed 198/198; production verification passed all 159 frozen members with replay, exact E-014 paths, constructive routes, and zero resource reuse; Solver copies remained byte-identical at `24388AD1...ED2AD`; diff hygiene reported only line-ending notices.
- Decision: close P8-01 as `PASS / STOPPED` after correcting durable records. Do not invent a new product defect, benchmark program, Solver experiment, release action, commit, push, or deployment scope from the generic continuation instruction alone. Runtime code and frozen artifacts remain unchanged.

## D-070: Stop current-source Hard browser readiness at NEEDS-FIX

- Context: the owner explicitly selected real-browser Hard performance and stress re-acceptance as the next milestone and prohibited optimization or Solver semantic changes. The prior P7-04f PASS left only 3.6 ms margin to the frozen 100 ms timer-gap gate, so a current-source rerun had to keep the absolute per-run threshold.
- Protocol: retain the existing two-profile, two-warmup, ten-measured-run, three-workload Chrome protocol and its exact correctness/path/work, heap, page-drift, wall-drift, and responsiveness gates. Add headless and visible lifecycle observations for fresh-page first/repeat wall time and cancellation resource release. Only stale hard-coded task/date evidence fields may be corrected; the complete formal protocol must rerun afterward.
- Evidence: the formal P8-02 rerun completed 60/60 exact path-stable results with 60/60 Worker heap coverage, at most 0.71 MiB page drift, and at most 1.0195 wall drift. Cancellation/restart passed headless and headful. The interior-Crystal Hard workload nevertheless produced timer gaps of 114.0, 115.9, and 111.1 ms in 3/20 runs; its maximum was 115.9 ms.
- Decision: classify P8-02 as `NEEDS-FIX / STOPPED`. A previous same-session run below the threshold cannot override the formal rerun's breaches, and no additional retry, threshold relaxation, optimization, Solver change, or RC closeout is authorized. Preserve the evidence for a separately scoped product-readiness decision.

## D-071: Accept the attributed Hard UI responsiveness repair

- Attribution: a real Chrome/V8 trace captured a 118.4 ms diagnostic timer gap. Worker calculation remained on `DedicatedWorker thread`; the decisive `CrRendererMain` terminal task was about 73 ms, about 72 ms of it synchronous Cytoscape construction from `renderGraph()`, followed by Cytoscape first-paint work. Style/element processing and short scavenges dominated; measured repeated-run canvas serialization was zero and browser layout was below 1 ms.
- Repair boundary: keep Solver semantics, Worker payload/result, path data, graph topology, images, styles, preset coordinates, directions, and interactions unchanged. Yield one task after the terminal Worker result with stale-task suppression, then reuse the active solver Cytoscape instance and atomically replace elements/layout. Mix and Explorer retain their reset behavior; no result or graph update is skipped.
- Formal gate: the original harness identity, workloads, two fresh profiles, two warmups, ten measured runs, exact correctness/path/work rules, memory/drift rules, and absolute 100 ms per-run timer-gap gate remain unchanged.
- Result: `PASS / STOPPED`. All 60 results and paths passed, Worker heap coverage was 60/60, maximum page drift was 0.377 MiB, maximum wall drift was 1.3246, and timer maxima were 31.6 ms ordinary, 97.1 ms interior Crystal, and 30.5 ms W1. Headless/headful lifecycle, full 198/198, production 159/159, syntax 120/120, Solver parity, and diff hygiene passed.
- Decision: the P8-02 blocker is resolved without a search-semantic or frozen-gate change. P8-03 stops here; Hard-capable Release Candidate closeout is the next milestone and was not started automatically.

## D-072: Accept the content-addressed Hard-capable Release Candidate

- Scope: close release-candidate readiness from the accepted frozen evidence only. Do not rerun a Solver benchmark or Chrome performance distribution, change a gate, modify production semantics, push, deploy, or trigger remote CI/CD.
- Identity: accept `hard-capable-rc-v1:3e94ef55d6bcb09a4a74e7777516ae547ee02b7168ca566b2e0963dde80e5f17`, the SHA-256 manifest identity of the current 56-file static runtime selection. The working tree remains intentionally dirty and the candidate is content-addressed rather than falsely represented by base commit `b367b6e`.
- Evidence: frozen production verification is 159/159 with replay, exact E-014 paths, constructive routing, all 53 targets, and zero reuse. P6-15 browser-safe integration, P7-02/P8-03 lifecycle/error recovery, and P8-03's 60/60 browser readiness with 97.1 ms maximum all remain authoritative. Current non-performance checks pass 198/198 tests, 120/120 syntax, static dependency boundary, Solver parity, composite trust chain, frozen evidence hashes, and diff hygiene.
- Historical boundary: the benchmark composite, formal baseline, E-014 frontier, E-015 rejection, P8-02 `NEEDS-FIX`, P8-03 `PASS`, and rejected performance experiments retain their original artifacts and meanings. The P8-03 repair resolves the current gate; it does not rewrite the P8-02 observation.
- Decision: classify P8-04 and `hard-capable-rc-v1` as `PASS / STOPPED`. Release notes, limitations, debt, checklist, report, and machine verdict are complete. No subsequent release or engineering task starts automatically.

## D-073: Publish and stop the end-to-end Hard-capable Release

- Authority: the owner explicitly authorized working-tree closeout, commit, push, tag, existing CI/CD deployment, production identity verification, online Solver/Worker smoke, and final status updates, while prohibiting any expansion into Solver/benchmark/capability redesign, features, migrations, or optimization.
- Release identity: publish annotated tag `hard-capable-v1` at `f62683a3be7e826c8c764afcee4977114b15a9f0`, bound to unchanged candidate `hard-capable-rc-v1:3e94ef55d6bcb09a4a74e7777516ae547ee02b7168ca566b2e0963dde80e5f17`.
- Packaging: deploy only the static runtime allowlist, retain the required `constructive/` dependency directory, exclude raw multi-gigabyte profiling streams and local temporary products, and publish a machine-readable deployment identity. Git line-ending normalization initially changed five accepted runtime byte streams; `.gitattributes` repaired that mechanical mismatch and production now matches 56/56 frozen RC hashes exactly.
- Evidence: full 198/198, production 159/159 with replay/exact E-014 paths/zero reuse, syntax 120/120, Solver parity, installed-Chrome lifecycle, successful push/tag, Gitea Actions run 21 success, production identity at the release SHA, 56/56 RC and 4/4 constructive hashes, HTTP 200, and two successful online depth-52 Worker/UI solves with graph/button cleanup and zero console errors.
- Historical boundary: no Solver search semantic, benchmark semantic, capability architecture, runtime redesign, feature, migration, or optimization changed. Frozen benchmark, baseline, E-014, P8-02, P8-03, P8-04, and every historical verdict retain their content and meaning.
- Decision: classify P8-05 and `hard-capable-v1` as `PASS / STOPPED`. No next task starts automatically.
