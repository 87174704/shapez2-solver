# E-011 Resource-accounted isolated-Pin constructive synthesis

Status: **ACCEPT / STOPPED**

Formal baseline: `hard-53x3-solver-baseline-v1`, canonical SHA-256 `a23979099a2ae0dc7c8fa0a77c89ffa77d23fc82170e38690de000b708082661`.

## Frozen experiment

`TIPGDCS-A` was the sole predeclared configuration. It retains the E-010 component for all other cases and invokes one generic isolated-Pin stage only after E-010 reports `unsupported-isolated-pin` or `unsupported-terminal-isolated-pin`. The stage globally matches every exact and sacrificial atom to a distinct public starting token, builds a full-height sacrificial cage with one empty spatial column, creates and isolates a Crystal column, then applies Pin Pusher so Crystal breakage leaves the required isolated Pin. Candidate code receives no target ID, family slot, source identity, witness, construction metadata, structural tag, benchmark recipe, or prior path.

## Correctness gate

The focused 6/6 fixtures cover a replay-valid standalone isolated Pin, a terminal Pin above an ordinary base, the same primitive inside a mixed Pin/Crystal construction, one-too-few distinct resources, a disabled required operation, and unchanged E-010 delegation. The complete repository suite passed 167/167 before formal observation and again at closeout. All 95 JavaScript/module files passed syntax checks; quick W1 retained depth 6 / 3,612 states / 106,816 candidates; the production Solver copies remained byte-identical. Formal execution used one fresh child process per member and the independent production replay validator.

## Formal result

- First pass: 126 `SOLVED`, 15 `UNSUPPORTED_DOMAIN`, 18 `EXHAUSTED`, zero `LIMIT`, `ERROR`, `WATCHDOG`, or invalid replay.
- Replay: all 126 first-pass solutions replayed valid.
- Repeat: all 126 first-pass solves ran again in independent fresh processes; all 126 solved and replayed valid. Every repeated operation count and complete solution path matched its first pass.
- Frontier: all 117 E-010 members were preserved.
- Increment: nine stable members across three newly covered targets: all families of `hard-main-007`, `hard-side-029`, and `hard-side-036`.
- New frontier: 126/159 stable replay-valid members across 43/53 targets.
- Remaining failure distribution: 15 broader Crystal layouts remain unsupported and 18 members exhaust distinct-resource matching. The latter includes the prior 15 resource mismatches plus the three `hard-side-038` isolated-Pin members, whose public resources cannot satisfy this construction's globally distinct exact-and-sacrificial demand set. These are not impossibility proofs.

The predeclared ACCEPT gate required preservation of all 117 frontier members plus at least three stable new members across at least two new targets. `TIPGDCS-A` preserves the frontier and adds 9 members across 3 targets, so E-011 is **ACCEPT / STOPPED**. No fallback, post-formal tuning, unrelated failure repair, production integration, or E-012 was started.

## Immutable identities

- Solver SHA-256: `a2dae5c30fd87fc5264b6d6ebd51c6e2ac46201ac72dada6c1b7ef4c261c8994`
- Frozen config SHA-256: `899bf1b208334709f58db4a2fe0ab9b4c8e85f0070580e9d550b01ed2b4ede6c`
- First-pass SHA-256: `10cc4d432f49f84ca7711ac0a4648cac9a58b8e3cae0e5321ab36386fe915f81`
- Repeat SHA-256: `846926e4ec7bc0a23d01550e6a301ab14e259b1dbddb3af679d9253329223fbf`
- Summary SHA-256: `bbf545551f293670dd0a79d85654f1eb8d10169d27bcad76d117a6be3740737b`

The JSON artifacts and their 159/126 member records are authoritative; this report is a human-readable summary.
