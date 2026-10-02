# Hard 53x3 staged diversity generation — pilot report

Date: 2026-09-22

## Result

The representative pilot passed. All 13 selected targets have one unchanged frozen Hard 53x1 baseline family plus two replay-valid overlay families. For every target, the three independently recomputed `causal-construction-v3` signatures are distinct.

This is an `expansion-pilot` overlay, not a full Hard 53x3 release. The overlay artifact contains only the 26 new instances. Its release manifest binds the unchanged `hard-53x1-stage-v1` artifact as `sourceArtifact`; the effective pilot set is the frozen baseline family plus the two overlay families.

## Pilot targets

- `hard-main-001`: simple ordinary construction.
- `hard-side-003`: small ordinary construction and a baseline `+1` environment.
- `hard-side-035`: refinement A.
- `hard-main-010`: refinement B plus Crystal construction.
- `hard-side-040`: refinement C and sparse-upper Crystal outlier.
- `hard-main-012`: refinement D and Mixed Pin/Crystal construction.
- `hard-main-005`: generic Pin/overflow construction.
- `hard-main-008`: staged Crystal-mask construction.
- `hard-main-007`: high-operation Mixed outlier.
- `hard-side-036`: isolated-Pin and near-core environment outlier.
- `hard-side-033`: dense-Crystal fallback history.
- `hard-side-041`: refinement D and the largest baseline expansion delta.
- `hard-side-021`: shared-occurrence Pin construction.

## Family coverage and environments

Signatures below use 12-character display prefixes. Full signatures and complete route provenance are retained in `benchmarks/diversity-pilot/v1/target-status.json`. `sim` is weighted multiset Jaccard similarity to the frozen baseline environment. Counts are `available/core`, followed by expansion delta, witness depth and operation count.

| Target | Baseline family | Family 2 | Family 3 |
|---|---|---|---|
| hard-main-001 | `5ec610ccdab7` | `a256ca0c0f30`; `RuRuSuCu → CuRu----`; 10/8, Δ2, sim .538, d11/o50 | `493f9bd659ed`; two replacements; 9/8, Δ1, sim .462, d9/o51 |
| hard-side-003 | `766c16f9d52d` | `4b29bac85076`; `RuCuWuCu → CuRu----`; 7/5, Δ2, sim .444, d9/o34 | `0d0fb9dcb780`; `RuRuSuCu → CuRu----`; 7/5, Δ2, sim .444, d9/o34 |
| hard-side-035 | `285813c205c7` | `ef8114f413d7`; `RuCuWuCu → WuCu----`; 8/6, Δ2, sim .417, d12/o27 | `2494146c5167`; `RuWuCu-- → WuCu----`; 8/6, Δ2, sim .417, d12/o27 |
| hard-main-010 | `bebec529dedc` | `3aef6d886d19`; one-source Cut/Swapper recomposition; 8/6, Δ2, sim .778, d20/o55 | `ac85ed23a019`; two-source Swapper recomposition; 8/6, Δ2, sim .600, d17/o53 |
| hard-side-040 | `08b3917ea07e` | `9c4935d5120e`; `CuWuSuCu → ----SuCu`; 44/42, Δ2, sim .872, d26/o271 | `2dad262a5b4a`; `RuCuWuCu → WuCu----`; 44/42, Δ2, sim .872, d26/o271 |
| hard-main-012 | `1468bbe79d77` | `b9e4f61bf9e6`; `SuCuSu-- → ----SuCu`; 16/14, Δ2, sim .722, d20/o118 | `c746c1e18e63`; two replacements; 15/14, Δ1, sim .667, d20/o118 |
| hard-main-005 | `26e907e6b035` | `0d814bea06be`; `SuCuSu-- → CuSu----`; 13/11, Δ2, sim .588, d11/o65 | `10b039b7a9e1`; two replacements; 12/11, Δ1, sim .529, d11/o66 |
| hard-main-008 | `d8d2550582b2` | `bd70531ff950`; `CuWuSuCu → ----SuCu`; 24/22, Δ2, sim .750, d21/o144 | `5d266f43a240`; two replacements; 23/22, Δ1, sim .714, d21/o147 |
| hard-main-007 | `64e3bf862fee` | `66289b44edfc`; `CuWuSuCu → CuCu----`; 53/51, Δ2, sim .893, d22/o336 | `2caa08219d3f`; two replacements; 52/51, Δ1, sim .875, d22/o336 |
| hard-side-036 | `70fb29ab1f2d` | `e4a679035d98`; `CuWuSuCu → ----SuCu`; 35/33, Δ2, sim .865, d22/o214 | `0e5c131c101c`; two replacements; 34/33, Δ1, sim .838, d24/o216 |
| hard-side-033 | `7ffc9da59473` | `aea7e2cf6237`; `RuCuWuCu → CuRu----`; 26/24, Δ2, sim .821, d14/o165 | `c10678aac181`; `RuRuSuCu → CuRu----`; 26/24, Δ2, sim .821, d14/o165 |
| hard-side-041 | `297e91896558` | `64f0095a9b34`; `RuRuSuCu → ----SuCu`; 11/8, Δ3, sim .533, d10/o46 | `5be5104ead72`; two replacements; 10/8, Δ2, sim .467, d10/o46 |
| hard-side-021 | `ce74bd7c3e19` | `9b6208c728f3`; `RuRuSuCu → ----SuCu`; 10/8, Δ2, sim .583, d12/o73 | `37ba9a3c084a`; `SuCuSu-- → ----SuCu`; 10/8, Δ2, sim .583, d12/o73 |

Every row reached `3/3`. No target was accepted through token relabeling, no-op insertion, sibling rescheduling, Swapper input reversal, output bookkeeping, or unrelated terminal byproducts. Novelty comes from causally consumed source replacement, different source ancestry, different Cut/Half-Destroyer/rotation routing, multi-resource replacement, or the two distinct Swapper preprocessing graphs for `hard-main-010`.

## Search and rejection profile

- Candidate attempts: 1,379.
- Accepted overlay instances: 26.
- Rejected attempts: 1,353.
- Structural duplicate collapse: 222.
- Replay-invalid: 16.
- Valid novel families not selected by environment ranking: 1,115.
- Expansion-invalid after final generator correction: 0.

Rejected attempts remain in `candidate-log.json`; they were not overwritten by later successes.

## Expansion and environment profile

- Additive: 0/26.
- Transformative with mechanically replayed preprocessing bridge: 26/26.
- Adds at least one input type absent from the corresponding baseline environment: 20/26.
- Uses only types already present in the baseline environment, but changes the causally consumed multiset: 6/26.
- Pure multiplicity-only expansion: 0/26.

New-instance distributions are shown as min / median / p90 / max:

| Metric | Distribution |
|---|---|
| Available occurrences | 7 / 12.5 / 44 / 53 |
| Core occurrences | 5 / 11 / 42 / 51 |
| Expansion delta | 1 / 2 / 2 / 3 |
| Witness depth | 9 / 14 / 24 / 26 |
| Operation count | 27 / 73 / 271 / 336 |

The six same-type-set cases are the process-heavy `hard-side-040`, `hard-main-007`, and `hard-side-033` families. They still remove and replace causally consumed resources and are not multiplicity-only rewrites. They remain the main environment-diversity debt for full expansion.

## Integrity and release identity

- Overlay artifact release: `hard-53x3-diversity-pilot-v1`.
- Trusted pilot manifest revision: `hard-53x3-diversity-pilot-v1-manifest-r1`.
- Overlay artifact canonical hash: `9eaf8dc3a64cf68830ea0ec734b8ea6aba0fe67304d8033765125ce6fb6139f0`.
- Overlay instances hash: `9ccffd150764176162ca759c4b9f414c3b308f60a967e6e33e322e0e1968f3a0`.
- Public projection canonical hash: `0d979fee615c16e3132562fb53d64a5586f234d9b747741fb55f83355ce4bb3b`.
- Manifest raw hash/policy pin: `fcc1d6c86556f1c6021ac40f4bbe85f33f4bf7d16889210cd8108da6ce74141d`.
- Pilot trusted validation: 26/26 replayed, 26/26 structural families, `releaseAcceptance=true`.

Frozen baseline checks remained unchanged:

- Artifact canonical hash: `11005e04e359fff9d0d3a0fec66dd491ca8e441f5c5c880e1ff3441b9fc77da3`.
- Instances hash: `40c4ea586dfeafb5f5e37545101220451d2cc9a9ca2ab54eb9d00a94806c8375`.
- Solver projection canonical hash: `52b07a352c8da0215bd4e052c08262b2255aa094d1cddd9635a75f5ea68bf15a`.
- Current r2 manifest raw hash: `c26501aaed729f5eaa693e0988b3fd7df402b1d7b8a854582d46a2290c9ddfa0`.
- Current r2 validation: 53/53 replayed, `releaseAcceptance=true`.

The public pilot projection contains only instance ID, track, target ID, target, available inputs and public rules. It contains no core basis, witness, bridge, generation trace, causal graph or proof-side metadata.

## Regression

`node --test tests/benchmark.test.mjs`: 39/39 passed. This includes structural metamorphic regressions and Pin, Crystal, Mixed, expansion, identity and release-validation tests. Solver was not run.

## Recommendation

Pilot passed; full Hard 53x3 staged diversity generation may proceed. Retain environment-diversity ranking pressure for the process-heavy targets and keep the frozen Hard 53x1 artifact external and immutable until the final 159-instance release is assembled.
