# E-014 Interior Crystal-column decomposition

Status: **ACCEPT / STOPPED**

Formal baseline: `hard-53x3-solver-baseline-v1`, canonical SHA-256 `a23979099a2ae0dc7c8fa0a77c89ffa77d23fc82170e38690de000b708082661`.

## Frozen experiment

`ICCDCS-A` was the sole predeclared configuration. It delegates first to frozen E-013 and invokes the new stage only after E-013 reports the specific generic `no canonical half-scaffold` construction boundary. The stage derives full-height monochrome Crystal columns from the public target, builds an all-solid-minus-one-column physical scaffold for each column from the finite public resource pool, uses Crystal Generator followed by lossless Cutter/rotation isolation, builds the ordinary remainder separately, and recomposes disjoint components with canonical Stacker physics.

Candidate code receives no target ID, family slot, source identity, witness, construction metadata, structural tag, benchmark recipe, prior path, or formal result. Historical replay-valid witnesses were inspected as architecture evidence before implementation, so no blinded-evaluation claim is made. The implemented planner contains no stored witness or target-specific branch.

## Correctness gate

The focused 6/6 fixtures cover replay-valid interior-column construction, a rotated column, token linearity, disabled Generator rejection, insufficient sacrificial resources, and unchanged E-013 delegation. The complete repository suite passed 184/184 before formal execution and again at closeout. All 109 JavaScript/module files passed syntax checks; quick W1 retained depth 6 / 3,612 states / 106,816 candidates. Production Solver sources were not modified and remain byte-identical at SHA-256 `EE558425BBC1761C5F01B82BB72D02F4D7DD611208C083D7355827600E518A37`. The frozen release Crystal planner also retained its policy-bound SHA-256 `D9D9997D830A37F52A3EF1BD868DD553E8408E5D1E13E98F2E827BED2C2702CD`.

## Formal result

- First pass: 159 `SOLVED`; zero exhausted, unsupported-domain, limit, error, watchdog, or invalid replay.
- Replay: all 159 first-pass solutions replayed valid.
- Repeat: all 159 first-pass solves ran again in independent fresh processes; all 159 solved and replayed valid. Every repeated complete solution path was byte-for-byte identical to its first pass.
- Frontier: all 156 E-013 members were preserved through unchanged delegation, and all 156 delegated complete paths exactly matched the frozen E-013 repeat paths.
- Increment: `hard-main-010:F1/F2/F3`, with 54 / 55 / 70 operations respectively. All three used the generic full-height column-extraction stage.
- New frontier: 159/159 stable replay-valid members across 53/53 targets.
- Failure distribution: empty.
- Resource audit: no public or derived token was consumed more than once in any first-pass solution.

The predeclared ACCEPT gate required preservation of all 156 frontier members, zero invalid replay or resource reuse, and stable replay-valid solutions for all three remaining members. `ICCDCS-A` satisfies every condition, so E-014 is **ACCEPT / STOPPED**. No post-formal tuning, fallback, target-specific behavior, production integration, or second architecture experiment occurred.

## Immutable identities

- Solver SHA-256: `d248493153cf77c03bc028bbbf158e7fe33df96ff5697b2df10519ea0c416f59`
- Column planner SHA-256: `703fd544de6da66ac4658257c0febc2da7dca17a12193594eb327aaec093e2d8`
- Shared constructor SHA-256: `2382b29285bc454417e286511a3cbaa398808f91f3b1ee0b236a387aedcca852`
- Frozen config SHA-256: `d2955d341fdcbbdbf4d0def7de1a1107cc66e2a51b8e57ec673fcb26a54beb59`
- First-pass SHA-256: `f0cdcddf40a5f42f0e06c1c16cd17d5ba45bf725fabcb723b4283020596e18b6`
- Repeat SHA-256: `9f8ea12211024412e180cffbe532fc18f8fd85e3ce52b56da29c51436bc61197`
- Summary SHA-256: `f61883f4f6cffafd761bec4ee99559ea46069d97f0fa41af424229d64acceabe`

The JSON artifacts and their 159/159 member records are authoritative; this report is a human-readable summary.
