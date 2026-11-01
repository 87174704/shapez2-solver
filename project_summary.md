# Shapez 2 Solver — Project Summary

> Architecture and research-context guide for the maintained branch
> (`codex/maintained`). Snapshot: 2026-11-01.
>
> This file explains how the system is put together, why its layers exist, and
> what a future maintainer must not break. It is deliberately not a command
> reference, a benchmark rulebook, or a release certificate. Commands live in
> [README.md](README.md); gate details and dated counts live in
> [docs/release/CI.md](docs/release/CI.md); normative Benchmark rules live in
> [docs/benchmark/USER_RULES.md](docs/benchmark/USER_RULES.md),
> [docs/benchmark/BENCHMARK_RULES.md](docs/benchmark/BENCHMARK_RULES.md) and
> [docs/benchmark/BENCHMARK_METHODOLOGY.md](docs/benchmark/BENCHMARK_METHODOLOGY.md).
>
> If this document ever disagrees with the selected source, the current gate or
> an authoritative rule document, those win. Every important claim here should be
> traceable to the linked source or document.

## 1. What this project is

Shapez 2 Solver is a browser-only solver for [Shapez 2](https://shapez2.com/),
independently maintained from
[Vystel/shapez2-solver](https://github.com/Vystel/shapez2-solver). A user supplies
target shapes, available input shapes, enabled machine operations, a layer cap and
several rule switches. The application searches for an operation sequence that
produces the target, then renders the sequence as a graph. The same static site
also contains a reachable-shape explorer and a colour-mixing solver.

The project has no backend, database, account system or runtime bundler. All heavy
search runs in browser Workers; the main thread handles UI, validation, previews and
graph rendering. The distributable artifact is a tree of static HTML, CSS, ES
modules, images and JSON. It supports 13 UI locales and builds as two static
profiles (`global`, `china`).

At a glance:

| Area | Current implementation |
| --- | --- |
| Browser shell | `index.html` + `main.js`; native ES modules, no framework |
| Shape solver | [shapeSolver.js](shapeSolver.js), callable as a module and as a module Worker |
| Physics | [shapeOperations.js](shapeOperations.js), semantics `shape-operations-v2-support-closure` |
| Constructive solving | An eight-stage delegation ladder in the repository root plus [constructive/](constructive/) planners |
| Workers | `shapeSolver` (solve and explore) and `mixingSolver` |
| Static build | [tools/static-build/](tools/static-build/) producing `global` and `china` |
| Current certification | [scripts/ci/verify-current.mjs](scripts/ci/verify-current.mjs) |
| Historical certification | [scripts/ci/verify-history.mjs](scripts/ci/verify-history.mjs) |
| Deployment | None functional for this branch as of 2026-11-01; see [README.md](README.md) |

“Current” in this repository means **the Git-selected source commit plus the
original immutable inputs**, not a fixed release manifest. “Historical” means the
fixed v1, Physics v2 RC and Release 1 Git objects, which are certified separately.
The maintained branch is **not** Release 1 and must never be described as one.

How to read this document:

- New to the codebase: sections 1–2.
- Changing solver behaviour: sections 3, 4, 7 and 8.
- Working on the Benchmark or a research experiment: sections 5, 6 and 8.
- Release, identity or historical evidence: section 6.

## 2. Runtime architecture

### 2.1 Browser application and Workers

```text
index.html
  │  classic CDN scripts: Cytoscape, ELK, cytoscape-elk, three.js, 3d-force-graph
  └─ main.js  (single application module entry)
       ├─ shapeValidation.js, shapeOperations.js
       ├─ shapeRendering.js      Canvas previews
       ├─ operationGraph.js      Cytoscape/ELK and 3d-force-graph
       ├─ i18n.js -> localeConfig.js + locales/*.js
       ├─ colorMode.js
       ├─ workerLifecycle.js
       ├─ Worker: shapeSolver.js  ──> bounded general search
       │                           └─ constructive delegation ladder
       └─ Worker: mixingSolver.js ──> colour-inventory search
```

`main.js` is the only application entry module. It holds UI state, validates
target and input shapes, rejects impossible non-renewable-part shortages, collects
the selected operations and options, starts a one-shot Worker task, and renders the
result. `workerLifecycle.js` guarantees that a task delivers at most one result or
error, terminates the Worker on completion or cancellation, and suppresses stale
messages after termination. This is why the UI can cancel a solve without later
receiving an old graph.

The solver Worker is created as:

```js
new Worker(new URL('./shapeSolver.js', import.meta.url), { type: 'module' })
```

`shapeSolver.js` is both a Worker entry and an importable module. Under Node tests,
a minimal `globalThis.self = { postMessage() {} }` is injected before import. The
Worker protocol is:

| Direction | Message | Payload |
| --- | --- | --- |
| UI → Worker | `{ action: 'solve', data }` | targets, starting codes, operations, `maxLayers`, `maxStatesPerLevel`, `preventWaste`, `orientationSensitive`, `allowSplitting`, `cleanPainting` |
| UI → Worker | `{ action: 'explore', data }` | starting codes, operations, `depthLimit`, `maxLayers` |
| UI → Worker | `{ action: 'cancel' }` | no payload |
| Worker → UI | `{ type: 'status', messageKey, messageParams, status }` | progress or cancellation |
| Worker → UI | `{ type: 'result', result }` | completed solve or explore result |
| Worker → UI | `{ type: 'error', messageKey, messageParams }` | classified failure |

The current UI cancels by terminating the Worker through `workerLifecycle.js`; the
Worker’s explicit `cancel` action remains part of the module protocol.

The UI-level non-renewable-part check is an early convenience, not the acceptance
authority. It prevents obviously impossible requests before a Worker starts; the
Solver result remains the executable answer.

`shapeOperations.js` is shared by the main thread (previews and target-material
extraction) and the Worker (search and replay). `shapeRendering.js` draws shapes
into Canvas elements. `operationGraph.js` owns two mutually exclusive graph
implementations: Cytoscape with ELK for solver and mixing graphs, and
`3d-force-graph`/three.js for the reachable-space explorer. Colour-mode changes
redraw shape previews, coloured operation nodes and mixing edges. The Explorer uses
the same Worker module with a separate Worker instance.

Internationalisation is a separate layer: `localeConfig.js` defines the supported
locale list, storage key, `cn` legacy alias and language-name mapping; `i18n.js`
contains the shared English/Chinese catalogue and merges
[locales/index.js](locales/index.js) and the per-locale modules. The default is
English; `cn` is retained as a URL/storage alias for `zh-CN`. The current test suite
asserts that all 13 locale dictionaries have the same non-empty keys and
parameters.

### 2.2 Static profiles and the application closure

The source tree can be served directly for development. The maintenance build in
[tools/static-build/](tools/static-build/) produces deployable static trees:

| Aspect | `global` | `china` |
| --- | --- | --- |
| Base path | `/shapez2-solver/` | `/` |
| Graph libraries | unpkg + jsDelivr | `jsdelivr.topthink.com` |
| Fonts | Google Fonts CSS (UA-dependent) | Checked-in Barlow snapshot and local CSS |
| CSP | allows the configured Google font/style origins | self-hosted fonts and styles only |

The important build logic is not a bundler. `build-current-worker.mjs` asks
[application-closure.mjs](tools/static-build/application-closure.mjs) to compute
the reachable application inventory. The closure starts at `index.html`, follows
HTML `src`/`href` references, static imports, literal dynamic imports, and literal
`URL`/`Worker` constructions. It accepts only root `*.js` and `*.js` inside
`constructive/` and `locales/`; a missing module or a non-application import fails
the build. All files under `images/` are included because operation icons are
resolved from operation names at runtime, so static text analysis alone cannot
prove an image unreachable.

The build copies the reachable ES modules unchanged; it does not transpile,
bundle or minify application JavaScript. It generates one HTML page per supported
locale from `index.html`, plus a root English page and a `cn` alias page, rewriting
the base path, CSP, CDN script URLs, SRI attributes and the single font `@import`
in `styles.css`. It also copies `LICENSE`, legal documents, third-party notices and
licences, and adds the China-only font snapshot. Each profile receives a generated
`release.json` (`status: maintenance-candidate`, `gameCertification: UNKNOWN`) and a
`build-manifest.json` binding the source commit/tree, source identity hash, build
tool hashes, dependency URLs/SRI and every artifact hash.

The verification entry rebuilds each profile twice, compares the trees for
reproducibility, checks the exact artifact inventory, validates CSP/SRI/markup,
serves the profile over HTTP, and permits only the documented profile differences
(CDN URLs, base path/CSP, China fonts, manifest). The tracked `cn/index.html` and
`en/index.html` are legacy entry copies bound by the historical runtime identity;
the current build synthesizes its own locale pages and does not copy them.

Do not confuse this build with the historical `tools/static-build/build.mjs`,
`verify.mjs` and `acceptance.mjs`. Those are Release 1 entries: they fail closed at
their identity checks when run against this branch.

## 3. Solver algorithm system

The Solver has two families behind one public function:

1. a **bounded general search** (`shapeSolverCore`) that always remains the
   fallback; and
2. a **constructive delegation ladder** that can produce an exact plan directly for
   narrow parts of the input space.

The ladder is tried first only when its eligibility conditions hold. A rejected
constructive candidate falls back to the general search with the same public
parameters. This is the central design fact: the constructive code is a fast path,
not a replacement for search, and every failure must degrade to search rather than
return a wrong result.

### 3.1 Public routing

[shapeSolver.js](shapeSolver.js) implements three routes:

| Route | Eligibility (current code) | Result marker |
| --- | --- | --- |
| Strict ordinary constructive | one target; `maxLayers === 4`; `orientationSensitive === true`; `allowSplitting === false`; `cleanPainting === true`; `preventWaste === false`; at most 64 starting shapes; every target/starting layer is exactly four cells, each empty or an ordinary part (C/R/S/W/H/F/G/X/Y plus colour), and at most four layers | `solverRoute: 'strict-ordinary-constructive'` |
| Hybrid constructive | one target; `maxLayers === 4`; `preventWaste === false`; `orientationSensitive === false`; `allowSplitting === false`; `cleanPainting === true`; no shape-family restriction | `solverRoute: 'constructive-hybrid'` |
| General search | everything else, or any constructive rejection | `solverRoute` is `'general-search'` after a rejected attempt; absent when general search is entered directly |

The strict route exists for exact-direction ordinary targets and uses a short
cooperative budget (currently 50 ms). The hybrid route serves rotation-insensitive
targets, including Pin and Crystal targets, and uses a larger budget (currently
12 s). Both budgets are charged against the same total solve cap (currently 120 s);
after a failure, the remaining time is handed to general search. `maxStatesPerLevel`
is a beam-size control for general search only; constructive stages ignore it.

The strict route is unconditional code, not a feature flag. The
`strictOrdinaryConstructive` object in the root [release.json](release.json) is
historical Release 1 metadata; it does not configure the current runtime. See
[README.md](README.md) for the same statement.

### 3.2 Bounded general search

`shapeSolverCore` searches a multiset of `(shape, throughput)` tokens:

- It expands depth by depth, but retains only the best `maxStatesPerLevel` states
  per layer according to the shape-similarity score. It is therefore a heuristic
  beam search, not an exhaustive BFS.
- Similarity weights come from `_getSimilarity` in
  [shapeOperations.js](shapeOperations.js): part type 0.5, shape+colour counts 0.3,
  rotated part order 0.2. The score is normalised by total throughput; when
  `allowSplitting` is on, a coarseness tie-break prefers less fragmented inventories.
- `BoundedStateCollector` keeps a fixed-capacity heap and prunes lazily during
  successor generation, so the solver never materialises a whole layer before
  ranking it.
- State keys sort token IDs and counts, `visited` prevents re-expansion, and
  similarity/shape/paint-colour/operation-output caches are capped.
- With `allowSplitting`, a `Splitter` step halves one token's throughput, down to
  `1/4096`; Splitter is not one of the ten selectable machine operations.
- Goal checking has a fast path for one target with no splitting and no waste.
  Otherwise it allocates the target multiset from the live inventory. When
  `orientationSensitive` is false, all four rotations of the target are acceptable.
  With `preventWaste`, remaining non-target shapes are rejected.
- A solution path is rebuilt from the parent chain and replayed to assign stable
  input/output IDs. Core results are classified as `solved`, `exhausted`,
  `not-found-pruned` or `limit`; beam pruning is never reported as exhaustive
  search.

Safety budgets cover frontier size, total visited states, generated states,
interned shapes and wall time. When one is hit, the result carries
`limitReached`/`limitReason` instead of exhausting browser memory. The authoritative
numbers are the constants in [shapeSolver.js](shapeSolver.js); do not treat a value
quoted in a report as permanent.

### 3.3 The constructive delegation ladder

The public route calls `interiorCrystalColumnSolve` as the entry to a chain of
modules. Control flows inward; each stage first asks the next inner stage, then
activates its own construction only for the status it owns. A solved inner result is
returned outward with the outer stage's architecture metadata added.

```text
interiorCrystalColumnSolve                      full-height interior Crystal columns
  └─ unsupportedCrystalResourcePoolSolve        broader staged Crystal layouts
       └─ sharedOccurrenceGoalDecomposedSolve   shared-occurrence / resource-mismatch
            └─ isolatedPinGoalDecomposedSolve   isolated or terminal isolated Pin
                 └─ mixedPinCrystalGoalDecomposedSolve   mixed Pin + Crystal
                      └─ crystalScaffoldGoalDecomposedSolve   Crystal scaffold
                           └─ pinGoalDecomposedSolve            Pin layouts
                                └─ goalDecomposedSolve          ordinary targets
```

| Stage | What it constructs | Delegates or activates on |
| --- | --- | --- |
| `goalDecomposedSolve` | ordinary four-cell targets by extraction recipes and global resource matching | base of the ladder |
| `pinGoalDecomposedSolve` | targets containing Pin; plans Pin columns and supported regions; requires `Pin Pusher` and `Stacker` | delegates to ordinary when the target has no Pin |
| `crystalScaffoldGoalDecomposedSolve` | dense single-colour Crystal targets without final Pins; builds a solid scaffold, generates Crystal, then applies `Crystal Generator` | delegates to the Pin stage when the target has no Crystal; requires `Crystal Generator` |
| `mixedPinCrystalGoalDecomposedSolve` | targets containing both Pin and Crystal; protected Crystal staging, Crystal-to-Pin support transition, half recomposition | delegates to the Crystal stage when the target is not mixed; reports terminal isolated-Pin layouts |
| `isolatedPinGoalDecomposedSolve` | isolated Pin and terminal isolated-Pin branches | activates on `unsupported-isolated-pin` or `unsupported-terminal-isolated-pin`; otherwise delegates inward |
| `sharedOccurrenceGoalDecomposedSolve` | resource-mismatch layouts that need shared occurrence extraction, column partitioning and disjoint composition | activates on `resource-mismatch`; otherwise delegates inward |
| `unsupportedCrystalResourcePoolSolve` | broader staged Crystal layouts using a physical-mask resource pool | activates on `unsupported-crystal-layout`; otherwise delegates inward |
| `interiorCrystalColumnSolve` | full-height interior Crystal columns that the frozen half-scaffold cannot express; ordinary remainder is overlaid after the Crystal skeleton | activates only on `shared-resource-construction-failed` with “no canonical half-scaffold”; otherwise delegates inward |

This is a **delegation ladder with status contracts**, not a portfolio of
independent planners tried in parallel. Two consequences matter:

- Changing an inner stage's returned status can silently disable an outer fallback.
  Delegation is part of the behaviour and is covered by tests.
- A stage that handles only a rare topology is not dead code. It is the only
  constructive capability for that topology, and without it the case degrades to
  general search.

The four production planners in [constructive/](constructive/) build the concrete
operation sequences through a shared builder:

| Planner | Main mechanisms |
| --- | --- |
| [pin-construction-planner.js](constructive/pin-construction-planner.js) | Pin column sequences, supported upper regions, isolated-Pin Crystal scaffold |
| [crystal-construction-planner.js](constructive/crystal-construction-planner.js) | Half-scaffold extraction, controlled boundary shattering, Swapper recomposition, staged/sparse refinement masks |
| [mixed-pin-crystal-construction-planner.js](constructive/mixed-pin-crystal-construction-planner.js) | Protected spatial Crystal staging, Crystal-to-Pin support transition, mixed half recomposition |
| [interior-crystal-column-planner.js](constructive/interior-crystal-column-planner.js) | Full-height Crystal columns inside an all-solid-minus-one-column scaffold, lossless Cutter partitioning, ordinary overlay |

[constructiveSolverRuntime.js](constructiveSolverRuntime.js) is the shared
browser-safe primitive layer: shape-code parsing, empty-part spelling, spatial
column partitioning, column selection/rotation, disjoint composition and layer
stacking. The planners use the same `Shape`/operation implementation as production
physics; they do not import Benchmark tools, witnesses or generator code. A current
test asserts that the production Solver import graph contains no `benchmarks/`
module.

Every constructive plan is a `solutionPath` of
`{ operation, inputs, outputs, params }` steps. The stages enforce operation
availability, layer limits, resource multiplicity, clean painting and output IDs
while building. The final authority is still the router's replay gate described
below.

### 3.4 Budgets, resources and constraints

| Control | How it flows | Important consequence |
| --- | --- | --- |
| `enabledOperations` | into the instance, then planners and the validator | A required disabled operation makes the stage unsupported; it must fall back, not use it silently |
| `maxLayers` | `ShapeOperationConfig`; constructive eligibility requires 4 | Constructive and core must agree on layer truncation |
| `maxStatesPerLevel` | core beam width only | Changing it does not change constructive behaviour |
| `preventWaste` | route gate, validator and core goal allocation | Constructive routes are entered only with `false`, but the validator still enforces it if present |
| `orientationSensitive` | chooses strict vs hybrid routing; changes the core goal set | Strict means exact orientation; hybrid means rotation-insensitive |
| `allowSplitting` | core splitter + throughput accounting; excludes constructive routes | Constructive plans contain no Splitter and no partial tokens |
| `cleanPainting` | route eligibility, planner matching/finishing, validator and core Painter pre-filter | The rule is enforced at three layers; see 3.5 |
| Wall time | strict 50 ms, hybrid 12 s, total solve 120 s | Construction **and** acceptance replay are charged to the same budget |
| Resource/matching limits | extraction states, matching transitions, operation count, wall time | Each stage checks its own config; the current values are in `shapeSolver.js` and the planners |

Constructive plans use finite, single-use tokens: every input ID must be live and
unique, consumed inputs disappear, and outputs receive new IDs. There is no
throughput splitting or partial-token reuse in this domain. Global matching exists
because a greedy per-cell assignment can consume a resource needed later.

The wall-clock checks are cooperative. A synchronous planner can overshoot between
checks; the router measures elapsed wall time after the constructor returns and
rejects the candidate as `budget` if the budget was exceeded. This keeps the public
time cap honest even when a planner's internal check runs late.

### 3.5 Acceptance of a successful path

A constructive candidate is **not** accepted because a planner returned a path.
The router applies a narrow domain gate and then replays the path with production
operations:

- [validate-strict-plan.js](constructive/validate-strict-plan.js) exports
  `validateStrictPlan` and `validateHybridPlan`. Both share
  `validateExactFinitePlan`.
- The gate rejects unsupported parameter combinations, paths longer than 256
  (strict) or 768 (hybrid), unknown or disabled operations, wrong arity, malformed
  or extra parameters, colours outside the colour set, `cleanPainting` violations,
  production output mismatches, missing/duplicate/spent input IDs, reused output
  IDs, a missing exact goal, and remaining waste when the instance requests it.
  The production constructive routes always pass `preventWaste: false`; the shared
  validator still enforces the rule for its tests and future domains.
- Swapper outputs are compared as an unordered multiset; all other operations are
  ordered. Empty operation outputs are removed from the expected list, so a
  declared path must contain only the non-empty outputs.
- The hybrid path additionally requires `outcome === 'solved'` and
  `depth === solutionPath.length`.
- A rejection returns a reason such as `clean-painting`, `physics`,
  `input-inventory`, `exact-goal`, `waste`, `result-metadata` or `budget`, and the
  router runs general search with the original public parameters.

The validator imports production physics. It is a strong semantic gate against
planner mistakes, but it is **not** an independent physics oracle. The independent
cross-check is a separate test/CI layer (section 4). A physics bug could make both
the constructor and this replay agree on the same wrong output.

For general search, the solution path is produced by replaying the internal trace,
not by a separate acceptance replay. Public tests and the current gate replay those
paths with both production and independent models; the runtime does not perform a
second independent validation per user request.

#### The `cleanPainting` boundary

`cleanPainting` permits `Painter` only on a single-layer shape whose paintable
parts are still uncoloured. Before the 2026-11-01 fix, the hybrid route accepted any
candidate with a `solutionPath`; a constructor could finish an atom by repainting a
precoloured part or use `Painter` when it was disabled, and the public Solver would
still report success. The fix has two independent parts:

1. the ordinary, Pin, mixed, isolated-Pin and shared-resource constructors respect
   `cleanPainting` and the enabled-`Painter` state during extraction matching and
   atom finishing; and
2. the hybrid router now gates every candidate with exact finite-token replay and
   charges construction plus replay against the solve budget. An invalid candidate
   becomes a visible fallback attempt, never a success.

The boundary is therefore: **a constructive success is an exact-replayed plan; a
public success is either that accepted plan or a path produced by general search.**
A future constructor regression should cause `hybridConstructiveAttempt.fallback`
or `strictConstructiveAttempt.fallback` to be true and a `general-search` result,
not a silently invalid constructive result. Tests should assert both the public
outcome and the attempt metadata, and should exercise the public-API matrix
(coloured/uncoloured inputs, exact/rotatable, clean/unrestricted, Painter
enabled/disabled), not only the frozen corpus.

### 3.6 Explorer

The Explorer is a second action of the same Worker module, not part of the solver
search. Starting from the supplied shapes, it enumerates operations up to
`depthLimit` and returns `{ shapes, ops, edges, outcome, limitReason, ... }`:

- unary operations expand only the current frontier; binary operations combine
  history with the frontier;
- `Painter` and `Crystal Generator` iterate the full colour set, so the Explorer is
  not restricted to red;
- hard limits cover attempts, shapes, operations, edges, wall time and serialised
  result bytes;
- a `complete` result is a closed reachable graph; a `limit` result is explicitly
  partial, with a reason.

The Explorer is a visual reachability tool. It has no goal-driven pruning and no
claim of enumerating the complete game state space.

### 3.7 Colour mixing

[mixingSolver.js](mixingSolver.js) is a separate Worker for colour inventories. A
mix consumes two colour units and produces two units of the mixed colour. Manual
input finds the shortest BFS solution and then enumerates near-shortest alternatives
with a bounded DFS; automatic mode enumerates base-colour allocations up to the
configured input limit. Solutions are capped and sorted; a 2-second DFS deadline
prevents unbounded enumeration. The mixing tab renders the chosen solution with
Cytoscape. This module does not use shape physics.

### 3.8 Change-impact map

| Change | Direct impact | Re-check |
| --- | --- | --- |
| [shapeOperations.js](shapeOperations.js) or [shapeConstants.js](shapeConstants.js) | Physics semantics, every operation, every solver route | Physics identity/manifest, independent model parity, retained control fixtures, 159 exact paths, corpus |
| [shapeSolver.js](shapeSolver.js) routing or core | All solve/explore results, routes, time sharing, beam behaviour | Strict/hybrid routing tests, public-API matrix, exact frozen paths/routes, corpus |
| [constructive/](constructive/) planners | Constructive coverage, path shape, delegation statuses | Stage tests, clean-painting/enabled-operation controls, exact frozen paths, fallback attempts |
| [constructive/validate-strict-plan.js](constructive/validate-strict-plan.js) | What the Solver will accept as a constructive success | Negative controls, fallback behaviour, exact paths |
| Worker protocol, `main.js`, renderers | UI behaviour and stale-result handling | Worker lifecycle tests, browser Worker test, i18n keys |
| `benchmarks/**` | Frozen Benchmark identity and acceptance | This is a new Benchmark release decision, not a normal edit |

## 4. Physics semantics and independent validation

### 4.1 Production physics

The current production physics is
[shapeOperations.js](shapeOperations.js), identified by the exported constant
`SHAPE_OPERATIONS_SEMANTICS = 'shape-operations-v2-support-closure'` and by
[versions/SEMANTICS_V2.md](versions/SEMANTICS_V2.md). It implements:

- the shape/part model, layer parsing and serialisation;
- rotation, half-destruction, cutting, swapping, stacking, painting, Pin pushing
  and Crystal generation;
- gravity and support, collision, Crystal fusion/breakage and layer truncation.

Physics v2 differs from v1 in two audited ways: support is computed as a
floor-anchored least fixed point rather than a path-dependent DFS cache, and
unsupported Crystal components are collected as complete pre-mutation fused
components before deletion. Operation scheduling, collision, truncation and
resource rules are otherwise unchanged. The bounded model evidence lives under
[docs/physics-fix-20261029/](docs/physics-fix-20261029/README.md).

The **current physics identity** is the semantics subset bound by
[versions/shape-operations-v2-support-closure.json](versions/shape-operations-v2-support-closure.json):
`shapeOperations.js`, `shapeConstants.js`, `shapeValidation.js` and
`versions/SEMANTICS_V2.md`. The same manifest also contains a runtime set from the
Physics v2 RC; that larger set is a historical implementation identity and does not
validate against later maintenance source. Do not confuse the two scopes.

### 4.2 Frozen historical physics

| Identity | Fixed object | Status |
| --- | --- | --- |
| v1 physics | v1 tree at `0647b8502f75145936faf8fbcde7cf2ab5371f75`; [docs/benchmark/GAME_SEMANTICS.md](docs/benchmark/GAME_SEMANTICS.md) and [versions/shape-operations-v1.json](versions/shape-operations-v1.json) | Historical only; never edited to describe v2 |
| Physics v2 RC | `ec9cc5cb633d021b6af276565223a392f8329b87`; v2 manifest | Historical RC snapshot; its runtime set does not match later Solver source |
| Release 1 | `5fbba47c9a2c6c3cbdb346bd7e935b08018f6d17`; [versions/shapez2-solver-release1.json](versions/shapez2-solver-release1.json) | Historical release identity; not a certificate for this branch |

`verifyVersion({ version: 'shape-operations-v2-support-closure' })` at the current
HEAD is expected to fail on `runtime: shapeSolver.js hash differs`; this is not a
corpus defect. The same check passes on the reconstructed v2 tree. Conversely, the
current source must not be presented as v1 or Release 1. [versions/index.json](versions/index.json)
is the trust root for both version manifests.

### 4.3 Independent model, probe and replay layers

| Layer | File | Independent of production physics? | Role |
| --- | --- | --- | --- |
| Production physics | [shapeOperations.js](shapeOperations.js) | — | The implementation being tested |
| Analytical model | [tests/helpers/independentPhysics.mjs](tests/helpers/independentPhysics.mjs) | Yes: no production imports | Independent support graph, all-pairs closure, Crystal components and operation outputs |
| In-memory probe | [tests/helpers/physicsProbe.mjs](tests/helpers/physicsProbe.mjs) | No: observes production source | Hooks the production support/deletion stages and compares them with the analytical model |
| Production replay | [constructive/validate-strict-plan.js](constructive/validate-strict-plan.js), [tests/helpers/shapeSolverOracle.mjs](tests/helpers/shapeSolverOracle.mjs), [benchmarks/tools/benchmark-core.mjs](benchmarks/tools/benchmark-core.mjs) | No: imports production operations | Re-executes plans/witnesses with the production model |
| Independent replay | [tools/release1/replay.mjs](tools/release1/replay.mjs) | Yes: imports only the analytical model | Replays a path with an independently written physics implementation |

The independence claim is deliberately narrow. The analytical model is a second
in-repo implementation, not the Shapez 2 game engine and not a third-party oracle.
It shares the repository's interpretation of the rules. “Independent” here means
“no production operation imports and a separately written algorithm”, not
“independently certified by the game”.

The current acceptance entry
([tests/tools/validateCurrentPhysics.mjs](tests/tools/validateCurrentPhysics.mjs))
orchestrates all of these layers. For every frozen witness and every selected solve
it checks production output against the probe and the analytical model, replays the
path with production physics, checks the exact target and resources, and records
any v1↔v2 operation difference. The historical entry runs the same style of
acceptance against the reconstructed v2 and Release 1 implementation roots
([tests/tools/validatePhysicsV2.mjs](tests/tools/validatePhysicsV2.mjs)).

### 4.4 What the validation proves — and what it does not

The current gate demonstrates, for the selected commit and the frozen corpus:

- every frozen witness (331 unique instances, 30,158 steps) replays with production
  physics and agrees with the analytical model and probe;
- the 159 selected solves are reproduced exactly, with no resource reuse, on 53
  distinct targets, through the `constructive-hybrid` route;
- the retained v1/v2 control fixtures exercise the reviewed physics corrections
  (25 reviewed output changes), while the selected Benchmark outputs are unchanged;
- the corpus itself (6 profiles, 195 instances, 159 composite members) is accepted
  under the current semantics by the narrow deferred-pin rule described in 5.1.

It does **not** prove:

- that every combination of the public API is solvable, covered or free of
  constraint bugs;
- that the search finds an optimal or even a complete answer;
- that the in-repo model matches the real game in all versions, platforms or edge
  cases;
- that a successful local run or a hosted CI run guarantees future commits;
- that the branch is deployable or released.

`release.json` and generated profile metadata both say `gameCertification:
UNKNOWN`. That is the correct current statement.

## 5. Benchmark and research system

### 5.1 Rules, provenance and generation

Rule precedence is:

1. [docs/benchmark/USER_RULES.md](docs/benchmark/USER_RULES.md) — owner-supplied
   requirements;
2. [docs/benchmark/BENCHMARK_RULES.md](docs/benchmark/BENCHMARK_RULES.md) —
   formalised rules;
3. [docs/benchmark/BENCHMARK_METHODOLOGY.md](docs/benchmark/BENCHMARK_METHODOLOGY.md)
   — construction and acceptance methodology.

[benchmarks/policy/official-policy.v1.json](benchmarks/policy/official-policy.v1.json)
is the repository-side allowlist. It pins supported schema versions, profiles,
suites/partitions, target membership/counts, seed/catalog/semantics/target hashes,
`cleanPainting`, Splitter state and profile quality gates. Artifact metadata is not
the authority; the policy and trusted release manifests are.

A Benchmark release has three separate identity layers:

- the immutable artifact content identity (`releaseId` plus canonical content hash);
- the trusted release-manifest revision (`manifestRevisionId`) that binds rules,
  seed, catalog, targets, semantics, schemas, generators, validator and artifact;
- the policy pin that selects the current revision.

A content-identical copy can pass regardless of path or JSON whitespace; a modified
artifact cannot regain trust by recomputing its own self-hashes. The frozen
generation and validation chain is under
[benchmarks/tools/](benchmarks/tools/) and remains unchanged. The formal workload
is not tuned to the current Solver: rules require realistic, hard instances and
forbid deleting an instance merely because the Solver cannot solve it.

The current corpus acceptance is special. The frozen validator is executed
unmodified, and exactly one error class may be deferred: a game-semantics file's v1
byte pin. In the current tree only `shapeOperations.js` is deferred; its v1 pin is
replaced, not skipped, by the current v2 pin, and only when the file on disk equals
that current pin. Every other error — targets, seed, catalog, schemas, replay,
artifact content, projection, witness or rejection log — remains blocking.
`--semantics=strict` keeps the v1 byte identity and is expected to fail outside the
reconstructed v1 tree.

### 5.2 The frozen corpus

The trusted policy currently contains six profiles totalling 195 instances:

| Profile (artifact release) | Instances | Role |
| --- | ---: | --- |
| `hard-pilot-audit-v2` | 25 | Original pilot re-audited with causal metadata |
| `hard-coverage-pilot-v1` | 5 | Generation-capability coverage |
| `hard-expansion-pilot-v1` | 6 | Input-environment expansion |
| `hard-53x1-stage-v1` | 53 | One instance per official Hard target |
| `hard-53x3-diversity-pilot-v1` | 26 | Diversity pilot |
| `hard-53x3-rollout-stage-v1` | 80 | Rollout stage |

The **formal composite release** is separate:
[hard-53x3-stage-v1.release.json](benchmarks/releases/hard-53x3-stage-v1.release.json)
selects 53 targets × 3 structural-family slots (F1/F2/F3) = **159 members** from six
frozen source artifacts: the 53×1 baseline, diversity pilot, rollout stage,
deep-diversity pass, optional promotions and final depth reselection. Its canonical
identity and final-selection identity are pinned in
[benchmarks/policy/](benchmarks/policy/) and in
[docs/benchmark/PROVENANCE.md](docs/benchmark/PROVENANCE.md). The 159 members are
references into immutable source instances; the composite manifest does not copy or
rewrite them.

The matrix does not stop at 195. The acceptance entry also scans every frozen
Benchmark JSON artifact in
[versions/frozen-v1.inventory.json](versions/frozen-v1.inventory.json), including
source/core artifacts outside the final 159, and re-deduplicates by instance
content. That yields **331 unique witness instances** (30,158 steps). The exact
numbers are frozen data; the gate recomputes them from the files rather than
trusting a document.

### 5.3 Witnesses, records and formal acceptance

These are different kinds of evidence and must not be conflated:

| Artifact | What it is | What it proves |
| --- | --- | --- |
| A Benchmark **witness** | A recorded operation sequence from the available inputs to the exact target, with resource accounting | The instance is constructible under the recorded rules; it is not a Solver result |
| A **baseline record** in [benchmarks/solver-baselines/hard-53x3-v1/records](benchmarks/solver-baselines/hard-53x3-v1/records) | A frozen historical Solver outcome for one selected member | The record and its hashes are intact; the original Solver source was not recovered in the audited scope (see [REPRODUCIBILITY.md](docs/benchmark/REPRODUCIBILITY.md)) |
| The **E-014 experiment result** in [benchmarks/experiments/interior-crystal-column-v1/ICCDCS-A/repeat.json](benchmarks/experiments/interior-crystal-column-v1/ICCDCS-A/repeat.json) | Frozen solution paths from the constructive-hybrid experiment for the 159 selected members | The exact path compatibility contract checked by the current acceptance entry |
| The **current acceptance** | One current Solver call per selected member plus witness/physics replay | This commit reproduces the 159 exact paths and 331 witnesses |
| An **official-workload report** in [benchmarks/results/](benchmarks/results/) | Dated performance observations with their own Solver hash | Historical measurement only; never pass/fail acceptance |

The current acceptance entry requires all 159 results to use
`constructive-hybrid`, to equal the frozen E-014 path exactly, to replay without
error, to reuse no consumed token, and to cover 53 distinct targets. It also runs
the reconstructed v1 Solver and checks that it produces the same selected paths,
and it checks that the reviewed v2 physics corrections do not change any selected
output. A failure here is a compatibility failure, not a reason to edit the frozen
expectations.

### 5.4 Research generators, frozen planner copies and validation basis

[benchmarks/tools/](benchmarks/tools/) contains the frozen generation framework,
environment expansion, four `*-planner.mjs` copies, the validators and the shared
Benchmark core. The four copies are byte-frozen historical snapshots. They are
still imported by the frozen v1 generators, so deleting or merging them would break
both the 461-file identity and historical regeneration. The dependency roles are
distinct:

- **Production runtime:** for planner code, [shapeSolver.js](shapeSolver.js)
  imports only the maintained implementations in [constructive/](constructive/).
  The production import-graph test asserts that `benchmarks/` is absent, and the
  application closure rejects any non-application import.
- **Direct planner tests:** the tests that exercise planner behaviour directly
  import the maintained implementations:
  [tests/benchmark.test.mjs](tests/benchmark.test.mjs) and
  [tests/mixedPinCrystalGoalDecomposedSolver.test.mjs](tests/mixedPinCrystalGoalDecomposedSolver.test.mjs).
- **Research regression tests:** [tests/deepDiversity.test.mjs](tests/deepDiversity.test.mjs)
  and [tests/finalDepthReselection.test.mjs](tests/finalDepthReselection.test.mjs)
  still execute frozen research generators. Those generators reach
  [macro-plan-enumerator.mjs](benchmarks/tools/macro-plan-enumerator.mjs), which
  imports and uses the frozen Pin, Crystal and Mixed planners. This is an indirect
  historical-generation and reproduction dependency, not a production runtime
  dependency. `tests/benchmark.test.mjs` also uses frozen pilot/audit generators and
  the frozen generation framework as test fixtures, but that path does not import
  the four frozen planner copies.

This separation is intentional. If the frozen generator were changed to import the
current production planner, “historical regeneration” would be decided by today's
mutable code — a self-certification loop. The repository instead keeps fixed bytes
and re-runs the original tools from fixed Git objects. Do not “deduplicate” these
files by editing the frozen side.

[benchmarks/tools/benchmark-core.mjs](benchmarks/tools/benchmark-core.mjs),
`validate-benchmark.mjs` and `repository-policy.mjs` are the shared validation
basis. `benchmark-core.mjs` (and the validators built on it) uses production shape
operations for witness replay, so that replay is a production-physics semantic
check, not the independent model. The independent check is the separate layer
described in section 4.

Two standalone research solvers are deliberately outside the production closure:
[targetConditionedSolver.js](targetConditionedSolver.js) and
[bestFirstPlanSolver.js](bestFirstPlanSolver.js). They have their own tests and
Benchmark-tool entry points, but `shapeSolver.js` does not import them and the
application closure does not ship them. Treat their experiment records as research
evidence, not as current production behaviour.

### 5.5 What a green Benchmark does not mean

Passing the formal workload means the fixed 195-instance corpus and 159-member
composite replay under the current rules, and the selected 159 paths are
reproduced. It does **not** mean the Solver covers the public API's input space.
The corpus fixes `cleanPainting = true`, disables splitting and caps construction at
four layers; the constructive routes accept only narrow parameter combinations;
general search is bounded. The `cleanPainting` defect is the concrete lesson: the frozen suite was
green while the public API could return an invalid constructive success. Coverage
must be argued from explicit public-API tests, not inferred from a green corpus.

The exact-path check is a compatibility contract. Research may discover a shorter
or otherwise better path, but the frozen expectations are not silently replaced.
Adopting a different path requires an explicit new acceptance/experiment decision
and a new record; it is not a routine test update. Conversely, a new algorithm may
be developed and measured outside the frozen path set, provided production success
still preserves the contract.

The Benchmark rules themselves are frozen inputs. Editing an instance, witness,
count, projection, policy or manifest to make a test pass creates a new Benchmark
release with new identities, not a documentation fix. If a real rule question
exists (the unresolved Splitter throughput question is the known example), record
it and leave the formal data frozen.

## 6. Current and historical identity

### 6.1 The current certificate

[versions/current.mjs](versions/current.mjs) defines the current certificate:

- `verifyCurrentSource` requires an explicit full commit equal to `HEAD`, a clean
  tracked tree, no untracked source inputs, regular non-redirected files, and each
  tracked file's working bytes equal to its Git blob or to a pinned original-byte
  representation.
- `verifyCurrentInputs` binds the immutable inputs: the v2 semantics files, all
  frozen `benchmarks/**` files plus `docs/benchmark/USER_RULES.md`, all `versions/**`
  files in the fixed historical tree, `tests/fixtures/physics-v2/**`, and the two
  locked strict-routing holdout files. It reports the number of frozen and
  immutable files it checked.
- `prepareCurrentInputs` restores only those immutable working representations; it
  never restores current scripts or source.
- The gate emits `maintenance-source/1`, `maintenance-inputs/1` and
  `maintenance-behavior/1` identities, plus logs and acceptance outputs under the
  ignored `.ci-results/current/`.

There is no mutable source manifest pinned for the maintained branch. The Git
commit and tree are the source identity. Algorithm modules may therefore change
through reviewed commits, while the immutable inputs above may not. This is the
difference between “current maintenance” and a sealed historical release.

The current trust roots are:

- [versions/index.json](versions/index.json) — canonical hashes of the v1 and v2
  manifests; its `current` entry selects v2;
- [versions/SEMANTICS_V2.md](versions/SEMANTICS_V2.md) — the current v2 semantics
  description;
- [versions/frozen-v1.inventory.json](versions/frozen-v1.inventory.json) — the
  file-level 593-file frozen inventory;
- [docs/release/frozen-maintenance.json](docs/release/frozen-maintenance.json) —
  the fixed v1 head/tree, original commits, tag and file hashes.

The root [release.json](release.json) is **historical Release 1 metadata**, not a
current build descriptor. Current builds generate their own
`dist/<profile>/release.json`.

### 6.2 Independent historical certification

[scripts/ci/verify-history.mjs](scripts/ci/verify-history.mjs) is the independent
historical entry. It:

- reads the fixed Release 1 Git object rather than current HEAD source;
- uses the disposable Release 1 archive as the evidence root for the version
  index, pin, manifests, inventory, recovery recipes and verifiers;
- reconstructs the v1 tree (593 files, exact original working bytes) and the
  Physics v2 RC from existing Git objects;
- verifies all 781 Release 1 source files, the 8 original commit objects, the
  annotated `hard-capable-v1` tag, both frozen version identities and the frozen
  file inventory;
- runs the original v1 suite (198 tests), frozen evidence checks, the v2 and
  Release 1 regression suites, and independent Physics v2/Release 1 acceptance;
- installs fresh locked dependencies in a disposable tree and never uses the
  current checkout's `node_modules`;
- proves that the distinct implementations cannot be substituted for one another
  at the verifier boundary;
- disables Git replacement objects so ambient replacements cannot alter archives
  or old helpers.

This entry is not part of the daily gate. It runs on manual dispatch and on changes
to frozen identity inputs, authenticators, policies or trust roots
([.github/workflows/verify-history.yml](.github/workflows/verify-history.yml)).

The division of responsibility is:

| Question | Current gate | Historical entry |
| --- | --- | --- |
| What source is being checked? | Git-selected HEAD commit | Fixed historical Git objects, never HEAD |
| What is reconstructed? | v1 tree only as a comparison input | Release 1, v1 and Physics v2 trees |
| Which suites run? | Current regression + corpus + current acceptance + both static profiles | v1, Physics v2 and Release 1 original suites, frozen evidence and acceptance |
| When does it run? | Pushes/PRs to the maintenance branches | Manual dispatch or frozen-identity changes |
| What does it certify? | This commit's current behaviour | The fixed historical identities |

A current run does not certify Release 1; a historical run does not certify HEAD.
Historical-only entries such as
[prepare-checkout.mjs](tools/release1/prepare-checkout.mjs),
[build.mjs](tools/static-build/build.mjs),
[verify.mjs](tools/static-build/verify.mjs),
[acceptance.mjs](tools/static-build/acceptance.mjs), `npm run verify:physics-v2`,
`npm run measure:physics-v2` and the closed
[strict-orientation reproduction](docs/strict-orientation-constructive-20261030/REPRODUCE.md)
fail closed at their identity checks when pointed at this branch. That is expected,
not a regression.

### 6.3 Objects frozen by history

| Object | Why it must not be rewritten |
| --- | --- |
| v1 commit/tree (`0647b85…`) | Bound by `frozen-maintenance.json`, the 593-file inventory and the historical entry |
| Eight original commits and `hard-capable-v1` tag | Raw commit/tag SHA-256, ancestry and tag target are verified |
| Release 1 commit/tree (`5fbba47…`) | Evidence root for the historical entry and the 781-file source identity |
| Physics v2 RC commit/tree (`ec9cc5c…`) | Historical RC identity and acceptance root |
| Frozen Benchmark blobs/manifests/policy | Byte identity for 461 files; a change is a new Benchmark release |
| `shapeSolver_web.js` | Frozen Release 1 runtime artifact; it is hashed, never executed, and need not equal `shapeSolver.js` |
| `docs/benchmark/GAME_SEMANTICS.md` | Frozen v1 semantics record; never edit it to point at v2 |
| Root `release.json` | Historical Release 1 metadata; current builds use their own generated descriptor |

Git replacement objects are disabled by both entries. Do not amend, rebase, force
push or rewrite published commits/tags to make a check pass. Do not normalise the
frozen files' line endings: the inventory distinguishes Git blob hashes from the
original working-byte hashes, and `.gitattributes` deliberately disables automatic
line-ending conversion for the protected paths.

`shapeSolver_web.js` deserves a specific warning. It is a historical artifact, not
a second maintained Solver. The old rule requiring it to be byte-identical to
`shapeSolver.js` is void. Do not copy it over the current Solver, do not edit it,
and do not treat a difference between the two files as a bug.

The old planners and research tools are retained for the same reason: they are
evidence and frozen inputs, not current production dependencies. Some of them can
still be executed from the fixed historical tree; none of them should be wired into
the current Worker.

### 6.4 Safe change model

- Current algorithm or UI: make a reviewed commit on `codex/maintained`, then run
  the current gate against that commit.
- Benchmark content or rules: a new Benchmark release/manifest revision and a new
  policy pin; never an edit to a frozen file.
- Physics semantics: a new physics version/manifest; the v2 semantics files are
  immutable inputs for this maintenance certificate.
- Historical evidence: a new experiment or record; never a rewrite of an old
  record, tag, blob or manifest.
- Release/deployment: a separate decision. Nothing in this repository currently
  authorises a deployment of this branch (see section 8).

Reference roles for those changes (authoritative rules:
[docs/release/VERSIONING.md](docs/release/VERSIONING.md)):

- **Development**: `codex/maintained`, the GitHub default branch and the only
  branch that receives new work.
- **Frozen historical preservation**: `codex/pre-migration-main` and
  `codex/solver-optimization`, both at `0647b85` (v1). They share a commit but
  serve different purposes — pre-migration `main` state and optimisation-batch
  provenance — and neither is a development branch.
- **Independent upstream lineage**: GitHub `main` at `ba62646`. Read-only.
- **Deployment**: Gitea `main` at `0647b85`, which triggers the Gitea deploy
  workflow. Do not fast-forward it to sync maintenance code.
- **Historical certification tag**: `hard-capable-v1` (`c27b895` → `f62683a`).
  It is not the current product version.

## 7. Development and research workflow

### 7.1 Read before changing an algorithm

At minimum:

1. this document's section 3;
2. [README.md](README.md) for commands, prerequisites and current limits;
3. [docs/release/CI.md](docs/release/CI.md) for gate phases and the dated test
   snapshot;
4. [versions/SEMANTICS_V2.md](versions/SEMANTICS_V2.md) and the current manifest for
   physics scope;
5. the relevant solver/planner module and its `*.test.mjs` neighbours;
6. the Benchmark rules only if the change touches corpus acceptance or research
   data.

For a routing change, also read `strictOrdinaryEligible`,
`tryStrictConstructive`, `tryHybridConstructive` and
`validateHybridPlan`/`validateStrictPlan`. For a planner change, read the
delegation stage above it and the frozen-path acceptance entry.

### 7.2 Locate the effective rules

- Current physics: `SHAPE_OPERATIONS_SEMANTICS` in
  [shapeOperations.js](shapeOperations.js), [versions/index.json](versions/index.json)
  and [versions/SEMANTICS_V2.md](versions/SEMANTICS_V2.md).
- Current source: the Git-selected commit and [versions/current.mjs](versions/current.mjs).
- Current Benchmark acceptance: [benchmarks/policy/official-policy.v1.json](benchmarks/policy/official-policy.v1.json)
  plus the release manifests it pins.
- Benchmark rule precedence: USER_RULES > BENCHMARK_RULES > METHODOLOGY.
- Historical identities: the fixed commits/manifests, not current files.
- Deployment status: [README.md](README.md), not an old phase report.

If two documents disagree, decide which class of statement is at issue. Behaviour
is implemented by source and tested by the current gate; normative Benchmark rules
are owned by the rule documents and policy; historical facts are owned by the fixed
objects.

### 7.3 Focused and full checks

The command list and prerequisites are maintained in [README.md](README.md); the
phase descriptions and dated counts are in [docs/release/CI.md](docs/release/CI.md).
Use this section only to choose the right entry:

| Need | Entry | When |
| --- | --- | --- |
| One behaviour | `node --test tests/<name>.test.mjs` | Fast local iteration |
| Whole current suite | `npm test` | Before committing any solver change |
| Corpus acceptance | `npm run bench:validate` | After a physics, corpus-adjacent or rule-facing change |
| Full current gate | `node scripts/ci/verify-current.mjs --commit=$(git rev-parse HEAD)` | After the final commit; requires a clean tracked tree |
| Build one profile | `node tools/static-build/build-current.mjs <profile> --commit=<HEAD>` (`global` or `china`) | When changing the browser app or build inputs |
| Verify both profiles | `node tools/static-build/verify-current.mjs --commit=<HEAD>` | The gate already does this |
| Historical certification | `node scripts/ci/verify-history.mjs` | Frozen-identity changes or explicit review |
| Official workload sample | `npm run bench:official -- --suite hard --partition development` | Opt-in performance observation |
| Browser Worker lifecycle | `npm run test:browser-worker` | UI/Worker protocol changes; needs Chrome or Edge |

The current gate is deliberately strict: it refuses an uncommitted tree, a commit
that is not `HEAD`, and any untracked input outside the ignored outputs. Commit the
finished change first, then run it. It writes ignored logs under `.ci-results/current/` and ignored
`dist/<profile>/`; those outputs are evidence, not commits.

Do not weaken a check to get a green run. A failure in identity, corpus or frozen
path acceptance is a signal that the change crossed a boundary; fix the change or
make an explicit new-identity decision.

### 7.4 When historical certification is required

Run the historical entry when a change touches any of:

- `versions/**`, `docs/release/frozen-maintenance.json`, the version index or a
  release pin;
- `scripts/ci/verify-history.mjs`, `scripts/ci/verify-frozen.mjs` or the historical
  preparers under `tools/release1/`;
- `tests/helpers/historicalV1Test.mjs`, `tests/tools/runHistoricalV1.mjs` or
  `tests/fixtures/physics-v2/**`;
- `benchmarks/policy/**` or other frozen trust roots.

Ordinary current-only changes do not need it, and the current gate does not run the
v1 suite. A change to current solver algorithms can still affect the current
acceptance of the frozen paths; that is checked by the current gate, not by
rewriting the historical evidence.

### 7.5 Ordinary, holdout and performance validation

- **Ordinary cases**: the current suite and the 195-instance corpus cover the normal
  domains. Use focused tests plus `npm test` for a change.
- **Locked routing holdouts**: [tests/strict-routing/holdouts.json](tests/strict-routing/holdouts.json)
  contains prespecified routing cases locked by
  [holdout-lock.json](tests/strict-routing/holdout-lock.json). The daily suite
  checks that the bytes remain locked; executing the cases is a deliberate review
  step for routing/coverage changes. Do not tune on them or edit them.
- **Official-workload holdouts**: [benchmarks/manifest.json](benchmarks/manifest.json)
  has `development`, `validation`, `holdout` and `stress` partitions. A holdout run
  requires `--include-holdout`; use it for review, not for iterative tuning.
- **Performance**: `npm run bench` is the synthetic quick baseline;
  `npm run bench:full` and `bench:stress` are larger observation modes.
  `npm run bench:official` is the manifest-driven workload. Reports are
  observations, not pass/fail gates; they record the executed current Solver hash
  and the frozen Release 1 runtime pin separately.
- **Browser performance**: the default `npm run measure:browser-performance` output
  path is a frozen evidence file. Pass `--output` to an ignored or OS-temporary
  path when running it in this tree, or leave the frozen result untouched. This
  command is not part of the daily gate.

### 7.6 Evidence and workspace hygiene

- Do not edit, move, rename, regenerate or annotate frozen Benchmark files. A
  change there is a new Benchmark release, not a cleanup.
- Do not write logs, reports, clones or caches into tracked paths. The ignored
  areas are `node_modules/`, `.ci-results/`, `dist/`, `.f1/`, `.release1/`,
  `.codex-temp-*` and profiling NDJSON; an OS temporary directory is preferred.
- Both gate entries clean their own `mkdtemp` directories in a `finally` block. A
  forced termination can leave a `shapez2-current-*` or `shapez2-history-*`
  directory under the OS temp root; remove only those known prefixes.
- `test:historical-v1` also uses an OS temporary directory. Do not create a
  project-local historical tree.
- Do not commit generated `dist/`, `.ci-results/`, dependency trees or performance
  artifacts. Do not overwrite `benchmarks/integration/browser-performance-v1/results.json`.
- Do not use `verify:physics-v2` or `measure:physics-v2` as current commands; they
  are historical-only and refuse this branch.

## 8. Known limits and research cautions

These are long-lived constraints, not a task list:

1. **The public API is larger than the frozen corpus.** The 195-instance corpus and
   the 159-member composite use fixed rules and parameters. Passing them does not
   prove coverage of every target/input/operation/layer/rule combination. Add
   explicit public-API tests for any new routing or constraint claim.
2. **Constructive solving is domain-limited.** It is entered only under the strict
   and hybrid eligibility conditions, and each ladder stage checks its own topology.
   Everything else falls to bounded search.
3. **General search is incomplete and non-optimal.** Beam pruning is reported as
   `not-found-pruned`, not as exhaustion. A `limit` result is a safety outcome, not
   a proof that no solution exists.
4. **The 159 exact frozen paths are a compatibility contract.** A better path is a
   new decision, not a silent replacement. This is a hard constraint on constructive
   output, independent of how the Benchmark witnesses are generated.
5. **The independent model is in-repo and model-relative.** It is not the game
   engine. Full game-version-specific certification remains `UNKNOWN`; browser and
   platform coverage are also unknown beyond the optional Chrome/Edge checks.
6. **The historical baseline Solver source was not recovered in the audited
   scope.** The 159 historical result records are hash-verifiable, but the original
   execution source is unavailable for a full rerun; copies outside the audited
   scope remain `UNKNOWN`. See
   [REPRODUCIBILITY.md](docs/benchmark/REPRODUCIBILITY.md). Do not describe record
   verification as re-running that missing Solver.
7. **Historical results are not current acceptance.** A v1/Physics v2/Release 1
   PASS certifies a fixed historical object, not this branch.
8. **Splitter success semantics are unresolved in the formal Benchmark.** Formal
   profiles disable splitting; the Solver's `allowSplitting` option is a separate
   public search feature, not permission to assume a Benchmark answer.
9. **No release path is functional for this branch as of 2026-11-01.** The
   [Pages workflow](.github/workflows/pages.yml) builds with the Release 1 entry and
   requires the Release 1 identity; the
   [Gitea workflow](.gitea/workflows/deploy.yml) triggers only on Gitea `main` (the
   Release 1 tree) and its whitelist is incomplete;
   [PUBLISH_PLAN.md](docs/release/PUBLISH_PLAN.md) was never executed. Treat
   deployment status as a dated observation and re-check [README.md](README.md)
   before making any claim.
10. **The documentation-link phase does not cover this file.** The gate checks
    README and selected release/legal/benchmark documents. Links in this summary are
    maintained by review; verify them after edits.
11. **Performance claims are not stable.** Past timing batches had mixed directions
    and dispersion. Use the current performance entries and report observations with
    their environment and source identity.

## 9. Authoritative document index

| If you need… | Read… |
| --- | --- |
| Install, commands, current maintenance state, release limits | [README.md](README.md) |
| Gate phases, prerequisites, dated test snapshot, hosted-CI interpretation | [docs/release/CI.md](docs/release/CI.md) |
| Clean-clone reproduction and historical limitations | [docs/benchmark/REPRODUCIBILITY.md](docs/benchmark/REPRODUCIBILITY.md) |
| Benchmark provenance, frozen identities and licence boundaries | [docs/benchmark/PROVENANCE.md](docs/benchmark/PROVENANCE.md) |
| Normative Benchmark rules | [USER_RULES.md](docs/benchmark/USER_RULES.md) → [BENCHMARK_RULES.md](docs/benchmark/BENCHMARK_RULES.md) → [BENCHMARK_METHODOLOGY.md](docs/benchmark/BENCHMARK_METHODOLOGY.md) |
| Current physics scope | [versions/SEMANTICS_V2.md](versions/SEMANTICS_V2.md) |
| Historical certification design | [docs/release/HISTORICAL_VERIFICATION.md](docs/release/HISTORICAL_VERIFICATION.md) |
| Branch roles, tag namespaces, release conditions | [docs/release/VERSIONING.md](docs/release/VERSIONING.md) |
| Physics v2 RC scope (dated snapshot) | [docs/release/PHYSICS_V2.md](docs/release/PHYSICS_V2.md) |
| Future release architecture (not current) | [docs/release/ARCHITECTURE.md](docs/release/ARCHITECTURE.md) |
| Closed optimisation research record | [docs/optimization/README.md](docs/optimization/README.md) |
| Closed strict-orientation experiment | [docs/strict-orientation-constructive-20261030/REPORT.md](docs/strict-orientation-constructive-20261030/REPORT.md) |
| Licensing, attribution, third-party boundaries | [docs/legal/LICENSING.md](docs/legal/LICENSING.md), [docs/legal/ATTRIBUTION.md](docs/legal/ATTRIBUTION.md), [docs/legal/THIRD_PARTY.md](docs/legal/THIRD_PARTY.md), [LICENSE](LICENSE) |
| Translation terminology | [docs/i18n/TERMINOLOGY.md](docs/i18n/TERMINOLOGY.md) |

The old phase reports and `docs/optimization/*` are evidence, not operating
instructions. In particular, `docs/optimization/WORKFLOW.md` no longer governs
anything, and the old byte-identity rule for `shapeSolver_web.js` is void.

If a future change needs a rule or identity that this summary does not cover, stop
and read the authoritative document or the selected source before proceeding. The
repository is designed to fail closed when a boundary is crossed; that failure is
information, not an obstacle to route around.
