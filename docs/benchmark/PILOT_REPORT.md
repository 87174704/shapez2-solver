# Hard Benchmark Pilot Report

Date: 2026-09-15; refinement-classification re-audit verified 2026-09-22

> Current causal-v3 re-audit candidate: forward solvability remains 25/25. The operation-sequence/strategy-label signature and the later v2 `prepared-piece = final shape + source kind` collapse are both superseded. Replay-backed causal graphs retain meaningful source ancestry and find 25 families; identity/no-op rewrites remain in the same family. `pilot/v1` is retained unchanged for history. This conclusion awaits independent acceptance re-audit.

## Result

The Benchmark Builder Pilot produced 25 independently replayable instances for 5 representative official Hard development targets. Each target has 5 distinct `(input multiset, target)` instances. No current-Solver run, solve rate, timeout, or search result was used to generate, accept, reject, or rank them.

A subsequent refinement-classification audit established that the earlier C+D conclusion was a report-layer hallucination, not an executable classification bug. The real `hard-main-012` target is `cwP---P-:--cw--cw:RrWrYwWr:Yk------`. When C+D was first reported, the executable classifier already retained module type and color, parsed only `Yw` and `Yk`, and returned D only. The Agent misread or confused `Yk` with `Xk` in natural-language reporting. The generator selected the D bundle, the validator accepted it, and the validator already rejected a C bundle. This is not a rule ambiguity and no user clarification is required. `hard-main-012` is not part of the 25-instance Pilot, so affected instances remain 0; all 25 were revalidated in place without regenerating or rewriting any input or witness.

Selected coverage:

| Target | Structure | Instances |
|---|---|---:|
| `hard-side-006` | 3 full layers, mixed types/colors | 5 |
| `hard-side-007` | 4 layers, partial top, asymmetric colors | 5 |
| `hard-side-018` | 4 layers, partial base, mixed types/colors | 5 |
| `hard-side-021` | 4 layers with an internal full pin layer | 5 |
| `hard-side-035` | Group A refinement plus full red crystal base | 5 |

## 1. Specification and schema

Rules are formalized in `BENCHMARK_RULES.md`; canonical game behavior is recorded in `GAME_SEMANTICS.md`; generation, validation and partition methodology are in `BENCHMARK_METHODOLOGY.md`. `benchmark-instance.v1.schema.json` treats inputs as counted available multisets and stores immutable target provenance, constructive strategy, forward token-lineage witness, mechanically derived difficulty/diversity metadata, and integrity hash.

The generated input catalog is a provenance-bearing copy of the owner seed, not a reinterpretation. v1 uses the stricter hard maximum of 3 for ordinary multiplicity and at most one pure type.

## 2. Can the validator independently prove solvability?

Yes with a precise scope: it proves every accepted instance has a legal forward constructive witness under the repository's current canonical game semantics, without importing or executing Solver search. It checks that initial witness tokens are a multiplicity-bounded subset of the available inputs, consumes token IDs at most once, recomputes every operation using `shapeOperations.js`, validates every intermediate output, and requires the declared result to equal the official target byte-for-byte. It does not require all available inputs/refinement members to be selected or consumed, and it permits terminal byproducts.

All 25/25 committed witnesses pass. Negative tests show that forged lineage, use of an unavailable resource, forged outputs, invalid final IDs, excluded raw shapes, multiplicity 4, forbidden main `SuSuRuRu`, incomplete/mixed refinement groups, overlapping refinement feature definitions, and wrong refinement bundles are rejected. Positive tests show that an unused ordinary input, unused refinement group members, and a live terminal Cutter byproduct are legal. Classification tests separately cover A-only, B-only, C-only, D-only, no-refinement, and invalid mixed-group targets.

Replay shares only the canonical deterministic operation layer with Solver. Its search, beam, heuristic, pruning and ranking are not used. This is not an external-game differential proof; that disclosed evidence boundary is recorded in `BENCHMARK_STATUS.md` and `GAME_SEMANTICS.md`.

## 3. Candidate and accepted counts

- Deterministic candidates attempted: 25
- Accepted: 25
- Rejected: 0
- Targets: 5
- Accepted per target: exactly 5
- Artifact SHA-256: `b0982e5c14faa5bdd9846c32594a6ba0cf39e0111c702faf72bb597e0d166d28`

The post-fix and semantics-migration in-place audits did not regenerate or rewrite the artifact:

- Affected existing instances: 0
- Unaffected existing instances: 25
- Accepted after revalidation: 25
- Rejected after revalidation: 0

The zero rejection count means the first five deterministic seeds for each selected supported template passed all gates; it does not imply unsupported Hard targets are easy or constructible by current templates. Candidate logging is retained for future rejection evidence.

## 4. Simple/trivial bias audit

No Pilot instance uses a pure input or the target itself. Ten instances exercise repeated multiset entries, with maximum multiplicity 3. Two side instances legally include `SuSuRuRu`; no refinement instance does.

Descriptive ranges across 25 instances:

| Metric | Minimum | Mean | Maximum |
|---|---:|---:|---:|
| Witness operations | 19 | 63.48 | 91 |
| Witness dependency depth | 9 | 11.12 | 13 |
| Input occurrences | 6 | 12.00 | 15 |
| Distinct input types | 4 | 9.08 | 15 |
| Live non-result tokens | 7 | 17.16 | 24 |

The maximum observed same-target input weighted Jaccard is 0.60, below the 0.84 gate, and the canonical input multisets remain unique. The original label/sequence rationale for uniqueness remains withdrawn. Under replay-backed causal v3, token IDs, independent scheduling, rotations, identity Cutter chains and unrelated terminal byproducts normalize away, while the five variants per target retain genuinely different resource ancestry; the current mechanical result is five families per target.

These signals show the Pilot is not dominated by direct or pure-material sanity cases. They do not establish optimal recipe length or empirical Solver difficulty; no Solver measurement was performed, by design.

## 5. Confirmed report error, classifier hardening, and remaining ambiguities

The original defect was in natural-language reporting. The target, parser, executable feature extraction and classifier already preserved the `X` versus `Y` module type together with color. For `hard-main-012`, the executable path saw `Yw`/`Yk` and returned D only; C appeared only after the Agent misread or confused `Yk` with `Xk` in the report. The executable path did not use a color-only rule.

Later classifier-related changes were robustness hardening: clearer feature-key representation, explicit unique-group classification, catalog-overlap detection, explicit errors for unknown or mixed groups, a shared deterministic classifier path for generator and validator, and regression coverage. They must not be interpreted as a correctness fix for a former color-only classifier. Both before and after that hardening, `hard-main-012` returns D only, the generator selects `YkYkYwYw ×2`, the validator accepts the D bundle and rejects a C bundle, and the current code has no regression. Agent prose has no authority in this deterministic path.

The latest `USER_RULES.md` resolves the former availability questions: all inputs are available resources rather than a mandatory minimal-consumption recipe; the complete refinement bundle must be provided but `witness.initial` may select only a legal subset; unused inputs and legal byproducts are allowed. These are implemented rules, not user-clarification blockers. The live-waste table above remains comparable because all 25 committed witnesses happen to enumerate the full available environment; future subset witnesses distinguish unselected availability (`unusedAvailableInputCount`) from live selected waste (`liveWasteCount`).

No user clarification is needed for refinement classification or for acceptance of these 25 instances. The one genuine unresolved rule outside this Pilot is Splitter throughput success semantics (whether split 2048 or unsplit 4096 is the success quantity); Splitter remains disabled, so that question does not affect the 25-instance result. Canonical operation tests cover representative Pin insertion/overflow, Crystal generation/connectivity/breakage, Stack gravity, four-layer overflow, Cut and Half Destroyer behavior. Complex mixed Pin/Crystal gravity, Crystal-containing Stack overflow, Swapper multi-component breakage, and external game parity remain disclosed implementation/evidence gaps rather than user-rule ambiguities, and they do not block an independent audit of these 25 against the selected canonical implementation.

No ambiguity was resolved by weakening an input rule or by consulting Solver success.

## 5a. Structural re-audit result

| Target | Families | Duplicate instances |
|---|---:|---|
| `hard-side-006` | 1 | pilot-02 through pilot-05 |
| `hard-side-007` | 1 | pilot-02 through pilot-05 |
| `hard-side-018` | 1 | pilot-02 through pilot-05 |
| `hard-side-021` | 1 | pilot-02 through pilot-05 |
| `hard-side-035` | 1 | pilot-02 through pilot-05 |

All five instances for each target are representatives under causal v3 because their replay-backed source ancestry differs. If future instances share a recomputed signature, the first in stable artifact order is the representative and later instances must point to it as structural duplicates.

## 6. Before expanding to 53×5

The 25 forward witnesses remain suitable evidence of solvability, but `pilot/v1` signatures are not structural authority. Independent audit should use the repository-bound `pilot/v2` artifact with causal-v3 signatures, its structure audit and the separate coverage pilot. Any 53×5 expansion remains paused, as does Solver optimization.
