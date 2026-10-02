# Hard 53×3 Formal Solver Baseline

Baseline ID: `hard-53x3-solver-baseline-v1`
Baseline canonical SHA-256: `a23979099a2ae0dc7c8fa0a77c89ffa77d23fc82170e38690de000b708082661`
Benchmark canonical SHA-256: `5836350ed30779f76fa32a6d4e9dce3628f7b5a554dfc4cb4e512c3b1ffe72db`
Solver code SHA-256: `68f2be34f9737204a69f1db2c83463c76e9a3110732f829da916ae5d14aba873`
Config SHA-256: `2ed7ea7b1d6af5d8c81e7b4a3baa9277a41cfb8c460947b8664706058ddab009`

Outcomes: 0/159 solved (0.00%).
Target families: 3/3=0, 2/3=0, 1/3=0, 0/3=53.
Termination counts: SOLVED=0, TIMEOUT=1, STATE_CAP=0, CANDIDATE_CAP=106, MEMORY_LIMIT=0, SHAPE_UNIVERSE_CAP=52, NOT_FOUND_PRUNED=0, SEARCH_EXHAUSTED=0, ERROR=0.

## Cost summary

| Cohort | Metric | Min | Median | p90 | p95 | Max |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| solved | wallMs (n=0) | unavailable | unavailable | unavailable | unavailable | unavailable |
| solved | cpuMs (n=0) | unavailable | unavailable | unavailable | unavailable | unavailable |
| solved | statesExplored (n=0) | unavailable | unavailable | unavailable | unavailable | unavailable |
| solved | candidatesGenerated (n=0) | unavailable | unavailable | unavailable | unavailable | unavailable |
| solved | maxSearchDepthReached (n=0) | unavailable | unavailable | unavailable | unavailable | unavailable |
| solved | peakRssMiB (n=0) | unavailable | unavailable | unavailable | unavailable | unavailable |
| failed | wallMs (n=159) | 2416.43 | 10273.96 | 28536.37 | 34469.29 | 120001.42 |
| failed | cpuMs (n=159) | 3203 | 11359 | 30593.8 | 36814.5 | 123625 |
| failed | statesExplored (n=159) | 3785 | 21374 | 93294.4 | 123139.6 | 252123 |
| failed | candidatesGenerated (n=159) | 1046274 | 5000000 | 5000000 | 5000000 | 5000000 |
| failed | maxSearchDepthReached (n=159) | 2 | 8 | 32 | 42 | 85 |
| failed | peakRssMiB (n=159) | 260.71 | 409.12 | 497.18 | 560.3 | 578.54 |

## Observed failure clusters

- mechanism/tag:ordinary-only: 126/126 failed; outcomes CANDIDATE_CAP=90, SHAPE_UNIVERSE_CAP=36.
- mechanism/class:ordinary: 81/81 failed; outcomes CANDIDATE_CAP=47, SHAPE_UNIVERSE_CAP=34.
- depthClass/B: 64/64 failed; outcomes CANDIDATE_CAP=39, SHAPE_UNIVERSE_CAP=25.
- sourceCategory/retained-B: 64/64 failed; outcomes CANDIDATE_CAP=39, SHAPE_UNIVERSE_CAP=25.
- mechanism/swapper-related: 60/60 failed; outcomes CANDIDATE_CAP=51, SHAPE_UNIVERSE_CAP=9.
- mechanism/pin: 54/54 failed; outcomes CANDIDATE_CAP=40, SHAPE_UNIVERSE_CAP=14.
- depthClass/baseline: 53/53 failed; outcomes CANDIDATE_CAP=35, SHAPE_UNIVERSE_CAP=18.
- sourceCategory/baseline: 53/53 failed; outcomes CANDIDATE_CAP=35, SHAPE_UNIVERSE_CAP=18.
- sourceCategory/replacement: 42/42 failed; outcomes TIMEOUT=1, CANDIDATE_CAP=32, SHAPE_UNIVERSE_CAP=9.
- mechanism/class:pin: 39/39 failed; outcomes CANDIDATE_CAP=25, SHAPE_UNIVERSE_CAP=14.

Machine-readable config, per-instance records, aggregate, landscape, resume state, and identity are authoritative.
Execution: fresh Node subprocess per instance, concurrency 1, internal timeout 120000 ms, external watchdog 135000 ms.
Missing production counters are recorded as null with availability notes. No Solver search semantics were changed.
