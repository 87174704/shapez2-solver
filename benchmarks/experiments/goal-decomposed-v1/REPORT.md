# Goal-Decomposed Constructive Synthesis v1

Verdict: `ACCEPT / STOPPED`

Formal comparison baseline: `a23979099a2ae0dc7c8fa0a77c89ffa77d23fc82170e38690de000b708082661` (0/159 solved). Prior capability frontier: E-005 stable replay-valid `hard-main-001:F1` and `hard-main-001:F2` (2/159, one target).

| Configuration | SOLVED | UNSUPPORTED_DOMAIN | EXHAUSTED | LIMIT | ERROR | WATCHDOG | Stable solved | Stable targets | Stable new members |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| GDCS-A | 78 | 78 | 3 | 0 | 0 | 0 | 78 | 26 | 76 |

All 78 first-pass solutions replayed valid. Every one was then solved again in an independent fresh process under the identical frozen configuration, and all 78 repeat paths replayed valid. The stable set contains the two E-005 members and 76 new members; target coverage rises from one to 26, with 25 newly covered target IDs.

GDCS-A decomposes an ordinary target into exact occupied cells, searches a bounded unary physical closure for extractable source cells, computes a global distinct-resource matching, and emits only the Cutter/rotation/Painter/Stacker operations selected by deterministic layer-first or column-first target assembly. It receives only the public Solver input. Target IDs, family slots, source identities, witnesses, construction metadata, structural tags, benchmark recipes, and prior solved paths are absent from the child request and solver interface.

The unsolved distribution is explicit: 78 special-part members are outside the frozen ordinary-target domain, and all three `hard-side-039` members exhaust because distinct-source matching cannot cover every refined/exotic/ordinary target cell. There were no formal resource limits, errors, watchdogs, or invalid replays. A miss is not an unsolvability proof.

Stable solution operation counts were min/median/p90/max 19/59/73/78. First-pass solved wall times were 15.36/35.07/43.00/54.30 ms in fresh Node processes; these are descriptive and not browser Worker performance. The architecture was not tuned after formal observation.

The predeclared ACCEPT gate required at least three stable replay-valid members across two targets with at least one new member beyond E-005. GDCS-A achieves 78, 26, and 76 respectively, so E-007 is ACCEPT. Engineering gates do not add capability credit. The experiment is stopped; no fallback configuration or second architecture experiment was run.

Final engineering verification passed: focused tests 8/8, full repository suite 142/142, all 79 JavaScript/module syntax checks, deterministic artifact identity/count/repeat audit, quick W1 at its exact depth/state/candidate signature, byte-identical production Solver copies, and diff checking apart from informational line-ending warnings.

Artifacts are bound to solver SHA-256 `fdb286700fba1204d7434fe36d0a4cd53cd6c3c6476e95ae37e3bf11dadbcf26`, frozen config SHA-256 `451d3b7562b213390023982e405bcd647e5b5b14c7dd50ba99ffcb1ee13d6137`, first-pass SHA-256 `0adf209cf12c73eb7232b4398c774243ef1824612008e1ad7b259e3dbea6d208`, and repeat SHA-256 `7baac62e16cc5d4bc5ef9dbd2ef1c73157dde2055be68a25a7983756c2ba7106`.
