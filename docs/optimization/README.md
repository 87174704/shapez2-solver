# Optimization phase — closed historical record

This directory is the working record of the solver optimization phase that ended
with the `hard-capable-v1` annotated tag (`c27b8955…`, target `f62683a3…`) and the
later maintenance split. It is **history, not current operating policy**: nothing
in this directory constrains `codex/maintained`.

## What no longer applies

- `WORKFLOW.md` is not a durable operating contract. Its model/agent routing
  table, the requirement to read every file here and to keep five status
  documents updated, and its checkpoint protocol are not current instructions.
- The old rule that `shapeSolver.js` and `shapeSolver_web.js` must remain
  byte-identical is void. `shapeSolver_web.js` is a frozen Release 1 runtime
  artifact: do not edit it, do not copy it over the current Solver, and do not
  restore the byte-identity invariant.
- `RESUME.md`, `PROJECT_STATE.md`, `TASKS.md` and `RELEASE_CANDIDATE.md` describe
  superseded phases. Statements such as "current phase" are historical.
- The P8-05 remotes/deployment moratorium was a point-in-time authorization note.
  Current remote and deployment boundaries are governed by the current gate and
  the release documents, not by this directory.

## What still has value

`DECISIONS.md`, `EXPERIMENTS.md`, `BASELINE.md`, `BENCHMARKS.md`, `ORACLE.md`,
`ARCHITECTURE_PROFILING.md`, `ASTRA_REVIEW.md`, `FORMAL_BASELINE_AUDIT.md`,
`P6_03_OBSERVER.md` and `TARGET_CONDITIONED_CANDIDATE_GENERATION.md` are the
research record: hypotheses, measurements, rejected experiments and design
rationale. Read them as evidence, not as instructions. Entries later overturned by
the code (for example `DECISIONS.md` D-004 on duplicate Solver sources) are
superseded by the current code and gate; they are not rewritten here.

## Current entry points

Start at [README.md](../../README.md) for commands and authority links, and use
[CI.md](../release/CI.md) for the current gate. Independent historical
certification is [scripts/ci/verify-history.mjs](../../scripts/ci/verify-history.mjs).
