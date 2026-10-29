# Verification-only CI

The [workflow](../../.github/workflows/verify.yml) uses GitHub-hosted Ubuntu,
`contents: read`, full checkout without persisted credentials, locked npm install
without lifecycle scripts, and the Phase C reviewed action commit pins recorded
in [action-pins.json](action-pins.json). Triggers include the RC branch,
`codex/maintained`, and manual dispatch. There is no deployment, self-hosted
runner, secret, OIDC, Pages write or production connection in this workflow.
The original Gitea deployment workflow is preserved as a historical file; it is
not used by this verification suite and must not be executed or pushed to Gitea
main without separate deployment authorization.

The [verification entry](../../scripts/ci/verify.mjs) records source SHA/tree,
environment, each exit code and full logs in ignored `.ci-results/`. It restores
only newline representations that match existing exact SHA pins, checks the
eight historical commit objects and original tag, verifies v2 identity, syntax
and local documentation links, reconstructs and runs the original v1 tree,
checks frozen v1 evidence, runs current tests, and independently validates v2
frozen witnesses and 159 solved paths/resources. The two immutable control inputs
are copied from committed test fixtures; no original-workspace evidence is needed.
V1 uses only dependencies freshly installed in this clone. Neither environment
uses dependencies or caches from the original workspace.

Current applicable tests must report 229 PASS, 13 explicit historical skips and
0 FAIL. Historical v1 must report 198 PASS with no skips. Original frozen records
are verified in their v1 environment, not falsely accepted under v2 physics.

Run the suite once per clean clone after the locked install. Its historical
destination must not already exist: this prevents overwriting prior evidence.
For another run, create another clean clone and retain the original attempt.
GitHub uploads `.ci-results/` even on failure; an uploaded log is not a PASS.
Local Windows validation does not establish an actual hosted Ubuntu result.
Those hosted execution and artifact-retention checks remain UNKNOWN.
