# Generic Crystal Construction Planner Report

Date: 2026-09-17 (Asia/Shanghai)

This pass was limited to the sparse-upper Crystal mask-removal capability required by `hard-side-040`. It did not implement mixed Pin/Crystal target planning, work on `hard-side-033`, run Solver search or filtering, or enter 53×3/53×5 or Insane generation.

## Root cause

The target is `cycycycy:XkcwXk--:--Cy----`, with layers numbered bottom-up:

- L0: full yellow Crystal;
- L1: `Xk` at q0/q2, wanted white Crystal at q1, and required empty q3;
- L2: `Cy` at q1 and required empties q0/q2/q3.

The full-layer primitive used by `hard-main-008` relies on every cell in the refinement suffix being Generator-eligible. That is correct for a full monochrome Crystal suffix, but it overfills the sparse upper layers here. A premature white pass produces `cycycycy:XkcwXkcw:cwCycwcw`, filling L1 q3 and L2 q0/q2/q3.

The four required upper empties cannot remain as unqualified empty cells during white generation. They need physical state transitions: cells in the discarded spatial half are occupied by temporary solids, while the retained-half empty at L2 q0 becomes sacrificial white Crystal and is removed through a boundary-crossing sacrificial pair.

Removal after full-base attachment is unsafe. Yellow Crystal is fused horizontally across L0 and vertically to the wanted white cell at L1 q1. Any Cutter-triggered Crystal component that reaches that fused base propagates destruction through the connected component. Separately generating the complete sparse upper assembly is also insufficient: canonical Stacker checks support before an unsupported Crystal-bearing upper operand can fall, so the white cell shatters and `cycycycy:XkCyXk--` remains.

The blocker is therefore construction topology, not a target ID:

1. Generator eligibility and required emptiness coexist in the same sparse upper layers.
2. Destructive mask removal must occur while the base is split into Cut-safe spatial halves.
3. The Crystal-bearing upper component must be generated only after its partial base support is attached.
4. The protected halves must be recomposed without using Crystal-bearing upper Stack input.

## New primitive

`sparse-upper-refinement-mask` is a bounded, target-derived primitive. Its current structural class requires:

- a fully occupied monochrome Crystal base prefix;
- a sparse upper suffix containing one different Crystal color;
- all upper refinement Crystal cells to fit in one Cutter half;
- the other half to contain only ordinary target cells and empties;
- canonical preview of mask generation, Cutter cleanup, and Swapper recomposition to reproduce the exact target.

For `hard-side-040`, the selected refinement half is q0/q1.

### Protected refinement component

The partial yellow base is generated as `cycyCuCu`. The ordinary q2/q3 cells are real protection masks, so yellow Crystal does not cross either Cutter boundary.

The two physical upper mask layers are:

- `XkP-CuCu`
- `P-CyCuP-`

After they are attached above the protected partial base, white generation produces:

`cycyCuCu:XkcwCuCu:cwCyCucw`

The Pin at L1 q1 becomes the wanted white Crystal. The Pins at L2 q0/q3 become a sacrificial white pair fused across the q3/q0 Cutter boundary. Cutter removes that pair and discards the solid-masked half, preserving exactly:

`cycy----:Xkcw----:--Cy----`

The wanted white cell is vertically fused to the retained yellow half, but that component does not cross a Cutter boundary. Target Crystal breakage is therefore zero; exactly two sacrificial white mask cells are deliberately shattered.

### Other component and recomposition

The other base scaffold is `CuCucycy`. Its q2 `Xk` upper cell is attached while it is still non-Crystal, and Cutter preserves:

`----cycy:----Xk--`

Swapper recomposes the two already-safe halves into the exact target. No destructive operation occurs after the full yellow base exists.

The planner enumerates only the two spatial half assignments and target-derived mask partners. Every candidate is checked through canonical Stack, Generator, Cutter, and Swapper mechanics; it does not enumerate arbitrary operation sequences and has no target-ID branch.

## Resource lineage

Group C remains exact:

- `XwXwXwXw ×1`
- `XkXkXkXk ×1`

The single `Xk` occurrence is partitioned once; q0 and q2 columns enter the target and the remaining columns stay as explicit byproducts. The required `Xw` occurrence is present exactly once and remains in the causal preprocessing/byproduct graph without being duplicated or treated as an infinite source.

The witness also records all ordinary scaffold sources, three physical Pins, two red sacrificial Crystal columns used by the existing isolated-Pin primitive, Cut outputs, yellow/white Crystal generation, both non-target Swapper outputs, Stack ancestry, and terminal waste. No logical-only mask is used.

## hard-side-040 result

Result: **generated and formally released**.

| Check | Result |
|---|---:|
| Canonical forward replay | pass |
| Trusted release validation | pass |
| Available input occurrences | 44 |
| Core input occurrences | 42 |
| Available/core input types | 20 / 20 |
| Available-input expansion | additive, +2 |
| Witness depth | 26 |
| Operation count | 269 |
| Crystal Generator | 7 |
| Cutter | 94 |
| Stacker | 38 |
| Swapper | 3 |
| Pin Pusher | 3 |
| Target Crystal breakage | 0 |
| Sacrificial white mask breakage | 2 |
| Refinement group | C, exact ×1/×1 |

The large temporary basis comes from replay-proven ordinary protection masks plus the existing isolated-Pin Crystal scaffold; no hidden resource or duplicated refinement occurrence is used. Expansion remains the frozen additive policy and adds one `CuCu----` plus one `CuRu----` occurrence.

The previous full-layer rejection is retained as attempt 1 in the generation log. Sparse construction is accepted as attempt 2, and additive expansion as attempt 3.

## Regressions

Focused positive regressions prove:

- sparse required-empty cells are protected by real solid/Pin/eligible states;
- the boundary-paired sacrificial mask is removed before full-base recomposition;
- the retained refinement half and ordinary other half recombine exactly through Swapper;
- Group C provides exactly one `XwXwXwXw` and one `XkXkXkXk` occurrence;
- the complete formal witness replays to the exact target.

Focused negative regressions prove:

- premature Generator overfills the sparse suffix;
- stacking a detached Crystal-bearing upper assembly onto the full base destroys the unsupported white Crystal;
- using the base color, or refining the detached upper mask before base attachment, fails canonical sparse replay;
- removing the cross-boundary sacrificial partner leaves the wrong Crystal distribution;
- duplicating the `XkXkXkXk` occurrence is rejected by resource validation.

The prior full-layer-mask, single-color Crystal, generic Pin, historical release, coverage release, expansion release, and complete-suite regressions remain required.

## Coverage

| Measure | Before | After |
|---|---:|---:|
| Total Hard coverage | 46 / 53 | 47 / 53 |
| Mainline | 9 / 12 | 9 / 12 |
| Side | 37 / 41 | 38 / 41 |
| Pure Crystal construction failures | 1 | 0 |

Released artifact SHA-256: `3cf5332c6db31eb86419d7096632701896200cf99b2fb498720d4df6a3ef2896`.

## Remaining taxonomy

- mixed Pin/Crystal gravity gap: 5;
- sparse Crystal construction gap: 0;
- generic construction planner gap: 1 (`hard-side-033`).

## Integrity

- no target-specific recipe or target-ID branch;
- no Solver execution, filtering, or solve-rate work;
- no official target, canonical mechanic, input rule, refinement rule, schema, canonicalization, expansion policy, validator boundary, or release identity change;
- no mixed Pin/Crystal planner development;
- all 47 accepted instances start from presented available inputs and pass canonical forward replay plus trusted release validation;
- the original `hard-side-040` full-layer rejection remains visible in target status and generation history.

## Recommendation

Pure Crystal construction gaps have converged; next candidate phase is Mixed Pin/Crystal.

Do not enter that phase automatically. `hard-side-033` remains a separate generic alternating dense-Crystal assembly gap and was not changed in this pass.
