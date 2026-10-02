# Canonical Game Semantics

Version: shape-operations-v1 (repository-bound canonical semantics)

本文件只记录当前仓库中已经存在的 deterministic shape-operation implementation。它不是根据自然语言重新实现的第二套游戏物理。

## 1. 权威边界与复用关系

当前 canonical game semantics 的主实现是 `shapeOperations.js`：

- `ShapePart`、`Shape`、`ShapeOperationConfig` 定义形状对象和层数上限；
- `cut` / `halfCut`、三种 rotate、`swapHalves`、`stack`、`topPaint`、`pushPin`、`genCrystal` 定义操作；
- `_makeLayersFall`、`_breakCrystals`、`_getConnectedSingleLayer`、`_getConnectedMultiLayer` 实现重力和 Crystal 连通/碎裂；
- `shapeConstants.js` 定义 part/color code、不可染色类型和 Crystal Generator 的替换集合；
- `shapeValidation.js` 校验外部 shape code；
- `shapeSolver.js` 的 `operations` 表直接导入上述函数。Solver 的 search、beam、heuristic、pruning、candidate ranking 不属于本文件定义的游戏语义。

Benchmark 不复制这些操作。`benchmarks/tools/benchmark-core.mjs` 的 replay 操作表直接调用同一批函数，并在其外层负责 available-resource token、multiplicity、throughput、参数、lineage 和最终 target 检查。这里的“独立”是指 replay 不调用 Solver 搜索，也不使用 Solver 的 beam/heuristic/pruning/ranking；它不要求再造一套 Pin/Crystal/Stack 物理。

## 2. Shape 与 layer representation

- shape code 用 `:` 分隔层；数组顺序是从底层到顶层。`Shape.toShapeCode()` 按同一顺序还原。
- 每个 part 占两个字符：一个 part code 和一个 color code。`-`/`-` 是空位，`P`/`-` 是 Pin，`c` 加颜色是 Crystal，`X`/`Y` 是 refinement/exotic module。
- `Shape.layers[layer][part]` 保存 `ShapePart {shape,color}`。旋转把 part index 当作循环顺序；当前代码没有把 index 0 明确绑定到某个世界坐标方向，因此本文件不猜测 north/east 等名称。
- 底层操作支持任意固定 part count；二元 `Swapper`/`Stacker` 要求两边 part count 相同，否则抛出 `InvalidOperationInputs`。当前 Hard benchmark 进一步限制为每层四个 part、最多四层。
- `validateShapeCode` 要求所有层 part count 相同，并禁止 empty/Pin 携带颜色。`benchmark-core.mjs::assertShape` 还拒绝全空资源和超过实例层数上限的 shape。
- 操作内部可以暂时产生全空 shape；replay 只要求 witness 声明所有非空物理输出。`_cleanUpEmptyUpperLayers` 删除连续的空顶层；如果整个 shape 为空则保留一个空层表示。

## 3. Gravity

重力没有公开操作入口，而是在 `cut`、`stack`、`pushPin` 内通过 `shapeOperations.js::_makeLayersFall` 调用。

实际算法顺序如下：

1. 计算支撑状态。底层所有非空 part 都受支撑；同一位置下方的受支撑 part 可以提供支撑。
2. 同层相邻的非空、非 Pin part 形成重力组，连接不比较 shape 或 color；part index 首尾相邻。
3. Pin 不参与同层连接。Crystal 之间另有垂直 fused 连接，可沿正上方的同位置 Crystal 传播支撑。
4. 第一遍支撑计算后，所有 unsupported Crystal 先直接变为空位；它们不是作为普通组下落。
5. 重新计算支撑；每个仍 unsupported 的同层组垂直落到不发生位置碰撞的最低层。Pin 因不横向连接而作为单 part 组处理。
6. 调用方随后清除空顶层。

已固定回归：`tests/benchmark.test.mjs` 的 canonical-operation case 覆盖一个 partial top group 穿过空层并落到底层的 Stack 情形。

## 4. Cut 与 Half Destroyer

`shapeOperations.js::cut` 对四 part shape 形成两个固定 lane：一个保留后两个 index，另一个保留前两个 index，其他位置补空。每个 layer 使用相同切面。

切分前，代码检查切面两侧是否都是 Crystal。如果是，则从该位置调用 `_breakCrystals`，删除整个 fused Crystal component；随后两个 lane 分别执行重力和空顶层清理。Crystal breakage 因此是合法且可能有损的 Cut 结果。

`halfCut` 直接返回 `cut` 的第二个 lane；它可以返回全空 shape。Solver 将它注册为 `Half Destroyer`。Benchmark replay/schema 复用同一实现，并像其他操作一样省略空物理输出。

已固定回归：跨切面、跨层的 fused Crystal component 全部碎裂；Half Destroyer 的指定 lane 可以为空。

## 5. Rotate 与 Swapper

- `rotate90CW` 把每层最后一个 part 移到第一个位置；`rotate90CCW` 做相反循环位移；`rotate180` 循环移动半个 part count。三者不触发重力或 Crystal breakage。
- `swapHalves` 先对两个输入分别调用 canonical `cut`，因此继承 Cut 的 Crystal breakage 和分半重力；之后交叉组合固定 lane，并清理空顶层。它返回两个输出。
- Benchmark replay 将 Swapper 的两个 shape 视为无序 multiset，但仍检查输出 multiplicity，并把每个声明的 token ID 绑定到其声明 shape；Cutter、Stacker 和 unary outputs 保持顺序敏感。

## 6. Stack 与 maximum layer behavior

`shapeOperations.js::stack(bottomShape, topShape, config)`：

1. 复制 bottom layers；
2. 插入一个全空分隔层；
3. 复制 top layers；
4. 对整体执行 `_makeLayersFall`，因此 top 可以下落、穿过缺口或与其他 part 形成受支撑组，unsupported Crystal 会先碎裂；
5. 清理空顶层；
6. 只保留最底部 `config.maxShapeLayers` 层，超过上限的上层被丢弃。

这一定义允许有损 Stack overflow。已固定回归覆盖 partial group 下落和 5 层结果在 Hard 的 4-layer cap 下丢弃最高层。

当前实现对 Stack 最后的 `slice(0, maxShapeLayers)` 不执行额外的“跨保留/丢弃边界 Crystal 传播碎裂”步骤；与 Pin Pusher 的 overflow 分支不同。仓库中尚无包含 Crystal 的 Stack-overflow 专项回归，不能从现有代码之外断言游戏是否还应有额外效果。

## 7. Pin / Pin Pusher

`shapeOperations.js::pushPin` 根据输入底层逐位置产生新 Pin 层：底层位置为空则新位置为空，其他任何 part（包括 Crystal、refinement/exotic）都产生 Pin。然后把新层插到最底部，原 shape 整体上移。

- 未达到 layer cap 时，保留全部旧层。
- 已达到 cap 时，先丢弃旧最高层，只保留可容纳的旧底层。
- 如果保留下来的新最高层 Crystal 与被丢弃旧最高层的同位置 Crystal fused，则在保留部分调用 `_breakCrystals`，删除与该位置连通的整个 retained Crystal component。
- 最后执行 canonical gravity 和空顶层清理。

已固定回归覆盖 partial bottom 产生对应 Pin、四层输入顶层溢出，以及不同颜色 Crystal 跨 overflow 边界仍视为 fused 并导致 retained component 碎裂。

## 8. Crystal generation、connectivity、breakage 与 stacking

`shapeOperations.js::genCrystal` 在每一个现有层中，把 `shapeConstants.js::REPLACED_BY_CRYSTAL` 指定的 Pin 和空位替换成给定颜色的 Crystal。它不新增层，不替换普通/refinement/exotic part，也不重染已经存在的 Crystal。

Crystal fused connectivity 由 `_crystalsFused` 定义：只检查两边 part code 都是 `c`，不比较颜色。一个 component 可通过同层循环相邻位置和相邻层同一 part index 连通。当前会删除完整 component 的入口是：

- Cut/由 Cut 组成的 Swapper 切面穿过 fused Crystal；
- Pin Pusher 在 layer overflow 时检测到 retained/dropped 边界两侧的 Crystal；
- Gravity 发现 Crystal unsupported 时，先将该 unsupported Crystal 位置清空；连锁范围由支撑计算和后续重算共同决定。

Stack 不另造 Crystal 规则，而是通过 `_makeLayersFall` 使用上述支撑/碎裂行为，再应用 layer cap。Crystal breakage 是合法语义；Benchmark witness 可以包含它。`USER_RULES.md` 另规定未来 Solver 应尽量避免不必要的 breakage，但本轮不改变 heuristic，也不设 penalty。

已固定回归覆盖 Generator 替换 Pin/empty 且保留 solid/已有 Crystal、跨颜色 fused component 的 Cut breakage、Pin overflow breakage。现有 25 Pilot 中 `hard-side-035` 的五个 witness 还覆盖 full red crystal base 的正向生成和 replay。

## 9. Paint 与不可染色 part

`topPaint` 只处理当前最高层。普通可染色 part 被设置为给定颜色；empty、Pin、Crystal、refinement `X`、exotic `Y` 在 `UNPAINTABLE_PARTS` 中，保持原值。

底层 operation 本身不实施 clean-painting 限制。Solver/replay 的 `cleanPainting` 是上层求解/Benchmark 子域规则：当前 Pilot 只允许单层且所有可染色 part 尚为 `u` 的 Painter 输入。它不是另一套 Painter 物理。

## 10. Witness resource semantics

Benchmark input 是 available multiset。`witness.initial` 是某条正向证明选择使用的 token 子集；每个 shape 的选择数量不得超过 available multiplicity。未选择的 ordinary/refinement inputs 合法。每步必须消费 live token、使用新 output ID，并声明 canonical operation 产生的全部非空输出。最终只要求一个 live `resultId` 严格等于 target；其他 live token 和合法副产物可以保留。

Splitter 是 shape physics 之外的 throughput/资源语义，当前尚未获得统一成功条件。正式 Benchmark 明确禁用 Splitter；replay 遇到 Splitter 即报告 pending-semantics，而不是假定 4096 初始单位或 2048 split 输出中任一数值构成成功。generator 仅保留 disabled interface，待项目所有者统一语义后再版本化启用。

## 11. 已知证据边界与 regression gaps

- 新增回归已固定代表性的 Pin、Pin-overflow、Crystal generation、跨颜色/跨层 Crystal breakage、Stack gravity、4-layer Stack overflow 和 Half Destroyer empty-lane 行为。
- `tests/shapeSolver.oracle.test.mjs` 已覆盖公开 solution replay 的基本 Pin Pusher、Crystal Generator、Painter 参数与 Stacker/Cutter output order；它复用同一底层操作，证明 replay 接线，不是第二套物理认证。
- 仍缺复杂 mixed Pin/Crystal gravity、Crystal-containing Stack overflow、Swapper 触发多 component Crystal breakage、多个 unsupported Crystal group 的处理顺序等专项回归。
- 当前 implementation 源注释说明它移植自 Loupau38 的 Shapez 2 Library，但仓库没有锁定上游语义版本，也没有与真实游戏 executable/save 的 differential corpus。按 `USER_RULES.md`，当前仓库实现仍是本 Benchmark 的 canonical authority；外部 parity 是可追加证据，不是要求重写第二套物理的理由。
- part index 的真实世界方位名称无法从实现和现有测试可靠确定；本文件只记录循环顺序。
