# Bounded Best-First Plan Synthesis v1

Verdict: `REJECT / STOPPED`

Formal comparison baseline: `a23979099a2ae0dc7c8fa0a77c89ffa77d23fc82170e38690de000b708082661` (0/159 solved). Prior capability frontier: E-005 stable replay-valid `hard-main-001:F1` and `hard-main-001:F2` (2/159, one target).

| Configuration | SOLVED | LIMIT | ERROR | WATCHDOG | Stable solved | Stable new members |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| BFPS-A | 1 | 158 | 0 | 0 | 1 | 0 |
| BFPS-B | 0 | 159 | 0 | 0 | 0 | 0 |

BFPS-A's only solution was `hard-main-001:F2`. Its ten-operation path replayed valid in the first pass and again in an independent fresh-process repeat, but the member was already part of E-005's stable frontier. BFPS-B produced no solution, so its repeat set was empty. Neither configuration returned an invalid replay, ERROR, or WATCHDOG.

BFPS-A limits were 143 time and 15 expanded-node. BFPS-B reached time on all 159 members. A's wall-time median/p90/max was 10,000.32/10,000.47/10,001.28 ms; B's was 20,000.44/20,000.72/20,001.60 ms. Median attempts/expanded nodes/chart nodes were 146,854/21,362/30,688 for A and 109,839/14,987/27,899 for B. The larger partner pool increased scheduling/pair-selection cost, so B performed less search work within twice the wall budget, lost A's known solution, and added no capability.

The fixed small-domain gate passed 7/7 and the repository suite passed 134/134 both before formal execution and after artifact closeout. The E-006 identity/count audit passed, all 75 JavaScript/module files passed syntax checks, and the production Solver copies remained byte-identical. Pin/Crystal fixture support and clean execution are correctness facts only; they do not add formal capability.

Stable new members beyond E-005: 0. Stable new targets: 0. The formal capability frontier remains 2/159 across one target, so E-006 is REJECT under its frozen verdict rule. No third configuration, priority/pool tuning, production integration, or second architecture experiment is authorized in this session.

Artifacts are bound to Solver SHA-256 `1fa6346166b2006eb58ee527628e3048f4d056e6a6c1c1c619d957d61c4f609e` and config SHA-256 `b5970650be89a6cda23c7dff53b1f758bb0da6ff4b7352c7c35453df230d57d0`.
