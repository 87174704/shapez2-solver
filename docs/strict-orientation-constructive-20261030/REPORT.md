# Shapez 2 Solver — Strict-Orientation Constructive Routing

日期：2026-10-30（Asia/Shanghai）。固定 RC ec9cc5cb633d021b6af276565223a392f8329b87。隔离目录 E:\solver-strict-constructive-20261030，分支 codex/strict-orientation-constructive。

已完成默认关闭的严格方向普通目标 Constructive 路由、有限库存/Physics v2 完整回放验收及安全回退。先锁定 24 个留出案例（提交 db25eb4），再实施。仅两个生产文件有内容增改：shapeSolver.js 与新增 constructive/validate-strict-plan.js；构造算法、通用搜索/Beam、缓存和 Physics v2 不变。

三种配置 rc/off/on，201 例，各三次，原 2 秒/768 MiB 限制串行执行，共 1809 次。原 18 例成功率从 RC/off 的 13/18 提升为 on 的 18/18，每次重复一致；原五个超时均三次合法完成。冻结 159 每种配置均 159/159，全部 1431 条返回路径与历史路径完全相同。24 个留出中 19 个正例全部合法成功、5 个负例全部 exhausted。总计 1734 条返回路径双重回放通过，无正确性退化。

改善有代价：原可解 13 例中按中位耗时 9 例更快、4 例更慢，13 例路径变长；初始目标控制和部分简单留出有额外构造开销。默认开关保持关闭。没有据此宣称全局性能提升、普通域全覆盖或最短解。

50 ms 为构造与生产验收共享的协作式预算，另有限定输入域及工作量上限；不声称能强制抢占 JavaScript 同步构造阶段。超支候选被拒绝，已花时间计入总求解并从 core 上限扣除。测量使用原外部 2 秒进程硬截止，结果不是构造器内部计时。

开关关闭时 588 对完成结果非计时字段一致，含 573 对成功路径精确一致；15 对超时的最终路径未知。旧入口/core/cache/Beam 源码不变。Physics v2 与 461 冻结文件身份一致；旧 RC 全源码身份因授权修改 shapeSolver.js 按预期失配，不改历史哈希，详见身份日志及 CORRECTNESS_VALIDATION.md。

交付：ROUTING_PATCH.md（设计/开关/变更）、CORRECTNESS_VALIDATION.md、PERFORMANCE_COMPARISON.md、HOLDOUT_RESULTS.md；REPRODUCE.md 给出完整方法。MEASUREMENTS.csv、formal.jsonl、runs/formal/ 保留每次原始数据、完整路径、路由、回退、内存。源码 SHA 见 identity-validation.json，证据哈希见 EVIDENCE_MANIFEST.sha256。

未修改 E:\solver 或其他 Agent 工作目录；未 push、deploy、修改 GitHub Pages/Gitea/ECS 或任何生产环境。未启动缓存优化或下一阶段重构。完成后 STOP。
