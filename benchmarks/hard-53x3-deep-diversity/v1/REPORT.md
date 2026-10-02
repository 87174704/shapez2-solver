# Hard 53×3 Deep Macro-Plan Diversity Pass

Status: diversity quality acceptable → perform final depth re-audit

## Required 29

- C/D/E replacement found: 25
- still shallow: 1
- reclassified probably limited: 3

Depth distribution: {"D":15,"E":10}

| Target | Retained | Replaced | Depth | Macro topology | Environment | Status |
|---|---:|---:|---|---|---|---|
| hard-main-004 | F2 | F3 | E | chunked-upper-half-recomposition | 1 new types; J=0.583 | DEEP_REPLACEMENT_FOUND |
| hard-main-005 | F2 | F3 | D | pin-column-support-partition | 0 new types; J=0.667 | DEEP_REPLACEMENT_FOUND |
| hard-main-006 | F2 | F3 | D | pin-column-support-partition | 0 new types; J=0.643 | DEEP_REPLACEMENT_FOUND |
| hard-main-010 | F2 | F3 | - | - | - | STILL_SHALLOW |
| hard-main-011 | F2 | F3 | D | mixed-state-transition-routing | 0 new types; J=0.800 | DEEP_REPLACEMENT_FOUND |
| hard-side-021 | F2 | F3 | E | pin-column-support-partition | 3 new types; J=0.500 | DEEP_REPLACEMENT_FOUND |
| hard-side-024 | F2 | F3 | E | pin-column-support-partition | 0 new types; J=0.643 | DEEP_REPLACEMENT_FOUND |
| hard-side-026 | F2 | F3 | D | pin-column-support-partition | 0 new types; J=0.688 | DEEP_REPLACEMENT_FOUND |
| hard-side-028 | F2 | F3 | D | pin-column-support-partition | 0 new types; J=0.750 | DEEP_REPLACEMENT_FOUND |
| hard-side-029 | F2 | F3 | D | mixed-state-transition-routing | 0 new types; J=0.821 | DEEP_REPLACEMENT_FOUND |
| hard-side-031 | F2 | F3 | E | mixed-state-transition-routing | 8 new types; J=0.417 | DEEP_REPLACEMENT_FOUND |
| hard-side-032 | F2 | F3 | - | - | - | PROBABLY_LIMITED |
| hard-side-034 | F2 | F3 | - | - | - | PROBABLY_LIMITED |
| hard-side-035 | F2 | F3 | E | layer-local-crystal-staging | 18 new types; J=0.161 | DEEP_REPLACEMENT_FOUND |
| hard-side-037 | F2 | F3 | E | pin-column-support-partition | 0 new types; J=0.667 | DEEP_REPLACEMENT_FOUND |
| hard-side-039 | F2 | F3 | E | chunked-upper-half-recomposition | 0 new types; J=0.714 | DEEP_REPLACEMENT_FOUND |
| hard-side-040 | F2 | F3 | - | - | - | PROBABLY_LIMITED |
| hard-main-007 | F3 | F2 | D | mixed-state-transition-routing | 0 new types; J=0.860 | DEEP_REPLACEMENT_FOUND |
| hard-main-008 | F3 | F2 | D | alternate-crystal-staging-boundary | 4 new types; J=0.500 | DEEP_REPLACEMENT_FOUND |
| hard-main-009 | F3 | F2 | D | pin-column-support-partition | 2 new types; J=0.625 | DEEP_REPLACEMENT_FOUND |
| hard-main-012 | F3 | F2 | D | mixed-state-transition-routing | 1 new types; J=0.632 | DEEP_REPLACEMENT_FOUND |
| hard-side-022 | F3 | F2 | D | pin-column-support-partition | 0 new types; J=0.647 | DEEP_REPLACEMENT_FOUND |
| hard-side-023 | F3 | F2 | D | pin-column-support-partition | 0 new types; J=0.722 | DEEP_REPLACEMENT_FOUND |
| hard-side-025 | F3 | F2 | D | pin-column-support-partition | 0 new types; J=0.538 | DEEP_REPLACEMENT_FOUND |
| hard-side-030 | F3 | F2 | E | pin-mask-crystal-staging | 0 new types; J=0.346 | DEEP_REPLACEMENT_FOUND |
| hard-side-033 | F3 | F2 | E | pin-mask-crystal-staging | 1 new types; J=0.423 | DEEP_REPLACEMENT_FOUND |
| hard-side-036 | F3 | F2 | D | pin-column-support-partition | 7 new types; J=0.556 | DEEP_REPLACEMENT_FOUND |
| hard-side-038 | F3 | F2 | D | pin-column-support-partition | 2 new types; J=0.654 | DEEP_REPLACEMENT_FOUND |
| hard-side-041 | F3 | F2 | E | chunked-upper-half-recomposition | 1 new types; J=0.571 | DEEP_REPLACEMENT_FOUND |

## Macro-plan classes discovered

{
  "alternate-crystal-staging-boundary": 1,
  "chunked-upper-half-recomposition": 3,
  "layer-local-crystal-staging": 1,
  "mixed-state-transition-routing": 5,
  "pin-column-support-partition": 13,
  "pin-mask-crystal-staging": 2
}

## Unknown 21 feasibility

| Target | Classification | Evidence |
|---|---|---|
| hard-main-002 | DEEP_ROUTE_FOUND | replay-backed mechanism/state-transition routing differs |
| hard-main-003 | DEEP_ROUTE_FOUND | replay-backed mechanism/state-transition routing differs |
| hard-side-001 | DEEP_ROUTE_FOUND | replay-backed mechanism/state-transition routing differs |
| hard-side-002 | DEEP_ROUTE_FOUND | replay-backed mechanism/state-transition routing differs |
| hard-side-004 | DEEP_ROUTE_FOUND | replay-backed mechanism/state-transition routing differs |
| hard-side-006 | DEEP_ROUTE_FOUND | replay-backed mechanism/state-transition routing differs |
| hard-side-007 | DEEP_ROUTE_FOUND | replay-backed mechanism/state-transition routing differs |
| hard-side-008 | DEEP_ROUTE_FOUND | replay-backed mechanism/state-transition routing differs |
| hard-side-009 | DEEP_ROUTE_FOUND | replay-backed mechanism/state-transition routing differs |
| hard-side-010 | DEEP_ROUTE_FOUND | replay-backed mechanism/state-transition routing differs |
| hard-side-011 | DEEP_ROUTE_FOUND | replay-backed mechanism/state-transition routing differs |
| hard-side-012 | DEEP_ROUTE_FOUND | replay-backed mechanism/state-transition routing differs |
| hard-side-013 | DEEP_ROUTE_FOUND | replay-backed mechanism/state-transition routing differs |
| hard-side-014 | DEEP_ROUTE_FOUND | replay-backed mechanism/state-transition routing differs |
| hard-side-015 | DEEP_ROUTE_FOUND | replay-backed mechanism/state-transition routing differs |
| hard-side-016 | DEEP_ROUTE_FOUND | replay-backed mechanism/state-transition routing differs |
| hard-side-017 | DEEP_ROUTE_FOUND | replay-backed mechanism/state-transition routing differs |
| hard-side-018 | DEEP_ROUTE_FOUND | replay-backed mechanism/state-transition routing differs |
| hard-side-019 | DEEP_ROUTE_FOUND | replay-backed mechanism/state-transition routing differs |
| hard-side-020 | DEEP_ROUTE_FOUND | replay-backed mechanism/state-transition routing differs |
| hard-side-027 | DEEP_ROUTE_FOUND | component partition or merge DAG differs beyond resource preparation |

## Candidate funnel

{
  "macroCandidates": 282,
  "replayInvalid": 96,
  "expansionInvalid": 0,
  "structuralDuplicate": 12,
  "bOnly": 31,
  "cde": 143,
  "accepted": 25
}

## Integrity

- no baseline changes
- no retained pilot/rollout family changes
- no structural canonicalization changes
- no Solver filtering
- no artificial mechanism injection
- no composite release constructed
