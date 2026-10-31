> 历史记录：以下结论对应 2026-10-30 的 opt-in 实验；正式 Release 1 已默认启用 O1。工作区收敛时已移除原始性能采样、逐次日志和一次性审计脚本；原始记录仍属于既有 Git 历史，未重写历史。当前回归请使用 REPRODUCE.md 的仓库内入口。

# 独立留出结果

24 个输入在实现前固定，提交 db25eb4；SHA/时间见 tests/strict-routing/holdout-lock.json。由形状结构、资源与操作条件定义，不使用任何求解器挑选。之后没有增加、删除、改写案例，未把预设可达期望当作证明。全量原始输入在 holdouts.json；运行输入的独立锁在 input-lock.json。

三种配置各运行三次：19 个正例均 3/3 成功、两套回放均合法，5 个负例均 0/3 返回解、以 exhausted 正常结束。全部 24 个预设结果符合，无非法方向、库存或物理路径。负例包括缺少颜色来源、单副本无法堆叠两份、方向错误但旋转关闭、Stacker 关闭、preventWaste 禁止剩余库存。负例未用超时冒充无解。

| Case | 预设 | rc/off/on ms | RC→on 步数 | on 成功/3 | on 路由 | 回退/3（原因） | 提交峰 MiB |
|---|---|---:|---|---:|---|---|---:|
| L01-mixed | reachable | 508.97/534.93/14.67 | 5→18 | 3 | strict-ordinary-constructive | 0 ({}) | 27.2 |
| L02-two-layer | reachable | 0.52/0.55/9.92 | 1→9 | 3 | strict-ordinary-constructive | 0 ({}) | 26.4 |
| L03-three-layer | reachable | 1.22/0.98/9.51 | 2→2 | 3 | strict-ordinary-constructive | 0 ({}) | 26.3 |
| L04-four-layer | reachable | 13.19/11.93/14.50 | 3→3 | 3 | strict-ordinary-constructive | 0 ({}) | 26.4 |
| L05-clockwise | reachable | 0.27/0.21/0.73 | 1→1 | 3 | strict-ordinary-constructive | 0 ({}) | 26.4 |
| L06-counterclockwise | reachable | 0.19/0.24/0.88 | 1→1 | 3 | strict-ordinary-constructive | 0 ({}) | 27.6 |
| L07-halfturn | reachable | 0.19/0.19/0.68 | 1→1 | 3 | strict-ordinary-constructive | 0 ({}) | 26.6 |
| L08-copies | reachable | 0.22/0.20/1.03 | 1→1 | 3 | strict-ordinary-constructive | 0 ({}) | 26.7 |
| L09-surplus-copies | reachable | 813.53/937.05/12.50 | 6→18 | 3 | strict-ordinary-constructive | 0 ({}) | 27.6 |
| L10-no-rotation-needed | reachable | 0.24/0.22/0.78 | 1→1 | 3 | strict-ordinary-constructive | 0 ({}) | 26.3 |
| L11-clean-paint | reachable | 0.56/0.60/7.89 | 1→1 | 3 | strict-ordinary-constructive | 0 ({}) | 26.5 |
| L12-paint-disabled | unreachable | 0.41 exhausted/0.54 exhausted/11.34 exhausted | —→— | 0 | general-search | 3 ({'construction-failed': 3}) | 27.0 |
| L13-insufficient-copy | unreachable | 0.17 exhausted/0.24 exhausted/2.46 exhausted | —→— | 0 | general-search | 3 ({'construction-failed': 3}) | 26.6 |
| L14-wrong-direction | unreachable | 0.19 exhausted/0.14 exhausted/2.38 exhausted | —→— | 0 | general-search | 3 ({'construction-failed': 3}) | 26.5 |
| L15-stack-disabled | unreachable | 0.41 exhausted/0.58 exhausted/13.15 exhausted | —→— | 0 | general-search | 3 ({'construction-failed': 3}) | 26.3 |
| L16-cutter-only | reachable | 0.23/0.26/2.96 | 1→1 | 3 | general-search | 3 ({'construction-failed': 3}) | 26.5 |
| L17-no-cutters | reachable | 0.27/0.26/9.01 | 1→1 | 3 | strict-ordinary-constructive | 0 ({}) | 27.0 |
| L18-rotated-mixed | reachable | 609.30/535.48/14.62 | 5→18 | 3 | strict-ordinary-constructive | 0 ({}) | 28.2 |
| L19-layer-cap-two | reachable | 0.22/0.22/2.76 | 1→1 | 3 | general-search | 0 ({}) | 26.5 |
| L20-waste-rule | unreachable | 0.24 exhausted/0.22 exhausted/2.65 exhausted | —→— | 0 | general-search | 0 ({}) | 26.8 |
| L21-paint-rule-off | reachable | 0.44/0.42/3.05 | 1→1 | 3 | general-search | 0 ({}) | 26.5 |
| L22-rotation-insensitive | reachable | 2.10/2.24/2.22 | 0→0 | 3 | general-search | 0 ({}) | 26.6 |
| L23-multilayer-resource | reachable | 0.14/0.14/3.52 | 0→0 | 3 | general-search | 3 ({'construction-failed': 3}) | 26.9 |
| L24-different-parts | reachable | 492.12/529.33/13.86 | 5→18 | 3 | strict-ordinary-constructive | 0 ({}) | 27.9 |


正例涵盖 2/3/4 层、三种旋转、同形副本及冗余副本、不同材料、纯 Cutter、无 Cutter、受限操作、多层输入、cleanPainting/maxLayers/orientation 的原入口边界。新增生产验收的故意坏路径另见 routing-tests.log，包括同一步重复 ID 和跨步重复消费。

相对 RC 产生更长解的留出案例：L01-mixed, L02-two-layer, L09-surplus-copies, L18-rotated-mixed, L24-different-parts。这些是可行解优先的代价，未隐去。逐次 min/max、端到端耗时、路径哈希与全部操作在 case-summary.json 和 runs/formal/；表中 exhausted 的返回耗时仍完整保存在原始数据中。

本留出集不是随机总体样本；不可推断未测普通输入的普遍成功率或最优性。特殊材料资源、超过 64 token、分流、preventWaste、非四层上限等不满足新 gate 的输入保留旧路线。
