# Hard 53×3 Formal Solver Baseline Audit

Audit date: 2026-09-24 (Asia/Shanghai)

Auditor: GPT-6 Astra Medium, read-only independent audit

## Scope

The audit was restricted to baseline methodology and evidence integrity. It checked configuration freeze, benchmark leakage, terminal-cause classification, exact membership, mechanical statistics, omissions, source identities, and whether Solver search semantics changed. It did not propose or implement Solver optimization.

## Audited identity

- Baseline ID: `hard-53x3-solver-baseline-v1`
- Baseline canonical hash: `a23979099a2ae0dc7c8fa0a77c89ffa77d23fc82170e38690de000b708082661`
- Benchmark canonical identity: `5836350ed30779f76fa32a6d4e9dce3628f7b5a554dfc4cb4e512c3b1ffe72db`
- Final-selection hash: `6e3efdece360e8dd338a49dd3edd8fe10620b288aa161d35a8d01ab966e1b47f`
- Solver code identity: `68f2be34f9737204a69f1db2c83463c76e9a3110732f829da916ae5d14aba873`
- Configuration hash: `2ed7ea7b1d6af5d8c81e7b4a3baa9277a41cfb8c460947b8664706058ddab009`
- Membership hash: `2d575703b6f014a18280368e3924a9f9e08697aacec5579f6e1ab536591aade3`
- Result hash: `b5280ee921365f7dcbaaaed900aba040c49e3b3dedcd89c9af181f659ee0d987`

## Independent checks

- Revalidated the released composite trust chain at 159/159 and exact 53-target/three-family membership.
- Verified all 159 per-record canonical hashes, metadata links, configuration links, unique membership, and actual terminal-cause mappings.
- Reconstructed aggregate and failure-landscape counts and independently recalculated all six reported quantile distributions.
- Rebuilt membership, result, configuration, runner, Solver, and baseline identities and matched the stored values.
- Compared current Solver and runner sources with the frozen identities and verified the tracked-diff identity used by the run.
- Ran the full Node test suite independently: 112/112 passed.
- Found no benchmark source mutation, no missing result, no result substitution, no configuration drift, and no Solver search-semantic modification attributable to the baseline work.

## Result

`PASS` — no blocking issue and no Astra High escalation.

## Non-blocking evidence limits

- The formal run used isolated Node subprocesses, not the browser Worker path, so timing and RSS must not be presented as browser measurements.
- Production `statesExplored` is an accepted/visited-state counter rather than exact expanded-state instrumentation.
- Frontier values are sampled progress values, not a continuously measured peak.
- The `ordinary-only` metadata tag overlaps Pin/Crystal tags; exclusive mechanism aggregates must be used for class comparisons.
- The released composite contains all 53 Hard targets, so the former manifest-v1 Hard holdout is now observed.

These limits are disclosed in the frozen report and do not block the baseline's use as the formal optimization comparison point.
