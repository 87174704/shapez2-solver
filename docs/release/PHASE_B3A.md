# Phase B3a：维护版验证与历史 Release 1 身份分离

2026-11-01，正式工作区 `E:\solver`。基线为
`3e0e80bb12326c54873ebf30e60f7c22b8300eec`，包含 B1
`855d96efbad20dd9d52f9abc304ad6f4f4fe5458`。本阶段只建立并行入口，
不切换默认工作流，不推送、不部署、不开展 B2 去重。

## 两条认证链

历史链仍为 `node scripts/ci/verify-history.mjs`。它从固定
`5fbba47c9a2c6c3cbdb346bd7e935b08018f6d17` 重建原认证环境，
原 v1、Physics v2、Release 1 的 manifest、pin、原 Commit/Tree/Tag
和历史拒绝矩阵全部保持。旧完整入口 `scripts/ci/verify.mjs`、旧验收器、
旧构建器及静态验证器均保留原代码，历史绿色基线仍使用它们。

维护链为 `node scripts/ci/verify-current.mjs --commit=<完整40位OID>`。
调用方明确选择 Commit，必须与检出的 HEAD 一致。实际受跟踪文件逐字节与
该 Commit 的 Git blob 比较；拒绝缺失文件、符号链接/目录重定向、非普通文件、
未跟踪输入和工作区改动。没有第二份全仓源码 manifest/pin；源码身份来自
Git Commit/Tree，不来自生成的构建清单。维护脚本在新 Commit 中可以演进。

固定历史对象只为不可变输入提供原有信任来源：461 个冻结 Benchmark 文件、
Physics v2 语义文件、原身份文档、原物理控制样本、预先指定的 O1 留出数据
及用户规则，共 480 个文件。新入口不读取 Release 1 的 `source.files` 来认证
当前源码，也不要求当前源码匹配旧 runtime 身份或旧 RC 的变更白名单/祖先规则。

准备阶段只恢复这些不可变输入已知的历史换行表示。不能恢复为原哈希的内容
立即失败。若工作字节不同于选定 Git blob，只有该 blob 仍是原历史 blob 且字节
恰好等于原冻结哈希才允许；不能把一个已篡改的提交恢复成旧字节后冒称该提交。

## 入口与文件

| 文件 | 责任 |
| --- | --- |
| `scripts/ci/verify-current.mjs` | 维护版完整验证，显式选择源码版本，结果写入现有 `.ci-results/current` |
| `versions/current.mjs` | 当前 Git 源码身份、固定输入认证、限定恢复、从当前 Git 枚举站点输入 |
| `versions/benchmark-current.mjs` | 当前实现对冻结 artifact 的资源/witness/projection 验证；发出维护版证书名称 |
| `tests/versionIdentity.test.mjs` | 将当前成功身份与 artifact 回放移到维护链；保留原历史身份、manifest 与输入篡改拒绝断言 |
| `tests/currentIdentity.test.mjs` | 新 Commit 中的脚本注释可通过；错误版本、脏输入、未跟踪输入、冻结数据及伪恢复被拒绝 |
| `tests/tools/validateCurrentPhysics.mjs` | 保留 Physics 完整行为断言的维护版入口；必须明确提供临时输出和已认证 v1 目录 |
| `tools/static-build/build-current.mjs`、`build-current-worker.mjs` | 独立当前构建入口与构建实现 |
| `tools/static-build/verify-current.mjs`、`verify-current-worker.mjs` | 双 Profile、重复构建、独立产物检查及只验现有产物的入口 |
| `tools/static-build/current-context.mjs`、`current-dependencies.mjs` | 执行第三方构建包前核对源码、lock 与实际安装包；结束时复查安装字节 |
| 本文 | 覆盖、信任来源、实验结果与 B3b 边界 |

Solver 算法、物理实现、语言资源、冻结 Benchmark、旧身份文件、原 pin、
工作流及部署配置均未修改。没有改动原 `versions/benchmark-v2.mjs` 的历史语义。
新增入口暂时保留验收与构建代码的重复；本阶段没有去重或缩减执行。

## 当前行为覆盖与原断言的分离

| 保护性质 | 当前维护入口 | 历史入口 |
| --- | --- | --- |
| Release 1 的 781 个 source 绑定、原 runtime、原历史提交/tag 与完整原文件身份 | 不把当前源码认证为历史 Release | B1 固定快照按原逻辑认证 |
| 当前 Physics v2 行为、合法编码/层数、生产/观察模块一致性 | 全部保留 | 固定历史实现按原断言运行 |
| 独立物理模型、支持图/闭包、全对检查、整组件破坏 | 全部保留 | 原断言保留 |
| 冻结 witness | 331 个引用/331 个实例，有限资源回放及 30,158 步逐步物理检查 | 原断言保留 |
| 物理控制 | 367 个 lateral 控制、6 个传播触发、5 个 helper 控制，只允许原审阅的 25 个变化 | 原断言保留 |
| 159 个冻结 Benchmark | 当前求解、精确路径、资源回放、逐步物理、生产 constructive 路由全部保留 | 原断言保留 |
| 历史比较 | 保留 v1 的 159 次原路径重现和全部路径的旧操作逐步比较，不以历史单独通过替代当前比较 | 原断言保留 |
| 资源/方向/操作与参数/回退/O1 | 全量当前回归，包括 strict-routing 普通及留出案例、独立 oracle、生产依赖图与真实回退 | 固定历史回归 |
| manifest/pin/跨版本/源码替换拒绝 | 原负例保留；当前成功认证改用维护身份，不忽略旧错误 | 原正例与负例完整执行 |
| artifact 输入篡改 | 保留 provenance、资源、witness、difficulty、release、数组顺序、projection 和未登记输入拒绝 | 原矩阵保持 |
| 多语言与静态构建 | 全部语言键/参数/回退/URL 检查；global/china 静态与 HTTP 验证 | 原历史断言保留 |

原 `tests/versionIdentity.test.mjs` 的第一个正例原先要求当前工作区是 Release 1，
并同时保护 Physics v2 语义、冻结数据和历史元数据。现在将正例的当前实现认证
换成维护输入身份，后面的语义/冻结数量/旧身份拒绝/历史元数据断言仍执行。
artifact 回放原来先要求 Release 1 全源码身份；维护版复制同一资源与输入断言，
只把前置身份和证书名称换为维护身份。原 helper 及原正例在 B1 快照中原样执行。
`tests/release1Identity.test.mjs` 的篡改负例无需放松，保持原文件。

## 当前构建的信任来源

用法：

```powershell
$sourceCommit = (git rev-parse HEAD).Trim()
node scripts/ci/verify-current.mjs "--commit=$sourceCommit"
node tools/static-build/build-current.mjs global "--commit=$sourceCommit"
node tools/static-build/build-current.mjs china "--commit=$sourceCommit"
node tools/static-build/verify-current.mjs "--commit=$sourceCommit"
node tools/static-build/verify-current.mjs "--commit=$sourceCommit" --artifacts-only
```

这些命令应在所选版本的干净隔离检出中运行；先按现有 lock 安装根目录与
`tools/static-build` 的依赖。完整维护入口负责恢复不可变输入的原工作表示；
单独构建前也需要 `prepareCurrentInputs()`，且它遇到真实篡改会失败。

1. 外部指定的 Git Commit/Tree 绑定实际源码和工具/资源/lock。站点 JS、图片、
   legal 文档及构建工具枚举来自当前 Git，不使用历史 runtime 文件列表，
   也不复制未登记的目录内容。
2. 两份已有 `package-lock.json` 的 SRI 认证 npm 提取内容。使用临时目录执行
   `npm ci --ignore-scripts --no-audit --no-fund`，再对比实际安装包的全部有效文件；
   根依赖 537 个文件、构建依赖 606 个文件。第三方包通过动态 import 在认证后
   加载，构建/验证结束再次核对安装字节。Node/npm/Git 与操作系统仍是工具链前提。
3. 保留原 `resources.lock.json` 的 CDN 版本、SRI、许可证与字体哈希，以及 CSP、
   完整性、脚本顺序、无额外远端依赖、严格双 Profile 差异规则。
4. 复用 `build-manifest.json` 记录当前 Commit/Tree、维护身份、工具哈希、依赖
   核对结果、Profile 与产物哈希。产物中的 `release.json` 明确标为
   `shapez2-solver-maintenance`，不分发冻结 Release 1 pin 来代表当前构建；
   仓库原 `release.json` 作为历史元数据保持。
5. 验证器从所选 Git 源码独立核对复制文件、精确产物集合、CSS 变换、各语言
   HTML/内联代码、精确 CSP 与 SRI，再核对清单。`--artifacts-only` 不重建或覆盖
   待验产物，因此能发现“产物与自写清单一起伪造”。清单是追溯记录，不是自签信任根。

## 隔离实测

基于正式仓库对象建立临时共享克隆；测试候选、注释及错误实验的 Commit 只在
隔离仓库或无分支引用的临时对象中使用，不移动正式分支，也不推送。
正式工作区原有 `tests/shapeSolver.test.mjs` 混合换行改动及后续审计报告未纳入提交。

| 验收 | 结果 |
| --- | --- |
| B1 固定历史快照 | 完全通过；v1 198 PASS/0 SKIP，Physics v2 229 PASS/13 原有 SKIP，Release 1 249 PASS/13 原有 SKIP |
| 历史身份及对象 | 593 个原文件的工作字节和 Git blob、8 个原 Commit、原 tag、跨版本替换拒绝全部通过 |
| 绿色 B2 基线的原完整 CI | 11/11 阶段通过；当前回归 252 PASS、13 原有 SKIP、0 FAIL；原两 Profile 构建通过 |
| 新当前完整入口 | 11/11 阶段通过；回归 258 PASS、13 原有 SKIP、0 FAIL；新增身份测试登记 6 项，无新增 skip |
| 当前 Physics/冻结验收 | 159 solved/resourceReplay/frozenReplay/exactPath/v1Reproduced，331 witness，路径及操作差异均为零 |
| 当前生产入口 | members=solved=replayValid=exactE014Paths=constructiveRoutes=159，53 个目标，resourceReuse=0 |
| 当前 global/china | 两次构建分别完全一致；115/170 个产物，41 个相同应用 JS；15 个 HTML/Profile；HTTP 35/36 项通过；72 个差异均有既定规则解释 |

物理计数与原基线一致：`outputChecks=67855`、`gravityCalls=57345`、
`supportChecks=4675`、`allPairsChecks=4675`、`componentChecks=476`。
159 个成员 witness 路径检查 15,150 步；冻结和当前求解路径各检查 11,087 步。
保留全部 318 次当前求解和 159 次旧 v1 求解，没有实施 B2 复用。

最终实现的完整隔离验收候选为
`32e7e8b9e2f19621fb8a34539b0531932c7bfc9e`，Tree 为
`c2e08c8a340ac8047bf69c0fdb051a1651513133`；同一实现追加四条注释后的
完整验收 Commit 为 `a39751737ebe556a6fad65d4714216121eeddb15`。
正式交付相对该实现候选只增加本文。两者与绿色基线的全部验收 summary
逐字段相等；159 条 `{caseId,input,depth,solverRoute,solutionPath}` 投影的
canonical SHA-256 均为
`ae5ed5eb48c247f4239a839f266afa4d263fd8142ed3acade596c223031c4d90`。

## 修改自由与拒绝实验

- 对完整当前入口、当前 Physics 验收、原生产 159 入口和当前静态验证器各追加
  一条注释，在隔离仓库形成新 Commit。完整当前验证与两 Profile 构建仍通过；
  159 输入/结果路径投影、全部计数与原基线一致。该新 Commit 没有冒充 Release 1。
- 在新 Commit 中让 `shapeSolver` 返回错误的空解结果。当前源码身份正常通过，
  完整维护入口在 `regressions-current` 失败，出现 19 个失败断言。证明没有用
  源码字节锁替代当前算法正确性验证。
- 提交冻结 `benchmarks/input_catalog.json` 的字节改动，当前输入认证拒绝；
  将工作字节偷偷恢复而保留不同的提交也拒绝。真实内容篡改不会被恢复器转成 PASS。
- 保留并运行输入/projection、资源、库存 lineage、方向、参数、开关、非法计划、
  waste 和回退拒绝矩阵；没有将这些错误改为 skip 或忽略。
- 篡改原历史生产验收脚本或冻结输入时，原 Release 1 认证均拒绝；恢复后重新通过。
- 在既有产物中篡改 JS、两个 Profile 的 HTML、CSP、SRI 或字体，同时重写相应
  `build-manifest.json` 哈希，独立产物验证仍拒绝；伪造 sourceCommit 也被拒绝。
- 篡改实际安装的 acorn 并加入顶层执行标记，构建在依赖字节核对时失败，标记代码
  未执行。安装包和本次实验目录均恢复/清理。

## B3b 边界与交付

当前成功认证已没有对 Release 1 的 781 文件全源码身份的运行要求。
历史拒绝测试仍会调用旧验证器并要求其拒绝伪造；固定历史对象、冻结输入和
v1 对照实现仍是明确依赖。当前入口不是浅克隆/脱离历史数据的轻量入口，
也不声称消除了研究档案依赖。现有工作流已经取完整历史，后续仍应保留这个前提。

具备进入 B3b 正式 CI 切换与目标运行器验收的条件。B3a 仅在本机 Windows、
Node v24.21.0 上完成隔离实测；GitHub 的 Linux 运行器尚未实际执行新入口。
B3b 应使用显式 CI Commit、完整历史和原锁定依赖，在目标平台验证后再切换。
本阶段保持默认 workflow 原状，因此不要求新 HEAD 通过旧 Release pin。

临时克隆、运行日志和产物在提取上述结果后清理；不新增长期证据目录。
本阶段实现、测试及本文作为一个本地提交交付，完整提交号见交付消息。
STOP：不自动切换工作流，不进入 B2。

## B3b/P1b 切换后注记

上述内容是 B3a 当时的状态。正式切换后，日常入口为
`scripts/ci/verify-current.mjs`（工作流 `verify.yml`），历史入口为
`scripts/ci/verify-history.mjs`（工作流 `verify-history.yml`）；旧
`scripts/ci/verify.mjs` 与 `scripts/ci/prepare-checkout.mjs` 已删除。
本节以前的描述不再代表当前默认 CI。
