# Agent maintenance contract

This repository is maintained by code agents as well as humans. The default is:

**An agent owns the maintenance consequences of its changes.**

Delivering a change includes resolving the stale documentation, inconsistent
rules, test gaps and temporary artifacts it directly creates. This file states
the expectations; the linked authorities own the details. Update this file when
its defaults, not a specific fact, become wrong.

## 1. Find the authority first

Read the document that owns the question instead of reading the whole repository
by default.

| If the question is about... | Read... |
| --- | --- |
| Install, commands, current status, release limits | [README.md](README.md) |
| Architecture, runtime layers, research context | [project_summary.md](project_summary.md) |
| Current/historical certification and test entries | [docs/release/CI.md](docs/release/CI.md) |
| Git refs, published history, formal releases | [docs/release/VERSIONING.md](docs/release/VERSIONING.md) |
| Current physics semantics | [versions/SEMANTICS_V2.md](versions/SEMANTICS_V2.md) |
| Normative Benchmark rules | [USER_RULES.md](docs/benchmark/USER_RULES.md) → [BENCHMARK_RULES.md](docs/benchmark/BENCHMARK_RULES.md) → [BENCHMARK_METHODOLOGY.md](docs/benchmark/BENCHMARK_METHODOLOGY.md) |

When documents disagree, identify the class of claim: behavior belongs to the
selected source and current gate; Benchmark rules to their rule documents and
policy; historical facts to fixed Git objects; refs and releases to VERSIONING.md.

`docs/optimization/` is a closed historical research record, not operating
policy; its old `WORKFLOW.md` governs nothing. See its
[README](docs/optimization/README.md) for what remains useful as evidence.

The four maintained planners in `constructive/` are production code. The
`*-planner.mjs` copies under `benchmarks/tools/` are frozen historical inputs;
do not merge them "for deduplication".

## 2. Temporary files and intermediate artifacts

- Prefer an OS temporary directory or an explicitly ignored workspace; the
  ignored areas are documented in project_summary.md (§7.6).
- Decide the lifetime when you create something. Clean up through `finally` or
  another reliable path so failures leave no clones, logs, caches or experiments.
- Before finishing, remove this task's temporary artifacts that are no longer
  needed. The default is cleanup, not retention.
- Retain evidence only for a stated purpose and in its intended location. Gate
  output under `.ci-results/current/` and `dist/` is ignored and regenerable.
- Do not delete existing files because their names contain `temp` or `cache`. Do
  not clean another agent's workspace, files that predate your task, or artifacts
  still in use.
- Do not commit one-off analysis reports, disposable test scripts or intermediate
  results. A durable evidence record is a deliberate exception with an owner and
  a purpose.
- Cleanup must not destroy evidence needed to reproduce a reported result.

## 3. Documentation synchronization

When a change affects an interface, runtime behavior, algorithm architecture,
commands, build entries, CI or deployment status, check the current documents
that own those facts.

- Update the authoritative document instead of adding another document that
  explains the same fact. Remove or correct statements your change made stale.
- Add a document only when it has long-term value. An ordinary commit does not
  need a phase report.
- Do not present a point-in-time record as current operating guidance. Mark
  historical material as historical and point readers to the current authority.
- Keep responsibilities separate: README.md owns commands and current status;
  project_summary.md owns architecture and research context; CI.md owns
  certification and test entries; VERSIONING.md owns refs and release semantics.
- Not every change needs a documentation edit, but direct breakage caused by this
  change must not be left to the next round.

## 4. Rule maintenance

Rules are maintained, not accumulated.

- When behavior or architecture changes, check whether the directly related
  non-frozen rules still apply, and update them if they do not.
- Remove duplication and contradiction. One authoritative rule should live in one
  place.
- When a bounded phase or convention ends, mark it historical in an appropriate
  place. Preserve the original record while it still has research or historical
  value.
- Distinguish ordinary maintenance rules from frozen formal artifacts. Frozen
  Benchmarks, historical certification, Physics versions and other hash- or
  OID-bound files follow their versioning mechanism. Never edit historical
  evidence to make a check pass.
- You may repair ordinary rules; you may not use "rule maintenance" to bypass
  formal certification. A frozen or release-identity change is a new explicit
  decision, not housekeeping.

The frozen boundary is summarized in [README.md](README.md) and owned by the
version manifests and [VERSIONING.md](docs/release/VERSIONING.md): `benchmarks/**`,
Benchmark rules and policy, `versions/**`, the v1, Release 1 and Physics v2
identities, `shapeSolver_web.js` and root `release.json`. Do not normalize bytes.

## 5. Tests and correctness

- For a bug fix or new behavior, add or update tests in proportion to the impact.
  Do not rely only on the formal Benchmark passing.
- For a new or corrected public-API constraint, cover normal, boundary and
  failure paths.
- A constructive solver success must satisfy the actual operation, resource and
  parameter constraints. A returned path is not acceptance; the replay and
  validation gates decide.
- Never obtain a green result by changing frozen expectations, deleting tests or
  loosening validation.
- Distinguish current certification from independent historical certification and
  use the correct entry; neither certifies the other's object.
- Run the historical entry when a change touches a frozen identity input,
  authenticator, policy or trust root. Ordinary current-only changes do not need
  it. CI.md owns the triggers and commands.
- Match verification effort to risk, using the entries in README.md and CI.md.
  The full current gate certifies a committed tree; run it after the final commit.

## 6. Scope and ownership

Do the maintenance your task reasonably entails.

- If changing a constructor makes its API documentation stale, fix that document
  in the same task. If changing a build entry breaks a README command, update the
  command.
- If a clear, small error is in the area you are already editing, fix it when the
  source and authoritative rules make the correct state unambiguous.
- Treat unrelated historical debt differently: record it as a follow-up instead of
  expanding the task indefinitely. Do not launch a whole-repository audit or write
  a long-lived report for every small issue.
- Keep the change coherent and reviewable: one purpose and a correspondingly
  scoped commit.
- Use normal commits on `codex/maintained`; fast-forward synchronization is
  routine. Never rewrite published history, move frozen refs or tags, create a
  formal release, or change deployment configuration as maintenance.

## 7. Delivery and closeout

Before reporting completion, confirm:

- the requested behavior or fix is implemented;
- the necessary tests ran, and the results are reported honestly, including
  skips and failures;
- directly affected documentation and rules are synchronized;
- this task's temporary artifacts are cleaned, or their retention is justified;
- the Git worktree and commit scope are clear;
- no frozen evidence, release reference, tag or deployment configuration was
  changed accidentally;
- remaining limits and incomplete work are stated accurately.

No long checklist or repeated verification report is needed. State the result,
the verification evidence and any remaining concerns concisely.
