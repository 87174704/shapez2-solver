# Benchmark Builder Status

Last verified: 2026-09-23 (Asia/Shanghai)

## Current phase

Final Targeted Acceptance for the Hard 53×3 selection is **PASS** and the diversity phase is **FROZEN**. The deterministic selection contains 53 baseline families, 64 retained original B families, and 42 frozen replacements (C=1, D=7, E=34), for 159 instances across all 53 official targets. Canonical replay and expansion are 159/159, and every target has three unique replay-derived structural fingerprints. The final selection identity is `6e3efdece360e8dd338a49dd3edd8fe10620b288aa161d35a8d01ab966e1b47f`. See `benchmarks/final-targeted-acceptance/v1/REPORT.md`.

The formal provenance-preserving composite release `hard-53x3-stage-v1` is now established with composite manifest schema v4 and manifest revision `hard-53x3-stage-v1-manifest-r1`. Its canonical identity is `5836350ed30779f76fa32a6d4e9dce3628f7b5a554dfc4cb4e512c3b1ffe72db`. The manifest contains no copied benchmark instances: 159 member references select immutable instances from six source artifacts, and validation resolves provenance, replay, expansion, and fingerprints at 159/159 while reconstructing the exact frozen final-selection hash. Fourteen frozen source/decision bindings and fifteen repository authority bindings are independently checked. GPT-6 Astra Medium independently audited the design and implementation as PASS with no critical unresolved issue. The final repository suite passed 107/107. Hard 53×5 expansion, Solver baselining/optimization, new diversity search, and benchmark-content changes remain out of scope.

## Composite release v4

- `benchmarks/releases/hard-53x3-stage-v1.release.json` separates selection from source ownership through an explicit source registry and member references.
- `benchmarks/policy/composite-releases.v1.json` pins the trusted canonical composite identity while allowing JSON whitespace and object-key ordering to vary.
- Every member binds target, F1/F2/F3 slot, source identity, source instance identity, structural signature, family identity, and its complete frozen selection-entry hash.
- The validator rejects selection/source/member substitution, 158/160 cardinality, duplicate references, family collapse, missing sources, source mutation, authority-file substitution, and provenance discontinuity without changing old v1/v2/v3 validation semantics.
- The 11-case negative tamper set passed 11/11; the complete composite test file passed 14/14.

## Input Environment Expansion pilot

- schema v3 separates `coreWitnessBasis` from Solver-facing `availableInputs`;
- 6 instances cover 3 official targets, with two different presented environments per target;
- 4 are additive and 2 are transformative full-shape substitutions with replayed Cutter preprocessing;
- `hard-main-010` preserves the non-uniform Crystal construction; `hard-side-021` preserves the Pin subassembly construction;
- all 6 replay from presented inputs to exact targets; no Solver result was consulted;
- the separate `solver-inputs.json` export contains neither core basis nor witness, is release-bound, and is mechanically checked against the full artifact.

Current expansion limitations: arbitrary replacement planning and general multi-input preprocessing bridges are unsupported. The v1 pilot adapter only accepts explicit unary canonical derivation chains. Random unrelated fillers and preassigned input-role labels are intentionally absent.

## Acceptance boundary

- Ajv 2020-12 now executes catalog, instance, artifact, and release-manifest schemas.
- Release identity is split into immutable artifact content identity (`artifactReleaseId`, retained as artifact `releaseId`) and immutable trust-declaration revision identity (`manifestRevisionId`). The current policy maps profile → manifest revision → artifact release and retains the v1 manifests in a historical registry.
- `benchmarks/policy/official-policy.v1.json`—not artifact metadata—fixes supported versions, release profiles, suite/partition, seed/catalog/semantics/target hashes, complete membership, cardinality, cleanPainting, Splitter state, and Pilot quality gates.
- The validator rebuilds all 53 Hard target identities from `hard_main.txt` and `hard_side.txt`, compares them with the pinned official manifest, mechanically compares catalog payload with the pinned human seed, and verifies canonical semantics file hashes.
- The release manifest binds the canonical content of the actual accepted artifact. External copies with identical JSON content pass independent of path/formatting; mutations cannot regain trust by recomputing self hashes.
- Regression tests cover ten release-owned metadata/witness mutations, unknown version/release, controlled partition profiles, incomplete membership, nonofficial target, seed/catalog drift, forged provenance, schema extra fields, and solver projection consistency.

## Documentation-correction manifest revisions

Four manifest-r2 revisions were created solely because trusted `BENCHMARK_RULES.md` received a historical documentation correction. Benchmark instances, witnesses, public solver inputs, mechanics and normative rules were unchanged. The correction records that the original `hard-main-012` defect was a report-layer hallucination and that later classifier work was robustness hardening. These are new immutable trust-declaration revisions, not new benchmark generation releases:

- `hard-pilot-audit-v2-manifest-r2` → artifact release `hard-pilot-audit-v2`;
- `hard-coverage-pilot-v1-manifest-r2` → artifact release `hard-coverage-pilot-v1`;
- `hard-expansion-pilot-v1-manifest-r2` → artifact release `hard-expansion-pilot-v1`;
- `hard-53x1-stage-v1-manifest-r2` → artifact release `hard-53x1-stage-v1`.

The four original v1 manifest files remain unchanged and are registered as historical identities. Current trusted-policy pins select the r2 revisions.

## Refinement report error and classifier hardening

The original defect was a report-layer hallucination, not an executable classification bug or a user-rule ambiguity. The real `hard-main-012` target is `cwP---P-:--cw--cw:RrWrYwWr:Yk------`. When C+D was first reported, the executable classifier already preserved both module type and color; it parsed the refinement features as `Yw` and `Yk` and classified the target as D only. The Agent instead misread or confused `Yk` with `Xk` in natural-language reporting and therefore incorrectly claimed that Groups C and D were both involved. Group C requires `Xw`/`Xk`.

At that time the generator selected the D bundle, the validator accepted that D bundle, and the validator already rejected a C bundle for this target. Later classifier-related engineering work was robustness hardening: clearer feature-key representation, explicit unique-group classification, catalog-overlap detection, explicit unknown/mixed-group errors, a shared deterministic classifier path for generator and validator, and regression coverage. It did not correct a historical color-only classifier or restore previously lost X/Y type information. The historical and current classifiers agree on `hard-main-012`: D only; the current code has no regression.

The existing 25-instance Pilot does not contain `hard-main-012`. Subsequent read-only release validation mechanically replayed all 25: affected 0, unaffected 25, accepted 25, rejected 0. No Pilot instance was regenerated or rewritten. This issue is closed and must not be listed as requiring user clarification.

## Existing 25 Pilot re-audit

The original `benchmarks/pilot/v1` files remain unchanged as historical artifacts. `benchmarks/pilot/v2` preserves every input and witness and changes only repository-bound provenance, mechanically derived metadata and structural-family classification.

| Target | Instances | Distinct structural families | Structural duplicates |
|---|---:|---:|---:|
| `hard-side-006` | 5 | 5 | 0 |
| `hard-side-007` | 5 | 5 | 0 |
| `hard-side-018` | 5 | 5 | 0 |
| `hard-side-021` | 5 | 5 | 0 |
| `hard-side-035` | 5 | 5 | 0 |
| **Total** | **25** | **25** | **0** |

All 25 forward witnesses remain valid. The earlier v2 collapse to five families is superseded because `prepared-piece` discarded meaningful source ancestry. Replay-backed causal v3 preserves those source graphs while eliminating identity Cutter chains, token relabeling, independent scheduling and unrelated terminal byproducts. The resulting 25-family classification awaits independent re-audit.

## Coverage pilot

The new `hard-coverage-pilot-v1` contains 5 instances, not 265. All replay forward to official targets and exist only to exercise generation capability:

- main + catalog half-chunk construction: `hard-main-004`;
- Group B + non-uniform Crystal scaffold/extraction: `hard-main-010`;
- shared occurrence reuse + meaningful Pin subassembly: `hard-side-021`;
- Group C + Cutter byproduct/shared refinement occurrence reuse: `hard-side-039`;
- Group D + partial selection from its required ×2 availability bundle: `hard-side-041`.

No current-Solver outcome was consulted.

## Rule alignment

- `cleanPainting` is now honored by replay; formal profiles fix it to true.
- duplicate input rows are aggregated correctly for metadata and rejected at the formal artifact boundary until consolidated.
- Splitter is formally disabled. Whether 2048 or 4096 throughput constitutes success remains explicitly unresolved.
- `maximumAddedOrdinaryMultiplicity=3` now means total added ordinary occurrences in the expansion delta and is enforced by generator and validator.
- v3 partitions use a controlled enum for `expansion-pilot`, `development`, `validation`, and `holdout`; repository profiles still select the exact accepted value.

## Still unsupported / disclosed gaps

- Genuine unresolved rule question: Splitter throughput success semantics (split 2048 versus unsplit 4096). Splitter remains disabled and this does not affect the existing 25 Pilot.
- Implementation/evidence gaps, not user-rule ambiguities: external-game differential parity and several complex canonical-operation edge cases already listed in `GAME_SEMANTICS.md`.

Unsupported capabilities are recorded in `benchmarks/coverage-pilot/v1/capabilities.json` and candidate/rejection logs; no target is silently skipped or replaced.

## Audit readiness

Final Targeted Acceptance and the provenance-preserving `hard-53x3-stage-v1` composite release are complete and independently audited by GPT-6 Astra Medium with no critical unresolved issue. The repository is authorized to claim this formal Hard 53×3 release only at the exact composite and final-selection identities recorded above. It is not authorized to claim a complete 53×5 Hard corpus; full expansion and all Solver work remain paused until separately requested.
