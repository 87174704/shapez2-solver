# Shapez 2 Solver

Browser-based solver for [Shapez 2](https://shapez2.com/), independently
maintained from [Vystel/shapez2-solver](https://github.com/Vystel/shapez2-solver).
It supports shape operations, constructive solving and visual solution graphs,
serves 13 UI languages, and builds as two static profiles (`global`, `china`).
Strict-orientation ordinary targets use bounded constructive attempts by default;
there is no feature flag for them.
With unrestricted painting (`cleanPainting: false`), the same bounded constructor
recovers ordinary `not-found-pruned` search results while preserving existing
successful search paths.
Strict-orientation Pin/Crystal targets also get a bounded constructive recovery
after search pruning or a non-time state/shape limit. Existing successful paths
are preserved; recovery uses at most 50 ms of the same total solve allowance.

Maintained branch: **`codex/maintained`**. Its certificate covers the Git-selected
source plus the original immutable inputs
([versions/current.mjs](versions/current.mjs)). It is not a Release 1
certificate: the Release 1 identity is a frozen historical record that does not
validate against this branch by design. Current physics semantics:
`shape-operations-v2-support-closure`
([SEMANTICS_V2.md](versions/SEMANTICS_V2.md)).

Long-lived ref roles are defined in
[VERSIONING.md](docs/release/VERSIONING.md): `codex/maintained` is the only
development branch, GitHub `main` preserves the independent upstream lineage,
Gitea `main` is a deployment trigger, and two frozen refs keep v1 at `0647b85`.
Do not fast-forward the upstream or deployment branch to "sync" maintenance code.

## Install (Node.js 24.21.0)

~~~powershell
npm ci --ignore-scripts --no-audit --no-fund
npm ci --prefix tools/static-build --ignore-scripts --no-audit --no-fund
git config core.autocrlf input
~~~

Two lockfiles: repository root and `tools/static-build`. The verification
workflow runs the same install. Do not let Git rewrite the frozen inputs'
bytes; the gate only restores representations whose existing SHA-256 pins match.

## Commands for this branch

| Purpose | Command |
| --- | --- |
| Regression suite | `npm test` |
| Current complete gate (ten phases) | `node scripts/ci/verify-current.mjs --commit=$(git rev-parse HEAD)` |
| Build one profile | `node tools/static-build/build-current.mjs global --commit=$(git rev-parse HEAD)` (or `china`) |
| Verify the built profiles | `node tools/static-build/verify-current.mjs --commit=$(git rev-parse HEAD)` |
| Corpus acceptance | `npm run bench:validate` |
| Official workload sample (opt-in) | `npm run bench:official -- --suite hard --partition development` |
| Browser Worker lifecycle (needs Chrome or Edge) | `npm run test:browser-worker` |
| Independent historical certification | `node scripts/ci/verify-history.mjs` |
| Historical v1 suite on a reconstructed tree | `npm run test:historical-v1` |

The gate and both build/verify entries require a clean tracked tree whose HEAD
equals `--commit`; they refuse to certify uncommitted work, so commit first.
They write ignored `.ci-results/current/` and `dist/<profile>/`. Phase details,
prerequisites and the dated test snapshot live in [CI.md](docs/release/CI.md);
they are not repeated here. `test:historical-v1` extracts the fixed v1 tree into
an OS temporary directory and removes it on success or failure; pass an explicit
destination only if you want to keep it.

## Current certification vs historical certification

- **Current** ([verify-current.mjs](scripts/ci/verify-current.mjs)): frozen-input
  and Git source identity, locked dependencies, syntax, documentation links,
  corpus acceptance (195 instances, 159 composite members), the current
  regression suite, independent validation of 331 frozen witnesses and 159 solved
  paths with one current Solver call per case, and both static profiles.
- **Historical** ([verify-history.mjs](scripts/ci/verify-history.mjs)): rebuilds
  the fixed Release 1 tree (781 files), the v1 tree (593 exact bytes) and the
  Physics v2 RC from the existing Git objects, then runs their original suites,
  the frozen evidence check and the 198-test v1 suite. It never reads current HEAD
  source and is not part of the daily gate.

Historical-only entries fail closed at their identity checks instead of producing
current results — this is expected, not a defect:
`tools/release1/prepare-checkout.mjs`, `tools/static-build/build.mjs`,
`tools/static-build/verify.mjs`, `tools/static-build/acceptance.mjs`,
`npm run verify:physics-v2`, `npm run measure:physics-v2` and
[docs/strict-orientation-constructive-20261030/REPRODUCE.md](docs/strict-orientation-constructive-20261030/REPRODUCE.md).

## Frozen boundary and Benchmark rules

The maintenance certificate binds bytes, not intentions:

- All `benchmarks/**` files (461) and `docs/benchmark/USER_RULES.md` are frozen by
  [versions/current.mjs](versions/current.mjs). `BENCHMARK_RULES.md`,
  `GAME_SEMANTICS.md`, seed/catalog/targets/schemas/generator/validator and
  `benchmarks/policy/*` are additionally bound by the Benchmark release manifests
  and policy.
- Do not edit, move, rename, regenerate or add status banners to those files, and
  do not "fix" a count inside them. A change there is a new Benchmark release
  (new manifest revision and policy), not a documentation edit.
- `docs/benchmark/GAME_SEMANTICS.md` is the frozen **v1** semantics record;
  [SEMANTICS_V2.md](versions/SEMANTICS_V2.md) describes the current **v2**
  semantics. Never edit the frozen file to point at v2.
- `shapeSolver_web.js` is the frozen Release 1 runtime artifact, not a second
  current source. It is never executed, must keep its original bytes, and is not
  required to be byte-identical to `shapeSolver.js`. Historical measurements in
  `benchmarks/results/` keep their own solver hash; new `bench:official` reports
  record the executed current Solver hash plus the frozen pin.

Rule precedence: [USER_RULES.md](docs/benchmark/USER_RULES.md) >
[BENCHMARK_RULES.md](docs/benchmark/BENCHMARK_RULES.md) >
[BENCHMARK_METHODOLOGY.md](docs/benchmark/BENCHMARK_METHODOLOGY.md).

## Known release limits (2026-11-01)

No release path is functional for this branch, and none may be assumed:

- [.github/workflows/pages.yml](.github/workflows/pages.yml) still builds with the
  Release 1 entry (`build.mjs`) and requires the Release 1 identity, so it cannot
  publish current code.
- [.gitea/workflows/deploy.yml](.gitea/workflows/deploy.yml) triggers only on
  Gitea `main` (currently `0647b85`, the v1 tree) and copies a whitelist
  that lacks `locales/` and `assets/`; fast-forwarding Gitea `main` would publish
  a broken site.
- [PUBLISH_PLAN.md](docs/release/PUBLISH_PLAN.md) was never executed and depends
  on repository-external Phase D materials.
- The root [release.json](release.json) is historical Release 1 metadata; current
  builds generate their own identity inside `dist/<profile>/release.json`.
- The hosted verification workflow verifies only. Hosted run `41292992814` on
  `810d2ed` completed successfully on 2026-11-01; that is a dated observation for
  one commit, not a guarantee for later commits, and it deploys nothing.

## Documentation

- [Agent maintenance contract](AGENTS.md) — daily maintenance expectations for
  code agents.
- [Current gate and counts](docs/release/CI.md)
- [Versioning and branch roles](docs/release/VERSIONING.md)
- [Reproduction and historical limitations](docs/benchmark/REPRODUCIBILITY.md)
- [Independent historical certification](docs/release/HISTORICAL_VERIFICATION.md)
- [Benchmark provenance](docs/benchmark/PROVENANCE.md)
- [Physics v2 scope](docs/release/PHYSICS_V2.md) (RC snapshot)
- [License scope](docs/legal/LICENSING.md), [MIT terms](LICENSE),
  [attribution](docs/legal/ATTRIBUTION.md),
  [third-party boundaries](docs/legal/THIRD_PARTY.md)
- [i18n terminology](docs/i18n/TERMINOLOGY.md)
- [Project summary](project_summary.md) — architecture and research-context guide
  for the maintained branch: module relationships, solver algorithms, validation
  boundaries and research cautions. This README covers installation, commands and
  maintenance status.

## Historical material (read-only)

- `docs/optimization/` — closed optimization phase; see its
  [status page](docs/optimization/README.md). `WORKFLOW.md` no longer governs
  anything.
- Seven F1 documents in the repository root (`REPORT.md`,
  `ARTIFACT_MANIFEST.md`, `BROWSER_VALIDATION.md`, `BUILD_PROFILES.md`,
  `CDN_VERIFICATION.md`, `DEPENDENCY_MATRIX.md`, `NEXT_DEPLOY_PLAN.md`) record the
  2026-10-30 dual-CDN build; their commands and counts are historical. They stay in
  place because [versions/shapez2-solver-release1.json](versions/shapez2-solver-release1.json)
  binds those paths and [tools/static-build/reports.mjs](tools/static-build/reports.mjs)
  regenerates them at the root.
- `docs/release1/` and
  [docs/strict-orientation-constructive-20261030/](docs/strict-orientation-constructive-20261030/REPORT.md)
  — Release 1 records and a closed experiment.
