# Browser-safe production integration

Status: **PASS / STOPPED**

This task repaired the deployment boundary that rejected E-015. It did not start a Solver architecture experiment: E-014 remains frozen at 159/159, and the restored public activation is byte-identical to the evaluated E-015 Solver source (`876a3e5f...191`).

Production now owns browser-safe copies of the four constructive planners and a small pure runtime module for shape parsing and physical column composition. Benchmark generators, artifact validation, Node file I/O, and hashing remain outside the production import graph. The recursive graph from `shapeSolver.js` contains 16 local modules, zero Node/bare imports, and zero modules under `benchmarks/`. Policy-pinned benchmark generator hashes remain unchanged.

The current public entry was executed against all 159 frozen members: 159 solved, 159 independently replayed valid, 159 used the constructive route, 159 complete paths exactly matched frozen E-014 repeat, all 53 targets were covered, and no public or derived token was reused.

The production gate ran against the installed real Chrome executable. Its module Worker completed legacy result/cancel/error/restart lifecycle coverage and a nontrivial interior-Crystal construction through the public production entry. The full repository suite passed 188/188, quick W1 retained depth 6 / 3,612 states / 106,816 candidates and its exact operation signature, all 118 JavaScript/module files passed syntax checks, and the two Solver copies are byte-identical.

Verdict: **PASS / STOPPED**. The browser integration is accepted; E-015 remains a historical `REJECT`, the frozen benchmark was not changed, and no subsequent major task is started.
