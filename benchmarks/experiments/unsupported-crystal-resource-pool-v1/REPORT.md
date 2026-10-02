# E-013 Broader-Crystal resource-pool activation

Status: **ACCEPT / STOPPED**

Formal baseline: `hard-53x3-solver-baseline-v1`, canonical SHA-256 `a23979099a2ae0dc7c8fa0a77c89ffa77d23fc82170e38690de000b708082661`.

## Frozen experiment

`UCRPGDCS-A` was the sole predeclared configuration. It delegates first to frozen E-012 and invokes the existing E-012 public-token resource constructor only when delegation returns `unsupported-crystal-layout`. The allocator, physical-mask Crystal planner, operation implementations, and all limits are unchanged. Candidate code receives no target ID, family slot, source identity, witness, construction metadata, structural tag, benchmark recipe, prior path, or formal outcome. A read-only diagnostic exercised the already-existing internal constructor on the remaining public inputs before predeclaration; it was disclosed in E-013/D-049, is not counted as a formal run, and means no blinded-evaluation claim is made.

## Correctness gate

The focused 5/5 fixtures cover replay-valid broader-Crystal entry, token linearity, unchanged E-012 delegation, disabled-Cutter failure, and a clean still-unsupported Crystal geometry. The complete repository suite passed 178/178 before formal execution and again at closeout. All 104 JavaScript/module files passed syntax checks; quick W1 retained depth 6 / 3,612 states / 106,816 candidates. Production Solver sources were not modified and remained byte-identical at SHA-256 `EE558425BBC1761C5F01B82BB72D02F4D7DD611208C083D7355827600E518A37`.

## Formal result

- First pass: 156 `SOLVED`, three `EXHAUSTED`, zero `UNSUPPORTED_DOMAIN`, `LIMIT`, `ERROR`, `WATCHDOG`, or invalid replay.
- Replay: all 156 first-pass solutions replayed valid.
- Repeat: all 156 first-pass solves ran again in independent fresh processes; all 156 solved and replayed valid. Every repeated complete solution path was byte-for-byte identical to its first pass.
- Frontier: all 144 E-012 members were preserved.
- Increment: 12 stable members, all three families of `hard-main-008`, `hard-side-032`, `hard-side-034`, and `hard-side-040`.
- New frontier: 156/159 stable replay-valid members across 52/53 targets, a gain of 12 members and four newly covered targets over E-012.
- Remaining failure distribution: only `hard-main-010:F1/F2/F3`. Each exhausted because the unchanged generic planner found no canonical half-scaffold for quadrants 0/1. This is not an impossibility claim.

The predeclared ACCEPT gate required preservation of all 144 frontier members, zero invalid replay, and at least three stable new members across at least two previously uncovered targets. `UCRPGDCS-A` preserves the frontier, adds 12 members, and covers four new targets, so E-013 is **ACCEPT / STOPPED**. No post-formal tuning, planner change, fallback, target-specific route, production integration, or E-014 was started.

## Immutable identities

- Solver SHA-256: `02518d4874199178a24b43e8958e678f3bd4a2d645bd82bfa8e052446327d98b`
- Frozen config SHA-256: `d16702677aff9152d6c35f3d5f478765784e344fd807e850ee17be3b1e41a025`
- First-pass SHA-256: `c51f55d729862c39b5c4d4ae56fe47506efb8728d6493c2b085fe71865896664`
- Repeat SHA-256: `49c9b41df2e66f46fcce6909b4dd43fa26bff638cb2380a1d91f054d84783404`
- Summary SHA-256: `4c8547f2d0d2b4bee4c6dbaebd1a4f4a8f8bb788c3144f0dbf41ead7886866a2`

The JSON artifacts and their 159/156 member records are authoritative; this report is a human-readable summary.
