# E-012 Shared-occurrence resource-pool constructive synthesis

Status: **ACCEPT / STOPPED**

Formal baseline: `hard-53x3-solver-baseline-v1`, canonical SHA-256 `a23979099a2ae0dc7c8fa0a77c89ffa77d23fc82170e38690de000b708082661`.

## Frozen experiment

`SOGDCS-A` was the sole predeclared configuration. It delegates first to frozen E-011 and invokes the new stage only after E-011 reports `resource-mismatch`. The stage physically partitions each public starting token into spatial atoms with lossless Cutter operations, retains every non-empty output as an independently live finite resource, and allocates exact and sacrificial cells without reusing any token. Canonical target-derived ordinary, Pin, Crystal, and mixed Pin/Crystal builders then assemble the goal. Candidate code receives no target ID, family slot, source identity, witness, construction metadata, structural tag, benchmark recipe, prior path, or formal outcome. E-011 `unsupported-crystal-layout` remains outside scope.

## Correctness gate

The focused 6/6 fixtures cover real two-output reuse, consumed-token linearity, insufficient multiplicity, a disabled Cutter, unchanged E-011 delegation, and broader-Crystal non-entry. The complete repository suite passed 173/173 before formal observation and again at closeout. All 100 JavaScript/module files passed syntax checks. Quick W1 retained depth 6 / 3,612 states / 106,816 candidates. The production Solver copies remained unchanged and byte-identical at SHA-256 `EE558425BBC1761C5F01B82BB72D02F4D7DD611208C083D7355827600E518A37`.

## Formal result

- First pass: 144 `SOLVED`, 15 `UNSUPPORTED_DOMAIN`, zero `EXHAUSTED`, `LIMIT`, `ERROR`, `WATCHDOG`, or invalid replay.
- Replay: all 144 first-pass solutions replayed valid.
- Repeat: all 144 first-pass solves ran again in independent fresh processes; all 144 solved and replayed valid. Every repeated complete solution path was byte-for-byte identical to its first pass.
- Frontier: all 126 E-011 members were preserved.
- Increment: 18 stable members across seven target IDs: all families of `hard-main-009`, `hard-main-011`, `hard-side-037`, `hard-side-038`, and `hard-side-039`, plus `hard-side-021:F1/F2` and `hard-side-031:F3`.
- New frontier: 144/159 stable replay-valid members across 48/53 targets, a gain of 18 members and five fully newly covered targets over E-011.
- Remaining failure distribution: exactly 15 pre-scoped broader-Crystal layouts remain unsupported, comprising all families of `hard-main-008`, `hard-main-010`, `hard-side-032`, `hard-side-034`, and `hard-side-040`. No impossibility claim is made.

The predeclared ACCEPT gate required preservation of all 126 frontier members, zero invalid replay, and at least three stable new members across at least two previously uncovered targets. `SOGDCS-A` preserves the frontier, adds 18 members, and fully covers five previously uncovered targets, so E-012 is **ACCEPT / STOPPED**. No post-formal tuning, fallback, broader Crystal work, production integration, or E-013 was started.

## Immutable identities

- Solver SHA-256: `fe07681b9d3aec67d7ea91dea41f8ebc60301b3b48bdc3a3a1f85a366e7a408e`
- Frozen config SHA-256: `a165101b2561cd6f0f222ef57eb162ad42e1d776fe16bc5b9ec96592debfaa58`
- First-pass SHA-256: `213d05630b86ffcb75bdb2f5212e1d18270008c663893d4e3f902a14c9e974c3`
- Repeat SHA-256: `c47d600b193c953e8ccbb175089457b11e8157de4453707e2b0b9a7af78b75ef`
- Summary SHA-256: `0909ba88e9fe25eddfad22861b09f8ebb79adbeb1a25da4a702d496895f1c5a8`

The JSON artifacts and their 159/144 member records are authoritative; this report is a human-readable summary.
