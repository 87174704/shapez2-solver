# Verification-only CI

The [current workflow](../../.github/workflows/verify.yml) uses GitHub-hosted
Ubuntu, `contents: read`, full checkout without persisted credentials, locked npm
install without lifecycle scripts, and the Phase C reviewed action commit pins
recorded in [action-pins.json](action-pins.json). It runs on pushes and pull
requests to `codex/maintained`, plus manual dispatch. There is no deployment,
self-hosted runner, secret, OIDC, Pages write or production connection in this
workflow. The Gitea deployment workflow triggers only on Gitea `main`;
verification branches do not trigger it.

## Current gate

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm ci --prefix tools/static-build --ignore-scripts --no-audit --no-fund
git config core.autocrlf input
node scripts/ci/verify-current.mjs --commit=$(git rev-parse HEAD)
```

The [current verification entry](../../scripts/ci/verify-current.mjs) accepts
only an explicit commit equal to HEAD and requires a clean tracked tree. It
records the selected source commit/tree, environment, each phase result and full
logs in ignored `.ci-results/current/`. Its ten phases verify the Git source and
immutable inputs, locked dependencies, syntax and local documentation links,
reconstruct the v1 byte tree only as a comparison input for current Physics, run
corpus acceptance (`scripts/bench/validate-corpus.mjs --semantics=deferred`:
195 instances, 159 composite members, 0 blocking), run the current regression
suite, independently validate all 331 frozen witnesses and the 159 solved paths
with one current Solver call per case, and build/verify both static profiles. The
two immutable control inputs are copied from committed test fixtures. The v1
comparison tree shares only this clone's freshly installed dependencies; it never
uses caches or dependencies from the original workspace.

The same two static profiles can be produced directly with
`node tools/static-build/build-current.mjs <global|china> --commit=<OID>`; the
build worker audits Git inputs and dependencies before writing `dist/<profile>`.
See the [README](../../README.md) for the short command list.

## Historical entry

The [historical entry](../../scripts/ci/verify-history.mjs) certifies the fixed
v1, Physics v2 and Release 1 identities from the existing Git objects. It is not
part of the daily gate: [verify-history.yml](../../.github/workflows/verify-history.yml)
runs it on manual dispatch and on changes to a frozen identity input,
authenticator, policy or trust root. Ordinary current-only pushes do not repeat
that workload. See [HISTORICAL_VERIFICATION.md](HISTORICAL_VERIFICATION.md).

## Test counts are a snapshot, not a requirement

The current regression suite registered 334 tests at the 2026-11-01 maintenance
baseline (`810d2ed`): 332 PASS, 2 explicit historical skips (the two
composite-release cases) and 0 FAIL. `npm test` output is the authority for any
other commit; do not change this paragraph to match a run, and do not treat the
number as a fixed gate requirement. The six v1 regeneration cases exist only in
the fixed v1 snapshot and are executed by the historical entry, not replayed from
current HEAD. Historical v1 must report 198 PASS with no skips. Original frozen
records are verified in their v1 environment, not falsely accepted under current
physics.

## Interpreting results

Run the suite once per clean clone after the locked install. GitHub uploads
`.ci-results/current/` even on failure; an uploaded log is not a PASS. Local
Windows validation does not establish an actual hosted Ubuntu result; hosted
execution and artifact retention are recorded on the workflow run. Hosted run
`41292992814` on `810d2ed` completed successfully on 2026-11-01; that is a dated
observation for one commit, not a standing guarantee for later commits. This
workflow verifies only and never deploys.
