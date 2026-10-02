# Hard 53×1 Staged Generation Report

Date: 2026-09-18 (Asia/Shanghai)

This run attempted exactly one formal instance for every official Hard target. It did not run Solver search, solve-rate measurement, candidate filtering by Solver outcome, 53×3/53×5 generation, or Insane generation.

## Coverage

| Scope | Generated | Failed | Total |
|---|---:|---:|---:|
| Mainline | 12 | 0 | 12 |
| Side | 41 | 0 | 41 |
| **All Hard** | **53** | **0** | **53** |

- forward replay valid: 53/53 generated instances;
- trusted release valid: 53/53 generated instances;
- target-scoped canonical structural families: 53;
- released artifact: `hard-53x1-stage-v1`;
- current trusted manifest revision: `hard-53x1-stage-v1-manifest-r2`;
- artifact content SHA-256: `40c4ea586dfeafb5f5e37545101220451d2cc9a9ca2ab54eb9d00a94806c8375`.

The manifest-r2 revision was created solely because trusted `BENCHMARK_RULES.md` received a historical documentation correction. It did not regenerate or modify this artifact, its witnesses, its public Solver projection, canonical mechanics, or normative rules.

The release profile contains every official Hard target. `target-status.json` and `generation-log.json` retain the rejected direct-layer attempt for `hard-side-033` before its accepted generic composition.

## hard-side-033 root cause

The target is a four-layer, fully occupied checkerboard:

- L0/L2: `Rw cm Rw cm`;
- L1/L3: `cm Rw cm Rw`;
- no Pin, refinement, or final empty region;
- eight isolated magenta Crystal components, because Crystal cells are separated horizontally by `Rw` and alternate quadrants vertically.

The previous dense fast path constructed each exact layer independently and then used Stacker. Its first non-preserving transition is:

`Stack(RwcmRwcm, cmRwcmRw) -> RwcmRwcm:--Rw--Rw`

Canonical Stack inserts an empty layer and applies Gravity. Detached Crystal cells in the upper operand are marked unsupported and shatter before the ordinary cells fall. Repeating that macro-action produces the recorded failure state `RwcmRwcm:RwRwRwRw:--Rw--Rw`.

This was not a primitive, resource, pruning, or semantics gap. The existing Generic Crystal planner already returned `single-color-half-scaffold` for the complete target and forward-constructed it exactly. The upper composition layer never called that planner because the broad dense-Crystal branch claimed the target first and treated its failed Stack result as terminal.

## Existing capability reuse

The accepted construction uses only existing generic capabilities:

1. ordinary extraction, rotation, painting, and disjoint scaffold-layer construction;
2. one fully supported four-layer sacrificial scaffold for q0/q1 and one for q2/q3;
3. one magenta Crystal generation pass per scaffold;
4. canonical Cutter extraction of the exact stable half;
5. final Swapper recomposition, avoiding Crystal-bearing upper Stack input;
6. frozen additive input-environment expansion and canonical forward replay.

Every Cut boundary is Crystal-safe: no layer has Crystal on both sides of a boundary, so target Crystal breakage is zero. Each retained half is vertically supported. Swapper recomposes the halves without Gravity.

## Composition fix

The dense path now performs a read-only canonical preview of direct layer composition before consuming construction resources. If direct Stack preserves the target, the existing direct strategy remains available. If it does not, the failed preview is retained as a rejection and construction falls back to the existing Generic Crystal planner.

The routing rule is structural and target-ID independent. It also applies to other dense Crystal targets whose individually constructible layers cannot be safely stacked. No new primitive was added.

## hard-side-033 result

| Check | Result |
|---|---:|
| Canonical forward replay | pass |
| Trusted release validation | pass |
| Available input occurrences | 25 |
| Core input occurrences | 24 |
| Available/core input types | 14 / 14 |
| Available-input expansion | additive, +1 |
| Witness depth | 14 |
| Operation count | 163 |
| Crystal Generator | 2 |
| Cutter | 56 |
| Stacker | 22 |
| Swapper | 1 |
| Target Crystal breakage | 0 |

The available environment adds one related ordinary occurrence to the 24-occurrence core basis. It is not an exact-core presentation and exposes no hidden resource.

## Corpus characteristics

All 53 released environments use the frozen additive expansion policy. Transformative expansion count remains 0 in this one-instance stage. Available input multiplicity ranges from 6 to 53; core basis multiplicity ranges from 5 to 51. The larger cases retain all process-only cage, isolated-Pin, Cut byproduct, and Swapper lineage.

### Refinement and mechanics coverage

| Feature | Instance count |
|---|---:|
| Refinement A | 3 |
| Refinement B | 3 |
| Refinement C | 3 |
| Refinement D | 2 |
| No refinement | 42 |
| Pin Pusher in witness | 21 |
| Crystal Generator in witness | 15 |
| Swapper in witness | 11 |

Witness depth ranges from 8 to 26 and operation count from 25 to 334. These are mechanically derived construction descriptors, not Solver performance labels.

## Regression evidence

- a target-independent two-layer alternating dense-Crystal regression reproduces the destructive direct Stack result and proves exact half-scaffold fallback;
- `hard-side-033` retains the rejected direct strategy followed by accepted generic composition and additive expansion;
- all 53 released instances replay from presented inputs to exact targets;
- Generic Pin, Generic Crystal, staged full-layer mask, sparse-upper mask, Mixed Pin/Crystal, historical, coverage, and expansion regressions remain active;
- the complete npm test suite passes.

## Integrity

- no target ID or official shape-code recipe was added;
- no Solver result, solve-rate, or optimization was consulted;
- no official target, canonical mechanic, schema, validator boundary, input/refinement rule, structural canonicalization, expansion policy, or benchmark architecture was changed;
- no hidden resource, core-basis exposure, or rule relaxation was added;
- every witness begins with presented `availableInputs`, uses complete canonical operations, and forward-replays to exact target equality;
- the Solver-facing projection continues to exclude core basis, witness, expansion, and construction metadata.

## Recommendation

Hard 53×1 target coverage complete.

Do not enter 53×3/53×5, Solver optimization, or Insane generation automatically.
