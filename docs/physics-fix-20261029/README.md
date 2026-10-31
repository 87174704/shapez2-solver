# Physics fix evidence scope

The accepted patch replaces path-dependent DFS failure caching with floor-anchored
least support closure. It collects fused crystal components before any deletion,
then removes each triggered component completely. Existing movement scheduling,
collision, truncation and Solver search are unchanged.

The [current release description](../release/PHYSICS_V2.md) and
[implementation semantics](../../versions/SEMANTICS_V2.md) describe the public
candidate. Tests include an independent per-root BFS, all-pairs closure, whole
component assertions, symmetry and layer boundaries, and 2,048 bounded inputs.

Original dated investigation reports and complete logs are preserved in the
external Phase D evidence archive, with their original bytes and hashes. They
describe earlier stages, including the former v1 identity failures; their old
BLOCKED/uncommitted statements are historical, not the current candidate status.
No complete game-version certification or stable performance change is claimed.
