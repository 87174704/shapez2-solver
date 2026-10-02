# Mixed Pin/Crystal Support-safe Goal-decomposed Constructive Synthesis

Status: `ACCEPT / STOPPED`  
Experiment: P6-09 / E-010  
Configuration: `MPCGDCS-A`  
Formal baseline: `a23979099a2ae0dc7c8fa0a77c89ffa77d23fc82170e38690de000b708082661`

## Architecture

E-010 adds one public-input mixed Pin/Crystal construction stage above the frozen E-009 component. Non-mixed targets delegate unchanged. A mixed target is decomposed into target-derived halves and columns. Crystal-bearing suffixes are built before their supporting Pins, Crystal cells are generated inside physical disposable solid cages, and canonical Stack/Swapper recomposition is accepted only when previewed operation physics reproduces the requested component exactly.

Every ordinary or sacrificial leaf is extracted from one globally distinct starting token. The solver receives no target ID, family slot, source identity, witness, construction metadata, structural tag, benchmark recipe, or prior path. The frozen first stage deliberately excludes terminal isolated-Pin construction.

## Formal result

The first pass ran all 159 members in independent fresh processes. All 117 solution returns replayed valid. The same 117 members then ran again in independent fresh processes under the identical configuration; every repeat solved and replayed valid.

| Outcome | Count |
| --- | ---: |
| SOLVED | 117 |
| UNSUPPORTED_DOMAIN | 21 |
| EXHAUSTED | 21 |
| LIMIT | 0 |
| ERROR | 0 |
| WATCHDOG | 0 |
| INVALID_REPLAY | 0 |

Architecture statuses were 117 solved, six excluded terminal-isolated-Pin layouts, 15 delegated unsupported Crystal layouts, 15 resource mismatches, and six delegated unsupported isolated-Pin layouts.

## Capability accounting

E-009 was the comparison frontier at stable 112/159 across 38 targets. MPCGDCS-A preserved all 112 frontier members and added five stable members:

- `hard-main-012:F1`, `F2`, and `F3`;
- `hard-side-031:F1` and `F2`.

The resulting frontier is 117/159 across 40/53 targets: +5 stable members and +2 targets. This exceeds the predeclared ACCEPT gate of at least three new stable replay-valid members across at least two new targets with complete frontier preservation.

`hard-side-031:F3` exhausted distinct-resource matching under the frozen public input. `hard-main-011` also exhausted matching, while `hard-main-007` and `hard-side-029` require the deliberately excluded terminal isolated-Pin branch. These misses are not impossibility proofs.

## Correctness and verification

- Focused mixed-domain gate: 6/6 passed.
- Full repository suite: 161/161 passed before formal execution and again after formal execution.
- Every one of 234 formal solution returns across first pass and repeat replayed valid.
- Artifact identity, exact 159-member coverage, unique membership, repeat equality, frontier preservation, counts, and summary verdict audit: PASS.
- No formal LIMIT, ERROR, WATCHDOG, invalid replay, or frontier loss occurred.
- Production Solver sources were not modified by E-010.

## Frozen identities

- solver: `d06404ab017ccb19e4f26a1305a67f252c5f6f03eda256654ebfbc0330674cdf`
- config: `7b31db6d74af2c14f187a1efa2ad8556a361c677cf4b50efbbf5ab5ffccea2c9`
- first pass: `a577a836cae8093586283072a7a330773f7df0a165d6a0077a3d00b0ab45ab80`
- repeat: `a08971d2ef17baa813472772b187b8319cc963b0ca9b5bf6c5c6d8bee7841978`
- summary: `16cc95bfaf0bfe90b92323c79facad1b50a1b631d2c8c5c21016505750322aa1`

## Verdict and stop

`ACCEPT / STOPPED`. No post-formal implementation or configuration change occurred. No fallback, terminal isolated-Pin completion, other failure-class repair, production integration, or E-011 starts in this session.
