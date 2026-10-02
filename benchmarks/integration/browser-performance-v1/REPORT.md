# P7-03 Repeated Real-Browser Performance and Responsiveness

Status: `NEEDS-FIX / STOPPED`  
Date: 2026-10-01 (Asia/Shanghai)

## Scope and protocol

The real `/en/` page was measured in installed Chrome `153.0.8010.53` with native production module Workers and unchanged UI payloads. Two independent disposable Chrome profiles each ran two unreported warmups and ten measured repetitions of three frozen workloads:

1. a small ordinary `constructive-hybrid` solve;
2. the accepted 52-step interior-Crystal `constructive-hybrid` solve from P7-01;
3. the exact W1 bounded-search case, made ineligible for the constructive route with `cleanPainting=false`.

The page-side wrapper only timestamped Worker messages and termination. Chrome DevTools Protocol collected page heap after requested garbage collection outside the timed interval and sampled each live Worker with `Runtime.getHeapUsage`. A 10 ms page timer and animation frames recorded main-thread responsiveness through terminal rendering. The harness did not alter a request, response, operation, Solver option, result, Worker module, or search decision.

## Correctness and evidence completeness

- All 60/60 measured solves completed with the frozen outcome, route, depth, state, and generated-candidate expectations.
- Each workload returned one stable path SHA-256 across both fresh profiles and all measured repetitions.
- W1 retained depth 6, 3,612 states, and 106,816 generated candidates on every run.
- Page heartbeat evidence was present for every run.
- Worker heap coverage was 20/20 for every workload, including the required bounded-search workload.
- Solver copies remained byte-identical at `876a3e5f494ecb8edd4392506fecf5bfc7f383a42162f3599a1a4a110cbd9191`.

## Measurements

Times are milliseconds. Heap values are sampled/retained evidence, not operating-system process RSS.

| Workload | Worker result median / p90 / max | UI settled median / p90 / max | Timer gap median / p90 / max | Worker peak heap median / max | Page post-GC heap median |
| --- | ---: | ---: | ---: | ---: | ---: |
| Ordinary constructive | 39.4 / 47.3 / 88.0 | 81.35 / 95.8 / 149.3 | 69.35 / 102.0 / 111.3 | 0.47 / 1.21 MiB | 12.96 MiB |
| Interior Crystal | 40.4 / 42.2 / 44.2 | 142.3 / 148.5 / 154.9 | 239.8 / 251.4 / 260.7 | 0.88 / 1.53 MiB | 16.02 MiB |
| Bounded-search W1 | 469.45 / 522.5 / 558.2 | 504.8 / 563.8 / 594.2 | 53.45 / 65.5 / 70.8 | 30.08 / 33.04 MiB | 14.20 MiB |

Repeated-run drift stayed within the predeclared limits. The largest second-half/first-half Worker-result median ratio was 1.191 for ordinary construction, 1.015 for interior Crystal, and 1.035 for W1, all below 2.0. The largest first-to-final post-GC page-heap increase was 1.60 MiB for ordinary construction, 0.30 MiB for interior Crystal, and 0.10 MiB for W1, all below 5 MiB.

## Verdict

The predeclared 100 ms main-thread timer-gap threshold failed:

- ordinary construction exceeded it in 3/20 measured runs, with a 111.3 ms maximum;
- interior Crystal exceeded it in 19/20 measured runs, with a 260.7 ms maximum;
- bounded-search W1 stayed below it in 20/20 runs, with a 70.8 ms maximum.

The result is therefore `NEEDS-FIX / STOPPED`, despite complete correctness, stable paths, full memory evidence, and acceptable repeated-run drift. The timing shape localizes the product risk to page-side terminal handling/rendering rather than Worker search: the 52-step Worker result arrived at a 40.4 ms median, while UI settlement and the heartbeat observation were materially later. This is an evidence-backed localization, not a complete CPU attribution.

No product or Solver change was made. P7-04 must carry this responsiveness risk as an explicit release-readiness issue. It may investigate or implement the smallest behavior-preserving UI/render repair, but P7-03 does not authorize a search-semantic change.

## Verification and identities

- `npm test`: 188/188 passed.
- `npm run verify:production`: 159/159 solved, replay-valid, constructive-routed, and exact E-014 paths; zero resource reuse.
- `npm run test:browser-worker`: PASS against real Chrome, including lifecycle/recovery and the production UI path.
- Syntax: 119/119 JavaScript/module files passed `node --check`.
- Raw artifact: `results.json`, SHA-256 `81728305843a611018433c48b0748eaffadf59ff4c49e74e091754b89211e775`.
- Frozen measurement-harness SHA-256: `43dc01af9d5dfe33bba7f2c1634ee8cacb26f6a0ba5244a7975165c7d4b4f9d7`.

