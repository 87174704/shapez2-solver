# Target-Conditioned Candidate Generation

Status: PROVISIONAL / STOPPED  
Experiment: P6-04 / E-005  
Formal baseline: `a23979099a2ae0dc7c8fa0a77c89ffa77d23fc82170e38690de000b708082661` (0/159)

## Objective

Demonstrate real Solver capability progress, not another engineering-only PASS. The experiment succeeds only through stable replay-valid solves on the frozen 159 membership. Search order and representation may change; game operations, finite resources, option semantics, and replay correctness may not.

## Architecture

The ordinary-target first stage uses a resource-disjoint construction chart rather than whole-inventory breadth expansion. Each supplied starting item receives one resource bit. A chart node is a shape plus the exact resource mask used to construct it and a replayable plan. Unary operations preserve the mask. Binary operations are generated only for disjoint masks and produce their union, so an input item cannot be consumed twice.

Target conditioning is computed from the target shape itself. Rotations and vertical placements define compatible subgoals. A shape is target-compatible only when every occupied cell can map to the same target part type and an attainable target color; empty cells do not claim coverage. Cut, rotation, and clean-paint steps may prepare a relevant raw input. Stacker and Swapper pairs are attempted only when their inputs contain target-relevant material, and their outputs enter the chart only when they are target-compatible or pass the predeclared progressive preparatory rule.

The implementation receives no benchmark identity or generation data. There is no targetId branch, shape-code recipe table, hidden witness access, construction-metadata access, or benchmark-shape special case.

## Known incompleteness

This first chart may discard unused siblings from Cutter/Swapper and therefore cannot exploit two siblings from one physical call later in the same plan. Dominance keeps a same-shape plan only when it uses a subset of resources at no greater operation cost; this is safe for future disjoint composition. Admission itself is heuristic and intentionally incomplete. A miss is not a proof of unsolvability.

## Staged gates

1. Unit-level target analysis and resource-mask dominance.
2. Small-domain exhaustive-oracle fixtures for legal coverage and false-positive prevention.
3. Replay validation of every returned solution.
4. One frozen formal configuration over 159 fresh processes, followed by fresh-process repetition of solved members.
5. Only if the first configuration misses ACCEPT, the single frozen fallback configuration may run.

## Verdict

- ACCEPT: at least three stable replay-valid solved members spanning at least two targets.
- PROVISIONAL: at least one stable replay-valid solved member but below ACCEPT.
- REJECT: any invalid replay, or zero solved after both frozen configurations.

After the verdict, stop and report. No second architecture experiment is authorized.

## Result

Both frozen configurations solved and independently repeated the same two members: `hard-main-001:F1` and `hard-main-001:F2`. Every returned path was replay-valid and had nine operations. This is stable 2/159 across one target, below the ACCEPT requirement of 3/159 across two targets, so the final verdict is PROVISIONAL.

TCG-A outcome counts were 2 SOLVED, 70 LIMIT, 78 UNSUPPORTED_DOMAIN, and 9 EXHAUSTED. TCG-B counts were 2, 71, 78, and 8 respectively. There were no ERROR or WATCHDOG outcomes. The experiment is stopped; no third configuration or second architecture experiment is authorized.
