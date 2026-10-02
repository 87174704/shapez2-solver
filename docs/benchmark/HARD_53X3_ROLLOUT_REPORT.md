# Hard 53x3 staged rollout report

Date: 2026-09-23 (Asia/Shanghai)

## Outcome

The mechanically derived remaining target set contained exactly 40 official Hard targets: the 53 official targets minus the 13 target IDs read from the accepted diversity-pilot artifact. Five batches of eight targets completed.

- remaining targets at 3/3 canonical families: **40/40**;
- newly accepted rollout instances: **80/80**;
- effective staged composition: **53/53 targets, 159/159 instances**;
- canonical forward replay: **159/159**;
- expansion validation: **159/159**;
- frozen baseline retained by identity: **53/53**;
- accepted pilot overlay retained by identity: **26/26**;
- Solver filtering, solve-rate measurement, 53x5, Insane and production operations: **not run**.

The 80-instance overlay is independently trusted as `hard-53x3-rollout-stage-v1` at manifest revision `hard-53x3-rollout-stage-v1-manifest-r1`. It contains only the newly generated instances and binds the frozen Hard 53x1 artifact as its source.

The effective 159-instance result is deliberately retained as `hard-53x3-staged-composition-v1`, not published as the requested formal `hard-53x3-stage-v1` release. Two independent acceptance blockers remain: the diversity-depth debt described below, and a frozen release-model incompatibility that prevents byte-preserving promotion of all 79 existing instances into one v3 artifact.

## Immutable authoritative inputs

| Input | Artifact release | Manifest revision | Artifact canonical SHA-256 | Instances SHA-256 |
|---|---|---|---|---|
| Frozen family 1 | `hard-53x1-stage-v1` | `hard-53x1-stage-v1-manifest-r2` | `11005e04e359fff9d0d3a0fec66dd491ca8e441f5c5c880e1ff3441b9fc77da3` | `40c4ea586dfeafb5f5e37545101220451d2cc9a9ca2ab54eb9d00a94806c8375` |
| Accepted pilot families 2/3 | `hard-53x3-diversity-pilot-v1` | `hard-53x3-diversity-pilot-v1-manifest-r1` | `9eaf8dc3a64cf68830ea0ec734b8ea6aba0fe67304d8033765125ce6fb6139f0` | `9ccffd150764176162ca759c4b9f414c3b308f60a967e6e33e322e0e1968f3a0` |

Both trusted validations still pass after the rollout. Their artifacts, witnesses, environments, family signatures and provenance were not rewritten.

## Batch checkpoints

| Batch | Targets | 3/3 | 2/3 only | Candidates | Accepted | Replay invalid | Expansion invalid |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 1 | 8 | 8 | 0 | 1,280 | 16 | 0 | 0 |
| 2 | 8 | 8 | 0 | 1,280 | 16 | 0 | 0 |
| 3 | 8 | 8 | 0 | 1,280 | 16 | 0 | 0 |
| 4 | 8 | 8 | 0 | 1,134 | 16 | 0 | 0 |
| 5 | 8 | 8 | 0 | 1,134 | 16 | 0 | 0 |

The persisted resume state is complete, with no next target. Each checkpoint records attempted targets, family coverage, rejection categories, candidate counts and capability gaps.

## Candidate funnel

Counts combine the accepted 13-target pilot and the new 40-target rollout because together they provide families 2/3 for all official targets.

| Stage | Count |
|---|---:|
| Searched | 7,487 |
| Replay invalid | 16 |
| Structural duplicate collapse | 1,089 |
| Expansion invalid | 0 |
| Valid but lower-ranked | 6,276 |
| Accepted | 106 |

The rollout itself searched 6,108 candidates, accepted 80, rejected 867 structural duplicates and left 5,161 valid novel candidates unselected. Its final accepted set had no replay-invalid or expansion-invalid candidate.

## Difficult targets

`hard-main-009` was the only first-pass capability gap. Its two ordinary core resources are three-quadrant partials for which no single catalog source has a legal unary Cut/rotation derivation. A bounded, target-independent fallback now composes two independently prepared catalog sources through canonical Swapper preprocessing. It found two natural families:

- `--CuWuSu` from `CuCu----` plus `RuSuWuSu`, with 49 operations;
- `--RuRuWu` from `Cu--Ru--` plus `RuWu--Su`, with 50 operations.

The frozen baseline has 46 operations. The fallback therefore did not select an extreme operation-count construction. It contains no target ID or official shape-code branch and all routes are accepted only after complete replay.

The largest rollout duplicate-family rejection counts were:

- `hard-main-004`, `hard-side-013`, `hard-side-037`: 50 each;
- `hard-main-002`: 49;
- `hard-side-008`, `hard-side-028`: 47 each;
- `hard-side-005`, `hard-side-019`: 43 each.

## Diversity depth

The formal `causal-construction-v3` gate passed: every target has three distinct recomputed signatures. However, the deeper diversity objective did not pass.

| Accepted new-family depth | Count |
|---|---:|
| Single-source ancestry variation | 22 |
| Multi-replacement preprocessing ancestry | 81 |
| Multi-source preprocessing graph | 3 |
| Assembly topology | 0 |
| Support/scaffold topology | 0 |
| Mechanism-routing difference | 0 |

The existing Pin, Crystal and Mixed planners expose one accepted construction plan rather than an enumerable family of alternative macro compositions. Consequently, the full rollout search still degenerated to source/preprocessing ancestry for all 106 new families. These are real causal families under the frozen fingerprint, but they do not satisfy the requested preference for component partition, assembly, Cut boundary, Stack routing, scaffold lifetime or half/quarter routing diversity.

This is the new pathology to address before final corpus acceptance. It is not hidden by the 3/3 signature count.

## Expansion and environment

Across all 159 staged instances:

- additive: 53;
- transformative: 106;
- adds a type absent from the corresponding baseline environment: 100/106 new instances;
- pure multiplicity-only: 0;
- multi-source preprocessing graph: 3.

Environment distributions are min / median / p90 / max (mean):

| Population | Available occurrences | Core occurrences | Available/core ratio | Expansion delta | Available types |
|---|---|---|---|---|---|
| Baseline family 1 (53) | 6 / 15 / 25 / 53 (17.08) | 5 / 14 / 23 / 51 (15.04) | 1.03 / 1.15 / 1.29 / 1.50 (1.17) | 1 / 2 / 3 / 4 (2.04) | 5 / 14 / 20 / 28 (13.55) |
| New families 2/3 (106) | 7 / 15 / 24 / 53 (16.29) | 5 / 14 / 23 / 51 (15.04) | 1.02 / 1.08 / 1.25 / 1.40 (1.11) | 1 / 1 / 2 / 3 (1.25) | 6 / 13 / 20 / 28 (13.50) |
| All staged instances (159) | 6 / 15 / 25 / 53 (16.55) | 5 / 14 / 23 / 51 (15.04) | 1.02 / 1.08 / 1.27 / 1.50 (1.13) | 1 / 1 / 3 / 4 (1.52) | 5 / 13 / 20 / 28 (13.52) |

No random filler, pure multiplicity rewrite, forced transformative quota or input-count maximization was used.

## Construction and complexity

Across the staged 159:

- Pin Pusher: 63 instances;
- Crystal Generator: 45;
- Mixed Pin/Crystal: 30;
- Swapper: 37;
- baseline core strategy with explicit reuse: 18;
- staged full-layer mask: 3;
- sparse-upper mask: 3;
- explicit scaffold strategy: 15.

Complexity distributions are min / median / p90 / max (mean):

| Population | Witness depth | Operation count | Terminal waste |
|---|---|---|---|
| Baseline family 1 | 8 / 11 / 21 / 26 (12.96) | 25 / 80 / 154 / 334 (95.02) | 7 / 25 / 52 / 115 (29.92) |
| New families 2/3 | 9 / 12 / 21 / 26 (13.33) | 27 / 83 / 157 / 336 (97.64) | 8 / 27 / 54 / 116 (31.26) |
| All staged instances | 8 / 12 / 21 / 26 (13.21) | 25 / 82 / 157 / 336 (96.77) | 7 / 26 / 54 / 116 (30.82) |

The new-family mean operation count is only 2.62 above baseline, and p90 is only 3 operations higher. The selection did not reward large operation-count inflation.

## Public projection

The staged 159-instance public projection contains only:

- opaque public instance ID;
- track;
- target ID and target;
- available inputs;
- public rules.

It contains no family number, witness, strategy, provenance, bridge, signature, difficulty or proof-side metadata. Opaque IDs are `h53-` plus a one-way 20-hex digest and do not expose internal family suffixes.

## Release identities and validation

The trusted 80-instance rollout overlay:

- artifact release ID: `hard-53x3-rollout-stage-v1`;
- manifest revision ID: `hard-53x3-rollout-stage-v1-manifest-r1`;
- artifact canonical SHA-256: `36ffc2397f3fa5c29b0edf0840515c0159008e0bd91c41ac7f4d2407c12064ad`;
- instances SHA-256: `874369d93095d0a4a69e130d15c36543d2072ff86870ec86106ab01501bf809e`;
- release manifest raw SHA-256: `b2424224cae43cad320292bf3339786c99a14b6ec5fc159d346b10b07d363ba8`;
- trusted validation: 40 targets, 80 instances, 80 replayed, 80 structural families, `releaseAcceptance=true`.

The 159-instance staged composition audit reports 53 targets, 159 instances, 159 replayed, 159 expansion-valid and no composition errors.

## Formal release blocker

The frozen v3 model cannot express byte-preserving promotion of the three immutable inputs into one trusted artifact:

1. validator line-of-authority requires every inline instance `provenance.releaseId` to equal the active profile artifact release ID;
2. it permits one profile-level `sourceArtifact` and requires every v3 instance `expansion.sourceInstance` to resolve through it;
3. the 53 baseline, 26 pilot and 80 rollout instances intentionally retain different release IDs and different source-artifact chains.

Rewriting those fields would violate the explicit immutable-input requirement and change every affected instance hash. Adding a composite source model would change the frozen validator/schema and cross the prohibited benchmark-architecture boundary. Therefore no `hard-53x3-stage-v1` manifest or fake trusted acceptance was produced.

## Integrity

- baseline and pilot canonical identities unchanged;
- canonical mechanics unchanged;
- `causal-construction-v3` unchanged;
- validator and schemas unchanged;
- Generic Pin, Crystal and Mixed planners unchanged;
- only a bounded generic Swapper preprocessing fallback was added to the rollout generator;
- no target ID, official shape-code special case, Solver result or hidden resource was used;
- no push, remote CI, SSH or production action was performed.

## Recommendation

**Stop and analyze the diversity planner before final corpus acceptance.**

Construction coverage is mechanically complete at 53x3, but all 106 new families remain in the source/preprocessing-ancestry depth classes, and the frozen release model cannot publish the immutable three-source composition. The next bounded work should be an explicit decision on composite release representation plus generic enumeration of alternative macro-composition plans. Do not start 53x5.
