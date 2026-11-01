# Phase P4：Planner 双份实现与研究工具解耦

2026-11-01，正式工作区 `E:\solver`。基线为
`a92492a2217cebe614a61fdc1c3b230b2565bae2`。本阶段只处理四组 Planner
的重复实现及其与研究工具、当前测试之间的耦合；Solver 搜索、物理语义、
Benchmark 规则、159 个实例、331 witness 和冻结身份均未修改。

## 真实调用关系

| 类别 | 实现 | 调用方 | 结论 |
| --- | --- | --- | --- |
| 当前生产运行 | `constructive/pin-construction-planner.js`、`crystal-construction-planner.js`、`mixed-pin-crystal-construction-planner.js`、`interior-crystal-column-planner.js` | `shapeSolver.js` 生产路由中的 goal-decomposed、isolated-Pin、mixed、interior 求解器 | 保留并继续维护 |
| 生产共享原语 | `constructiveSolverRuntime.js` | 四个生产 Planner、shared-occurrence 求解器 | 保留；本阶段成为唯一的小型单元/层拼写原语实现 |
| 冻结的历史副本 | `benchmarks/tools/` 下四个同名 `*-planner.mjs` | 冻结的 `build-hard-53x1.mjs`、`macro-plan-enumerator.mjs`；不进入当前生产 Graph | 保留为不可变 Release 1 输入，不再作为当前测试实现 |
| 历史重生成专用 | 六个 `historicalV1Test` 回调及其生成器 | 固定 v1 树 | 从当前 HEAD 退出；`verify-history.mjs` 从固定 Git 对象恢复并执行 |
| 当前测试实际消费 | `tests/benchmark.test.mjs`、`tests/mixedPinCrystalGoalDecomposedSolver.test.mjs` | 原直接导入冻结 Planner 副本 | 改为只使用生产 Planner 和已提交的冻结 artifact |
| 当前验证依据 | `benchmarks/tools/benchmark-core.mjs`、`validate-benchmark.mjs`、`repository-policy.mjs` | 当前 Corpus 验收、artifact/witness 校验 | 保留；这是验证依据，不是 Planner 实现 |

`tests/benchmark.test.mjs` 不再导入任何 `benchmarks/tools/*-planner.mjs`，
也不再运行冻结的 `build-hard-53x1.mjs`。它直接读取已提交的
`benchmarks/hard-53x1/v1/instances.json` 并重放冻结 witness，因此当前测试
既不维护冻结副本，也不通过“当前生成器生成、再被同一验证依据接受”形成闭环。

## 为什么不合并四组冻结副本

四个 `benchmarks/tools/*-planner.mjs` 与 `constructive/*.js` 除 import 路径
和行尾外逐字相同。合并它们本来是最直接的减行方式，但本仓库当前维护证书把
`benchmarks/` 下的 461 个文件全部绑定为不可变输入：

- `versions/current.mjs` 的 `frozenBindings()` 从固定历史对象读取
  `versions/frozen-v1.inventory.json`，要求当前工作树的每个
  `benchmarks/**` 文件与冻结 SHA-256 一致；
- 四个冻结 Planner、`generation-framework.mjs` 和 58 个 Benchmark 工具都在
  这 461 个文件中；
- 冻结的 `build-hard-53x1.mjs` 和 `macro-plan-enumerator.mjs` 继续从同目录
  导入这些副本。

因此删除或改写副本会同时触发两类失败：`verifyCurrentInputs` 的 461 文件
字节身份失败，以及固定 Benchmark 生成工具无法再运行。若为此放宽
`frozenBindings()` 或重封 461 个哈希，就会改动当前认证的信任基础，超出
“不修改 Benchmark 规则、159 个实例、331 witness 或冻结路径”的边界。

更关键的是，若把冻结生成器改为导入生产 Planner，历史 Benchmark 重生成就
会由当前可变 Solver 决定，形成禁止的自证循环。保留固定字节、从固定 Git
对象独立复验，才是本仓库已有的历史独立性设计。故四组算法文本仍保留双份，
但只有 `constructive/` 一份处于维护状态；`benchmarks/tools/` 一份是冻结
历史快照，不再由当前测试维护。

## 实际实施

### 1. 收敛四个 Planner 中重复的拼写原语

`constructiveSolverRuntime.js` 新增唯一的 `EMPTY_PART`、`partCode`、
`layerCode`、`isEmptyLayer`。四个生产 Planner 删除各自的 13 个局部定义并
改用共享实现：

- `partCode`：4 份 → 1 份；
- `layerCode`：4 份 → 1 份；
- `EMPTY`：3 份 → 1 份；
- `isEmptyLayer`：2 份 → 1 份。

这是本阶段唯一改动的生产算法文件；四个 Planner 的规划/构建逻辑、错误文本
和操作序列未变。

### 2. 当前测试改用维护实现

`tests/benchmark.test.mjs` 的 Pin、Crystal、mixed Planner 行为测试改为导入
`constructive/`；`tests/mixedPinCrystalGoalDecomposedSolver.test.mjs` 同样把
mixed Plan 断言改为生产实现。之前该测试用冻结副本断言生产求解器的行为，
两边只是碰巧相同。

### 3. 历史重生成回调用例退出当前 HEAD

`tests/benchmark.test.mjs` 删除六个 `historicalV1Test` 回调。它们只在
`shapeOperations.js` 等于 v1 哈希时运行，当前日常门禁中一直是 6 个 skip；
`verify-history.mjs` 会归档固定 v1 树并在其中执行原文件，因此当前 HEAD 的
副本没有认证作用。删除后当前套件不再加载
`build-coverage-pilot.mjs`、`build-hard-53x3-diversity-pilot.mjs`、
`build-hard-53x3-rollout.mjs` 和 `historicalV1Test` 辅助器。

### 4. 当前测试直接读取冻结 artifact

`hard-53x1` 稀疏掩码和 mixed Planner 测试不再调用冻结生成器，改为读取
`benchmarks/hard-53x1/v1/instances.json`；dense-layer Stack 断言直接用
`shapeOperations.js` 的 canonical `stack` 完成。生成尝试日志和完整重生成
相等性仍由固定 v1 历史入口验证。

## 文件

| 文件 | 动作 |
| --- | --- |
| `constructiveSolverRuntime.js` | 新增共享拼写原语 |
| `constructive/pin-construction-planner.js` | 改用共享原语 |
| `constructive/crystal-construction-planner.js` | 改用共享原语 |
| `constructive/mixed-pin-crystal-construction-planner.js` | 改用共享原语 |
| `constructive/interior-crystal-column-planner.js` | 改用共享原语 |
| `tests/benchmark.test.mjs` | Planner 导入改为生产实现；删除 6 个历史回调；直接读取冻结 artifact |
| `tests/mixedPinCrystalGoalDecomposedSolver.test.mjs` | mixed Plan 导入改为生产实现 |
| `docs/release/CI.md` | 更新当前测试计数与 skip 说明 |
| `docs/benchmark/REPRODUCIBILITY.md` | 更新当前测试计数与历史重生成归属 |
| `docs/release/PHASE_P4.md` | 本报告 |

没有删除文件。四个冻结 Planner、`generation-framework.mjs`、
`benchmark-core.mjs`、`versions/**`、`benchmarks/**` 和所有冻结 artifact
均未改动。

## 数量变化

| 指标 | 变化 |
| --- | --- |
| 生产算法行数 | -7 行（+12/-19） |
| 重复拼写原语定义 | 13 → 4（-9 份） |
| 冻结 Planner 副本 | 仍为 4 个文件、1218 行，未改一字节 |
| 独立维护的 Planner 实现 | 8 → 4（冻结副本退出维护责任） |
| 当前测试对研究 Planner 的直接导入 | 4 处/3 个模块 → 0 |
| 当前测试调用冻结 Benchmark 生成器 | 2 处 → 0 |
| 当前测试注册数 | 277 → 271（删除 6 个仅历史 skip） |
| 当前测试历史 skip | 8 → 2（仅两个 composite-release 用例） |
| 删除的中间适配/旧回调 | 6 个历史重生成回调，均仍可从固定 Git 对象恢复 |
| 新增测试框架/适配器/同步清单 | 0 |

源码（JS/MJS）净变化：`+33/-200`，净 -167 行；其中生产算法 -7 行，
测试 -160 行。文档变化另计：已跟踪文档 `+10/-7`，本报告新增 126 行；
含本报告的工作树净变化为 `+169/-207`，净 -38 行。构建产物在 `dist/`
中被忽略，不计入。

## 保留项及理由

- `benchmarks/tools/*-planner.mjs`：冻结输入，见上。
- `benchmarks/tools/generation-framework.mjs`：冻结；其中五个构建辅助函数
  与 `constructiveSolverRuntime.js` 重复，但它同时被冻结 Benchmark 生成器
  和当前研究测试作为 Witness 构建器使用。改写会破坏 461 文件身份；在测试中
  另造一份构建器则会新增重复实现，违背本阶段约束。当前 Planner 测试使用它的
  `WitnessBuilder`/`OrdinaryAtomAllocator` 作为测试夹具，但被验证对象已经是
  生产 Planner，不再是冻结副本。
- `benchmarks/tools/benchmark-core.mjs`：当前 Corpus 验收、331 witness
  重放、release/policy 校验和投影验证的共同验证依据。它不包含 Planner 实现，
  当前使用它是“验证依据”而非“生成器自证”。未改动。
- `constructive/validate-strict-plan.js`：生产 `shapeSolver.js` 的严格路径
  验收器，不是 Planner 重复，保留。

## 验证

所有命令在干净的 `codex/maintained` 检出上执行；输出写入 OS 临时目录或
忽略的 `.ci-results/`，未提交运行日志。

| 验证 | 结果 |
| --- | --- |
| 当前回归 | 271 注册，269 PASS，2 个既有 composite-release skip，0 FAIL |
| 当前 159 解与精确冻结路径 | 159/159 solved、exactFrozenPaths、exactE014Paths、v1ReproducedPaths；53 个目标；`constructiveRoutes=159`；`resourceReuse=0` |
| 331 witness | 331 references / 331 unique instances；路径检查 15,150 步；冻结与当前求解路径各 11,087 步 |
| 物理计数 | `outputChecks=67855`、`gravityCalls=57345`、`supportChecks=4675`、`allPairsChecks=4675`、`componentChecks=476` |
| 159 投影身份 | canonical SHA-256 `ae5ed5eb48c247f4239a839f266afa4d263fd8142ed3acade596c223031c4d90`，与 P1/P3 记录一致 |
| 195 Corpus 当前兼容性 | 6 个 profile，195/195 重放；composite 159/159；`validate-corpus --semantics=deferred` PASS |
| 原有生成规则与历史重生成 | 固定 v1 入口 198/198 PASS、0 SKIP；`v1-frozen-evidence` PASS；593 个原始文件 Git blob + 工作字节完全一致 |
| Physics v2 历史 | 242 注册，229 PASS，13 个原历史 skip，0 FAIL |
| Release 1 历史 | 262 注册，249 PASS，13 个原历史 skip，0 FAIL |
| 独立历史认证 | `verify-history.mjs` 全阶段 PASS；8 个原 Commit、原 tag、固定 Physics v2/Release 1 身份保持 |
| global/china 双 Profile | 两次构建可复现；global 112 文件、china 167 文件、38 个共享应用 JS、15 个 HTML/Profile；HTTP 35/36；72 个差异均有既定规则解释；461 冻结文件核对 |
| 真实浏览器与 Worker | Chrome `workerLifecycle.browser.mjs` PASS；生产 constructive 路径 depth 52、连续路径稳定、取消/过期抑制/Explorer 恢复/6 个 Worker 观测均通过 |
| 原有错误拒绝能力 | 当前回归包含 release/profile/schema/witness/projection 篡改矩阵；`benchmarkCurrent.test.mjs` 三条负例按内容绑定、目标身份、物理重放分别拒绝；历史入口原拒绝矩阵完整执行 |

`verify-current.mjs` 完整门禁在最终交付 Commit 上另行执行，结果见交付消息；
它的各阶段与上表使用同一入口。

## 边界

- 本阶段没有把 `benchmarks/tools/` 副本改成生产实现的 re-export，也没有
  删除冻结文件或移动研究目录。
- 没有新增通用 Planner 框架、适配器层或长期同步清单。
- `generate` 历史工具仍由固定 Git 对象提供，不依赖当前工作树。
- 当前日常门禁仍需重建 v1 树作为 Physics 对照输入；这是既有设计，本阶段
  未改变。
- 不处理图片清理、性能基准入口、文档全面重写或仓库瘦身；不进入 P5。

STOP。
