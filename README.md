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

Use Node.js 24.21.0. Run `npm ci --ignore-scripts --no-audit --no-fund`, `git config core.autocrlf input`, and `node scripts/ci/verify.mjs` once in a clean clone. See [reproduction steps](docs/benchmark/REPRODUCIBILITY.md) before rerunning. Serve the repository with a local static server to open `cn/` or `en/`.
