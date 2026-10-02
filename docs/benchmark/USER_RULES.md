# Benchmark User Rules

本文件记录由项目所有者直接规定的 Shapez 2 Benchmark 规则。

本文件是 Benchmark 规则的最高优先级人工来源。

后续 Agent 可以将这些规则形式化为 `BENCHMARK_RULES.md`、JSON schema、validator 和 generator 规则，但不得在没有明确依据时擅自改变本文件的含义。

---

# 1. Benchmark 的真实目标

Benchmark 的目的不是构造容易通过的测试，也不是让当前 Solver 获得漂亮的通过率。

Benchmark 应尽可能代表实际玩家会将求解器用于解决的问题。

实际玩家通常是在输入与目标之间关系较复杂、人工求解较困难时才需要使用 Solver。

因此：

- Benchmark 应主动偏向困难实例。
- 简单、trivial、几乎直接可见答案的实例应降低采样权重。
- “理论上可解但搜索非常困难”的实例属于重要且真实的使用场景。
- 不得因为当前 Solver 无法解决某实例，就认为该实例“不合理”或将其删除。
- Benchmark 的难度不能根据当前 Solver 的能力反向调整。

当前长期目标：

- Hard 官方目标共 53 个。
- 每个目标最终至少构造 5 个不同的合法、可解输入实例。
- 即至少形成 265 个 Hard benchmark instances。
- 但正式扩大到全部 265 个之前，应先进行小规模 Pilot，以验证出题器和验证体系本身是否可靠。

---

# 2. 普通输入形状

普通输入分为：

- 纯净
- 全部
- 部分
- 半边

具体允许的 shape code 以项目中的 input catalog 为准。

## 2.1 纯净

纯净 shape 出现概率很低。

一个配方中：

- 最多只能出现一种纯净 shape 类型；
- 同一种纯净 shape 可以重复；
- 数量原则上不得超过 3。

`WuWuWuWu` 视为不存在，不允许作为输入。

因此目前有效纯净形状为：

- `RuRuRuRu`
- `CuCuCuCu`
- `SuSuSuSu`

## 2.2 普通 shape 重复

相同普通 shape 可以在同一道题中重复输入。

相同 shape 的数量，包括纯净 shape，原则上不应超过 3。

输入必须被建模为 multiset，而不是简单 set。

---

# 3. SuSuRuRu 特殊规则

`SuSuRuRu` 是特殊普通 shape。

规则：

- 主线任务中原则上不能使用；
- 非主线任务中可以使用；
- 如果题目使用任何精炼模块，则无论主线还是支线，都不能同时使用 `SuSuRuRu`。

---

# 4. 精炼模块

精炼模块与普通原料规则不同。

精炼模块不能染色。

成品形状本身围绕精炼规则定制，因此使用哪一个精炼组，必须根据目标成品中的精炼模块颜色/类型决定，不能为了方便求解任意选择。

一道题如果目标对应精炼模块组，则 available input environment：

- 只能提供目标唯一决定的一个组别；
- 必须完整提供该组的全部规定输入及数量；
- 不允许只取该组的一部分；
- 不允许混合多个精炼组。

这里的“完整提供”是 input availability 要求，不表示 witness 必须选择或消耗全部组员。

具体规则：

## Group A

必须同时提供：

- `XrXrXrXr ×1`
- `XgXgXgXg ×1`
- `XbXbXbXb ×1`

## Group B

必须同时提供：

- `XcXcXcXc ×1`
- `XmXmXmXm ×1`
- `XyXyXyXy ×1`

## Group C

必须同时提供：

- `XwXwXwXw ×1`
- `XkXkXkXk ×1`

## Group D

必须提供：

- `YkYkYwYw ×2`

Group D 是特殊情况，同一 shape 恰好需要两个。

同一个 available input environment 内，精炼模块必须恰好提供某一组的全部规定原料，不应额外重复该组成员。

使用精炼模块时，禁止普通输入 `SuSuRuRu`。

---

# 5. Benchmark Instance 的可解性

正式 Benchmark Instance 必须被证明为可解。

但是：

**不得使用当前被测 Solver 能否找到答案来证明题目是否可解。**

正式 solvability proof 必须是 constructive forward witness：

1. 从题目提供的 available input environment 中选择一个合法子集；
2. 使用项目 canonical game semantics 执行合法的正向操作；
3. 保存完整的正向 solution witness；
4. validator 从 available inputs 正向 replay 每一步；
5. 只有每一步均合法、未使用不存在或超量的资源，并且最终确实产生严格等于 target 的 shape，实例才可进入正式 benchmark。

从 target 出发的 reverse decomposition 可以作为候选生成方法，但由于 Pin、Crystal、Stack overflow 等机制可能有损且不可逆，它本身不是 solvability proof，也不要求 `target -> reverse decomposition` 成立。

当前 Solver 搜索失败，不构成删除 benchmark instance 的理由。

---

# 6. Benchmark 多样性

同一个 target 的多个 instance 必须具有真实区别。

不能仅通过：

- 输入顺序改变；
- 等价旋转；
- 同一 decomposition 的微小表面变化；

来充当不同题目。

应尽量产生不同：

- decomposition structure；
- input composition；
- cut / stack / split 路径；
- 搜索分支结构；
- witness depth。

---

# 7. 难度原则

Benchmark 不要求 easy / medium / hard 数量平衡。

实际采样应明显偏向困难实例。

简单实例可以存在，主要承担 sanity check 功能，但应该降低其总体权重。

不得为了提高 Solver solve rate 而：

- 大量提供纯净 shape；
- 提供几乎已经成型的关键中间 shape；
- 提供 target 本身；
- 故意挑选明显容易搜索的输入组合。

难度 metadata 可以记录，但当前阶段不要假设任何单一指标能够完整代表实际求解难度。

---

# 8. Benchmark 与 Solver 的隔离

Benchmark Builder 与 Solver Optimization 应逻辑隔离。

Benchmark Builder：

- 负责产生合法实例；
- 负责产生 constructive witness；
- 负责证明 solvability；
- 不负责帮助 Solver 通过题目。

Solver Optimization：

- 可以观察允许公开的 benchmark；
- 不允许修改 benchmark 来提高通过率；
- 不允许 hardcode 官方目标或 benchmark instances。

后续应设置 dev / validation / holdout，以降低针对固定题目的过拟合风险。

---

## Available Input Semantics

Benchmark 中给出的 inputs 表示该题中 Solver 可以使用的输入资源环境，而不是最终解必须全部消耗的最小配方。

因此：

- ordinary inputs 可以最终没有被使用；
- Solver 可以只使用 available inputs 的一个合法子集完成目标；
- 合法操作产生的副产物可以最终保留；
- terminal inventory 不要求清空；
- Benchmark 的成功条件是存在一条合法操作路径产生 target。

Refinement 是特殊的 availability rule：

- 如果目标对应某个 refinement group，则必须完整提供该组规定的全部输入及数量；
- 但这些 refinement inputs 不要求最终全部进入 target lineage 或被实际消耗。

不应要求 Benchmark Builder 或 Agent 仅凭最终 target 判断每一个 available input 是否最终“有用”。特别是在涉及 Pin、复杂 Stack、Cut、置换等机制时，某个输入能否参与合法解可能无法从 target 表面结构可靠判断。


## Crystal 求解偏好

Crystal 的具体生成、连接、切割、堆叠、碎裂以及与 Pin 等结构的交互规则，应以项目现有 canonical game-semantics implementation 为准。

这些底层物理规则由后续 Agent 从实际 Solver 代码和已有 tests 中审计并整理，不在本人工规则文件中重新实现。

项目所有者额外规定：

Crystal breakage 虽然属于合法游戏行为，但由于 Crystal 的生成通常消耗大量资源，因此 Solver 在存在其他合理合法方案时，应尽量避免不必要的 Crystal breakage。

因此：

- Crystal breakage 不得被判定为非法；
- 不得绝对禁止 Crystal breakage；
- Benchmark witness 可以包含合法的 Crystal breakage；
- 后续 Solver heuristic / cost model 可以明显惩罚不必要的 Crystal breakage；
- 当前不预设具体 penalty 数值，应根据真实 Benchmark 表现确定。

本轮只固化该偏好，不调整 Solver heuristic，也不决定 penalty 数值。

## Input Environment Expansion

Benchmark 中用于证明可解性的核心输入集合，不应直接等同于最终展示给 Solver 的输入集合。

真实使用场景中，使用者往往只是凭经验输入数量不定的不规则图形，而不是只提供某条具体解所需的最小原料集。

因此，一个正式 Benchmark instance 应区分：

1. **core witness basis**  
   用于构造并证明某条合法 witness 的核心输入基础。

2. **presented available input environment**  
   实际提供给 Solver 的输入资源环境。

正式 Benchmark 的 available inputs 应在 core witness basis 的基础上进一步进行：

- 扩充；
- 打乱；
- 引入更完整或可替代的图形；
- 引入合理数量的冗余图形；
- 形成更接近真实玩家输入习惯的资源环境。

这里的 core witness basis 只需要提供一个可靠的 solvability basis；它不要求是数学意义上的绝对最小集。它属于 Benchmark 的证明/生成元数据，不得作为 Solver evaluation 的搜索提示。

Expansion 必须分为两类：

- **Additive Expansion**：保留全部 core witness basis，只添加额外合法输入。只有在原 witness 仍可直接从 presented inputs 执行时，原 witness 才可继续作为证明。
- **Transformative Expansion**：移除或替换一个或多个 core resources，改为更完整、不同粒度或需要处理的 presented resources。此时原 witness 不能自动证明可解；Builder 必须保存合法 preprocessing/derivation，使 `presented inputs -> core witness resources -> target`，或生成另一条完整 end-to-end forward witness，并重新完整 replay。

例如，如果某条 witness 的核心输入只需要一个半边图形和一个缺角图形，则 presented inputs 可以扩充为：

- 两个完整图形；
- 一个完整图形加一个缺角图形；
- 或总数量扩展为三到四个图形；

任何上述方案都必须符合输入规则。若 core resources 被替换，则不得仅凭人工或 Agent 判断“完整图形应该可以切出所需资源”；合法 derivation 必须出现在完整 witness 中并通过 forward replay。

Benchmark Builder 不应追求“输入尽量最小”或“输入尽量只包含绝对必要资源”。

正式 Benchmark 应优先代表真实、带冗余、带近似替代资源、带不规则性的输入环境。

Expansion policy 必须显式版本化，并继续遵守 pure、multiplicity、`WuWuWuWu`、`SuSuRuRu`、refinement bundle、main/side 等规则。输入数组排序变化不构成 diversity。

Generator 不应在生成前为 available inputs 预贴“进入 target”“只产 Pin/Crystal”“牺牲”“不会使用”等角色标签。若需要资源使用 metadata，只能从完整机械 replay 的实际 token lineage 派生。

Validator 的唯一 solvability acceptance boundary 始终是：

`presented available inputs -> legal forward replay -> exact target`。

它必须拒绝 witness 从仅存在于 core witness basis、但未出现在 presented inputs 或未由合法 preprocessing 产生的资源开始执行。
