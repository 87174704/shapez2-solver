# Reproduction and historical limitations

## Historical baseline disclosure

本项目保留了 hard-53x3-solver-baseline-v1 的冻结配置、159 项结果记录及其可核验的内容哈希。该历史基线依赖当时未提交的 Solver 工作树；截至 2026-10-29，我们在本次审计范围内尚未恢复 SHA-256 为 `1f25e23d2703896bf55c2b9ae5f2d41e2f6a014ccd6748d0e05a82a916ea8d2e` 的 shapeSolver.js / shapeSolver_web.js。因此，历史结果的记录完整性可以核验，但尚不能从已公开提交完整重跑该历史执行版本。当前维护版的源码和验证结果另行提供。历史冻结结果不等同于可独立复现的执行快照，其他版本不会被标记为原始基线。

VERIFIED — The owner explicitly accepted this disclosure in Phase C. Phase B searched all 958 valid local blobs, including reachable, reflog and dangling objects (no size cap), the working files and the named historical ZIP. No matching Solver source was recovered. UNKNOWN — copies outside that stated scope. This phase does not repeat the open-ended recovery search.

VERIFIED — Historical [config.json](../../benchmarks/solver-baselines/hard-53x3-v1/config.json) records 176 uncommitted status entries at freeze. Checkout of its named commit alone cannot reconstruct the recorded execution. The retained 159 record hashes, record files, configuration identity, aggregate and baseline identity can be recomputed. This must not be described as rerunning the missing Solver. No historical output is overwritten.

## Current maintenance and historical verification

Use Node.js 24.21.0 and the checked-in npm lockfiles (root and tools/static-build).
Create a full independent clone, including the original annotated tag and all
ancestors (no shallow clone). No original-workspace dependencies, caches or
untracked evidence are required.

~~~text
npm ci --ignore-scripts --no-audit --no-fund
npm ci --prefix tools/static-build --ignore-scripts --no-audit --no-fund
git config core.autocrlf input
node scripts/ci/verify-current.mjs "--commit=$(git rev-parse HEAD)"
~~~

The entry refuses any selected commit other than HEAD and requires a clean
tracked source. It writes logs and generated acceptance results to ignored
.ci-results/current/, bound to source HEAD/tree and Node/OS. It reconstructs
exact original newline representations only after their existing SHA-256 pins
match. Git blobs, frozen rules, records, witnesses and expected hashes are not
changed. The immutable control inputs are under tests/fixtures/physics-v2.

Current regressions register 277 tests: 269 PASS, zero FAIL, and 8 explicit
historical skips (six v1 regeneration cases and two composite-release cases)
excluded from the current score. The original committed v1 tree is reconstructed
only as a comparison input for current Physics acceptance: all 593 original files
must match their exact inventory bytes. Its 198 original tests, the frozen
evidence check and the fixed Physics v2 / Release 1 regressions belong to the
independent historical entry:

~~~text
node scripts/ci/verify-history.mjs
~~~

That entry runs on manual dispatch and on changes to frozen identity inputs,
authenticators, policies or trust roots (see verify-history.yml); daily current
CI does not repeat it. Historical record integrity is checked in the v1
environment. This does not reconstruct the missing earlier Solver source
identified above.

Independent v2 acceptance checks all 461 frozen files, all 331 frozen witness
instances (30,158 steps), and the 159 selected solves. V1 rerun, v2 and frozen
E-014 paths must match exactly; outputs and resource flow must also pass the
independent bounded model and resource replay. This workload is used in
development; it does not establish completeness, optimality or untouched holdout
performance. See [Physics v2 scope](../release/PHYSICS_V2.md).

After the full suite, optional bounded observations can be run explicitly:

~~~text
node tests/tools/capturePhysicsV2.mjs .ci-results
node tests/tools/boundedPhysicsV2.mjs .ci-results
~~~

Neither observation is a full reachable-space enumeration. No timing rerun is
required for correctness acceptance: earlier paired batches had mixed directions
and no stable performance conclusion. Full game-version certification remains
UNKNOWN. Local Windows success does not certify hosted Ubuntu or browser runs.

The original eight commits and hard-capable-v1 tag remain unchanged. Its old
56-file RC digest is historical, not this v2 publication identity. The external
Phase D seal binds the final full Git commit/tree, every candidate file and
fresh-clone results. Source publication follows the
[new plan](../release/PUBLISH_PLAN.md); no remote action or deployment is
authorized by these reproduction commands.
