import json, statistics
from pathlib import Path
ROOT=Path(__file__).resolve().parent
read=lambda f:json.loads((ROOT/f).read_text(encoding='utf-8'))
rows=[json.loads(x) for x in (ROOT/'formal.jsonl').read_text(encoding='utf-8').splitlines()]
cases=read('measured-cases.json'); stats=read('case-summary.json'); agg=read('aggregate.json')
get=lambda id,alg:next(x for x in stats if x['caseId']==id and x['algorithm']==alg)
ag=lambda source,alg:next(x for x in agg if x['source']==source and x['algorithm']==alg)
fmt=lambda x:'TIMEOUT' if x is None else f'{x:.2f}'
length=lambda r:'/'.join(map(str,r['lengths'])) if r['lengths'] else '—'
def write(name, text): (ROOT/name).write_text(text,encoding='utf-8')
ordinary=[c for c in cases if c['source']=='new-common-v2']
holdouts=[c for c in cases if c['source']=='independent-prespecified']
fast=slow=longer=extra=0
for c in ordinary:
    a,b=get(c['id'],'rc'),get(c['id'],'on')
    if a['medianMs'] is not None:
        fast+=b['medianMs']<a['medianMs'];slow+=b['medianMs']>=a['medianMs']
        d=b['lengths'][0]-a['lengths'][0];longer+=d>0;extra+=max(0,d)
table='| Case | RC ms | off ms | on ms（范围） | RC→on 步数 | on 路由 | 回退/3 | on 提交峰 MiB |\n|---|---:|---:|---:|---|---|---:|---:|\n'
for c in ordinary:
    a,o,b=[get(c['id'],alg) for alg in ['rc','off','on']]
    table+=f"| {c['id']} | {fmt(a['medianMs'])} | {fmt(o['medianMs'])} | {fmt(b['medianMs'])} ({fmt(b['minMs'])}–{fmt(b['maxMs'])}) | {length(a)}→{length(b)} | {','.join(b['routes'])} | {b['fallback']} | {b['maxCommitMiB']:.1f} |\n"
frozen='| 配置 | 成功/运行 | 三次总搜索 ms | 成功单次中位 ms | 最大私有提交 MiB | 最大工作集 MiB |\n|---|---:|---:|---:|---:|---:|\n'
for alg in ['rc','off','on']:
    a=ag('frozen-159',alg)
    frozen+=f"| {alg} | {a['statuses'].get('SOLVED',0)}/{a['runs']} | {a['totalCappedMs']:.2f} | {a['solvedMedianMs']:.2f} | {a['maxCommitMiB']:.1f} | {a['maxWorkingSetMiB']:.1f} |\n"
memory='| 集合/配置 | 三次合计（超时按阈值计入）ms | 最大私有提交 MiB | 最大工作集 MiB |\n|---|---:|---:|---:|\n'
for source in ['new-common-v2','independent-prespecified']:
    for alg in ['rc','off','on']:
        a=ag(source,alg)
        memory+=f"| {source}/{alg} | {a['totalCappedMs']:.2f} | {a['maxCommitMiB']:.1f} | {a['maxWorkingSetMiB']:.1f} |\n"
write('PERFORMANCE_COMPARISON.md',f'''# 性能对照

201 例×3 配置×3 次，全部串行，共 {len(rows)} 次；每次 2 秒/768 MiB、V8 512 MiB、新进程，S2 预热三次。配置和顺序预先固定。表中 ms 均为**完整公共求解入口**实测的三次中位值，范围为 min–max，包含生产构造验收与回退。TIMEOUT 是右删失，没有用 2000 ms 冒充成功时间。进程启动/预热、总 wallMs 及工作集另见 MEASUREMENTS.csv。

## 原 18 普通例

RC/off 均 39/54 次成功（13/18 例每次成功、5/18 例每次超时）；on 为 54/54。5 个原超时全部三次通过双重回放。开关开启时这 18 例均走新构造路线，未回退。

{table}

对于原先就成功的 13 例，按三次中位值比较，{fast} 例更快、{slow} 例更慢；{longer} 例解更长，正向步数增加合计 {extra} 步（逐例差值，不乘三次）。H4 原本为初始目标存在的零步控制，仍保留在分母和表中。5 个超时案例没有可比较的 RC 返回解，不能计算它们相对 RC 的解长膨胀或精确加速倍数。

## 冻结 159

{frozen}

每种配置 159/159 例均三次成功，共 1431 条路径，逐步双重回放通过，并与既有 E-014 历史路径完全相同。全部保持 constructive-hybrid；新严格分支不适用。表中差异是同机串行实测的分布波动，不能把它解释为新路由改善了冻结构造算法。未控制后台桌面负载、CPU 亲和性或温度。

## 留出与可解释边界

24 例中 19 个可达正例每次合法成功，5 个预设负例每次 exhausted，均无非法解；详见 HOLDOUT_RESULTS.md。简单题上的额外计划成本与解长成本真实存在。默认保持关闭；结果只支持本次新普通域路由的覆盖收益，**不宣称全局性能提升、最短解或普通形状全覆盖**。

内存为进程高水位，包含导入/预热/验收工具，不能直接相减当作搜索增量。完整逐例三种配置、状态、路径哈希、路由、回退、内存和启动数据在 case-summary.json、formal.jsonl、MEASUREMENTS.csv 及 runs/formal/。总预算内的超时统计不删例，不做事后择优组合。

{memory}

上表累计值是本次固定集合在截止规则下消耗的预算统计；有超时组的真实完成时间未知，不能用累计值之比当作未删失的加速倍数。
''')
ht='| Case | 预设 | rc/off/on ms | RC→on 步数 | on 成功/3 | on 路由 | 回退/3（原因） | 提交峰 MiB |\n|---|---|---:|---|---:|---|---|---:|\n'
for c in holdouts:
    a,o,b=[get(c['id'],alg) for alg in ['rc','off','on']]
    times='/'.join(fmt(x['returnedMedianMs']) + (' exhausted' if not x['lengths'] else '') for x in [a,o,b])
    ht+=f"| {c['id']} | {c['expectation']} | {times} | {length(a)}→{length(b)} | {b['solved']} | {','.join(b['routes'])} | {b['fallback']} ({b['fallbackReasons']}) | {b['maxCommitMiB']:.1f} |\n"
holdoutLong=[c['id'] for c in holdouts if get(c['id'],'rc')['lengths'] and get(c['id'],'on')['lengths'][0]>get(c['id'],'rc')['lengths'][0]]
write('HOLDOUT_RESULTS.md',f'''# 独立留出结果

24 个输入在实现前固定，提交 db25eb4；SHA/时间见 tests/strict-routing/holdout-lock.json。由形状结构、资源与操作条件定义，不使用任何求解器挑选。之后没有增加、删除、改写案例，未把预设可达期望当作证明。全量原始输入在 holdouts.json；运行输入的独立锁在 input-lock.json。

三种配置各运行三次：19 个正例均 3/3 成功、两套回放均合法，5 个负例均 0/3 返回解、以 exhausted 正常结束。全部 24 个预设结果符合，无非法方向、库存或物理路径。负例包括缺少颜色来源、单副本无法堆叠两份、方向错误但旋转关闭、Stacker 关闭、preventWaste 禁止剩余库存。负例未用超时冒充无解。

{ht}

正例涵盖 2/3/4 层、三种旋转、同形副本及冗余副本、不同材料、纯 Cutter、无 Cutter、受限操作、多层输入、cleanPainting/maxLayers/orientation 的原入口边界。新增生产验收的故意坏路径另见 routing-tests.log，包括同一步重复 ID 和跨步重复消费。

相对 RC 产生更长解的留出案例：{', '.join(holdoutLong)}。这些是可行解优先的代价，未隐去。逐次 min/max、端到端耗时、路径哈希与全部操作在 case-summary.json 和 runs/formal/；表中 exhausted 的返回耗时仍完整保存在原始数据中。

本留出集不是随机总体样本；不可推断未测普通输入的普遍成功率或最优性。特殊材料资源、超过 64 token、分流、preventWaste、非四层上限等不满足新 gate 的输入保留旧路线。
''')
write('CORRECTNESS_VALIDATION.md',f'''# 正确性验收

完整测量 {len(rows)} 次，验证器重新读取每条原始结果，而非仅信任 worker 的 valid 字段。validation-ledger.json 保存逐次记录。共 1734 条成功路径经生产测试 oracle 与不导入生产物理操作的独立分析模型双重回放；其余为 30 次原普通例基线/off 超时及 45 次留出负例 exhausted，没有非法解、运行异常或内存失败。

冻结 159×3 配置×3 次=1431 条路径全部合法，并逐路径匹配冻结 E-014 历史结果。历史 benchmark/witness/哈希未修改。input-lock.json 为每个完整输入提供 SHA，worker 不接收 witness。

开关关闭与 RC：588 对完成结果的全部非计时字段一致（包括 573 对成功路径逐字节/哈希相同、15 对负例无路径结果相同）；15 对均为 2 秒超时，最终路径 UNKNOWN，不声称比较到未返回的路径。旧 gate、core/Explorer、缓存/Beam 源码块逐字节不变，同时提供关闭路由的结构不变证据。

测试覆盖精确目标方向、完整操作/副产物、有限库存、跨步重复消费、同一步重复消费、输出 ID 重用、操作开关、颜色参数和 cleanPainting、预算与异常回退、Worker 开关传递、资源副本及多层。核心回归 95/95 通过（regression.log）；生产浏览器静态依赖与冻结路径检查见 browser-safe-production.log，真实浏览器 Worker 生命周期见 browser-worker.log。

Physics v2 当前物理回归通过。历史身份命令为 44 项中 42 通过、2 失败：这两项均要求整个源码仍是固定 RC，按预期只报告 runtime: shapeSolver.js hash differs。保留日志，不修改断言/历史清单来伪造 RC 身份。独立 check-identity.mjs 通过：原 RC 当前身份有效，补丁身份差异恰好这一项；全部 461 冻结文件及 Physics v2 语义绑定保持一致。新增验证模块另附 SHA。该已解释的身份差异不是物理正确性回归，也不表示新发布版本已获认证。

初次身份运行另发现 clone 的换行转换差异，已仅在本 Clone 恢复 README/package-lock/USER_RULES 的原目录字节；初始失败日志仍保留，最终 Git 提交不包含这些文件。`.gitea/workflows/deploy.yml` 和原测试文件的 clone 换行差异未修改，身份检查列为仅换行差异，内容相同。

没有发现无法解释的正确性回归，因此未触发 BLOCKED。有限分析模型不是游戏认证；沿用原 Physics v2 的 gameCertification=UNKNOWN，没有提高这一级结论。
''')
write('REPORT.md',f'''# Shapez 2 Solver — Strict-Orientation Constructive Routing

日期：2026-10-30（Asia/Shanghai）。固定 RC ec9cc5cb633d021b6af276565223a392f8329b87。隔离目录 E:\\solver-strict-constructive-20261030，分支 codex/strict-orientation-constructive。

已完成默认关闭的严格方向普通目标 Constructive 路由、有限库存/Physics v2 完整回放验收及安全回退。先锁定 24 个留出案例（提交 db25eb4），再实施。仅两个生产文件有内容增改：shapeSolver.js 与新增 constructive/validate-strict-plan.js；构造算法、通用搜索/Beam、缓存和 Physics v2 不变。

三种配置 rc/off/on，201 例，各三次，原 2 秒/768 MiB 限制串行执行，共 1809 次。原 18 例成功率从 RC/off 的 13/18 提升为 on 的 18/18，每次重复一致；原五个超时均三次合法完成。冻结 159 每种配置均 159/159，全部 1431 条返回路径与历史路径完全相同。24 个留出中 19 个正例全部合法成功、5 个负例全部 exhausted。总计 1734 条返回路径双重回放通过，无正确性退化。

改善有代价：原可解 13 例中按中位耗时 {fast} 例更快、{slow} 例更慢，{longer} 例路径变长；初始目标控制和部分简单留出有额外构造开销。默认开关保持关闭。没有据此宣称全局性能提升、普通域全覆盖或最短解。

50 ms 为构造与生产验收共享的协作式预算，另有限定输入域及工作量上限；不声称能强制抢占 JavaScript 同步构造阶段。超支候选被拒绝，已花时间计入总求解并从 core 上限扣除。测量使用原外部 2 秒进程硬截止，结果不是构造器内部计时。

开关关闭时 588 对完成结果非计时字段一致，含 573 对成功路径精确一致；15 对超时的最终路径未知。旧入口/core/cache/Beam 源码不变。Physics v2 与 461 冻结文件身份一致；旧 RC 全源码身份因授权修改 shapeSolver.js 按预期失配，不改历史哈希，详见身份日志及 CORRECTNESS_VALIDATION.md。

交付：ROUTING_PATCH.md（设计/开关/变更）、CORRECTNESS_VALIDATION.md、PERFORMANCE_COMPARISON.md、HOLDOUT_RESULTS.md；REPRODUCE.md 给出完整方法。MEASUREMENTS.csv、formal.jsonl、runs/formal/ 保留每次原始数据、完整路径、路由、回退、内存。源码 SHA 见 identity-validation.json，证据哈希见 EVIDENCE_MANIFEST.sha256。

未修改 E:\\solver 或其他 Agent 工作目录；未 push、deploy、修改 GitHub Pages/Gitea/ECS 或任何生产环境。未启动缓存优化或下一阶段重构。完成后 STOP。
''')
print('Reports written')
