# Phase B2：验收重复求解与源码身份阻点

> **Superseded（历史记录）。** B2 去重已由 `60981ab`
> （collapse duplicate 159-case Solver acceptance）与 P1/P2 的当前 Corpus 验收
> 实现；当前门禁对 159 个案例各执行一次当前 Solver 调用，见 [CI.md](CI.md)。
> 本文保留 `855d96e` 时点的阻塞状态记录，以下陈述不再是当前要求。

2026-11-01，工作区 `E:\solver`，基线提交
`855d96efbad20dd9d52f9abc304ad6f4f4fe5458`，Node `v24.21.0`。

**B2 去重尚未完成。** 本次只新增本文，未修改验收、Solver、Benchmark、
历史入口、冻结清单、pin、构建器或工作流。下述 PASS 是原有检查的实测结果，
不是去重实现的验收结果。没有以删除检查、放松身份验证或运行时替换实现取得 PASS。

## 两个 159 案例入口的实际执行

两个入口均按文件名排序读取
`benchmarks/solver-baselines/hard-53x3-v1/records/*.json`，解析每条记录指定的
`sourceArtifact`，按 `instanceId` 找实例，检查声明的实例哈希与
`sourceInstanceSha256` 相等。两者使用同一份 E-014 `ICCDCS-A/repeat.json`
的精确路径；Physics 入口还先验证 Release 1、v1 身份和全部冻结 Benchmark 文件。

两者传给当前 `shapeSolver` 的九项参数逐项相同：一个目标、展开有限输入库存、
全部十种操作、`maxLayers=4`、`maxStatesPerLevel=3000`、
`preventWaste=false`、`orientationSensitive=false`、`allowSplitting=false`、
`cleanPainting=true`。实测 159 组参数各自唯一，两个入口的参数多重集合相同。

| 入口 / 执行或断言 | 实际检查及输出 |
| --- | --- |
| `tests/tools/validatePhysicsV2.mjs`：身份 | 当前 Release 1 合法、历史 v1 合法；输出中保留两者身份 |
| 全冻结 witness | 按完整实例 JSON 哈希去重；331 个引用、331 个实例；资源 witness 回放合法；30,158 步逐步物理检查；输出 `all-frozen-witnesses.json` |
| 物理观察 | 原生产操作与加观察钩子的操作输出一致；与独立物理模型一致；合法编码、层数、象限、支持图、支持闭包和整组件破坏断言 |
| 物理控制 | 367 个 lateral 控制逐项核对旧证据并检查当前独立物理输出；6 个传播触发、5 个 helper 控制；仅允许已审阅的 25 个变化；输出 `controls.json` |
| 159 个成员的 witness | 有限资源 witness 回放和逐步物理检查，15,150 步 |
| 159 条冻结路径 | 当前资源 oracle 回放和逐步物理检查，11,087 步 |
| 159 次旧 Solver 求解 | 每条结果路径 `deepEqual` 冻结路径，错误信息 `reproduced v1 path` |
| 159 次当前 Solver 求解 | 有成功路径；每条路径 `deepEqual` 冻结路径；资源 oracle 回放合法；逐步物理检查，11,087 步 |
| 旧操作比较 | 对全部上述路径逐步调用旧操作，与当前操作比较；总差异必须为零 |
| Physics 汇总 | 159 个案例、零路径差异、零操作差异；输出每 30 条进度、最终 JSON、含输入/完整结果/耗时的 `acceptance.json` |
| `tests/tools/verifyBrowserSafeProduction.mjs`：159 次当前求解 | 每条路径按 JSON 序列化精确匹配冻结路径；用相同资源 oracle 再次回放；每条结果必须走 `constructive-hybrid` |
| 生产汇总 | `members=solved=replayValid=exactE014Paths=constructiveRoutes=159`，`resourceReuse=0`，`distinctTargets=53`；输出一行 `PASS` JSON，任一条件不满足即抛错 |

资源 oracle 逐步检查输入 ID 存活与形状、输入不可重复消费、新输出 ID、深度、
操作开关、参数与颜色、cleanPainting、物理输出及顺序（只有 Swapper 按多重集合）、
吞吐库存、最终目标分配、方向和 waste 条件。两个入口的 159 组参数均为方向不敏感；
严格方向、开关变化、回退等边界由下述回归套件另行覆盖，不能声称这 159 组输入已覆盖它们。

## 重复、独立检查与历史专用检查

- 可证明重复的是两个当前入口各 159 次、完整参数相同的当前 Solver 求解。
  理想复用范围仅为这些求解结果；两组路径、资源、物理、路由断言仍须执行。
- 独立物理模型、观察模块的支持图/闭包/组件检查、witness 资源回放、
  Solver 路径资源 oracle、路由统计承担不同职责，不能随求解去重而消失。
  witness 与 Solver 路径的长度和资源 lineage 也不同。
- 精确路径相等后，冻结路径与当前路径的部分逐步检查重复；本轮未删除它们，
  也未把独立物理检查替换成路径字符串相等。
- 旧 Solver 重现冻结路径、旧操作逐步比较、旧控制证据属于历史比较。
  正式历史入口已保留旧实现和原断言，但当前入口中的旧操作比较仍将当前输出与
  旧输出直接对照。没有将它们直接删掉，也没有将“固定历史快照通过”冒充
  “当前实现与旧实现的全部比较等价”。
- `tests/strict-routing.test.mjs` 保留方向、有限库存、非法计划、操作禁用、
  参数、cleanPainting、副产物、waste、超时计费、构造异常和真实回退检查；
  `tests/productionConstructiveHybrid.test.mjs` 保留浏览器安全依赖图、生产路由、
  不支持构造和不适用参数的回退检查；`tests/shapeSolver.oracle.test.mjs`
  保留资源、方向、多目标、拆分 lineage、参数和确定性参考矩阵。

## 为何不能在本轮边界内接入复用

三个需要修改的文件均在不可修改的 Release 1 `source.files` 中：

| 文件 | 已冻结 SHA-256 |
| --- | --- |
| `tests/tools/validatePhysicsV2.mjs` | `da2b16b33c6230f6974a56282247987b744f8e4c150ef96e85be7b512171f77a` |
| `tests/tools/verifyBrowserSafeProduction.mjs` | `278e96ea60c3b0c38b169544bea3dd0651e048c23ef96d1f5580bece633c73c1` |
| `scripts/ci/verify.mjs` | `dc137fbdc83bbddda2513adf1eb5f8f37a2a3af29e053c03f9b88692cd4686ac` |

隔离实验复制目录结构并建立文件硬链接，修改前先断开待修改文件的硬链接，
保证正式工作区字节不受影响。原副本 `verifyRelease({root})` 为真；分别对上表
三个文件只追加一条注释，校验均返回假，且唯一错误恰为对应的
`source: <文件路径> hash differs`；逐项恢复后再次返回真。副本随即清理。

这不是仅文档上的约束：

1. `tools/release1/prepare.mjs` 的 `restore(ROOT, m.source.files)`
   只容许可恢复为原哈希的换行差异；真实脚本修改会报 `Content differs from pinned identity`。
   full CI 第一阶段调用它，语义修改甚至早于身份阶段失败。
2. `versions/release1.mjs` 对全部 781 个源码文件逐项校验；full CI 的
   `release1-identity`、Physics 入口开头、现有身份回归都会拒绝上述修改。
3. `tools/static-build/build.mjs` 在构建前要求同一 `verifyRelease()` 成功；
   静态验证末尾还检查对旧 RC 的改动文件列表必须精确等于固定白名单。
4. 仅添加新脚本不会让现有 `node scripts/ci/verify.mjs` 使用它。
   修改启动脚本、白名单、pin、身份逻辑，或者绕过这些检查，均不能在本轮
   要求下被当作已完成的安全去重。

因此本次保留原状。没有引入源码重写 loader 作为产品或 CI 实现，没有伪装缓存
结果为一次新求解，也没有给历史失败增加跳过分支。

## 实测调用次数及前后对比

计数范围是两个 159 入口，不含回归套件中的其他求解或独立历史入口。
在临时 Node `registerHooks` 观察器中，仅对加载到内存的 `shapeSolver.js`
的 `async function shapeSolver(...)` 入口加一条调用记录：入口脚本路径、
被加载 Solver 的完整模块 URL、`sha256(JSON.stringify([...arguments]))`。
每个模块必须恰有一个函数锚点，否则观察器失败。所有正式文件字节不变；
不缓存、不改参数、不改返回值。另行运行的完整 CI 不加载该观察器。

| 调用位置 | 文档修改前 | 文档修改后 | 减少 |
| --- | ---: | ---: | ---: |
| Physics：当前 Solver | 159 | 159 | 0 |
| 生产：当前 Solver | 159 | 159 | 0 |
| **当前 Solver 合计** | **318** | **318** | **0** |
| Physics：旧 v1 Solver | 159 | 159 | 0 |
| 两入口全部 Solver 调用 | 477 | 477 | 0 |

未达到用户要求的“实际减少”，不能报告为 B2 PASS。
排序后的 159 个参数哈希数组的 `sha256(JSON.stringify(array))`，两入口均为
`d8d395d2ad6afc1fa9e4cf4b3e3ee313f4619e85b475183d17c756cb8b661822`。

记录文件名排序后，`{caseId, sourceArtifact, instanceId, sourceInstanceSha256}`
数组按 `versions/identity.mjs` 的 canonical 编码计算的摘要为
`fd560bcdbc9728a32efe76b0af22b2753d35e6c42e99209d59e0a5d0bd34c9f3`。
159 条验收结果投影 `{caseId, input, depth, solverRoute, solutionPath}` 的同类摘要为
`ae5ed5eb48c247f4239a839f266afa4d263fd8142ed3acade596c223031c4d90`。
基线完整 CI、计数运行及文档修改后运行逐项比较相等；耗时不参与结果相等比较。

物理计数保持：`outputChecks=67855`、`gravityCalls=57345`、
`supportChecks=4675`、`allPairsChecks=4675`、`componentChecks=476`。
331 witness、159 个成功/资源回放/冻结路径回放/精确路径/旧路径重现均通过，
零路径差异、零操作差异。生产汇总的 53 个目标和全部 159 条路由、零资源复用保持。

## 回归与正式历史入口

`node scripts/ci/verify.mjs` 修改前后均为 11/11 PASS：
`working-representation`、`history`、`release1-identity`、`syntax`、
`documentation`、`historical-v1`、`frozen-evidence-v1`、`regressions-v2`、
`acceptance-v2`、`current-solver-159`、`static-profiles`。
其中历史 v1 回归 198 PASS；当前回归 252 PASS、13 原有 SKIP、0 FAIL。
global / china 构建、重复构建一致性和静态验证通过。
已有的异常输入、manifest/pin/库存/lineage/操作输出/跨版本替换等拒绝矩阵原样执行。

正式独立入口仍是 `node scripts/ci/verify-history.mjs`，本轮实测通过：

- v1：198 PASS，0 SKIP，0 FAIL。
- 冻结 Physics v2：229 PASS，13 原有 SKIP，0 FAIL。
- 固定 Release 1：249 PASS，13 原有 SKIP，0 FAIL。
- Physics v2 与 Release 1 各 159 条精确冻结路径、331 witness、旧 v1 路径重现通过。
- 三种历史身份、593 个原文件字节和 Git blob、8 个原 commit、原 tag 校验通过；
  跨版本实现替换拒绝；该入口的临时根目录已自动清理。

## 后续必须先解决的依赖

需要在后续明确授权的阶段处理当前源码与历史 Release 1 全源码 pin 的绑定，
包括 checkout 恢复器、当前身份断言、源码身份回归、构建器对当前工作区的
旧 Release 身份要求，以及静态验证的旧 RC 差异白名单和 ancestry 要求。
历史入口的固定 ref、manifest、pin 和原拒绝断言应继续独立严格执行。
本轮没有解除任何一项，没有变更 GitHub Actions 或 Gitea，也没有进入 B3。

`tests/shapeSolver.test.mjs` 的既有混合换行工作区字节保持，SHA-256 为
`0fb38ae8cbd84b5962edd708c64dc32b085d0d3dc462068c2cb621b52354edfc`，未纳入提交。
