# 复现

固定日期：2026-10-30，Asia/Shanghai。RC：`ec9cc5cb633d021b6af276565223a392f8329b87`。本地隔离 Clone：`E:\solver-strict-constructive-20261030`，分支 `codex/strict-orientation-constructive`。禁止发布。

留出集先于实现提交：`db25eb4`，24 例定义及 SHA 见 `tests/strict-routing/holdouts.json` 和 `holdout-lock.json`。锁定脚本不导入求解器或物理代码。冻结 159 例从原 release/sourceRegistry 解析，原 18 普通例逐字段从原比较读取，全部输入及 SHA 在 `measured-cases.json`、`input-lock.json`。witness 未传给求解入口。

## 新目录复现

保留本证据，不在现有 `formal.jsonl` 上重跑。创建本补丁提交的新 Clone，使用相同绝对目录布局或调整 `prepare.mjs`、`worker.mjs`、`independent-replay.mjs` 中明确的只读基线地址。将本证据目录中的 `runs/`、`formal.jsonl`、`measured-cases.json`、`input-lock.json`、`source-before.json` 移出新副本后才运行；锁定留出文件必须原样保留。不要重新选择案例。

准备依赖时按原 package-lock 安装，或从固定 RC 复制 node_modules（仅 ajv 验收工具使用；生产求解无需第三方包）。Windows、Node v24.21.0、Python 3.14，原评测限制器 `limiter.py` 原样复制自 RCA。

```powershell
node docs/strict-orientation-constructive-20261030/prepare.mjs
node --test tests/strict-routing.test.mjs > docs/strict-orientation-constructive-20261030/routing-tests.log 2>&1
node docs/strict-orientation-constructive-20261030/check-identity.mjs > docs/strict-orientation-constructive-20261030/identity-validation.log 2>&1
python docs/strict-orientation-constructive-20261030/measure.py > docs/strict-orientation-constructive-20261030/formal-progress.log 2>&1
python docs/strict-orientation-constructive-20261030/analyze.py > docs/strict-orientation-constructive-20261030/analysis.log 2>&1
node docs/strict-orientation-constructive-20261030/verify-results.mjs > docs/strict-orientation-constructive-20261030/verification.log 2>&1
```

计时期间不并行运行回归、浏览器或其他性能任务。`measure.py` 串行执行 201×3 配置×3 次=1809 次：rc（只读 E:\solver）、off（补丁 false）、on（补丁 true）。每次新进程，S2 按该配置预热三次，GC，再发 START。每轮反转/轮换案例与配置顺序，`formal-config.json` 在测量前固定。

Windows Job Object 在传入请求前设置 PROCESS_MEMORY=768 MiB、KILL_ON_JOB_CLOSE；V8 堆 512 MiB。外部从 START 起 2,000 ms，5 ms 轮询强制终止；已返回但内部实测超过 2,000 ms 也归 TIMEOUT。TIMEOUT 的 2,000 是右删失阈值，不能当作成功解耗时。SEARCH_END 之后才进行两套回放，不把验收工具开销算入求解。

`searchMs` 包含完整公共入口：路由判断、全部构造尝试、生产严格回放、失败回退及通用搜索；不只是构造器 wallMs。导入、预热、启动和整个进程 wallMs 分开记录。内存记录 Job 的私有提交峰值及 PSAPI 的工作集峰值，包含导入/预热/回放；不把它们冒充仅搜索增量内存。

源码修改仅在开始计时前完成。`identity-validation.json` 绑定生产源码 SHA，并确认旧 core/Explorer、缓存/Beam、旧 dispatch 逐字节相同；`source-before.json` 与最终身份检查确认 E:\solver 全部跟踪文件未变。背景应用仍可能造成噪声，没有固定 CPU 亲和性、提权优先级或关闭其他 Agent。

## 回归和身份

```powershell
node --test --test-concurrency=1 tests/strict-routing.test.mjs tests/shapeSolver.test.mjs tests/shapeSolver.oracle.test.mjs tests/shapeSolver.profile.test.mjs tests/shapeSolver.observer.test.mjs tests/shapeSolver.limits.test.mjs tests/shapeExplorer.test.mjs tests/productionConstructiveHybrid.test.mjs tests/crystalPhysicsFix.test.mjs tests/workerLifecycle.test.mjs > docs/strict-orientation-constructive-20261030/regression.log 2>&1
node --test tests/crystalPhysicsFix.test.mjs tests/versionIdentity.test.mjs > docs/strict-orientation-constructive-20261030/physics-identity-final.log 2>&1
node tests/tools/verifyBrowserSafeProduction.mjs > docs/strict-orientation-constructive-20261030/browser-safe-production.log 2>&1
node tests/browser/workerLifecycle.browser.mjs > docs/strict-orientation-constructive-20261030/browser-worker.log 2>&1
python docs/strict-orientation-constructive-20261030/build-reports.py
python docs/strict-orientation-constructive-20261030/seal.py
```

历史版本身份测试的两处断言按预期拒绝 `shapeSolver.js` 新哈希；不应修改旧 manifest/expected hash 来使其通过。`check-identity.mjs` 独立要求差异**恰好**为这一项，并验证原 RC 身份通过、Physics v2 语义和全部 461 冻结文件身份一致。补丁不是原 RC 身份，也未声明新发布版本。初始 clone 的 README/package-lock/USER_RULES 换行问题仅恢复为原目录权威字节，保留失败日志；未提交这些文件的内容或历史哈希修改。

## 原始证据

`runs/formal/*.json` 包含原始结果和完整操作路径，`*.stdout.jsonl` 为启动、进度、路由结果日志，`*.stderr.log` 原样保留。`formal.jsonl`、`MEASUREMENTS.csv` 为逐次索引；`case-summary.json`、`aggregate.json` 派生统计；`validation-ledger.json` 是独立重放的每次验收；`off-rc-parity.json` 对比路径哈希与非计时字段。超时无完整返回路径的部分明确标 UNKNOWN。

仅重新生成统计：运行 analyze.py、verify-results.mjs、check-identity.mjs、build-reports.py，最后 seal.py；不运行 prepare/measure。封存前还须确认前述回归命令的日志来自本次源码。初次统计脚本处理无 attempt 的旧结果时出现空值错误，修复仅涉及统计工具，初始日志 analysis-initial.log 保留；没有修改测量输入或原始结果。所有脚本写自己的证据目录，原 RCA、原外部比较和固定 RC 只读。完成后 STOP。
