> 历史记录：以下结论对应 2026-10-30 的 opt-in 实验；正式 Release 1 已默认启用 O1。工作区收敛时已移除原始性能采样、逐次日志和一次性审计脚本；原始记录仍属于既有 Git 历史，未重写历史。当前回归请使用 REPRODUCE.md 的仓库内入口。

# 正确性验收

完整测量 1809 次，验证器重新读取每条原始结果，而非仅信任 worker 的 valid 字段。validation-ledger.json 保存逐次记录。共 1734 条成功路径经生产测试 oracle 与不导入生产物理操作的独立分析模型双重回放；其余为 30 次原普通例基线/off 超时及 45 次留出负例 exhausted，没有非法解、运行异常或内存失败。

冻结 159×3 配置×3 次=1431 条路径全部合法，并逐路径匹配冻结 E-014 历史结果。历史 benchmark/witness/哈希未修改。input-lock.json 为每个完整输入提供 SHA，worker 不接收 witness。

开关关闭与 RC：588 对完成结果的全部非计时字段一致（包括 573 对成功路径逐字节/哈希相同、15 对负例无路径结果相同）；15 对均为 2 秒超时，最终路径 UNKNOWN，不声称比较到未返回的路径。旧 gate、core/Explorer、缓存/Beam 源码块逐字节不变，同时提供关闭路由的结构不变证据。

测试覆盖精确目标方向、完整操作/副产物、有限库存、跨步重复消费、同一步重复消费、输出 ID 重用、操作开关、颜色参数和 cleanPainting、预算与异常回退、Worker 开关传递、资源副本及多层。核心回归 95/95 通过（regression.log）；生产浏览器静态依赖与冻结路径检查见 browser-safe-production.log，真实浏览器 Worker 生命周期见 browser-worker.log。

Physics v2 当前物理回归通过。历史身份命令为 44 项中 42 通过、2 失败：这两项均要求整个源码仍是固定 RC，按预期只报告 runtime: shapeSolver.js hash differs。保留日志，不修改断言/历史清单来伪造 RC 身份。独立 check-identity.mjs 通过：原 RC 当前身份有效，补丁身份差异恰好这一项；全部 461 冻结文件及 Physics v2 语义绑定保持一致。新增验证模块另附 SHA。该已解释的身份差异不是物理正确性回归，也不表示新发布版本已获认证。

初次身份运行另发现 clone 的换行转换差异，已仅在本 Clone 恢复 README/package-lock/USER_RULES 的原目录字节；初始失败日志仍保留，最终 Git 提交不包含这些文件。`.gitea/workflows/deploy.yml` 和原测试文件的 clone 换行差异未修改，身份检查列为仅换行差异，内容相同。

没有发现无法解释的正确性回归，因此未触发 BLOCKED。有限分析模型不是游戏认证；沿用原 Physics v2 的 gameCertification=UNKNOWN，没有提高这一级结论。
