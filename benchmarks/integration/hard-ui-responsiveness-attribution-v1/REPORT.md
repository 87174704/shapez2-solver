# P8-03 Hard UI Responsiveness Attribution

Status: `ATTRIBUTED / FIX VALIDATED`  
Date: 2026-10-02 (Asia/Shanghai)

## Scope

This diagnostic used the real `/en/` page in installed Chrome `154.0.8037.59`, native module Workers, the frozen 52-step interior-Crystal workload, Chrome tracing, the V8 CPU profiler, Long Tasks, and temporary phase probes. The probes were removed before formal acceptance; the frozen acceptance harness returned to SHA-256 `104888D64FEFC0FEDA435EF7078E7B510CB84F767A2D11581D9E4732BF1212F3`.

## Attribution

The reproduced diagnostic breach was a 118.4 ms page-timer gap. Worker computation ran on the trace's `DedicatedWorker thread` and was not counted as main-thread CPU attribution. On `CrRendererMain`, the terminal `HandlePostMessage` task took about 73 ms, with about 72 ms inside synchronous Cytoscape construction called by `renderGraph()`. The CPU profile localized the dominant self samples to Cytoscape style-hint/style application and element construction, with short scavenges throughout. The following Cytoscape animation-frame paint was a separate renderer task. Canvas `toDataURL()` was not called in measured repeated runs because the accepted bounded shape-image cache hit; traced browser layout itself was below 1 ms.

The failure was therefore not Solver search, Worker-internal compute, path conversion, canvas serialization, or browser layout. It was repeated destruction/recreation of the solver Cytoscape renderer and stylesheet immediately after the Worker result, plus its first paint, while an already-due heartbeat was waiting.

Key raw evidence:

- `phase-probe.json`: 20 untraced Hard measurements; max timer gap 120.7 ms and Cytoscape constructor up to 79.6 ms.
- `cpu-trace-probe.json`: captured the 118.4 ms breach with a 73 ms main-thread long task and 72.1 ms observed Cytoscape call.
- `cpu-traces/1-interior-crystal-constructive-2.json`: trace and CPU profile for that breach; SHA-256 `D98846508246A77C061D54769F2E829649A750B153E69CD784DFE0301EEC428A`.

## Minimal repair

The accepted repair keeps Solver semantics, Worker payloads, graph data, shape images, labels, preset coordinates, directions, and interactions unchanged:

1. Yield one main-thread turn after the terminal Worker result before synchronous graph rendering, with a task-identity check so cancellation during the yield suppresses stale rendering.
2. Reuse the active solver Cytoscape instance for later solver results and atomically replace its elements plus preset layout, instead of destroying and recreating the renderer/stylesheet each run. Mix and Explorer graphs retain their existing reset paths.

No result caching or graph-update skipping is used.
