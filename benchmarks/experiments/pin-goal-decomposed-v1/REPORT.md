# Pin-aware Goal-decomposed Constructive Synthesis

Status: `ACCEPT / STOPPED`  
Experiment: P6-07 / E-008  
Configuration: `PGDCS-A`  
Formal baseline: `a23979099a2ae0dc7c8fa0a77c89ffa77d23fc82170e38690de000b708082661`

## Architecture

E-008 extends E-007's bounded target decomposition with a pure-Pin structural stage. It derives canonical Pin columns and supported upper regions from the public target, matches every exact or sacrificial atom to a distinct public starting token, searches only bounded unary extraction closures, and emits physical Cutter/rotation/Painter/Pin Pusher/Stacker plans. Ordinary targets retain the frozen E-007 constructive component. Crystal-bearing targets are explicitly outside this stage.

The standalone solver receives no target ID, family slot, source identity, witness, construction metadata, structural tag, benchmark recipe, or prior path. Parent-only identity fields bind the result artifact and are never sent to the solver.

## Formal result

The frozen first pass ran all 159 members in independent fresh processes. Every first-pass solution was replay-valid. All 103 solved members then ran again in independent fresh processes under the identical configuration and all 103 again solved with valid replay.

| Outcome | Count |
| --- | ---: |
| SOLVED | 103 |
| UNSUPPORTED_DOMAIN | 39 |
| EXHAUSTED | 17 |
| LIMIT | 0 |
| ERROR | 0 |
| WATCHDOG | 0 |
| INVALID_REPLAY | 0 |

The 17 exhausted cases split into 11 distinct-resource mismatches and six unsupported isolated-Pin layouts. The 39 unsupported-domain members all contain Crystal and remain outside the frozen Pin-only scope.

## Capability accounting

E-007 was the comparison frontier at stable 78/159 across 26 targets. PGDCS-A preserves all 78 frontier members and adds 25 stable replay-valid members across nine new target IDs:

- `hard-main-005`, `hard-main-006`;
- `hard-side-021` through `hard-side-026` except no gap in that listed range;
- `hard-side-028`.

The resulting frontier is 103/159 across 35/53 targets. This exceeds the predeclared ACCEPT gate of at least three stable new members across at least two new targets.

## Correctness and scope

- Small-domain Pin gate: 6/6 passed before formal execution.
- Full repository suite: 148/148 passed before formal execution.
- Every one of 206 formal solution returns across first pass and repeat replayed valid.
- No formal run reached a limit, errored, hit the parent watchdog, or reused a starting token.
- The production Solver/Worker sources were not integrated or modified by E-008.

The remaining misses are not impossibility proofs. In particular, `hard-main-009`, two `hard-side-021` families, `hard-side-037`, and the earlier ordinary `hard-side-039` families are resource-mismatch outcomes under this deterministic construction; `hard-side-036` and `hard-side-038` require the isolated-Pin mechanism excluded from PGDCS-A. Crystal and mixed Pin/Crystal planning remain outside scope.

## Frozen identities

- solver: `6ccf166b56cc36538d13721a2713cecc4876a30074a1268d37c043a8da3230f7`
- config: `48b5b5bfae02abced06d0e42110858eb44d00a0a751107aa4b4e323b11e242bc`
- first pass: `a835cc09724f495e83f887b014b4b108a86a3477db9f1d4d1968cd528ff7c508`
- repeat: `060d1d17feb336c72c199fda7f8f9d998a0ae478335d437c54c2affc12b49131`
- summary: `84b087d4ae865435d1c41f464156ff3dad73d9d25f5c1931cb2b76f4465cdd15`

## Verdict and stop

`ACCEPT / STOPPED`. No post-formal tuning occurred. No fallback configuration, Crystal stage, production integration, or E-009 starts in this session.
