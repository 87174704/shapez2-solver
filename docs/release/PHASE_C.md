# Phase C history and current RC publication boundary

Phase C prepared a separate maintenance repository at commit
`796fe5ef8228dbcaad7eec0de369770e9cd38694`, tree
`1844572b6548a155588feab5486ecac4bfe3ba0e`. Its six preparation commits and its
actual upstream `main` (`ba626467641243088993d5486e7f22bc455bae69`, 87 commits)
remain preserved in that separate repository. Its imported maintenance history
and upstream history have no common ancestor. They have not been merged,
rebased, bridged or rewritten. The original eight maintenance commits are bound
by [frozen-maintenance.json](frozen-maintenance.json).

Phase D prepares Physics v2 directly on `codex/crystal-physics-fix-20261029`,
descending from `0647b8502f75145936faf8fbcde7cf2ab5371f75`. It imports reviewed
Phase C license/provenance/verification files as new commits, adapting CI and
current reproduction documentation to v2. The separate Phase C branch tip is
not the v2 RC and must not be used as its publication source. The local `main`
of the RC working repository is still the imported maintenance baseline; it is
not the independent upstream main. Do not infer target refs from local names.

Original `hard-capable-v1` tag object remains
`c27b895537907c85b5e32ad6cbf9263549e4613e`, target
`f62683a3be7e826c8c764afcee4977114b15a9f0`. No new public tag is created.
Author/committer/tagger fields, dates, messages and original object IDs remain
intact. Prior history is not anonymized or rewritten.

The previously selected prospective destination is `87174704/shapez2-solver`,
using a native Fork of Vystel's project and retaining its independent upstream
main. Account permission, current destination state and first public operation
approval require a later authorized check. Phase C's old API/login observations
are dated evidence, not current account or permission validation. The owner’s
scoped MIT decision and accepted historical-source disclosure are retained;
third-party boundaries remain in the legal documents.

Use the [new publication plan](PUBLISH_PLAN.md), with the final external RC seal.
The old Phase C refspecs and candidate object list are superseded. This round
does not create a Fork, remote branch, release tag, push or deployment.
