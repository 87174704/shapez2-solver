# Versioning and reference governance

This page defines what the long-lived Git references in this repository mean, and
when a formal version may be published. It governs **refs and release semantics
only**. It does not define engineering process, test duties or operating
procedure; the gate ([CI.md](CI.md)) and the Benchmark rules own those.

Where this page and an unexecuted plan disagree about a branch role, this page is
authoritative. [PUBLISH_PLAN.md](PUBLISH_PLAN.md) records a plan that was never
executed.

## Ref roles

| Ref | Remotes | Role | Moves? |
| --- | --- | --- | --- |
| `codex/maintained` | GitHub (default), Gitea | Authoritative development branch | yes, ordinary commits |
| `main` | GitHub | Preserved upstream lineage at `ba62646` | **no** |
| `main` | Gitea | Deployment trigger at `0647b85` | only at an approved deployment |
| `codex/pre-migration-main` | GitHub | Frozen v1 preservation ref at `0647b85` | **no** |
| `codex/solver-optimization` | GitHub | Frozen v1 provenance ref at `0647b85` | **no** |
| `hard-capable-v1` | GitHub | Historical certification tag `c27b895` → `f62683a` | **never** |

### `codex/maintained`

The only branch that receives new work. Every ordinary development commit lands
here; it is the GitHub default branch and the subject of the current
certificate ([versions/current.mjs](../../versions/current.mjs)).

### GitHub `main`

Independent upstream history: `ba62646`, 87 commits, no common ancestor with
`codex/maintained`. It is the attribution and fork-relationship anchor named in
[LICENSING.md](../legal/LICENSING.md) and
[ATTRIBUTION.md](../legal/ATTRIBUTION.md). Read-only: never merge it into
`codex/maintained`, never develop on it, never move it.

### Gitea `main`

Triggers [.gitea/workflows/deploy.yml](../../.gitea/workflows/deploy.yml) on
push. It currently sits at `0647b85` (the Release 1 tree). Do not fast-forward it
to "sync" maintenance code: that workflow copies a whitelist that lacks
`locales/` and `assets/`, so it would publish a broken site. See the README
section "Known release limits".

### Frozen v1 preservation refs

Both point at `0647b85` and must stay there. They share a commit but not a
purpose, and neither is a development branch:

- `codex/pre-migration-main` records what `main` was immediately before the
  maintenance migration, so that state keeps a stable name.
- `codex/solver-optimization` is the provenance branch for the closed
  optimisation batch recorded in [docs/optimization](../optimization/README.md).

Keep both. `0647b85` is the v1 certification anchor — bound by
[frozen-maintenance.json](frozen-maintenance.json), the 593-file inventory and
[HISTORICAL_VERIFICATION.md](HISTORICAL_VERIFICATION.md) — and these two are its
named non-deployment references. **Registering them here is documentation, not
technical protection**: this page does not create a branch-protection rule on any
remote, and it must not be read as one.

### `hard-capable-v1`

Annotated tag `c27b895`, target `f62683a`, created 2026-10-02. It certifies the
hard-capable v1 product and is bound by object hash in
[frozen-maintenance.json](frozen-maintenance.json). It is **not** the current
product version, and it must never be moved, deleted or recreated.

"Release 1" (`5fbba47`), "v1" (`0647b85`) and "Physics v2" (`ec9cc5c`) are
separate historical identities certified by commit OID. Do not add tags to them
retroactively; the OID is already the identity.

## What is not a version

| Artifact | What it is | Ref? |
| --- | --- | --- |
| Ordinary commit | One reviewed change on `codex/maintained` | no |
| Development phase | A bounded piece of work, described by its commits and, where useful, by the documents it changes | **no** |
| Release candidate | A commit that passed the full gate, identified by its SHA | no |
| Formal tag | An annotated `solver-v*` tag created at publication | yes |
| Release | A GitHub Release paired one-to-one with a formal tag | yes, derived |

A development phase needs no `PHASE_*` document, no branch and no tag. Write a
dedicated report only for independent certification, a long-term evidence record,
or a major architecture decision. Ordinary changes belong in the commit message
and in the documents they actually change.

## Formal versions

Naming: `solver-v<MAJOR>.<MINOR>`, annotated, created only at publication, never
moved and never deleted.

Create one only when all three hold:

1. the commit is on `codex/maintained` and its hosted
   [verify.yml](../../.github/workflows/verify.yml) run succeeded with
   `head_branch == codex/maintained`;
2. a deployable artifact path exists for that commit;
3. the intent is to publish, not to make the history look tidy.

None of these hold today (see the README "Known release limits"), so this
repository has no formal version and must not claim one. Publishing stays a
separate decision from merging.

## Preserving published history

- Never amend, rebase, force-push or otherwise rewrite a published commit, and
  never move a tag. Amend and rebase are acceptable only **before** a commit is
  published.
- Historical certification is anchored at `5fbba47` and earlier objects. Those
  objects, the `hard-capable-v1` tag object and the 781-file Release 1 identity
  stay byte-identical.

## Adding or retiring a ref

There is no fixed ref quota. A new long-lived ref needs a stated purpose, an
expected lifetime and named consumers, and it should be created only when a
commit SHA or an existing branch cannot carry that role. Check for documentary
and automation consumers before retiring a ref.
