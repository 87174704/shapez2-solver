# Generic Pin Construction Planner Report

Date: 2026-09-16 (Asia/Shanghai)

Scope was limited to the 10 targets previously classified as `Pin construction unsupported`. No mixed Pin/Crystal target, Crystal-only target, 53×3/53×5 profile, Solver run, or target-specific input injection was added.

## Target structure audit

Layers are zero-based from bottom to top. `q0..q3` are the four canonical quadrants.

| Target | Pin structure and support | Required construction behavior | Reused existing primitives |
|---|---|---|---|
| `hard-main-005` | Pins at L0/q0, L1/q0, L2/q2, L3/q0; q0 has a consecutive lower run and an unsupported top Pin; q2 Pin is between solids | Recursive per-column Pin runs plus sacrificial top geometry removed by four-layer Pin overflow | atom extraction/paint, Stack, Pin Pusher, overflow |
| `hard-main-006` | L1 Pins at q0/q3 and full Pin layer at L2; every L2 Pin has a solid above | Mixed solid/Pin columns and consecutive Pin runs | atom extraction/paint, Stack, Pin Pusher |
| `hard-main-009` | L0 Pins q1–q3 and L1 Pin q3; the L3 q0 solid is raised across empty q0 L1–L2 and is supported by the q3 roof member | Pin-bearing base columns followed by a supported horizontal roof | refinement extraction, Stack, Pin Pusher |
| `hard-side-022` | Full Pin layers at L2 and L3; the top Pins have no final geometry above | Consecutive upper Pins with sacrificial geometry removed by overflow | atom extraction/paint, Stack, repeated Pin Pusher |
| `hard-side-023` | L1 Pins q1/q2 below solids; L3 Pins q0/q3 have no geometry above | Direct middle Pins plus overflow-extracted top Pins | atom extraction/paint, Stack, Pin Pusher, overflow |
| `hard-side-025` | L0 Pins q1–q3 and L1 Pins q0/q1/q3; all upper Pin runs terminate under target solids | Mixed columns with one- and two-Pin runs | atom extraction/paint, Stack, Pin Pusher |
| `hard-side-026` | L0 Pins q1–q3; top Pins L3 q1/q3; q2 bottom Pin remains under solids | Direct lower Pins plus overflow-extracted top Pins | atom extraction/paint, Stack, Pin Pusher, overflow |
| `hard-side-028` | One Pin at L1/q0 between Ww and Wr; q1/q3 upper geometry begins at L1 and is carried by q2 | Pin column plus a three-layer raised region supported through q2 | atom extraction/paint, Stack, Pin Pusher |
| `hard-side-036` | L1 Pins q1/q3 have support below but no final part above; target has only three layers | Produce standalone Pins by extracting a temporary four-layer Crystal column and invoking canonical Pin-overflow breakage | temporary scaffold, Crystal Generator, Cut, Pin Pusher, Stack |
| `hard-side-038` | L2 Pins q0/q2; q1/q3 exist only in the top roof; q0 Pin must anchor roof neighbors without retaining its generating support | Standalone Pin anchor plus supported roof; q2 uses a normal Pin-under-solid column | refinement extraction, temporary Crystal scaffold, Cut, Pin Pusher, Stack |

None of the 10 requires Pin fill in the final construction. All use continuous ordinary/refinement components where canonical gravity requires them. `hard-side-036` and `hard-side-038` require process-only geometry and component disappearance; the other eight retain the Pin-generating upper part or discard only a legal overflow sacrificial part.

## Pin capability taxonomy

| Capability class | Targets blocked before | Targets |
|---|---:|---|
| Recursive Pin/solid column sequence | 6 | `hard-main-005`, `hard-main-006`, `hard-side-022`, `hard-side-023`, `hard-side-025`, `hard-side-026` |
| Supported raised solid region over Pin-bearing base | 2 | `hard-main-009`, `hard-side-028` |
| Standalone Pin via destructive Crystal scaffold | 1 | `hard-side-036` |
| Standalone Pin anchor plus supported neighbor roof | 1 | `hard-side-038` |

The latter three classes compose with the first rather than replacing it.

## Implemented reusable capabilities

### Pin column sequence

`planPinSubassembly` decomposes a desired Pin-containing assembly into quadrant columns. A column may contain ordinary/refinement parts, single Pins, separated Pin runs, or consecutive Pins. Construction is recursive: an upper suffix is built first, Pin Pusher adds the required run below it, and lower solids are stacked underneath. When a final top Pin occurs in a four-layer column, an ordinary sacrificial part is legally truncated by canonical overflow.

This capability directly unlocked 6 targets and forms the base of all 10.

### Supported upper region

The planner enumerates a bounded split layer and quadrant subset, but accepts a plan only if canonical forward Stack simulation reproduces the exact target. The lower region remains a set of Pin/solid columns. The upper solid region is built independently and falls onto an actual overlap/support point, carrying horizontally connected raised parts with it.

This capability unlocked `hard-main-009` and `hard-side-028`, and participates in `hard-side-038`.

### Isolated Pin by Crystal scaffold destruction

For a Pin that cannot retain a generating part above it, the planner builds a four-layer temporary scaffold with one empty spatial column, fills that column with Crystal, extracts the Crystal column by canonical Cut/rotation, then applies Pin Pusher. The new Pin is retained while the fused Crystal component crosses the retained/dropped overflow boundary and is destroyed by the canonical Pin-overflow rule. The result is a real standalone Pin token.

The scaffold inputs, Crystal Generator, Cut outputs, overflow, live byproducts, and final Pin ancestry remain in the witness. This unlocked `hard-side-036` and, together with supported-region composition, `hard-side-038`.

## Regression coverage

The regression suite includes minimal forward replay for:

- a mixed solid/Pin column;
- a supported raised region;
- an isolated Pin with Crystal scaffold extraction and destructive overflow;
- unavailable-input rejection on the isolated-Pin path;
- unsupported support topology rejection;
- causal fingerprint retention of Crystal Generator and Pin Pusher ancestry.

Formal regression also replays all 42 Hard 53×1 successes, validates the trusted release, and retains the historical pilot, coverage, and expansion releases.

## Coverage change

| Scope | Before | Newly unlocked | After |
|---|---:|---:|---:|
| Mainline | 5/12 | 3 | 8/12 |
| Side | 27/41 | 7 | 34/41 |
| **All Hard** | **32/53** | **10** | **42/53** |

- Pin failures before: 10
- newly unlocked: 10
- remaining Pin failures: 0

The remaining 11 failures are unchanged in scope: 5 mixed Pin/Crystal gravity, 5 Crystal construction, and 1 generic construction planner gap.

## Integrity

- every new instance starts from presented `availableInputs`, follows legal canonical operations, and forward-replays to exact target equality;
- every new environment uses frozen additive Input Environment Expansion rather than equating core basis with presented inputs;
- the Solver-facing projection still excludes witness, core basis, expansion, and construction metadata;
- no Solver filtering, target modification, rule relaxation, schema change, validator change, or target-specific hidden resource was used;
- process-only scaffolds are explicit causal resources and remain represented in witness provenance;
- release identity and frozen benchmark semantics are unchanged.

## Recommendation

The pure Pin construction gap is closed for the current 10-target set. Do not add further speculative Pin machinery or start 53×3. The next bounded capability work should move to Crystal construction (or mixed Pin/Crystal gravity as a separately scoped session), with the current Pin planner kept as a composable dependency.
