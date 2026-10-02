# P8-04 Hard-capable Release Candidate closeout

Status: **PASS / STOPPED**  
Date: 2026-10-02 (Asia/Shanghai)  
Candidate: `hard-capable-rc-v1`  
Identity: `hard-capable-rc-v1:3e94ef55d6bcb09a4a74e7777516ae547ee02b7168ca566b2e0963dde80e5f17`

## Decision

The current local product snapshot is accepted as the Hard-capable Release Candidate. This is a content-addressed candidate over the existing uncommitted working-tree batch; it is not a claim that Git is clean and it is not a deployment, tag, commit, or remote release.

P8-04 made no runtime, Solver, benchmark, performance, or gate change. It used the accepted frozen evidence and ran only proportionate non-performance closeout checks against the current tree.

## Bound source snapshot

The candidate runtime identity covers 56 files selected by root `*.js`, root `*.html`, `styles.css`, `en/index.html`, `cn/index.html`, and `images/**`. The manifest digest is SHA-256 over ordinally sorted UTF-8 lines of `path<TAB>lowercase-file-sha256<LF>`.

The complete path/hash list is frozen in `runtime-manifest.json`.

- Runtime manifest SHA-256: `3e94ef55d6bcb09a4a74e7777516ae547ee02b7168ca566b2e0963dde80e5f17`
- Solver and web Solver SHA-256: `24388ad12ce2b3e29075790f762ba8731fe6015e021a56efcb184aad218ed2ad`
- `main.js`: `5767038c930532c5aa6a9b20f5e5e25839a8816e4f611a238d0bf7154fb80490`
- `operationGraph.js`: `004a99b78cdd3a7a08008250800ccb4a4cb971636d0690c367d14c3557e05cb8`
- `workerLifecycle.js`: `b71059217a3fd553800f141354ba82a8c8088c621b3a0bd3aa7dcd7033af0c26`

The branch remains `codex/solver-optimization` at base commit `b367b6e`. The seven tracked modifications and the untracked optimization/runtime/test/evidence batch remain intentionally uncommitted and are already represented in the durable project inventory. P8-04 added only this verdict/report and status documentation. No unexpected capability or runtime semantic delta was found.

## Evidence ledger

| Release condition | Result | Authority |
| --- | --- | --- |
| Production Hard capability | PASS: 159/159 across 53/53 targets | P8-03 closeout, bound to E-014 |
| Replay and path consistency | PASS: 159 replay-valid, 159 exact E-014 paths, zero resource reuse | P8-03 / E-014 frozen evidence |
| Browser-safe static dependency boundary | PASS: local-only production graph, no Node/bare/benchmark import | P6-15 verdict plus current static-graph regression |
| Chrome Worker/UI lifecycle and error recovery | PASS headless and visible/headful | P7-02 and P8-03 closeout |
| Frozen browser performance/readiness | PASS: 60/60 exact measured runs, heap/drift gates pass | P8-03 frozen result |
| Responsiveness | PASS: every run at most 100 ms; Hard maximum 97.1 ms | P8-03 frozen result |
| Current repository regression | PASS: 198/198 | P8-04 local closeout |
| Current syntax | PASS: 120/120 | P8-04 local closeout |
| Solver parity | PASS: byte-identical | P8-04 local closeout |
| Diff hygiene | PASS; line-ending notices only | P8-04 local closeout |

The P8-03 harness and result still hash to `104888d6...12f3` and `ccb6cb6f...9c19`, exactly matching the accepted verdict. P8-04 did not rerun the 159-member production Solver gate, the Chrome performance distribution, or any benchmark.

## Historical immutability

- The released Hard 53×3 composite stays `5836350e...72db`.
- The formal baseline stays `a2397909...2661` and retains its original 159-outcome historical result; it is not relabeled as the current constructive production capability.
- E-014 remains the accepted 159/159 capability frontier and its repeat stays `9f8ea122...1197`.
- E-015 remains `REJECT / ROLLED BACK` for its Node-only production graph.
- P8-02 remains the historical `NEEDS-FIX / STOPPED` observation. P8-03 is the separately authorized accepted repair and current passing evidence.
- Rejected performance experiments and every earlier verdict remain unchanged.

## Release checklist

- [x] Candidate has an explicit ID and content-addressed runtime identity.
- [x] Hard capability is 159/159 with exact replay/path continuity.
- [x] Browser-safe production dependency boundary is preserved.
- [x] Chrome Worker/UI lifecycle, cleanup, cancellation, restart, and terminal error recovery are accepted.
- [x] Frozen browser correctness, memory, drift, and responsiveness gates pass.
- [x] The absolute 100 ms responsiveness gate passes without threshold reinterpretation.
- [x] Current tests, syntax, Solver parity, static dependency regression, and diff hygiene pass.
- [x] The dirty working tree is explicitly recorded; no clean-tree or commit identity is implied.
- [x] Release notes, limitations, and non-blocking debt are recorded in `docs/optimization/RELEASE_CANDIDATE.md`.
- [x] Frozen benchmark, formal baseline, E-014, P8-02, P8-03, and historical verdicts were not rewritten.
- [x] No commit, push, deployment, remote CI/CD, new Solver, benchmark, or optimization was started.

Verdict: **PASS / STOPPED**.
