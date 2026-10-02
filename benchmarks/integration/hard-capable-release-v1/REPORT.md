# P8-05 End-to-end Hard-capable release

Status: **PASS / STOPPED**  
Date: 2026-10-02 (Asia/Shanghai)  
Release: `hard-capable-v1`  
Commit: `f62683a3be7e826c8c764afcee4977114b15a9f0`  
Candidate: `hard-capable-rc-v1:3e94ef55d6bcb09a4a74e7777516ae547ee02b7168ca566b2e0963dde80e5f17`

## Result

The accepted Hard-capable RC was released to `origin/main`, tagged as `hard-capable-v1`, deployed by Gitea Actions run 21, and verified at `https://shapez2.ysc.icu/solver/`. The tag, CI head, deployment identity endpoint, and production file content all bind to release commit `f62683a3be7e826c8c764afcee4977114b15a9f0`.

The first deployment exposed a line-ending packaging mismatch between five accepted CRLF runtime files and Git's normalized blobs. No runtime semantics changed. `.gitattributes` now preserves those accepted bytes, the tag was moved to the corrective release commit, and the final deployment reproduces all 56 frozen RC hashes exactly. All four browser-runtime files under `constructive/`, which are outside the historical 56-file selection but required by the production import graph, also match the release commit.

## Verification

- Local full suite: 198/198.
- Production capability: 159/159 solved, replay-valid, exact E-014 paths, constructive-routed; 53/53 targets; zero resource reuse.
- Syntax: 120/120; Solver copies byte-identical at `24388ad1...ed2ad`.
- Real installed Chrome Worker/UI lifecycle: PASS, including a path-stable 52-step nontrivial interior-Crystal solve.
- Push: `origin/main` and annotated tag `hard-capable-v1` succeeded.
- CI/CD: Gitea Actions run 21 / run number 7 completed successfully at the release SHA.
- Deployment identity: `/deployment.json` reports the release SHA, `refs/heads/main`, run 21, and run number 7; `/release.json` reports the tag and unchanged RC identity.
- Production bytes: 56/56 RC runtime hashes and 4/4 constructive dependency hashes match.
- Public page: `/solver/en/` returned HTTP 200 and rendered successfully.
- Online production Worker smoke: the target `RrcrRrRr:RgcrRgRg:--cr----` with four `RuRuRuRu` inputs solved twice at depth 52 / 52 states; the button restored and graph rendered after both runs. Observed UI wall times were 2.70 s and 0.14 s.
- Browser console: zero errors. Three existing non-blocking third-party warnings concern deprecated Three.js script packaging, multiple Three.js instances, and custom Cytoscape wheel sensitivity.

## Scope

The release commit contains the accepted runtime, tests, documentation, benchmark/baseline/verdict evidence, deployment workflow, and release metadata. Raw multi-gigabyte `.states.ndjson` profiling streams, `node_modules`, and local `.codex-temp-*` directories were excluded. The deployed site contains only root runtime JavaScript/HTML/CSS/release metadata plus `cn/`, `en/`, `images/`, and `constructive/`; benchmark, test, and documentation trees are not published.

No Solver search semantics, benchmark semantics, capability architecture, runtime design, feature, data migration, or optimization changed in P8-05. Frozen benchmark, baseline, E-014, historical verdicts, P8-02, P8-03, and P8-04 remain intact.

Verdict: **PASS / STOPPED**.
