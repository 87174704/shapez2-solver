# ASTRA 独立审计报告

审计日期：2026-09-13（Asia/Shanghai）。审计对象：`codex/solver-optimization`，HEAD `b367b6e`，以及本轮开始时的完整未提交优化工作树。

**结论：应先补充验证再继续。**

没有发现足以判定 E-001/E-002 路线错误的证据，也没有复现 E-003 返回非法解。已独立确认当前 W5 能返回有效的深度 9 解。但是，E-003 最关键的分流剪枝质量门槛没有真正覆盖它要防范的情形，现有 benchmark 也不足以支持一般工作负载上的质量或性能结论。应先补充分流受剪枝的回归门槛及基准证据，再开展新的生产算法优化。

P5-01 的 **只读 Explorer 审计可以继续**，且具有实际价值；不建议据“Phase 4 complete”直接进入下一轮生产优化。以下阻塞意见区分验证、只读审计和生产修改，不要求停止收集证据。

## 审计范围和独立验证

已阅读 `WORKFLOW.md`、`PROJECT_STATE.md`、`BASELINE.md`、`TASKS.md`、`EXPERIMENTS.md`、`DECISIONS.md`、`RESUME.md`、`ORACLE.md`，检查 tracked diff、相关 untracked 测试及 benchmark、当前求解器和原始 diff，并核对 `shapeOperations.js`、`shapeConstants.js`、`main.js` 的相关逻辑。没有将此前 Agent 的审阅结论作为证明。

本轮只新增本报告；没有修改求解器、测试、benchmark 或其他状态文档。诊断插桩通过 Node 内存中的模块副本执行，不写回源文件，不用于性能结论。

独立复跑结果：

| 验证 | 结果 | 结论边界 |
| --- | --- | --- |
| `npm test` | 27/27 通过 | 当前测试通过，不是整个形状域的正确性证明 |
| `node --expose-gc tests/perf/shapeSolver.bench.mjs --full --stress --warmup 0 --runs 1` | W1–W5 全部匹配当前硬编码逻辑签名 | 单次无预热运行不重建历史性能基线 |
| W1/W2/W3/W5 完整公共路径独立 replay | 均有效；深度分别 6/5/7/9 | 以当前 parity 规则及共享物理操作为准 |
| W1/W2/W3/W5 的 Splitter / unequal-rate discard | 均为 0 / 0；最低吞吐量均为 1 | W3/W5 是开启 splitting 的搜索，不是必须分流的解 |
| solver 两份 SHA-256 | 均为 `60CDEE5D0B26A238DD734D236C81E46541432461E16B0643CFF7734B273F4C04` | 当前副本一致 |
| `git diff --check` | 通过，只有换行提示 | 不代表 untracked 文档经过版本化 |

另外进行了有界、确定性的 E-003 开/关筛查：全部 16 个四象限 C/R 形状分别作为一个起点和一个目标，操作为 Rotator CW/Swapper，orientation-sensitive、splitting=true、preventWaste=false、maxLayers=2，cap 为 2/3/5，共 768 对。内存对照仅关闭 collector 的 coarseness，双方候选上限均临时降至 20,000。未发现“关版本在预算内解出，而开版本未解出或深度更差”的案例。**这不是 E-002 历史快照，也不是 oracle completeness 验证；双方均失败/到限的案例不能排除风险。**

## CRITICAL：继续生产优化前必须解决

### C-01：E-003 的现有质量门槛没有检验“必须保留的分流路径被新排序挤出 beam”

- **相关文件/代码：** `shapeSolver.js:75`、`:126`、`:650`；`tests/shapeSolver.oracle.test.mjs:163`、`:196`、`:229`、`:250`、`:272`；`ORACLE.md` 的 exact domain 和 P4-02a；`EXPERIMENTS.md` E-003 gate；`DECISIONS.md` D-015。
- **具体风险：** “不删除 Splitter 边”不等于保留分流解。新排序可以持续淘汰必经的低 coarseness 状态，使旧 beam 能解的案例变成无解、到限或更深。visited 又让保留状态的扩展成为不可撤销的历史选择，不能靠后面再生成同一状态保证恢复。
- **独立证据：** 固定 cap-1 反例显式 `allowSplitting:false`，E-003 比较分支关闭。Split-required 三类案例虽然开启 splitting，但在 cap 100 下，独立插桩测得成功前 collector 最大占用分别只有 3、8、6，且 beam 丢弃/驱逐事件均为 0；它们主要验证边和 replay，而不是分流受剪枝的安全性。insensitive 的测量使用 preventWaste=false，另两例沿用测试配置。六例 exact matrix 全部在深度 0 或 1 找到解；并非文档所述种子、深度、操作组合上的生成式域覆盖。W3/W5 的成功路径也均不需要 Splitter。
- **为什么现有证据不足：** 所有测试通过与“在真正竞争 beam 槽位的 Split-required 案例上发生退化”完全相容。一次有益的 W5 排序变化和几个不剪枝的正例不能估计这种退化率。报告中的 768 对筛查也没有替代分流必要性证明。
- **最小验证方式：** 固定至少一个 splitting=true、确实发生 unique-state beam 丢弃、且参考 BFS 证明需要 Splitter 的案例；同时比较 E-003 开/关的解率、深度、replay、丢弃事件。增加一个需要多次或嵌套 Splitter 的有界见证，并证明禁止相应分流后不能达到同一目标。以独立留出集合声明可接受的质量退化标准；不能只把观察到的新版结果改写成 expected。
- **是否阻塞：** **是，阻塞新的 recipe 搜索语义优化及把 E-003 当作充分验证基线的生产推进。** 不阻塞只读 P5-01 或补充测试。该等级指验证门槛失效，不是已证明 E-003 有非法解。

## HIGH：强烈建议先验证

### H-01：五个 benchmark 实际是一个问题族，W5 同时承担发现、调参和验收职责

- **相关文件/代码：** `tests/perf/shapeSolver.bench.mjs:15`、`:22`、`:51`；`BASELINE.md` performance baseline；`EXPERIMENTS.md` E-001/E-002/E-003。
- **具体风险：** 一组四个单层无色输入、同一个单层目标，改变 cap/操作开关不能代表真实分布。缺少多层目标、彩色目标、pin/crystal 必需路径、六象限、重复/多目标、orientation-sensitive、preventWaste、cleanPainting、大初始库存和确实需要深分流的性能样本。ALL_OPERATIONS 启用不等于每个操作分支得到有效覆盖；当前目标使 Painter 无可用目标颜色。
- **为什么现有证据不足：** W5 是被用来提出 E-003 假设的样本，也是主要成功指标；没有独立留出集。W3/W5 的无分流解说明改进解决了特定“分流挤占本可无分流解决的路径”问题，不能推广为分流任务整体改善。W1–W5 相同签名也不能验证没有涉及的代码分支。
- **最小验证方式：** 在继续调参前冻结上述维度的独立 workload 清单，区分开发集与留出集；有用户实际输入时纳入匿名样本，否则称为合成覆盖集。每例记录解/未解/到限、深度、分流次数、损失、工作量和 replay，再做相同配置 A/B。保留 W5 作为历史回归，但补一个仍能触及预算的压力案例。
- **是否阻塞：** **是，阻塞跨工作负载收益声明和进一步以 W5 为主要验收指标的 heuristic 调整。** 不否定当前 W5 的收益。

### H-02：W4 被错误称为 exhaustive；生产“未找到”没有记录是否发生了 beam 丢弃

- **相关文件/代码：** `tests/perf/shapeSolver.bench.mjs:85`；`shapeSolver.js:126`、`:631`、`:949`；`main.js:338`、`:362`；`PROJECT_STATE.md` beam 限制说明。
- **具体风险：** bounded frontier 耗尽不能证明无解，而 W4 描述为 `No-solution exhaustive search`。生产返回的普通 null path 没有区分 unpruned exhaustion 和 pruned exhaustion；下游可能误用为 completeness 证据。进度中的 `consideredCount-size` 同时包含重复/visited 拒绝，不能作为真实 beam 丢弃统计。
- **独立证据：** 在保持 W4 深度 21、17,155 states、139,718 candidates 不变的内存诊断中，记录到 **79,888 次** beam 丢弃/驱逐事件，collector 达到 1,000。此处事件定义为满堆前置拒绝时 key 不在 visited/retained，或发生 heap eviction；是事件数，**不是全局不同状态数**。因此 W4 当前运行不是穷尽整个可达图。
- **为什么现有证据不足：** 未见 W4 独立无解证明；也不能由发生剪枝反过来断言 W4 有解。状态文档知道 beam 不完备，但 harness 的表述与之矛盾。
- **最小验证方式：** 增加明确的 `beamPruned`/淘汰计数及“搜索未找到”分类；只有确实未发生 unique-state beam 丢弃、未触发资源界限且自然耗尽时才称穷尽。核对界面文案与 API 消费者；修正文档和 W4 描述，不擅自把 expected 改成“有解”。
- **是否阻塞：** **是，阻塞无解/completeness 结论及依赖这种分类的质量比较。** 不阻塞独立 Explorer 调查。

### H-03：replay 是有价值的 parity 验证，但没有覆盖完整操作集，也没有成为 benchmark 的持续门槛

- **相关文件/代码：** `tests/helpers/shapeSolverOracle.mjs:10`、`:235`、`:250`；`tests/perf/shapeSolver.bench.mjs:36`、`:184`；`ORACLE.md` claim boundary、matrix exclusion；`EXPERIMENTS.md` W5 direct replay。
- **具体风险：** reference/replay 操作表都没有 Painter、Pin Pusher、Crystal Generator。文档突出排除 Painter/Crystal 的生成矩阵限制，容易掩盖 **Pin Pusher 和完整 replay 能力也缺失**。形状签名删除 token ID，无法发现重复消费、错误血缘或吞吐量重建问题。
- **独立证据：** 当前 W1/W2/W3/W5 原始公共路径均 replay-valid。把 W5 最后一步一个 input ID 改为不存在的 999999，shape signature 完全不变，而 replay 正确拒绝；说明 benchmark 断言确实有这类盲点。
- **为什么现有证据不足：** 一次直接 replay 不能保护未来每次 benchmark。`ORACLE.md` 所称“每个路径”只能理解为已调用 replay 的有限 fixture，不能扩大到 solver 所有操作。共享 `shapeOperations.js` 只能检查搜索/血缘与物理函数一致，不能证明物理函数本身正确。
- **最小验证方式：** 在每个 solved benchmark 上运行原始 ID 路径 replay，把 unsupported operation 与 invalid path 分开报告；扩展三类缺失操作及颜色参数、cleanPainting 策略验证。保留重复 ID、错误 input shape、禁用操作、错误颜色、缺失/多余 output、终端 throughput 不足等负例。物理层采用手工已知输出/不变量测试，不复用同一调用作为唯一期望。
- **是否阻塞：** **是，阻塞涉及未覆盖操作的 correctness 声明和相应优化。** 当前已重放的无彩色路径不因此失效。

### H-04：资源上限不是严格时间/内存界限，现有验证几乎没有覆盖边界行为

- **相关文件/代码：** `shapeSolver.js:22`、`:230`、`:331`、`:535`、`:649`、`:692`、`:696`、`:723`、`:871`、`:922`；`BASELINE.md` memory；`PROJECT_STATE.md` hard safety limits。
- **具体风险：** 时间检查在每个 current state 起点以及每 2,048 个 **有效入队候选**，被跳过的无效/无输出/no-op 操作不经过后者。巨大 inputGroups 的 O(m²) 循环或单次昂贵物理计算可超时后才返回。visited 限制是条目数，不是 key 字节数；长库存 key、trace 链、shape 字符串、token intern 表和每次操作的临时分配都不受字节预算约束。splitting token ID 理论上可达约 13 × interned shapes，远大于 shape cache 容量。初始化和 shape 解析也在正常边界检查之前。
- **为什么现有证据不足：** 现在 W5 已不触发 generated limit；27 个测试没有生产 time/visited/shape-universe/generated limit 的边界断言。低 post-GC heap 只说明那次 solve 结束后释放了对象，不证明运行中的峰值有界。有限状态数不能直接推出对浏览器安全的内存上限。
- **最小验证方式：** 用测试专用预算注入覆盖上限前一项/等于/超出、无效 pair 密集输入、长 trace、长 shape/大库存；记录返回类型和超时超额。进程外 watchdog 限制测试资源。真实浏览器独立 Worker 测峰值、终止及回收；建立输入尺寸边界和按操作尝试次数检查时间的策略。无需为了验证硬跑到 120 秒或接近 OOM。
- **是否阻塞：** **是，阻塞扩大预算、库存规模或 Explorer 规模的优化。** 对纯局部等价优化至少应先有相应边界门槛。

### H-05：内部消息取消不可协作生效；Explorer 的异常协议还有独立生命周期缺口

- **相关文件/代码：** `shapeSolver.js:159`、`:193`、`:198`、`:207`、`:212`、`:952`；`main.js:151`、`:170`、`:179`、`:186`、`:190`。
- **具体风险：** solver/Explorer 虽声明 async，搜索循环内部没有 await 或其他事件循环让出点。Worker 忙于同步计算时不能处理后续 cancel 消息，循环中读取 cancelled 不能解决这一点。**当前 UI 的 stopWorker 立即调用 terminate，因此不能据此声称界面取消失效。** 另一个实际问题是 Explorer catch 仅发送 `type:'status', status:'error'`，而 runWorker 的 status 分支直接返回；不会像 result/onerror 分支那样终止 Worker 并调用清理逻辑。
- **独立证据：** 通过现有 `self.onmessage` 调用 explore，输入 `CuCuCuCu`、`HuHuHuHuHuHu`，仅 Swapper、depthLimit=1，收到的仅为 InvalidOperationInputs 的 error status，没有终结 result。结合 main.js 可见自动清理路径缺失；本轮未做真实浏览器按钮状态测试。
- **为什么现有证据不足：** Node tests 使用 postMessage 空 stub，无法覆盖消息队列、按钮/Worker 生命周期、错误后的再次运行。正常路径 postMessage 也不意味着 Worker 已让出计算线程。
- **最小验证方式：** 用真实 Worker 做 solve/explore 启动后立刻取消、取消后重启、异常后重启，验证无旧结果、Worker 释放和 UI 恢复。明确 API 依赖强制 terminate 还是承诺协作取消；若承诺后者必须加入有界让出和任务隔离。
- **是否阻塞：** **阻塞取消可靠性和 Explorer“已隔离”的声明。** 应列入 P5-01 优先验证，不要求先大改 recipe 循环。

## MEDIUM：值得补充

### M-01：历史性能和 profile 结论的可复核性不足；非交错计时不能承担因果归因

- **相关文件/代码：** `EXPERIMENTS.md` E-001/E-002/E-003；`BASELINE.md` CPU/memory；`tests/perf/shapeSolver.bench.mjs:172`、`:197`、`:233`；`WORKFLOW.md` experiment protocol。
- **具体风险：** Git 仍只有起点提交，C-001/E-001/E-002/E-003 混在同一 diff；仓库中未找到阶段 A/B 源快照、原始 paired 序列、profile 或 replay 原始产物。数字有详细记录，但不能独立重放每次历史处理。相邻批次运行环境和 JIT 差异可能产生看似优化收益。
- **为什么现有证据不足：** E-003 标准计时连非 splitting W1 都明显下降，文档正确承认不能全部归因 E-003；同理“该批更快”不足以严格证明没有回归。E-002 后续 paired 证据缓解但不消除原始材料缺失。harness 的 maxRSS 是进程生命周期高水位，跨 workload/warmup 保留；`maxRSS - 本次开始RSS` 不是本次峰值增量。本轮同进程 W5 maxRSS 约 244 MiB，不能拿它反驳文档独立进程约 85 MiB。
- **最小验证方式：** 在下次实验前保存准确 A/B 源/hash、命令、原始 JSON、运行顺序及环境；使用交错 AB/BA 或随机化配对报告差值。memory 用每 workload 独立新进程。历史无法恢复的部分标为记录性证据，不补造结果。
- **是否阻塞：** 不阻塞只读审计；阻塞精确百分比的重新宣传或把历史 A 当作可复现控制组继续堆叠实验。

### M-02：文档声称 shadow recomputation，但测试只验证手写公式；主评分还有路径相关舍入

- **相关文件/代码：** `tests/shapeSolver.test.mjs:156`；`shapeSolver.js:508`、`:701`、`:756`、`:821`、`:855`、`:904`；`EXPERIMENTS.md` E-003 correctness gate/implementation。
- **具体风险：** 测试中手动计算一份 unary/binary 公式，不会捕获生产某一分支漏传字段或使用错误 token。测试也未直接覆盖生产 Splitter 累加链。primary similarity 含分数及十进制权重，incremental scoreTotal 可能因不同路径出现微小舍入差；coarseness 只在精确相等时参与比较，同 inventory 的首个路径分数又通过去重保留下来。
- **为什么现有证据不足：** 报告中“shadow recomputation tests”不对应当前自动化测试实现。吞吐量及平方的 dyadic 算术在当前可控规模内有良好精确性；这个事实不能推广到 similarity 的累加。没有发现当前生产平方公式错误，也不能把主评分舍入归因于 E-003 新引入。
- **最小验证方式：** 测试专用 hook 在真实 successor 上从 counts 重算 throughput、squareTotal、similarity，覆盖所有生成分支、same-token、consume-only、多层分流和长路径；报告主评分误差及相同 key 的重复路径差异。不要未经实验引入 epsilon，因为那会再次改变搜索语义。
- **是否阻塞：** 不单独阻塞 P5-01；建议在下一次评分/collector 优化前完成，并修正文档措辞。

### M-03：D-015 对 Cutter 的解释过强，coarseness 不是只度量“发生了几次分流”

- **相关文件/代码：** `DECISIONS.md` D-015 的 “Cutter output multiplicity does not create a false improvement”；`shapeSolver.js:701`、`:855`、`:904`。
- **具体风险：** 指标是按流量加权的均值，复制较粗流会提高它，消耗较细流也可能提高它。库存流量 `[1, 0.5]` 时指标为 `1.25/1.5 ≈ 0.8333`；Cutter 把 q=1 的非空左右两半都输出后变成 `[1,1,0.5]`，指标为 `2.25/2.5 = 0.9`。并没有更少的细流。因此在 primary 恰好相同的状态中，指标还会偏好某些 Cutter/消耗动作。
- **为什么现有证据不足：** E-003 采用这个指标本身可以是合理启发式，但不能把它描述为对输出重数不敏感的纯 fragmentation 指标。未见 mixed-throughput Cutter 与 primary tie 的行为覆盖；W5 无分流路径无法检验此偏好。
- **最小验证方式：** 增加 mixed-throughput Cutter 和消耗细流的状态对照，记录 primary/coarseness/真实解质量，说明这种偏好是否接受；修正解释即可，不建议因审计直接更换公式。
- **是否阻塞：** 不单独阻塞；与 C-01 的留出质量验证一起处理。

### M-04：Explorer 的审计范围应超出 reverse Stacker 和 lookup 优化

- **相关文件/代码：** `shapeSolver.js:952`、`:972`、`:1011`、`:1019`、`:1056`、`:1073`；`TASKS.md` P5-01。
- **具体风险：** `outB` 仅用于与 outA 比较，没有添加反向结果。frontier 只放本轮新形状，下层处理旧×新时，新×旧方向可能永久缺失。每次 lookup 用 find 并重新 parse，配合 pair enumeration 会再乘一个形状数因子。仅红色的彩色操作、`some(output equals input)` 就跳过全部 outputs、无限制 ops/edges 数量，以及 mixed-part 异常隔离也都需要审查。不能把 Explorer 形状集合闭包误当为有限库存 recipe 可达性。
- **为什么现有证据不足：** 无 Explorer 自动化回归；reverse Stacker 在首层可能两方向都有，所以简单首层例子不足。上述颜色/no-op 行为是否为产品要求没有明确契约；不是每一处可疑代码都已证明漏解。
- **最小验证方式：** 先定义 shape closure、depth 和颜色全集语义；用旧层+新层非交换 Stacker 构造 reference closure 对照，另加 mixed-part 错误生命周期（H-05）、多输出保留和图节点/边预算。将查找优化置于 correctness/资源验证之后。
- **是否阻塞：** 阻塞 Explorer 性能修改之前的验收；**支持继续 P5-01 的只读审计方向**。

## LOW：改进建议

### L-01：整理当前状态与历史检查点，避免把阶段记录读成同时成立的验收结论

- **相关文件/代码：** `RESUME.md` Verified state 中同时出现 6/6、9/9、27/27；`TASKS.md` 旧 Gate/Phase-three；`EXPERIMENTS.md` P3-03 的 “no E-003 selected”；`ORACLE.md` generated matrix、accepted implementation；`DECISIONS.md` D-005。
- **具体风险：** 部分内容明确是历史，部分采用现在时；新 Agent 可能把六个固定案例误读为文档整个 finite domain 已被验证，把历史 W5 的 5M limit 当作当前 gate，或将“current suite 9/9”当作当前事实。
- **为什么现有证据不足：** 这些大多是累积记录造成的歧义，不能据此说测试结果伪造；但代码实际覆盖与概括性措辞需要一致。特别是 generated matrix、shadow tests 和 W4 exhaustive 是实质性过度表述，已分别列入 C-01/M-02/H-02。
- **最小验证方式：** 顶部只保留一个当前 checkpoint，历史段落注明版本/日期；每个 done 链接具体 gate、产物和源 hash；用“六个固定问题实例”替代“整个有限域已验证”。
- **是否阻塞：** 否；下一轮恢复或提交时清理。

## CONFIRMED：独立检查后证据充分的有限结论

### F-01：E-001 的 lazy materialization 在当前实现中保持 collector 选择逻辑

- **相关文件/代码：** `shapeSolver.js:122`、`:664`、`:674`、`:702` 及 E-001 diff。
- **已确认：** consideredCount/sequence 在拒绝前推进；满堆分数拒绝与 key 去重的顺序互换不会让本应拒绝的候选被接纳。goal 检查在 beam 前，并可按需物化；factory 在调用期间同步执行，没有跨迭代延迟捕获变量。普通分支的 counts 更新和候选枚举在 diff 中对应，未发现 E-001 隐藏删除合法后继。
- **证据边界：** 这是代码结构推理和现有回归支持的逻辑等价，不是实际 120 秒限时下必然同结果；更快实现可在限时内搜索更远。未独立重测历史百分比。
- **最小复核：** 现有 collector/goal 回归；未来变更追加有限候选序列 A/B 和预算边界验证。
- **是否阻塞：** 否。

### F-02：E-002 的当前键空间可分离，未发现数字键碰撞

- **相关文件/代码：** `shapeSolver.js:8`、`:26`、`:30`、`:359`；`shapeConstants.js` 颜色定义。
- **已确认：** 当前 cacheId 唯一为 0–9；B=150001，shape ID 为 0–149999；binary 的两个 ID 各占一位；当前单字符颜色的 charCode 小于 B，且 colored unary 与 binary 属于不同操作区间。最大区间键为 `225003000009`，低于 Number.MAX_SAFE_INTEGER。Swapper canonicalization、Stacker 方向及 FIFO cache 结构保持原样。
- **证据边界：** 依赖当前 operation ID 唯一性、颜色单字符及 shape ID 上限。顶部断言没有自动验证所有未来 cacheId 唯一且在范围内；多字符颜色会失去区分。当前调用没有这种输入。
- **最小复核：** 增加操作 ID 唯一/范围和各颜色/边界 ID 的编码测试，供未来扩展使用。
- **是否阻塞：** 否。

### F-03：C-001 的两类修复与当前目标分配的限定论证成立

- **相关文件/代码：** `shapeSolver.js:372`、`:400`、`:410`、`:447`、`:676`；`tests/shapeSolver.test.mjs:217`、`:232`、`:244`；`DECISIONS.md` D-007/D-008。
- **已确认：** 合法 [] 与 InvalidOperationInputs 的 null 区分明确，非此类异常重新抛出；consume-only goal 检查可在 beam 前成功。mixed 4/6-part 回归复跑通过。对同一 orientation 模式的 singleton 或完整旋转轨道，可接受集合相同或互不相交，因此 splitting 的逐目标容量消耗不会产生一般任意重叠集合的 greedy 错配。
- **证据边界：** 此论证不授权未来 wildcard/目标各自不同替代集。`preventWaste=false` 时忽略纯消耗在不剪枝的可达性意义下安全，因为额外库存可不使用；在 bounded beam 中多余库存会影响评分，不能额外声称两种枚举方式的实际 beam 行为等价。
- **最小复核：** 保留现有回归；任何扩展接受集合或 waste 语义需重新证明。
- **是否阻塞：** 否。

### F-04：W5 的当前成功和 D-016 的 multiset replay 处理可信

- **相关文件/代码：** `shapeOperations.js:420`；`shapeSolver.js:386`、`:552`；`tests/helpers/shapeSolverOracle.mjs:286`；`DECISIONS.md` D-016。
- **已确认：** W5 当前为 depth 9、735 states、21,777 candidates，独立完整 replay 成功，Splitter=0、implicit binary discard=0、最低 throughput=1。Swapper 反向输入改变输出排列，库存是 multiset，replay 仍按每个 declared output ID 绑定其形状并检查后续血缘；允许 Swapper 输出置换没有放松 multiplicity 或 token 生存期。Stacker/Cutter 仍严格比较。
- **证据边界：** 本轮确认搜索 parity 下的有效路径，不证明游戏物理或输出车道契约；如果产品以后引入车道绑定，应补充映射。这个单例的候选量下降可信，但不是全体分流任务的 completeness 或性能结论。
- **最小复核：** 将本轮执行的 W5 完整 replay 固化为持续门槛（H-03）。
- **是否阻塞：** 否。

## 最小复核方法说明

为避免诊断计数被误当成生产指标，本轮插桩只做了以下操作：读取当前 `shapeSolver.js` 字符串，把两个相对 import 指向原始物理/常量模块，通过 data URL 加载；在 collector 每次 considerLazy 前记录现有 size。满堆前置拒绝时额外调用原 candidate factory 获取 key，仅当 key 不在 visited/retained 中计一次丢弃；每次 eviction 另计一次。没有改变 score、枚举、堆选择和返回值。factory 只克隆 counts/计算 key；该探针增加成本，因此不用于计时。W4 结果仍与原始逻辑签名相同。C-01 的三个 split fixture 可直接复用对应测试的参数，以 cap 100 调用。

完整 replay 方法：使用 benchmark 的原始配置调用 shapeSolver，将未删除 ID 的 `solutionPath` 与结果深度传入 `replaySolution(config, path, result)`。ID 负例仅在结果的深拷贝上变更。Explorer 异常探针则直接调用模块安装的 `self.onmessage`，捕获所有 postMessage。以上均不改动磁盘上的求解器文件。

## 后续顺序与最终判断

1. 先补 C-01 的 **splitting 开启、真实剪枝、分流必要** 门槛，以及 H-03 的持续 replay；固定独立 workload 留出集，明确哪些质量回退允许、哪些必须 revert。
2. 修正 W4 的 exhaustive 分类与文档过强结论，保存当前版本身份和可复核原始产物；不要把所有历史百分比相乘当作总收益。
3. P5-01 继续只读调查，优先确认异常生命周期、终止/资源预算和闭包语义，再处理反向 Stacker 与 lookup 性能。验证代码可以作为独立后续工作；本轮未修改它们。

**最终选择：应先补充验证再继续。** 当前路线没有被证明存在根本问题；E-001/E-002 的局部设计和 E-003 对 W5 的效果有可信依据。需要纠正的是验收证据覆盖和结论强度，尤其不能以“不删边、现有测试通过”替代 bounded beam 下的分流质量验证。
