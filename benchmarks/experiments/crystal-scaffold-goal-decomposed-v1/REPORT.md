# Crystal-scaffold Goal-decomposed Constructive Synthesis

Status: `ACCEPT / STOPPED`  
Experiment: P6-08 / E-009  
Configuration: `CSGDCS-A`  
Formal baseline: `a23979099a2ae0dc7c8fa0a77c89ffa77d23fc82170e38690de000b708082661`

## Architecture

E-009 adds one exact Crystal reversal above the frozen E-008 component. For a four-part target whose complete layer rectangle is occupied, contains no final Pin, and uses one Crystal color, it replaces every target Crystal with a Pin, asks the unchanged Pin-aware goal-decomposed component to construct that scaffold from the public finite resources, verifies that one physical Crystal Generator produces the exact target, and appends that operation. Non-Crystal targets delegate unchanged to E-008.

The standalone solver receives no target ID, family slot, source identity, witness, construction metadata, structural tag, benchmark recipe, or prior path. Sparse, mixed-color, final-Pin, isolated-Pin, and multi-stage Crystal layouts remain outside this frozen stage.

## Formal result

The frozen first pass ran all 159 members in independent fresh processes. Every first-pass solution replayed valid. All 112 solved members then ran again in independent fresh processes under the identical configuration and all 112 again solved with valid replay.

| Outcome | Count |
| --- | ---: |
| SOLVED | 112 |
| UNSUPPORTED_DOMAIN | 30 |
| EXHAUSTED | 17 |
| LIMIT | 0 |
| ERROR | 0 |
| WATCHDOG | 0 |
| INVALID_REPLAY | 0 |

The 30 unsupported Crystal layouts split into 15 final-Pin layouts, 12 sparse layouts, and three mixed-color layouts. The 17 exhausted cases preserve E-008's 11 distinct-resource mismatches and six isolated-Pin layouts.

## Capability accounting

E-008 was the comparison frontier at stable 103/159 across 35 targets. CSGDCS-A preserves all 103 frontier members and adds all three families of three new target IDs:

- `hard-side-030`;
- `hard-side-033`;
- `hard-side-035`.

The resulting frontier is 112/159 across 38/53 targets: +9 stable members and +3 targets. This exceeds the predeclared ACCEPT gate of at least three new stable members across at least two new targets with complete frontier preservation.

## Correctness and verification

- Fixed Crystal-domain gate: 7/7 passed before formal execution.
- Full repository suite: 155/155 passed before formal execution and again after the formal run.
- Every one of 224 formal solution returns across first pass and repeat replayed valid.
- Artifact identity, exact 159-member coverage, repeat membership, frontier preservation, counts, and summary audit: PASS.
- All 87 JavaScript/module files passed syntax checks.
- Quick W1 retained depth 6 / 3,612 states / 106,816 candidates.
- Production `shapeSolver.js` and `shapeSolver_web.js` remain byte-identical at SHA-256 `ee558425bbc1761c5f01b82bb72d02f4d7dd611208c083d7355827600e518a37`.
- `git diff --check` was clean apart from informational line-ending warnings.

Production Solver/Worker sources and prior frozen benchmark artifacts were not modified by E-009.

## Frozen identities

- solver: `51a129abdd2e8a2d573af0fbde05a43ed8cb616d0b46a19b7ff758e118b7d79f`
- config: `62129bc10b3de7727750d840d02d1eb645101622af1fe1b89500156f224e9fe5`
- first pass: `c4afc5b2e3d7401a824cd7a37eb6530b6c3ee7a31d88ccda0fe5cec63bf433e6`
- repeat: `f4f1f792933331aedd5a5c160f4ee4d8feb5aabb39857776077fb1ca70b7bf76`
- summary: `1f8a2f21c061c214c537cd1a10687d2782cece002b0569a4021ae331b2065c10`

## Verdict and stop

`ACCEPT / STOPPED`. No post-formal implementation or configuration change occurred. No fallback configuration, sparse or mixed-color extension, isolated-Pin/resource-mismatch repair, production integration, or E-010 starts in this session.
