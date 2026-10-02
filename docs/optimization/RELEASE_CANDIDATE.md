# Hard-capable Release Candidate

Status: **PASS / STOPPED**  
Candidate: `hard-capable-rc-v1`  
Identity: `hard-capable-rc-v1:3e94ef55d6bcb09a4a74e7777516ae547ee02b7168ca566b2e0963dde80e5f17`  
Recorded: 2026-10-02 (Asia/Shanghai)

## Published release binding

Release status: **PASS / STOPPED**  
Release/tag: `hard-capable-v1`  
Release commit: `f62683a3be7e826c8c764afcee4977114b15a9f0`  
CI/CD: Gitea Actions run 21 / number 7, `success`  
Production: `https://shapez2.ysc.icu/solver/`

The published release preserves this candidate identity. Production reports the release commit through `/deployment.json`, reports this RC identity through `/release.json`, matches all 56 frozen RC file hashes plus all four required constructive dependencies, and passes the online nontrivial 52-step Hard Worker/UI smoke twice. Complete release evidence is in `benchmarks/integration/hard-capable-release-v1/`.

## Release notes

- The production public Solver route covers all 159 frozen Hard members across all 53 targets.
- Every accepted path independently replays, exactly matches the frozen E-014 path, and consumes each public or derived resource at most once.
- The production Worker dependency graph is browser-safe: local modules only, with no Node-only, bare-package, or `benchmarks/` import.
- The real `/en/` page passes native Chrome module-Worker lifecycle coverage, including progress, cancellation, immediate restart, consecutive runs, stale-event suppression, terminal solve/Explorer errors, cleanup, and same-page recovery.
- The frozen 60-run browser readiness protocol passes exact results and paths, Worker heap coverage, page-memory drift, wall-time drift, and the absolute 100 ms responsiveness gate. The representative Hard maximum is 97.1 ms.
- Solver-result rendering now yields after terminal delivery and reuses the existing Cytoscape renderer while preserving graph data, deterministic coordinates, styles, directions, and interactions.

## Scope and identity

This RC is a local, content-addressed snapshot of the current static product runtime. Its 56-file identity covers root JavaScript and HTML files, `styles.css`, the English and Chinese entry pages, and all files under `images/`. It deliberately does not claim a clean Git tree: the accepted optimization/product-readiness batch remains uncommitted on `codex/solver-optimization` at base commit `b367b6e`.

The machine-readable verdict and complete checklist are in `benchmarks/integration/hard-capable-release-candidate-v1/`. Any later commit, package, tag, deployment, or regenerated asset must either reproduce this runtime manifest SHA-256 exactly or receive a new candidate identity and proportionate acceptance.

## Known limitations

- The 159/159 statement is exact for the frozen Hard 53×3 corpus. It is not a proof of general Solver completeness or correctness for every possible shape/resource environment.
- The bounded search remains heuristic when beam pruning occurs. A replay-valid returned solution is trusted; a pruned no-result is not proof of impossibility.
- Explorer is a bounded reusable-input closure. Large closures intentionally return a classified partial graph at the configured resource limit.
- Browser performance evidence is specific to the recorded Windows/Chrome `154.0.8037.59` environment and frozen workloads. The Hard responsiveness maximum of 97.1 ms leaves only 2.9 ms of observed margin to the 100 ms gate.
- The acceptance checks graph content, deterministic placement, interaction, and lifecycle, but does not provide cross-browser pixel-perfect visual equivalence.
- The page still loads pinned-version visualization libraries from third-party CDNs. Availability, vendoring, subresource integrity, and supply-chain policy are outside this RC milestone.
- `shapeSolver.js` and `shapeSolver_web.js` remain duplicate sources and must stay byte-identical.

## Current non-blocking debt

- The release commit/tag is complete. Any later package, version, or release still requires a separately authorized milestone.
- Add cross-browser/platform acceptance if the intended production support matrix extends beyond the recorded Chrome/Windows environment.
- Decide whether to vendor the visualization dependencies or add an explicit integrity/offline policy.
- Add visual-regression coverage if pixel-level rendering fidelity becomes a release requirement.
- Remove the duplicate Solver source only through a separately scoped architecture change with parity gates.
- Revisit broader workload performance only if real product evidence establishes a new blocker; do not reopen Solver or benchmark optimization from this debt list alone.

## Release checklist

- [x] RC identity and status are explicit.
- [x] Production Hard capability is 159/159.
- [x] Replay correctness and exact E-014 path continuity hold.
- [x] Browser-safe dependency boundary holds.
- [x] Worker/UI lifecycle and terminal error recovery hold.
- [x] Frozen browser readiness and 100 ms responsiveness gates hold.
- [x] Current source/test/diff checks reveal no unrecorded runtime semantic change.
- [x] Known limitations and non-blocking debt are explicit.
- [x] Frozen benchmark, formal baseline, E-014 frontier, and historical verdicts remain immutable.
- [x] No push, deploy, remote CI/CD, new Solver, benchmark, or optimization occurred.

Final verdict: **PASS / STOPPED**.
