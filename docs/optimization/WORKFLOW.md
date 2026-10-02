# Optimization Workflow

This file is the durable operating contract for the solver optimization project. A new session must recover from the repository and these documents rather than relying on prior chat history.

## Objective and priority

The current long-term phase is **Hard-capable Release Candidate established; stopped pending explicit release scope**. The accepted E-014 Hard 159/159 capability frontier, replay correctness, browser-safe production boundary, Chrome lifecycle, and frozen browser readiness evidence are bound by `hard-capable-rc-v1`. Do not start a commit/tag/package, push, deployment, remote CI/CD, new candidate, Solver, benchmark, or optimization task without an explicit milestone.

Capability correctness and product performance are separate ledgers. Performance findings do not authorize a search-semantic change. Prefer the smallest product, integration, or behavior-preserving performance repair supported by a reproduced product issue. Do not start another Solver architecture experiment unless product acceptance establishes a concrete capability blocker and a new experiment is explicitly predeclared.

The frozen benchmark, formal baseline, release artifacts, and accepted capability artifacts must not be modified. Do not create new benchmark/diversity/audit programs unless a current product defect actually requires one. Correctness has priority over performance, and measurements precede optimization.

## Recovery procedure

At the start of every new session:

1. Inspect the current branch, `git status`, tracked and untracked changes, recent commits, and the complete diff.
2. Read every existing file in `docs/optimization/`. Missing expected files are not evidence of failure.
3. Reconcile every `in_progress` or suspiciously interrupted task against the actual code, diff, tests, and benchmark artifacts.
4. Treat the repository as authoritative when it conflicts with a status document.
5. Reuse already verified expensive profiling, benchmark, and analysis results unless the current task specifically requires a new measurement.
6. Update `PROJECT_STATE.md`, `TASKS.md`, `EXPERIMENTS.md`, `DECISIONS.md`, and `RESUME.md` as applicable before continuing.

## Model / Agent Routing

This section is the project's single durable authority for model selection and Agent routing. The policy is frozen for current work; it is a scheduling policy, not a claim about general model performance.

Choose the appropriate capability tier first, then the reasoning effort that is just sufficient. Reasoning effort is a compute budget, not a simple model-intelligence rank, and higher effort does not guarantee monotonically better results. Do not compensate for an unsuitable weaker model by repeatedly increasing its reasoning effort, select the highest available effort mechanically, or call several advanced models on the same question without a concrete unresolved uncertainty. Workers should use the lowest reasonable capability tier that can complete the task; advanced models are reserved for work that genuinely requires advanced judgment, and escalation must be driven by a specific unresolved issue.

The current standard chain is:

- **GPT-6 Luna** -> mechanical worker: file enumeration, hash comparison, mechanical JSON/schema field checks, counts, format conversion, simple test maintenance, repetitive edits, and diff organization that require no architectural judgment. Luna must not decide benchmark semantics, make high-risk architecture decisions, determine provenance correctness, or make final acceptance judgments.
- **GPT-6 Sol** -> standard coding/analysis worker: ordinary coding, bounded implementations, single-module changes, tests, data analysis, local benchmark checks, local provenance verification, ordinary schema/validator work, profiling analysis, and independent technical investigation. Prefer Medium reasoning for ordinary tasks and High for clearly complex tasks; do not upgrade mechanically.
- **GPT-5.6 Sol High** -> primary Agent/orchestrator: long-running project orchestration, cross-task context, architecture decisions, benchmark and solver phase planning, worker routing, result synthesis, repository-wide decisions, and final PASS/BLOCKED judgments. Do not migrate the primary Agent default to GPT-6 Sol under the current policy.
- **GPT-6 Astra Medium** -> default advanced audit or exceptionally difficult bounded problem: architecture review, independent benchmark audit, provenance/identity audit, high-risk algorithm correctness and soundness checks, challenges to the primary Agent's conclusions, and advanced independent review before a freeze or release.
- **GPT-6 Astra High** -> escalation only when Astra Medium leaves a critical unresolved issue, produces conflicting interpretations that cannot be adjudicated, identifies major correctness/provenance/soundness ambiguity, says deeper exploration is required, or the final PASS/BLOCKED decision depends on a still-unresolved difficult judgment. If Medium reaches a complete evidence-backed conclusion with no critical unresolved issue, do not call High.

GPT-6 Astra XHigh/Max are not normal routing tiers. Reconsider them only if a future concrete task or experiment demonstrates that Medium/High is insufficient. GPT-5.6 Terra, GPT-5.6 Luna, GPT-5.6 Sol XHigh, and GPT-5.6 Sol Max are no longer current default routes.

The primary Agent maintains the global project model, decomposes work, accepts results, and keeps durable state. Workers receive the minimum context needed for bounded tasks. Read-only investigations may run in parallel; coupled writes and core algorithm changes should normally be serialized.

## Experiment protocol

Every optimization experiment follows this sequence:

1. State a falsifiable hypothesis supported by profiling or measurement.
2. Make the smallest change that tests one primary variable.
3. Run the relevant correctness tests.
4. Run the appropriate benchmark and compare with the recorded baseline or explicit A control.
5. Compare result kind, depth, state counts, generated candidates, and stable solution signatures as well as wall time and memory evidence.
6. Keep or revert the change according to predeclared criteria.
7. Record successful, failed, rejected, and inconclusive experiments in `EXPERIMENTS.md` so they are not repeated without new evidence.

Search-semantic changes must not be presented as equivalent implementation optimizations. Any change to pruning, beam occupancy, enumeration order, solution depth/quality, or reachable states requires explicit correctness and solution-quality criteria.

## Checkpoints and quota boundaries

After every important phase:

- run the proportionate correctness suite;
- run the relevant benchmark or signature smoke check;
- inspect the Git diff and confirm duplicate solver sources remain synchronized;
- update the state documents and `RESUME.md`.

When the current usage window is nearly exhausted, do not start a new large task. Finish or safely stop the current unit of work, preserve measurements and diffs, and make `RESUME.md` sufficient for a new session.

## Repository and deployment boundary

Local reads, edits, builds, tests, benchmarks, profiles, Git history inspection, and local commits are allowed. Do not push, trigger remote CI/CD, use SSH, or modify production. The duplicate `shapeSolver.js` and `shapeSolver_web.js` files must remain byte-identical unless a separately reviewed architectural change removes the duplication.

## Completion review

When optimization work is complete, obtain an independent GPT-6 Astra Medium review of correctness, performance claims, benchmark methodology, code quality, and remaining risks. Escalate to GPT-6 Astra High only under the unresolved-issue criteria in the routing policy above.
