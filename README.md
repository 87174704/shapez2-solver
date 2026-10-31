> Release 1 集成与验收记录见 [docs/release1/REPORT.md](docs/release1/REPORT.md)。严格方向普通目标的有界 Constructive 尝试默认启用，无 O1 feature flag；历史报告保持原貌。

# Shapez 2 Solver

A browser-based solver for [Shapez 2](https://shapez2.com/), independently maintained from [Vystel/shapez2-solver](https://github.com/Vystel/shapez2-solver). It supports shape operations, constructive solving, and visual solution graphs.

Physics v2 corrects support propagation and complete crystal shattering. The frozen workload contains **53 targets × 3 families = 159 cases**; complete game certification and stable performance changes remain unknown. See [validation scope](docs/release/PHYSICS_V2.md).

## Documentation

- [License scope](docs/legal/LICENSING.md) and [MIT terms](LICENSE)
- [Credits and asset sources](docs/legal/ATTRIBUTION.md)
- [Third-party dependencies and original licenses](docs/legal/THIRD_PARTY.md)
- [Benchmark provenance](docs/benchmark/PROVENANCE.md)
- [Reproduction steps and historical baseline limits](docs/benchmark/REPRODUCIBILITY.md)
- [Fork structure and publication gates](docs/release/PHASE_C.md)
- [Verification-only GitHub CI](docs/release/CI.md)
- [Future international/domestic release architecture](docs/release/ARCHITECTURE.md)

Use Node.js 24.21.0. Install dependencies from the two lockfiles:

```powershell
npm ci --ignore-scripts --no-audit --no-fund
npm ci --prefix tools/static-build --ignore-scripts --no-audit --no-fund
node tools/release1/prepare-checkout.mjs
node tools/static-build/build.mjs global
node tools/static-build/build.mjs china
```

The maintained release enables strict constructive routing by default and supports 13 languages in both profiles. Serve `dist/global` at `/shapez2-solver/` or `dist/china` at `/` with a local static server; each build manifest records the exact source commit and tree.

For current regressions, historical v1 certification, frozen benchmarks, witness replay, ordinary/holdout cases and browser checks, follow the [current validation commands](docs/strict-orientation-constructive-20261030/REPRODUCE.md). All inputs and resources are versioned; no historical workspace or cache is required. Use `core.autocrlf=false` for this checkout to retain the exact pinned representations. Generated outputs are disposable and ignored.
