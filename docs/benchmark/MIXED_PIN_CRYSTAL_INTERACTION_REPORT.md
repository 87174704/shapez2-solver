# Mixed Pin/Crystal Interaction Report

Date: 2026-09-18 (Asia/Shanghai)

Scope was limited to the five real Mixed Pin/Crystal failures. `hard-side-033`, Solver execution, 53×3/53×5, Insane, canonical mechanics, schemas, validator boundaries, structural canonicalization, expansion policy, and release identity were not changed.

## Target interaction traces

Layers are zero-based bottom-up; `q0..q3` are canonical quadrants.

| Target | Pin state | Crystal state | Exact composition blocker | Accepted transition |
|---|---|---|---|---|
| `hard-main-007` | L1 q0/q2; upper Pins L2 q1/q3 | blue L0 q1/q3, white L1 q1/q3; vertical fused pairs | Pin-only planning stops at every Crystal cell; Crystal-only planning cannot retain final Pins, and stacking a detached Crystal-bearing column in the wrong order shatters it | build protected Crystal columns, add lower/middle Pins by Pin Pusher or upper Pins by the existing isolated-Pin primitive, compose Crystal-bottom columns first, then Swapper halves |
| `hard-main-011` | L0 q1/q3 below Xw | blue L0 q0/q2, cyan L1 q0/q2 | two-color Crystal columns and Pin/Xw columns are individually constructible, but neither base planner owns their same-layer recomposition | construct two protected Crystal/refinement columns and two Pin-supported Xw columns; use support-safe per-half Stack and final Swapper |
| `hard-main-012` | L0 q1/q3 directly support white Crystal at L1 q1/q3 | white L0 q0 plus L1 q1/q3 | final Pins cannot exist before Generator because Generator replaces `P-`; detached L1 Crystal shatters before falling; direct adjacent-column Stack therefore cannot form the lower mixed base | generate each Crystal-bearing suffix first, Pin Push q1/q3 suffixes, route adjacent columns through quarter-column Rotator/Swapper recomposition, then attach the solid roof |
| `hard-side-029` | L0 q0; L1 q1–q3; upper Pin L3 q3 | cyan L0 q1–q3, magenta L1 q0, yellow L2 q1–q3 | the repeated Crystal→Pin→Crystal columns cannot be assembled by detached Crystal Stack; q2/q3 also need adjacent quarter recomposition | build Crystal suffixes before their supporting Pins, attach them above a protected cyan base only when the upper operand begins with Pin, and use quarter-column Swapper routing where direct Stack is destructive |
| `hard-side-031` | L0 q0/q1 | magenta/white q0/q1; yellow/red/white q2/q3 | the left Pins must be created after the Crystal-bearing upper half exists; the right three-color half exceeds the prior full-layer/sparse-mask shapes | protected staged Crystal half on each side, Pin Push the complete left suffix, then Swapper the two mechanically stable halves |

Across the five targets:

- same-layer Pin/Crystal adjacency occurs in every target;
- vertical Pin→Crystal support occurs in `hard-main-012`, `hard-side-029`, and `hard-side-031`;
- upper Pins occur in `hard-main-007` and `hard-side-029`;
- no final target requires Pin fill;
- the solid roof in `hard-main-012` is the only raised connected component handled after mixed recomposition;
- Generator is never allowed to run over a final Pin: canonical `P-` replacement is explicit and tested;
- no accepted extraction Cut crosses a retained Crystal component; sacrificial cage solids protect every boundary;
- canonical Gravity is decisive after Stack, while Swapper is used for Crystal-bearing recomposition that Stack cannot safely perform;
- Pin overflow and sacrificial Crystal destruction occur only through the reused isolated-Pin primitive for upper Pins;
- no accepted plan relies on Stack overflow/truncation of target Crystal, Pin fill, or an abstract symbolic merge.

## Interaction taxonomy

| Capability | Initially blocked targets | Targets |
|---|---:|---|
| Protected spatial Crystal staging | 5 | all five |
| Crystal-bearing suffix → supporting Pin | 3 | `hard-main-012`, `hard-side-029`, `hard-side-031` |
| Support-safe half recomposition | 5 | all five |
| Quarter-column routing instead of destructive Stack | 2 | `hard-main-012`, `hard-side-029` |
| Upper Pin after Crystal construction | 2 | `hard-main-007`, `hard-side-029` |

The implementation priority followed blocked-target count: protected staging and half recomposition first, then the Crystal-to-Pin transition, then the two-target quarter routing case.

## Implemented capabilities

### Protected spatial Crystal staging

Precondition: every retained cell of the requested column or half is occupied, and each stage introduces at most one new Crystal color. Existing generic Crystal planning is attempted where it already applies; otherwise the mixed planner builds a fully occupied sacrificial solid cage with Generator-eligible target holes.

Operations: ordinary/refinement construction → ordered Stack of cage layers → Crystal Generator after each new color layer → Cutter/column extraction.

State transition: an unsupported detached Crystal request becomes a supported, fully occupied staged component. Existing Crystal is not recolored; cage solids prevent unwanted generation and prevent Cutter breakage from entering retained Crystal.

### Crystal-bearing suffix to supporting Pin

Precondition: canonical Pin Pusher preview of the already constructed suffix must equal the requested component. The bottom output mask must match occupied suffix cells exactly.

Operations: build Crystal/solid suffix → Pin Pusher → optional support-safe lower attachment.

State transition: the suffix remains mechanically supported while new Pins are inserted beneath it. This is used instead of generating Crystal over final Pins, because Generator canonically replaces `P-`.

### Support-safe and quarter-column recomposition

Precondition: canonical preview must reproduce the requested half/target. Direct Stack is accepted only if Gravity preserves the component. When two adjacent columns cannot be stacked because one contains unsupported Crystal, both are rotated to opposite Swapper lanes, recomposed, and inverse-rotated.

Operations: ordered Stack for safe components; otherwise Rotator → Swapper → inverse Rotator; final half Swapper; optional solid-only upper Stack.

State transition: independently proven components become one mixed component without presenting a Crystal-bearing upper operand to Gravity.

## Regression evidence

- positive: all five formal instances replay from presented inputs to exact targets;
- ordering negative: `Pin → Crystal` and `Crystal → Pin` produce different canonical states;
- support/Gravity negative: stacking detached Crystal above a Pin base removes the unsupported Crystal before it can fall;
- Crystal negative: Generator over `P-` produces Crystal, proving final Pins cannot be treated as permanent masks;
- resource negative: removing one actually consumed occurrence makes replay fail;
- existing generic Pin, generic Crystal, staged full-layer mask, sparse-upper mask, historical release, coverage release, expansion release, and full-suite tests remain active.

## Coverage

| Measure | Before | Newly unlocked | After |
|---|---:|---:|---:|
| Mainline | 9/12 | 3 | 12/12 |
| Side | 38/41 | 2 | 40/41 |
| **All Hard** | **47/53** | **5** | **52/53** |

- mixed failures before: 5;
- newly unlocked: 5;
- still mixed-blocked: 0;
- reclassified: 0.

## Remaining failures

- mixed Pin/Crystal interaction: 0;
- generic alternating dense-Crystal assembly: 1 (`hard-side-033`);
- newly reclassified gaps: 0.

## Integrity and recommendation

All five new instances have complete causal provenance and pass canonical forward replay, additive expansion validation, and release validation. No Solver filtering, target-specific recipe, rule relaxation, hidden resource, or target-ID branch is present.

Mixed interaction has converged for the scoped failures. The next bounded task is `hard-side-033`; do not start it, 53×3/53×5, or Solver optimization automatically.
