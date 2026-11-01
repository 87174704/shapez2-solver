# Verification-only CI

The [current workflow](../../.github/workflows/verify.yml) uses GitHub-hosted
Ubuntu, `contents: read`, full checkout without persisted credentials, locked npm
install without lifecycle scripts, and the Phase C reviewed action commit pins
recorded in [action-pins.json](action-pins.json). It runs on pushes and pull
requests to `codex/maintained` and `codex/crystal-physics-fix-20261029`, plus
manual dispatch. There is no deployment, self-hosted runner, secret, OIDC, Pages
write or production connection in this workflow. The Gitea deployment workflow
triggers only on Gitea `main`; verification branches do not trigger it.

The [current verification entry](../../scripts/ci/verify-current.mjs) records the
selected source commit/tree, environment, each phase result and full logs in
ignored `.ci-results/current/`. It verifies the Git source and immutable inputs,
locked dependencies, syntax and local documentation links, reconstructs the v1
byte tree only as an input for current Physics comparison, runs the real corpus
acceptance (`scripts/bench/validate-corpus.mjs --semantics=deferred`) and the
current regression suite, independently validates all 331 frozen witnesses and
159 solved paths, runs the 159-case production Solver check, and verifies both
static profiles. The two immutable control inputs are copied from committed test
fixtures. The v1 comparison tree shares only this clone's freshly installed
dependencies; it never uses caches or dependencies from the original workspace.

The [historical entry](../../scripts/ci/verify-history.mjs) certifies the fixed
v1, Physics v2 and Release 1 identities. It is not part of the daily gate:
[verify-history.yml](../../.github/workflows/verify-history.yml) runs it on manual
dispatch and on changes to a frozen identity input, authenticator, policy or
trust root. Ordinary current-only pushes do not repeat that workload.

Current tests register 277 tests: 269 PASS, 8 explicit historical skips (the six
v1 regeneration cases and two composite-release cases) and 0 FAIL. Historical v1
must report 198 PASS with no skips. Original frozen records are verified in their
v1 environment, not falsely accepted under current physics.

Run the suite once per clean clone after the locked install. GitHub uploads
`.ci-results/current/` even on failure; an uploaded log is not a PASS. Local
Windows validation does not establish an actual hosted Ubuntu result; hosted
execution and artifact retention are recorded on the workflow run.
