# Shapez 2 Solver Benchmark Rules

Version: 4 (Trusted artifact binding and causal construction identity)

本文件把项目所有者的人工规则形式化为可执行约束。规则优先级严格为：

1. `docs/benchmark/USER_RULES.md`；
2. `benchmarks/sources/input_catalog.seed.json`；
3. 已验证的项目游戏语义实现；
4. Builder 推断。

若本文件与前两项冲突，前两项有效，本文件及生成物必须停止使用并修正。`benchmarks/sources/` 下的人工来源只读，Builder 不修改它们。

## Benchmark instance

一道题的 Solver-facing 身份是 `(presented available input multiset, target)`，不是 target 单独一项。相同 target 的输入顺序变化不产生新题。输入 multiplicity 是题目语义的一部分。

v3 instance 明确分离：

- `coreWitnessBasis`：证明/生成侧的核心资源 multiset，不要求是绝对最小集；
- `availableInputs`：唯一展示给 Solver、也是 replay 初始资源上限的 presented environment；
- `witness`：必须从 `availableInputs` 出发的完整 end-to-end forward proof；
- `expansion`：绑定版本化 policy、additive/transformative 类型、preprocessing 边界、core bridge tokens 和机械 multiset delta。

Solver evaluation 只读取独立导出的 `target + availableInputs + rules` view，不读取 `coreWitnessBasis`、`expansion` 或 `witness`。

正式实例必须同时满足：

- target 是官方语料中的原文 shape code；
- 每个输入及数量满足 catalog 与下述约束；
- constructive witness 的初始 token multiset 是实例 available input multiset 的合法子集，每种 shape 的数量不得超出可用 multiplicity；
- forward replay 逐步验证 token lineage、操作参数、canonical 物理输出、中间 shape 和最终 result token；
- result token 的 shape code 与 target 字符串严格相同；
- 当前 Solver 是否找到解不参与接受或拒绝。

v3 的 `availableInputs`（旧 v2 的 `inputs`）表示 Solver 可使用的资源环境，而不是必须全部进入最终产物的最小配方。witness 可以从该环境选择一个合法子集；普通输入可以不被选择或使用，合法副产物可以保留，只要存在合法路径产生严格等于 target 的 result token。terminal inventory 不要求清空。

正式 solvability proof 只能是 `available inputs -> legal forward operations -> target produced`。从 target 开始的 reverse decomposition 只可用于生成候选；Pin、Crystal、Stack overflow 等有损机制使其不具备一般证明效力。

## Environment expansion

Expansion policy `input-environment-expansion-v1` 是 repository-bound、release-bound 的版本化输入选择规则。它只允许与 target/core construction vocabulary 有可说明关系的 catalog neighborhood、可机械 derivation 的 fuller replacement 和合理 alternate sources；禁止用无关随机 filler 充数，也禁止预先给资源贴最终用途标签。

- additive：`coreWitnessBasis` 必须是 `availableInputs` 的 multiset 子集，`preprocessingStepCount=0`；bridge tokens 在 witness initial 中直接重建全部 core basis。
- transformative：core/available delta 必须确实移除 core occurrence，完整 witness 必须包含至少一步 preprocessing；声明的 bridge tokens 必须在边界处 live，shape multiset 必须严格等于 core basis。
- preprocessing 后的核心构造只能消费 bridge tokens 及其后代，不得消费未声明的 preprocessing 副产物来伪装成原 core construction。
- 两种模式都必须从 `availableInputs` 完整 replay 到严格 target；`basisRemoved` / `availableAdded` 必须等于 validator 独立重算的 multiset delta。

Expansion 后重新应用 ordinary multiplicity、pure、排除项、`SuSuRuRu`、refinement exact bundle 与 main/side 规则。数组顺序不参与环境 diversity。

`maximumAddedOrdinaryMultiplicity` 定义为 `coreWitnessBasis -> availableInputs` delta 中**新增 ordinary occurrence 的总数**，不是每个 shape 的 cap。v1 值为 3；它叠加在每个 ordinary shape 最终 multiplicity 最大 3 的既有规则之上。validator 从 multiset delta 和 catalog 分类重算该总数，generator 与正式验收都执行同一限制。

## 普通输入

- 允许集合只来自 catalog 的 `pure`、`full`、`partial`、`half`。
- `WuWuWuWu` 永远禁止。
- 相同普通 shape（含 pure）在一个实例中的 multiplicity 最大为 3。人工规则使用“原则上”，v1 选择较严格的硬上限 3，不做放宽。
- pure 类型最多一种，该类型 multiplicity 最大为 3。
- `SuSuRuRu`：main 禁止，side 可用；任何 refinement 实例中禁止。

## Refinement 输入

refinement 部件不可染色。分类是对 target 解析后的部件进行确定性判定，不允许按颜色单独匹配，也不允许由 Agent 用自然语言猜测。分类 key 是完整的 `(module type, color)`：

- A: `(X,r)`、`(X,g)`、`(X,b)`，即 `Xr`、`Xg`、`Xb`；
- B: `(X,c)`、`(X,m)`、`(X,y)`，即 `Xc`、`Xm`、`Xy`；
- C: `(X,w)`、`(X,k)`，即 `Xw`、`Xk`；
- D: `(Y,k)`、`(Y,w)`，即 `Yk`、`Yw`。

因此相同颜色不代表相同组：例如 `Xk` 属于 C，而 `Yk` 属于 D。shape parser 必须保留 `X`（refined）与 `Y`（exotic）的 module 类型，不能只传递 `k/w` 颜色，也不能用 substring 匹配。

目标完全不含 `X`/`Y` 部件时分类为无 refinement，并且不得提供 refinement 输入。目标含 refinement 部件且全部 feature 唯一映射到同一组时，输入 multiset 必须精确包含该组的全部 shape 和规定 multiplicity，且不能包含其他组。存在未知 feature、catalog 将同一 `(module type, color)` 配给多个组、或一个 target 同时出现多个组的 feature 时，classification 必须明确报错，generator 和 validator 都不得猜测或返回多个组。

`hard-main-012` 的真实 target 是 `cwP---P-:--cw--cw:RrWrYwWr:Yk------`。其中 refinement feature 只有 `Yw` 和 `Yk`，所以确定性分类结果是 D only；白色/黑色不能使 `Y` module 匹配到 C。

此前把该 target 写成 C+D 是已确认的报告层幻觉，而不是 executable classification bug：Agent 在自然语言报告中将 `Yk` 错读或混淆为 `Xk`。当时的 parser 和 executable classifier 已保留完整的 `(module type, color)`，实际返回 D only；generator 选择 D bundle，validator 接受 D bundle 并拒绝 C bundle。后续 classifier 相关改动属于 robustness hardening，包括更明确的 feature key、显式唯一 group classification、catalog overlap detection、unknown/mixed group explicit error、generator/validator 共用 deterministic classifier，以及 regression coverage；不得反向描述为修复了只按颜色分类或丢失 X/Y 类型的 correctness bug。历史与当前 classifier 对 `hard-main-012` 的结论一致，均为 D only，当前代码无 regression。

“完整 bundle”按最新 `USER_RULES.md` 的 available-input semantics 机械化为：输入 multiset 必须完整提供该组规定的全部 shape 与 multiplicity。它不要求每个 refinement input 都位于 result 的依赖链上或被实际消耗。

## Witness、操作与 canonical semantics

canonical game semantics 见 `docs/benchmark/GAME_SEMANTICS.md`。权威底层实现是 `shapeOperations.js`，配套 code/validation 定义位于 `shapeConstants.js` 和 `shapeValidation.js`。Benchmark validator 直接复用这些 deterministic shape operations；独立性边界是它不调用 Solver search、beam、heuristic、pruning 或 candidate ranking，而不是另写一套 Pin/Crystal/Stack 物理。

v1 Hard witness 使用不可复用的整数 token ID 表示 lineage，并固定 `maxLayers=4`。`witness.initial` 中每种 shape 的 token 数不得超过 available input multiplicity。每一步必须消费 live token，并声明全部非空物理输出及新的 token ID。validator 从 canonical `shapeOperations.js` 重新计算输出，不信任 witness 声明。

支持的操作为 Splitter、三种 Rotator、Half Destroyer、Cutter、Swapper、Stacker、Painter、Pin Pusher、Crystal Generator。Painter/Crystal Generator 必须提供唯一合法颜色参数；其他操作不得携带参数。refinement/exotic 部件依 canonical semantics 不可染色。

Splitter 在所有正式 Benchmark profile 中保持禁用。schema 保留操作名、generator 保留策略接口，但 replay 对任何 Splitter step 明确失败。原因是 throughput success semantics 尚未统一：本项目不得自行决定一次 split 后的 2048 或未 split 的 4096 应如何计入成功。统一前不得将 Splitter witness 纳入正式 corpus。

`cleanPainting=true` 时，Painter 输入必须是单层且所有可染色部件未染色；`cleanPainting=false` 时 replay 直接采用 canonical `topPaint`，不额外施加 clean 限制。正式 v2 Pilot/coverage profile 由 repository policy 固定为 `true`，artifact 不能自行关闭。

最终 result token 必须严格等于 target。未被 witness 选择的 available inputs 记录为 replay 的 `unusedAvailableInputCount`；已选择但未消耗的 token 和合法副产物允许作为 live waste，并记录 `liveWasteCount`。二者都合法，terminal inventory 不要求清空。

Crystal breakage 是 canonical semantics 中的合法行为，witness 可以包含。它不应被 validator 判为非法或绝对禁止。由于 Crystal 成本高，`USER_RULES.md` 要求未来 Solver 优化尽量避免不必要的 breakage；当前 Benchmark 规则不设 penalty，本轮不调整 Solver heuristic。

## 多样性和难度

结构多样性只由 validator 从已通过 canonical replay 的 result causal ancestry 重算。`construction.strategy`、artifact 自带 signature、token ID、raw step 调度顺序均不作为证据。`causal-construction-v3` representation：

- 只保留 result ancestry，忽略无关 live waste；
- Rotator 归一为透明边；任意 unary operation 只有在 replay-backed 输入/输出完整 shape state 相同且只有一个 active output 时才作为 semantic identity 消去，因此 identity Cutter/empty-effect chain 不能制造 family；
- 只有一个结果分支进入 target 的 Cut/Paint preparation chain 可折叠为 canonical prepared component，但节点必须保留完整 causal source graph，不能只保存 root operation kind；
- 无碰撞的横向 Stacker union 只有在 concrete reverse-operand replay 产生同一 output 时，才按 associative/commutative flatten 并排序；
- 精确的纵向 layer concatenation 按 associative flatten，但保留 bottom-to-top 顺序；
- Pin、Crystal、Swapper、发生重力/碰撞/overflow 的一般 Stack，以及两个输出都进入 target 的 shared Cutter/Swapper 保留为显式结构节点；operation params 保留。Swapper 只有在 concrete reverse-operand replay 合法、非空 output shape multiset（含 multiplicity）相同且声明输出与该 multiset 一致时，才按 replayed input state 与 canonical child ancestry 归一 operand 顺序；其他 input edges 保持有序；
- 独立 sibling 的 witness scheduling 不进入 identity；未证明可交换的依赖顺序不排序。

因此，仅改变 strategy label、token ID、独立 step scheduling、identity transform 或无关 terminal byproduct 不产生新 family；不同 source ancestry、direct/derived resource、shared occurrence、Pin/Crystal scaffold 或真正不同的 Stack/Cut topology 可以区分。正式扩展 profile 可以要求不同 family；validator 按重算 signature 决定 representative / structural-duplicate 和 `duplicateOf`。

Pilot 另设构造质量门槛：

- 不使用 pure 输入；
- 不把 target 本身作为输入；
- witness operation count 至少 18；
- witness dependency depth 至少 8；
- 同 target 两题输入 multiset 的 weighted Jaccard 不超过 0.84。

这些是 Pilot 防止 trivial bias 的筛选条件，不宣称 operation count 或 depth 等价于真实 Solver 难度。禁止按 Solver solve rate、timeout 或搜索成败调整实例。

## Partition

suite、partition、完整 target membership、每 target 数量及是否要求结构 family 唯一，均由 `benchmarks/policy/official-policy.v1.json` 的 repository profile 决定，artifact metadata 无权扩张。v3 schema 使用受控 enum `expansion-pilot | development | validation | holdout`，不接受自由字符串；当前 profile 再把具体 artifact 固定为其中一个值。旧 v2 Pilot/coverage schema 仍固定各自 pilot partition。正式扩展时继承 manifest 的 target-level development / validation / holdout 分区：同一 target 的全部 instances 必须留在同一分区，防止 target 泄漏。holdout 的生成种子、实例和结果不得用于 Solver 调参。

## 正式验收与发布边界

validator 必须先执行 policy 固定版本的 JSON Schema，再执行语义检查。它从 repository policy 取得支持的 artifact/instance/catalog/release schema version、suite/profile/partition、人工 seed identity/hash、official target manifest 与原始 source hash、canonical semantics ID/文件集合 hash、catalog version/hash和完整 target membership。实例 provenance 只能与这些值一致，不能定义这些值。

每个可验收 artifact 必须有 policy allowlist 中的 release ID，并由对应 release manifest 绑定 USER_RULES、BENCHMARK_RULES、seed、catalog、official targets、canonical semantics、schemas、generator、validator、generation log 与 rejection log。信任根还必须包含 `canonical-json-v1` 的完整 artifact content hash；validator 对**实际传入 artifact**重算该 hash，而不是只验证 manifest 路径处的仓库文件或 artifact 自报 hash。对象 key 顺序、空白和文件路径不参与 identity，数组顺序与全部 artifact content 参与 identity。

若 profile 发布 `solver-inputs.json`，release manifest 同时绑定该 projection 的 canonical content hash；validator 从实际 artifact 重新生成 `target + availableInputs + rules` public view 并要求与 released projection 精确一致。`validateRelease=false` 只用于 development/adversarial checks，返回结果不具有 release acceptance 含义。
