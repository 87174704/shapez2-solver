# Final Targeted Acceptance — Hard 53×3

Status: **FINAL TARGETED ACCEPTANCE: PASS**

Diversity phase: **FROZEN**

Verified: 2026-09-23 (Asia/Shanghai)

## Final selection identity

- Selection artifact: `benchmarks/final-targeted-acceptance/v1/final-selection.json`
- Canonicalization: `canonical-json-v1`
- Hash scope: the normalized 159 `slots` only, ordered by the bound official target order and then F1/F2/F3
- Canonical SHA-256: `6e3efdece360e8dd338a49dd3edd8fe10620b288aa161d35a8d01ab966e1b47f`
- The identity is independent of JSON formatting, object-property order, filesystem order, timestamps, and machine paths.

## Final 159 composition

| Category | Count |
|---|---:|
| Frozen baseline F1 | 53 |
| Retained original B families | 64 |
| Required deep replacements | 14 |
| Targeted re-selection replacements | 11 |
| `hard-main-010` accepted deep replacement | 1 |
| Frozen optional promotions | 16 |
| **Total** | **159** |

Membership is 12/12 main, 41/41 side, and 53/53 total. Every target has exactly F1/F2/F3 and three unique replay-derived structural fingerprints.

The 42 replacements are exactly the sum of the four frozen replacement categories above. They leave 64 of the original 106 B-family slots in place. No candidate was selected to make the counts match; the counts are post-reconstruction invariants.

## Depth accounting

- Retained formal B classifications: 64
- C replacements: 1
- D replacements: 7
- E replacements: 34

The C/D/E distribution was recalculated from the actual selected replacements and agrees with the frozen expectation. Existing classifications were copied from their decision artifacts, not reinterpreted.

## Mechanical acceptance

- Canonical replay: 159/159
- Expansion validation: 159/159
- Replay-derived fingerprint validation: 159/159
- Targets with three unique structural families: 53/53
- Solver-visible resource ceiling: `availableInputs`; replay rejected hidden or over-multiplicity resource use
- Solver filtering: not used
- Optional promotions: 16/16 resolve uniquely to the frozen mapping
- Optional negatives: 5/5 remain `KEEP_CURRENT_B_B`
- Rejected shallow, old overclassification, inflated/artificial, superseded deep-pass, and replaced staged candidates: absent

## Immutable identity chain

| Source | Canonical / bound identity |
|---|---|
| Baseline artifact | `11005e04e359fff9d0d3a0fec66dd491ca8e441f5c5c880e1ff3441b9fc77da3` |
| Baseline instances | `40c4ea586dfeafb5f5e37545101220451d2cc9a9ca2ab54eb9d00a94806c8375` |
| Diversity pilot artifact | `9eaf8dc3a64cf68830ea0ec734b8ea6aba0fe67304d8033765125ce6fb6139f0` |
| Diversity pilot instances | `9ccffd150764176162ca759c4b9f414c3b308f60a967e6e33e322e0e1968f3a0` |
| Rollout artifact | `36ffc2397f3fa5c29b0edf0840515c0159008e0bd91c41ac7f4d2407c12064ad` |
| Rollout instances | `874369d93095d0a4a69e130d15c36543d2072ff86870ec86106ab01501bf809e` |
| Deep-pass artifact | `e1430836207c556c2a7b0dd92d11d746446cce6106bf5e592c02a23efabf5172` |
| Deep-pass instances | `25e3ce318786f442b7c7953b2f968fe7e4e443f7b3aea6ff434cbcccdfb9ca65` |
| Optional candidates file | `9b823a8dace291b72b8dd8b6e6a52f7a3b6435282fc4945c6584b1f7d3c735f1` |
| Optional candidates canonical | `1992e8d284b83d5c3ab7d65b0be15e821e94d4134fb178122b9f86e30afc3718` |
| Optional source audit canonical | `c4ccd989b7cea374fc08dfd1307cffa7f34246f139c60304442b53a18f42691f` |
| Final re-selection artifact | `188fe904af003afb0d0a5f5615cd25824b4b1bb02ad73a046ed20db0de74430d` |
| Final re-selection instances | `0dc5efe6ba46f4a99be4f2f9faa9eef10a2ddd51ce32084cd825154063561e1d` |
| Optional promotion selection | `1adee7776f28ed10194108925dd21f4a0a9d591a945a6060e6a145ad17645989` |

The optional promotion selection identity uses its declared scope: every field except the self-referential `optionalPromotionSelectionHash` field. The final artifact additionally binds the canonical identities of the official manifest, catalog, expansion policy, deep target status, targeted re-selection mapping, and `hard-main-010` feasibility decision.

## Tests

- Frozen optional mapping: 1 passed, 0 failed, 0 skipped
- Final selection targeted tests: 3 passed, 0 failed, 0 skipped
- Relevant benchmark/depth/final suite: 50 passed, 0 failed, 0 skipped
- Full repository `npm test`: 93 passed, 0 failed, 0 skipped
- Browser Worker lifecycle check: PASS

## Independent audit

GPT-6 Astra Medium: **FINAL AUDIT: PASS**.

It independently checked all ten requested challenge areas, including 296 selected/original/retained/superseded references, the 16/5 optional decisions, the 42 replacement derivation, rejected-candidate exclusion, deterministic hash scope, Solver independence, and the provenance chain. It reported no critical unresolved issue, so Astra High was not invoked.

## Remaining corpus debt

Eleven targets retain both original B families under the frozen decisions:

- frozen optional negatives: `hard-side-001`, `hard-side-002`, `hard-side-004`, `hard-side-014`, `hard-side-019`;
- frozen `PROBABLY_LIMITED`: `hard-side-032`, `hard-side-034`, `hard-side-040`;
- no frozen replacement assigned: `hard-main-001`, `hard-side-003`, `hard-side-005`.

This debt is recorded, not reopened. It does not authorize another diversity search.

## Composite release blocker

The frozen v3 release format still cannot represent one composite corpus made from baseline, diversity pilot, rollout, deep-pass, optional-candidate, and targeted-reselection sources without rewriting their immutable provenance. Therefore no `hard-53x3-stage-v1` release was constructed or claimed.

## Next task

设计一个能够保留原始 provenance 的 Hard 53×3 composite release representation。

