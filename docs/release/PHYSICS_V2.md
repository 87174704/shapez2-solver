# Physics v2 Release Candidate

This local candidate uses `shape-operations-v2-support-closure`. It fixes two
audited defects in `shapeOperations.js`: path-dependent DFS false caching could
discard a supported cell; deleting crystals before collecting their fused graph
could stop shattering partway through a component. Support now starts only at
occupied floor anchors and propagates to a least fixed point. All triggered
crystal components are collected before deletion. The accepted production bytes
are unchanged during RC preparation; Solver algorithms and machine scheduling
receive no new changes.

## Version isolation

The [trust index](../../versions/index.json) pins independent
[v1](../../versions/shape-operations-v1.json) and
[v2](../../versions/shape-operations-v2-support-closure.json) manifests.
The historical baseline is `0647b8502f75145936faf8fbcde7cf2ab5371f75`.
V1 source SHA-256 is `c21fc3fcbff818e8c3bb85a84b47d5f975475aab0f6a81bb2e6d59aa66e3eb21`;
v2 is `3052ea5686bf7808cdefbee0d58347b3dcef812ea694d0a23bf1749e1be0bcc9`.
V2 semantics and runtime aggregates, acceptance file hashes, immutable inventory
and v1 parent identity remain exactly those accepted by the version gate.
Legacy v1 validators must reject the current physics; negative tests assert this.

Current applicable regression acceptance is 229 PASS, 0 FAIL. Node registers 242
tests: 13 are explicitly HISTORICAL_V1_ONLY, excluded from the v2 score. Original
callbacks are retained, and the original baseline tree is reconstructed and runs
198/198 separately, with no skips. These historical tests certify that committed
v1 tree, not the missing earlier Solver execution snapshot described in
[historical limitations](../benchmark/REPRODUCIBILITY.md).

## Frozen workload scope

All 461 original Benchmark files retain their pinned SHA-256 and Git blobs.
The 159/159 claim applies to the fixed 53-target × 3-family workload, with original
inputs, machines and parameters. It is not a completeness, optimality, holdout
or all-game-state claim. V1 rerun, current v2 and frozen E-014 paths are compared
exactly after solving. No witness is injected into search. Each returned path
and frozen solution is replayed for operation output and resource occurrence,
consumption, target, parameters and throughput. All 331 frozen witness instances
(30,158 steps) are replayed using production operations and an independent bounded
R1/R2/R3 model. The selected current paths contain 11,087 steps; selected witnesses
contain 15,150 steps. Selected paths, outputs and resource flows are unchanged.

367 historical controls, five helper controls and six public triggers exercise
the repaired behavior. Their 25 reviewed output corrections (20 Pin Pusher,
five Stacker) are distinct from the unchanged selected Benchmark outputs.
The control input fixtures are retained in
[tests/fixtures/physics-v2](../../tests/fixtures/physics-v2/).

## Reproduction and evidence

Follow [clean-clone verification](../benchmark/REPRODUCIBILITY.md). This runs the
current applicable tests, original v1 certification, frozen-record checks and
independent v2 acceptance, with exact source commit/tree and environment recorded
under ignored `.ci-results/`. Full previous logs, initial failed attempts and
the final RC manifest remain in the separately sealed local evidence archive.
The public Git tree contains source, tests, control inputs, version identities,
license/provenance documents and a verification-only workflow, without full logs,
dependencies or machine-specific evidence paths. The final Git SHA/tree are
recorded outside their own tree to avoid a self-referential identity.

## Remaining limits

Code, Benchmark and Version Gate acceptance is bounded by the recorded tests and
model. Complete game-version-specific physics certification remains UNKNOWN.
Earlier timing batches had mixed directions and substantial dispersion: neither
a stable improvement nor regression is established. No RC performance claim is
made. All reachable game states, browser/platform coverage, actual GitHub hosted
CI, native Fork metadata and remote permission remain UNKNOWN until tested.

[Licensing](../legal/LICENSING.md), [attribution](../legal/ATTRIBUTION.md) and
[third-party boundaries](../legal/THIRD_PARTY.md) remain separate documents.
The [publication plan](PUBLISH_PLAN.md) is preparatory; no remote operation,
release tag, deployment or production change is part of this RC.
