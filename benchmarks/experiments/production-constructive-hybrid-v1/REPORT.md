# E-015 Production constructive-hybrid activation

Status: **REJECT / STOPPED**

Formal baseline: `hard-53x3-solver-baseline-v1`, canonical SHA-256 `a23979099a2ae0dc7c8fa0a77c89ffa77d23fc82170e38690de000b708082661`.

## Frozen experiment

`PCHA-A` was the sole predeclared configuration. The evaluated candidate statically activated the unchanged E-014 cascade from public `shapeSolver` for the generic single-target, four-layer, orientation-insensitive, non-splitting, clean-painting domain, returning a construction when solved and otherwise falling back to the unchanged bounded search. Eligibility used only public arguments and no benchmark identity, member ID, witness, stored path, or prior result.

The first formal observation froze the candidate at Solver SHA-256 `876a3e5f494ecb8edd4392506fecf5bfc7f383a42162f3599a1a4a110cbd9191`.

## Formal capability result

- First pass through public `shapeSolver`: 159/159 `SOLVED`, all replay-valid, all using the constructive-hybrid route.
- Independent fresh-process repeat: 159/159 `SOLVED`, all replay-valid.
- Stability: 159/159 complete paths were identical between first pass and repeat.
- Frontier equality: 159/159 first-pass paths exactly matched the frozen E-014 repeat paths.
- Coverage: 159/159 members across 53/53 targets; empty formal failure distribution.
- Resource audit: zero public or derived token reuse.

This demonstrates a Node public-entry capability transfer from the frozen production baseline's 0/159 to 159/159. It does not add a benchmark member beyond the E-014 architecture frontier.

## Blocking correctness result

The predeclared real-browser gate failed after formal execution: a Chrome module Worker could not start even for an ineligible tiny legacy solve. Read-only diagnosis found that the new static import reaches `benchmarks/tools/benchmark-core.mjs`, which imports Node-only `node:fs/promises` and `node:crypto`. Node unit/formal processes resolve those modules, but the browser Worker cannot.

This is a public Worker correctness regression and therefore triggers the predeclared REJECT rule despite perfect formal coverage. The production activation was rolled back. After rollback, the complete suite passed 184/184, real Chrome Worker lifecycle verification passed, quick W1 retained depth 6 / 3,612 states / 106,816 candidates, the focused E-014 gate passed 6/6, all 111 JavaScript/module files passed syntax checks, and both production Solver copies returned to byte-identical SHA-256 `EE558425BBC1761C5F01B82BB72D02F4D7DD611208C083D7355827600E518A37`.

## Verdict

E-015 is **REJECT / STOPPED**. Formal capability passed, but the architecture failed its public deployment boundary. No tuning, browser-port implementation, eligibility change, fallback redesign, benchmark mutation, or second architecture experiment was started after the formal observation.

## Immutable identities

- Evaluated Solver SHA-256: `876a3e5f494ecb8edd4392506fecf5bfc7f383a42162f3599a1a4a110cbd9191`
- Rolled-back Solver SHA-256: `ee558425bbc1761c5f01b82bb72d02f4d7dd611208c083d7355827600e518a37`
- Frozen config SHA-256: `dc7391c86238ec84ff616c9b07bebac38ec6e82f5eede1a471f2a91f470e9a63`
- First-pass SHA-256: `f6d45980590e68f504535f23bb2b5d176a089ae801a7dd2c04730dfbb78114e0`
- Repeat SHA-256: `4697a61ea89bb285ae3326b4495ce058521a313b8f5d4148b533554479f7be48`
- Summary SHA-256: `c91eb0fd53b20d008d6ac6361c9bbffca4d82cbaaf6be58d6e6bfb24feb8f4eb`

The JSON artifacts are authoritative for the formal Node execution; the evaluated candidate source identity is frozen above. The browser gate and rollback determine the final architecture verdict.
