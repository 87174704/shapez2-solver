# Splitting Correctness and Solution-Quality Oracle

Status: P4-01/P4-02/P4-02a were accepted on 2026-09-13. Astra review subsequently found that this domain did not exercise E-003 under actual beam pruning, so it remains useful parity/replay infrastructure but is not an adequate E-003 bounded-beam acceptance gate.

## Purpose and claim boundary

Splitting optimizations may change beam occupancy, reachable states, enumeration order, or path depth. Fixed benchmark signatures alone cannot validate those changes. The oracle must determine whether:

- a production path is executable and its terminal inventory satisfies the goal;
- production misses a reference solution in an explicitly bounded small domain;
- a returned path preserves shortest primitive depth within that domain;
- an experiment changes solve rate, depth quality, splitting/loss/waste, or search work.

The reference search may reuse the physical shape rules in `shapeOperations.js`, but it must not reuse `shapeSolver.js` state representation, goal logic, successor enumeration, beam collector, or visited implementation. This isolates search semantics but does not independently prove the physics implementation correct.

Passing the oracle supports only a bounded-domain relative-completeness claim. It is never evidence that the production heuristic is globally complete.

## Current parity semantics

The initial oracle freezes the current production behavior:

- Starting tokens have throughput 1.
- Splitter maps `(shape, q)` to two `(shape, q/2)` tokens down to the production minimum of `1/4096`.
- Unary outputs inherit the input throughput; Cutter gives each non-empty output the full input throughput.
- Binary operations consume both complete inputs and assign every output `min(qA, qB)`.
- When binary inputs have unequal throughput, the larger-input remainder currently disappears; no residual token is retained.
- Legal `[]` is a consume-only transition. `InvalidOperationInputs` alone means an invalid action.
- Consume-only successors may be omitted when `preventWaste=false` and must be available when it is true.
- A unary single-output action whose output shape equals its input may be omitted. Binary actions must not be treated as generic no-ops because consuming inventory can satisfy `preventWaste`.
- Each target requires one full unit of matching throughput. Orientation-insensitive targets accept a complete rotation orbit.
- Multiple targets consume independent capacity, including identical or rotation-equivalent targets.
- With `preventWaste=true`, visible terminal throughput whose shape is outside every acceptable target set is forbidden; acceptable surplus is currently allowed.
- The first version excludes Painter and Crystal Generator from the generated exhaustive matrix because their action sets are target-dependent.

These are parity rules, not product decisions. In particular, unequal-throughput discard, acceptable surplus, and the scope of `preventWaste` remain explicit open questions.

## Exact finite domain

The routine generated matrix uses four-part shapes, `maxLayers=2`, no more than three starting shapes, no more than two targets, and no more than three enabled physical operations chosen from Rotator CW, Rotator 180, Half Destroyer, Cutter, Swapper, and Stacker. Splitting is an independent option.

The deterministic seed basis is:

- `CuCuCuCu`
- `RuRuRuRu`
- `CuRu----`
- `----RuCu`

Routine maximum depth is 5; selected hand-written adversarial fixtures may use depth 7. The default oracle guards are 20,000 unique states and 200,000 generated transitions. A production exact-comparison fixture must also have reference maximum layer width no greater than 1,000 and runs production with cap 5,000.

Oracle limit exhaustion is a test-domain error, not a no-solution result.

## Integer throughput model

Use exact integer units:

- `Q = 4096` represents throughput 1;
- a token key is `(shapeCode, units)`;
- Splitter is legal only when `units >= 2` and creates two tokens of `units / 2`;
- each target demands `Q` units;
- no floating-point tolerance appears in the reference implementation.

Current dyadic production throughput is exactly representable by JavaScript `Number`, so reference/production values should agree. Any future non-dyadic splitting ratio requires a new representation decision.

## Reference search

Use unpruned level-order BFS:

1. Represent state as a multiset from `(shapeCode, units)` to count.
2. Canonicalize its key by shape code, units, and count, independent of production token IDs.
3. Expand each canonical state only at its shallowest depth.
4. Enumerate every legal action without similarity, fragmentation, or beam pruning.
5. Check goals at level boundaries and optionally on generation without changing shortest-depth semantics.
6. Use canonical action order only for deterministic witnesses, not for parity with production path signatures.

Action enumeration rules:

- Splitter: once per available token group.
- Unary: once per token group.
- Swapper: unordered pairs; the same group requires count at least 2.
- Stacker: ordered pairs, including both directions; the same group requires count at least 2.
- Mixed incompatible inputs skip only `InvalidOperationInputs`; all other exceptions remain visible.
- Binary output units are `min(a, b)` and no residual is retained in parity mode.
- Legal empty output and invalid action remain distinct.

Return one of `found`, `not-found-within-depth`, `exhausted-no-solution`, or `oracle-limit`. Only natural frontier exhaustion can prove no solution under the modeled semantics.

## Independent goal allocation

Aggregate inventory by shape and integer units. Each target is a demand node of `Q`; each shape supplies a target only if it is in that target's singleton or rotation-orbit acceptable set. Use deterministic DFS capacity allocation or a small max-flow, not the production greedy loop.

After all demands are assigned, `preventWaste=false` succeeds. With `preventWaste=true`, remaining units outside the union of acceptable sets fail while acceptable surplus succeeds under current parity semantics.

## Production-path replay

`replaySolution(problem, solutionPath)` reconstructs throughput from public token IDs:

1. Create starting IDs `0..n-1`, each at `Q` units.
2. For each step verify every input ID is live, not consumed twice, and has the declared shape.
3. Verify the operation is enabled and Splitter is allowed.
4. Recompute physical outputs through `shapeOperations.js` and compare output count, order, and shape.
5. Derive units: Splitter halves; unary preserves; binary uses the minimum input units.
6. Require every output ID to be new and globally unique.
7. Verify consume-only steps and the terminal goal with the independent allocator.
8. Require `result.depth === solutionPath.length`.

Replay diagnostics include splitter step count, minimum units, implicit binary discard units, empty-output consumed units, unacceptable terminal waste, and acceptable terminal surplus. A non-replayable production path is always a hard correctness failure.

## Comparison and quality

Suggested interfaces:

```js
referenceSolve(problem, oracleLimits, semantics)
replaySolution(problem, solutionPath, semantics)
compareWithOracle(problem, productionResult, referenceResult)
```

Comparison classifications include `invalid-solution`, `false-negative-within-domain`, `optimal-within-domain`, and `solved-suboptimal`. The primary quality value is `depthGap = productionDepth - referenceDepth` after expanding any future macro edge into primitive operations.

Secondary reported metrics are Splitter count, minimum throughput, implicit binary loss, waste/surplus, production/reference states and candidates, and a deterministic diagnostic signature. Until a product cost model is chosen, Splitter count, machine count, and throughput loss are not hard optimization objectives.

## Required adversarial coverage

- Splitting lineage and aggregation: two half-throughput tokens satisfy one target; one half does not; `1/4096` cannot split again.
- Deliberately suboptimal witness: split `CuRuSuWu` and rotate both halves to `WuCuRuSu` in three primitive steps while the unsplit shortest path is one rotation.
- Unequal binary throughput: both inputs are consumed, outputs use the minimum, and discarded units are reported. Future `requireEqualThroughput` and `preserveResidual` modes may be parameterized but are not yet correct-by-definition.
- `preventWaste`: retain the fixed Half Destroyer consume-only case and test unacceptable remainder, acceptable surplus, fragmented acceptable throughput, and hidden binary discard diagnostics.
- Orientation: depth-zero rotation equivalence when insensitive, rejection when sensitive, one-step sensitive rotation, and a symmetric shape whose orbit has fewer than four members.
- Multiple targets: identical or equivalent targets still need two units; disjoint targets cannot share capacity; target permutation preserves truth and optimal depth.
- Enumeration boundaries: Swapper commutativity, both Stacker orders, same-token count requirements, incompatible 4/6-part pairs, and `[]` versus invalid input.
- Beam sensitivity: discover once with a bounded deterministic scan, then fix a case where cap 5,000 finds the reference shortest solution and a narrow cap misses or returns a longer solution. Routine tests must not rediscover it dynamically.

## P4-02 implementation and gate

P4-02 is test-only:

1. Implement integer tokens, canonical states, independent goal allocation, and action transitions.
2. Unit-test transition conservation, output throughput, pair direction/commutativity, consume-only, and invalid input.
3. Implement guarded BFS with the four result states.
4. Implement public-path replay and ID/throughput lineage checks.
5. Add hand-written adversarial fixtures.
6. Add a small deterministic generated matrix.
7. Compare approved reference cases with production through one positional-API wrapper.
8. Discover and then freeze one beam-sensitive fixture.
9. Run the full Node suite, W1 signature smoke, and a splitting smoke.
10. Confirm neither production solver copy changed and both remain byte-identical.

Acceptance requires all hand-written integer/goal tests to pass, every production path to replay, no high-cap false negative or depth gap in the approved exact group, no oracle/production limit, a fixed narrow-beam tradeoff case, deterministic output, all existing tests passing, and unchanged production solver hashes. Wall time is never a correctness threshold.

### Accepted implementation checkpoint

- Helper: `tests/helpers/shapeSolverOracle.mjs`.
- Tests: `tests/shapeSolver.oracle.test.mjs`.
- The helper has an independent integer-throughput state, goal allocator, guarded BFS, transition enumerator, public-path replay, and comparison classifications. It shares only physical operations with production.
- The oracle and production regression suite pass 27/27 total. Six fixed production/reference problem instances have replay-valid production paths, no high-cap false negative, no depth gap, and no limits. This is not a generated enumeration of the whole finite domain described above.
- A fixed beam-sensitive fixture starts from `CuCuCuCu` and `RuRuRuRu`, targets `CuCuRuCu`, and enables Rotator CW plus Swapper. Reference and cap 5,000 solve at primitive depth 3; cap 1 returns a replay-valid depth-6 path (`depthGap=3`). Reference maximum layer width is 5.
- W1 retains its exact solved/depth/state/generated signature; all 15 tracked and untracked JavaScript/module files pass syntax checks; production solver hashes remain byte-identical at `60CDEE5D...4C04` after E-003.
- The generated matrix still excludes Painter and Crystal Generator as designed. Operation physics itself is not independently proven by this search oracle.

### P4-02a Split-required extension

The original matrix exercised splitting mode and manual Splitter replay but did not require a Splitter. P4-02a now fixes strict Split-required Swapper cases across orientation-insensitive, orientation-sensitive, `preventWaste`, and multi-target modes. Removing Splitter naturally exhausts the reference graph; cap 100 and cap 5,000 retain replay-valid reference-shortest paths. The largest case uses only 41 states and 71 transitions.

No fixed case currently requires nested or multiple Splitter steps. The current one-split witnesses also complete before their beam fills, so they do not test whether E-003 displaces a required split state. Retained E-003 does not delete split edges, but that fact and these witnesses do not establish bounded-beam completeness or quality.

Post-Astra Sol High design review identified that the existing insensitive witness becomes a valid E-003-exercising gate when production cap is reduced from 100 to 2. Reference BFS with splitting solves at depth 3 (14 states, 21 transitions, maximum layer width 8); disabling splitting naturally exhausts. Read-only test instrumentation measured E-003 on/off both replay-valid at depth 3, but with different retained semantic sets. The on run used 5 states/15 candidates with one unique beam reject and one eviction; the off run used 5/18 with seven unique rejects. E-003 participated in at least three exact-primary ties. These measurements are design evidence to automate, not a benchmark or a nested-split completeness result.

The long-term test seam must leave the public Worker protocol and positional `shapeSolver(...)` API unchanged. A test-only wrapper may select coarseness and exact diagnostics. Diagnostic mode may materialize a normally lazy candidate solely to distinguish unique beam loss from visited/retained duplicates; it is forbidden for timing claims. Cross-run state identity uses canonical `shape@integerUnits#count`, never internal token IDs.

Nested witness discovery is fixed in advance: add oracle restrictions `maxSplitterSteps=1` (with splitter count in the visited key) and `noNestedSplitting`; synthesize reachable targets in deterministic order; try Rotator CW+Swapper, then add Rotator 180, then Cutter, then Stacker; guard each oracle at 20,000 states/200,000 transitions and the entire discovery at one million transitions or ten seconds. For each BFS-qualified target test caps 1,2,3,5,8,13 and freeze the first lexicographic case with unique pruning and coarseness retained-set divergence, whether it helps or harms E-003. Routine tests use the frozen case and never rediscover it.

Replay treats Swapper output shapes as an unordered multiset because the public path and graph have no output-lane contract. Shape multiplicity and declared output-ID lineage remain strict. All other modeled operations retain ordered-output replay.

### P5-07 accepted checkpoint

- The additive `shapeSolverTestOnly(instance, options)` export selects coarseness on/off and exact diagnostics without changing the existing Worker protocol, positional `shapeSolver(...)` contract, or normal result shape. Normal solves do not materialize diagnostic semantic keys.
- The cap-2 fixed witness passes the designed A/B gate. Reference BFS finds depth 3 with 14 states, 21 transitions, and maximum layer width 8; disabling splitting naturally exhausts. E-003 on/off both return replay-valid depth-3 paths. On records 5 states/15 candidates, one unique rejection and one eviction; off records 5/18 and seven unique rejections. Their depth-2 canonical retained sets differ and exact-primary coarseness ties are observed.
- `referenceSolve` now treats `maxTransitions` as an exact processed-transition budget. At the boundary it recognizes a goal already accumulated for the next BFS layer before reporting `oracle-limit`; tests cover both a boundary solution and a boundary limit.
- The discovery tool runs under a parent-process hard watchdog, automatically replays every solved A/B path before accepting a witness, fails on invalid replay, and reports the exact completed search prefix.
- The accepted deterministic run reached 1,000,000 transitions in about 5.5 seconds without a qualifying nested/multiple-Splitter witness. It fully covered Rotator CW+Swapper, completed only the `----RuCu` starting inventory in the Rotator CW+Swapper+Rotator 180 tier, and did not reach Cutter/Stacker. This is inconclusive, not evidence of nested-splitting completeness.
- Independent Sol High review accepted P5-07 with the nested/multiple-Splitter gap explicitly open. Future recipe semantic experiments need their own predeclared gates and cannot cite this checkpoint as a global or nested completeness proof.

## Semantic experiment gate

Before P4-02 passes, allowed work is limited to documentation, test-only oracle/fixtures, read-only analysis, bounded offline discovery of a fixed adversarial case, and existing regressions.

Splitting quotas, fragmentation penalties, coarse-flow tie-breaks, unequal-throughput restrictions or residuals, on-demand macro edges, and pruning that changes beam occupancy or reachable states are forbidden before the gate.

The original P4 gate passed, but Astra review reopened the E-003-specific acceptance gate. Before another semantic experiment, add fixed split-required fixtures with observed unique-state pruning and E-003 participation, declare A/B quality thresholds in advance, replay every solved path, and compare depth/work/beam events. W1-W5 remain diagnostic checks only.

## Open product/semantic decisions

1. Is unequal-throughput binary discard intentional, or should the operation reject unequal inputs or preserve a residual?
2. Does `preventWaste` cover only visible terminal non-target inventory, or internal operation/truncation/throughput loss too?
3. Is acceptable target-shaped surplus permitted?
4. Beyond primitive depth, should recipe quality optimize Splitter count, machines, throughput loss, or retained flow?
5. Should output paths expose throughput explicitly rather than relying on ID lineage?

These questions do not block parity-mode P4-02. They must be answered before an experiment changes the corresponding production semantics.
