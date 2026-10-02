# Final Diversity Depth Targeted Re-selection

Status: READY FOR FINAL TARGETED ACCEPTANCE

## 11-target re-selection

| Target | Recovered | Old rejected | New | Depth | Macro class | Baseline ops | Candidate ops | Earliest divergence | Rejoin | Decision |
|---|---:|---:|---:|---|---|---:|---:|---|---|---|
| hard-main-005 | yes | #3 | #6 | E | independent-half-swapper-assembly | 63 | 63 | result | Pin Pusher | ACCEPTED |
| hard-main-006 | yes | #3 | #8 | E | chunked-upper-half-recomposition | 54 | 57 | result | Pin Pusher | ACCEPTED |
| hard-main-007 | yes | #3 | #2 | D | mixed-state-transition-routing | 334 | 345 | result.children[0].children[1].children[1] | layers | ACCEPTED |
| hard-side-022 | yes | #1 | #6 | E | independent-half-swapper-assembly | 74 | 76 | result | Stacker | ACCEPTED |
| hard-side-023 | yes | #3 | #6 | E | independent-half-swapper-assembly | 90 | 91 | result | Stacker | ACCEPTED |
| hard-side-025 | yes | #2 | #10 | E | chunked-upper-half-recomposition | 49 | 53 | result | Pin Pusher | ACCEPTED |
| hard-side-026 | yes | #3 | #6 | E | independent-half-swapper-assembly | 70 | 70 | result | Pin Pusher | ACCEPTED |
| hard-side-028 | yes | #2 | #10 | E | chunked-upper-half-recomposition | 78 | 74 | result | compose | ACCEPTED |
| hard-side-031 | yes | #2 | #10 | E | chunked-upper-half-recomposition | 117 | 94 | result | resource | ACCEPTED |
| hard-side-035 | yes | #5 | #6 | E | pin-mask-crystal-staging | 25 | 40 | result.children[0] | resource | ACCEPTED |
| hard-side-036 | yes | #2 | #8 | E | chunked-upper-half-recomposition | 213 | 208 | result | Pin Pusher | ACCEPTED |

- 11/11 replacement found: 11
- remaining gaps: 0
- depth distribution: {"D":1,"E":10}

## hard-main-010

- macro classes searched: pin-mask-crystal-staging, column-first-assembly, independent-half-swapper-assembly, rotated-half-swapper-assembly, chunked-upper-half-recomposition, sparse-removable-solid-mask, sparse-removable-solid-mask-swapper-recomposition
- candidate count: 8
- replay failures: 6
- shallow collapses: 1
- deep candidates: 1
- final classification: DEEP_ROUTE_FOUND
- accepted signature: 405896738655ece7f5377acf409c547ca02fb25e1b76b958825e66b9204da552
- accepted operations: 81

## Proposed replacement total

30 accepted + 11 recovered + 1 hard-main-010 promotion = 42.

No final staged composition was written.

## Integrity

- baseline unchanged
- existing accepted candidate artifacts unchanged
- no structural canonicalization changes
- no schema/validator changes
- no composite release
- no Solver filtering
- no 53×5
- no Insane
