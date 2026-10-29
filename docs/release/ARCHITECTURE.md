# Subsequent release architecture

VERIFIED user decisions — GitHub will be the public source, Issue/PR entry point, and future GitHub Pages international host. Gitea and the current Alibaba Cloud ECS remain the domestic site and controlled release copy. The existing production deployment and runner stay in place.

INFERRED implementation plan — Both sites must use the same explicitly approved source commit and release version. Keep `hard-capable-v1` unchanged. Future releases get new tags and a separate publication manifest containing source commit/tree, common runtime file hashes, package digest and site-specific deployment evidence. Use the Phase B 60-file application allowlist as the current runtime base, with mandatory legal notices and publication metadata added by a separately reviewed packaging step. Do not deploy the whole source repository, Benchmark, tests, `.git`, `.gitea` or dependencies directory as site content. The old 56-file RC hash is not the new publication identity.

VERIFIED user decisions — International delivery keeps the existing overseas CDNs; future domestic delivery prioritizes free/community domestic CDNs. No runtime URL is changed now. New mirrors, vendored dependencies, font hosting, i18n, Pages production rollout and Solver optimization belong to a separately authorized next phase.

INFERRED release flow — verified GitHub commit → isolated Gitea release copy/staging → explicit domestic deployment approval → fast-forward of Gitea main using the existing deployment path. Never establish bidirectional mirroring or automatic production writes from GitHub PRs. A main update may trigger the existing Gitea runner and must not be treated as harmless synchronization.

UNKNOWN production prerequisite — a verified previous complete static package, deployment identity, recovery permissions and rollback procedure must exist before domestic deployment. The current copy workflow is not atomic. Preserve its current behavior in Phase C. It does not copy a new publication.json automatically; a future publication ledger can bind its existing deployment.json.commit to the approved shared-source identity.

INFERRED future deployment acceptance — verify actual github.io path, root/cn/en refresh and query/hash, module MIME, Solver/Explorer/mixing workers, rendering, clipboard context, and shared payload hashes at both hosts. Pages failure recovers using an approved earlier artifact. Production recovery uses an authorized complete package or new revert commit; no old tag moves or history rewrites.
