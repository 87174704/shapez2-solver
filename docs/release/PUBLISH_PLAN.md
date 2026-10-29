# Physics v2 RC: future C-Publish plan (not executed)

This plan supersedes the Phase C candidate SHA/tree and same-name branch push
assumptions. Its only acceptable source is the complete final HEAD and tree
in the external Phase D `RC_IDENTITY.md` and `rc-manifest.json`. Verify those
against the checked-out source before any publication; stop on a mismatch.
The final manifest lists every candidate file, Git blob, SHA-256, new commit and
raw original historical identity. No public release tag is proposed this round.

1. Obtain explicit authorization for public disclosure of those precise reachable
   objects, Benchmark/image contents and original Git metadata, and for the
   subsequent remote actions. Local commit authorization does not permit them.
2. In a trusted authentication flow, verify the selected account and destination
   `87174704/shapez2-solver`. Read actual current target/upstream refs and native
   Fork parent/source metadata. If necessary and authorized, create a native
   Fork of `Vystel/shapez2-solver`; do not create an unrelated imported repository.
   Compare independent upstream main against the preserved Phase C upstream
   object. Investigate drift or conflicts before dependent writes.
3. Prepare a separate publication checkout at the sealed RC object. Preserve
   upstream main and both independent histories; never send this working
   repository's local main to the Fork's main. No merge/rebase/bridge is needed.
4. After fresh authorization and checking remote ref conflicts, use the full
   sealed RC commit as the explicit source of an ordinary non-force push to
   `refs/heads/codex/maintained`. The mapping is
   `<SEALED_RC_FULL_SHA>:refs/heads/codex/maintained`, not the stale Phase C local
   branch tip. This is a plan template, not an executable command or a resolved
   refspec. The external `PUBLISH_DELTA.md` supplies the final literal object.
   If preservation refs are approved, map baseline object
   `0647b8502f75145936faf8fbcde7cf2ab5371f75` explicitly to
   `refs/heads/codex/pre-migration-main` and `refs/heads/codex/solver-optimization`.
   Only if separately approved and absent or identical remotely, preserve the
   existing `hard-capable-v1` annotated tag object. Never move it.
5. From the actual remote, create a fresh clone and rerun the complete documented
   suite. Verify exact RC SHA/tree, original raw commits/tag, preserved upstream
   history and native Fork metadata. Inspect actual GitHub hosted verification
   logs/artifacts and permissions. A local PASS is not a hosted PASS.
6. Only within that later approval, set `codex/maintained` as the default and
   configure the Issue/PR entry point after successful checks. Keep all deployment
   permissions and production credentials out of the verification workflow.

Never use force, mirror or all-ref pushes. Do not upload internal refs, dangling
objects, private backups, evidence logs, dependency directories or local caches.
Never push to Gitea main or deploy to ECS/Pages/CDN in this source-publication
step. Future web delivery must include v2 identity files in a separately reviewed
package; the original Gitea copy list does not do that automatically.

Technical local RC readiness depends on the final fresh-clone acceptance seal.
Full game certification, stable performance direction, hosted CI and remote
permissions remain UNKNOWN. Rights/source boundaries are accurately disclosed
in [LICENSING.md](../legal/LICENSING.md) and
[PROVENANCE.md](../benchmark/PROVENANCE.md).
