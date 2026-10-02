# P6-03 Retained-Candidate Observer and Ordered Gate

Status: `P6-03 GATE: BLOCKED`  
E-004 status: `BLOCKED / NOT RUN`

This evidence task is bound to released benchmark identity `5836350ed30779f76fa32a6d4e9dce3628f7b5a554dfc4cb4e512c3b1ffe72db` and formal Solver baseline `a23979099a2ae0dc7c8fa0a77c89ffa77d23fc82170e38690de000b708082661`. No frozen benchmark, release, baseline, or P6-02 profiling artifact was modified.

## Implemented evidence infrastructure

- `shapeSolverTestOnly(...)` accepts a test-only passive observer. The public positional Solver API and Worker protocol are unchanged.
- The observer records ordered shape births, operation inputs and outputs, candidate ranking, existing candidate materialization, collector decisions, frontier order, limit decisions, and identity lifecycle sets.
- A ranking-precheck loser that is already lazy does not invoke its candidate factory, clone its inventory, or build a state key solely for observation.
- Small fixtures cover Swapper output order, both Stacker operand directions, score/sequence FIFO retention, streaming events, D-024 generated/visited/shape/time boundaries, partial Cutter output overflow, legal `[]`, and invalid `null`.
- The fixed eight-case shape-cap runner resolves inputs through the released composite and formal baseline records. It never copies target or input shape codes into the runner and writes only to `benchmarks/profiling/hard-53x3-p6-03-v1/`.

## Measurement

All eight P6-02 shape-cap cases retained exact frozen outcome, depth, accepted/visited states, generated candidates, beam-pruned flag, and null solution signature in both plain and observer fresh processes.

| Metric through the original cap | Total across 8 cases | Fraction of operation-output births |
| --- | ---: | ---: |
| Distinct operation-output births | 1,199,836 | 100% |
| Entered existing candidate materialization | 329,188 | 27.4361% |
| Never entered candidate materialization | 870,648 | 72.5639% |
| Seen in final retained frontiers | 165,168 | 13.7659% |
| Seen in expanded states | 162,224 | 13.5205% |
| D-024 shape slots charged | 1,200,000 | not a savings metric |

The descriptor code payload proxy totaled 70,558,338 UTF-16 bytes across eight independent processes; per case it ranged from 6,841,968 to 9,901,770 bytes with a median of 9,255,435. This excludes JavaScript object, Set/Map, allocator, cache, and Shape-object overhead.

The observer-minus-plain fresh-process Node peak-RSS delta was positive in all eight single pairs: +2.79 to +56.53 MiB, median +35.46 MiB. This measures the cost of adding the observer ledger beside the eager implementation. It is not a deferred-backend net-memory estimate, is not a repeated timing experiment, and is not browser Worker memory evidence.

Machine-readable aggregate: `benchmarks/profiling/hard-53x3-p6-03-v1/analysis.json`, SHA-256 `BA7AF6E3EC4515878BB7B88195E0738627AA597D7A95A8F206FC96277CF073BE`.

## Blocking interpretation

The 72.5639% value is an inventory/state-key demand result, not a heavyweight Shape-object savings result. Operation outputs call `getCachedSimilarity()` before collector ranking, and similarity can call `getShapeObject()`. A ranking loser can therefore avoid `materializeCandidate()` while still requiring a parsed Shape for scoring.

D-024 also requires every distinct operation output to consume one shape slot at its eager encounter point. A compliant storage-only design must preserve that slot, a deterministic ordering identity, output order, and cache behavior. It cannot move any of the eight cases past the old shape cap. Omitting loser slots would be an explicit resource-semantic experiment, not behavior-preserving E-004.

The observer establishes a reusable trace foundation but not the complete ordered-equivalence oracle required by D-029. The current fixed assertions do not freeze a complete trace/digest across colored operations, Splitter/coarseness/token order, target-layer score bonuses, operation-cache eviction/FIFO, and all initialization paths. No independent deferred backend exists to compare against that oracle.

## Verification and audit

- Focused observer/limit/profile tests: 9/9 passed.
- Full repository suite: 120/120 passed.
- Quick W1: solved at depth 6 with 3,612 states and 106,816 candidates.
- Syntax: 67 JavaScript/module files passed `node --check`.
- Solver copies are byte-identical at SHA-256 `EE558425BBC1761C5F01B82BB72D02F4D7DD611208C083D7355827600E518A37`.
- `git diff --check` passed apart from informational LF/CRLF warnings.
- GPT-6 Astra Medium independently recomputed membership, identities, all eight logical signatures, aggregates, and hashes. It returned `BLOCKED` for the overall P6-03 gate, accepted the observer/data as useful evidence, kept E-004 blocked, and found no reason to escalate to Astra High.

## Decision

Keep the test-only observer, ordered event seam, fixtures, runner, and measurement artifact. P6-03 does not authorize E-004. The next Solver step, if explicitly selected, is further evidence work: freeze a complete representative ordered trace suite and measure pre-ranking Shape-object/cache demand. Do not implement deferred identity or alter D-024 accounting without a new reviewed gate and, for budget deferral, an explicit search/resource-semantic decision.
