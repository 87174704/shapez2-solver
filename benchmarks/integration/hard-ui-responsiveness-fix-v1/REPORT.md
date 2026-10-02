# P8-03 Hard UI Responsiveness Acceptance

Status: `PASS / STOPPED`  
Date: 2026-10-02 (Asia/Shanghai)

## Frozen protocol

The unchanged P8-02/P7-03 acceptance harness ran the real `/en/` page in Chrome `154.0.8037.59` through native module Workers. Two fresh profiles each received two warmups and ten measured runs for ordinary constructive, the 52-step interior-Crystal Hard workload, and exact bounded-search W1. The per-run responsiveness gate remained `maxTimerGapMs <= 100`; exact result/path/work, Worker heap, page-memory drift, and wall-drift gates were unchanged.

## Result

All 60/60 measured solves completed with exact expected results and stable per-workload paths. Every Worker produced heap samples. Maximum first-to-final post-GC page-heap growth was 0.377 MiB against 5 MiB, and the maximum second-half/first-half Worker wall median ratio was 1.3246 against 2.0.

| Workload | Worker result median / max | UI settled median / max | Timer gap median / max |
| --- | ---: | ---: | ---: |
| Ordinary constructive | 30.30 / 34.70 ms | 48.25 / 52.80 ms | 25.05 / 31.60 ms |
| Interior Crystal Hard | 39.05 / 54.70 ms | 100.95 / 136.00 ms | 68.70 / 97.10 ms |
| Bounded-search W1 | 427.85 / 449.80 ms | 446.95 / 470.70 ms | 25.50 / 30.50 ms |

Every individual timer gap was at most 100 ms. There was no selective rerun after this formal observation.

## No-regression closeout

- Real Chrome lifecycle/UI: PASS headless and visible/headful, including 52-step graph content/path stability, cancellation, one-shot cleanup, stale suppression, immediate restart, terminal error recovery, and bounded Explorer rendering.
- Full repository suite: 198/198.
- Production verification: 159/159 solved, replay-valid, exact E-014 paths, constructive-routed; zero resource reuse.
- Syntax: 120/120 JavaScript/module files.
- Solver copies: byte-identical SHA-256 `24388AD12CE2B3E29075790F762BA8731FE6015E021A56EFCB184AAD218ED2AD`.
- Frozen harness SHA-256: `104888D64FEFC0FEDA435EF7078E7B510CB84F767A2D11581D9E4732BF1212F3`.
- Raw results SHA-256: `CCB6CB6F6E2812D13FBA35357201D875CB94E58DE84F5A83DFD82D0163BF9C19`.
- `git diff --check`: passed apart from informational line-ending warnings.

P8-03 is `PASS / STOPPED`. The next milestone may enter Hard-capable Release Candidate closeout; it was not started here.
