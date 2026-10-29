# 性能对照

201 例×3 配置×3 次，全部串行，共 1809 次；每次 2 秒/768 MiB、V8 512 MiB、新进程，S2 预热三次。配置和顺序预先固定。表中 ms 均为**完整公共求解入口**实测的三次中位值，范围为 min–max，包含生产构造验收与回退。TIMEOUT 是右删失，没有用 2000 ms 冒充成功时间。进程启动/预热、总 wallMs 及工作集另见 MEASUREMENTS.csv。

## 原 18 普通例

RC/off 均 39/54 次成功（13/18 例每次成功、5/18 例每次超时）；on 为 54/54。5 个原超时全部三次通过双重回放。开关开启时这 18 例均走新构造路线，未回退。

| Case | RC ms | off ms | on ms（范围） | RC→on 步数 | on 路由 | 回退/3 | on 提交峰 MiB |
|---|---:|---:|---:|---|---|---:|---:|
| S1 | 0.51 | 0.49 | 8.39 (7.86–8.76) | 3→4 | strict-ordinary-constructive | 0 | 26.6 |
| S2 | 3.93 | 4.52 | 1.45 (1.38–1.77) | 3→13 | strict-ordinary-constructive | 0 | 26.8 |
| S3 | 0.79 | 0.79 | 3.53 (2.86–4.15) | 3→10 | strict-ordinary-constructive | 0 | 27.9 |
| S4 | 0.60 | 0.78 | 11.40 (11.29–12.72) | 1→16 | strict-ordinary-constructive | 0 | 28.2 |
| M1 | 27.83 | 30.87 | 3.07 (2.09–4.00) | 5→17 | strict-ordinary-constructive | 0 | 26.9 |
| M2 | 366.55 | 336.33 | 4.06 (4.00–5.67) | 6→26 | strict-ordinary-constructive | 0 | 26.9 |
| M3 | 523.74 | 552.37 | 15.02 (14.06–15.16) | 7→24 | strict-ordinary-constructive | 0 | 27.6 |
| M4 | 248.35 | 224.83 | 12.57 (12.48–12.80) | 5→20 | strict-ordinary-constructive | 0 | 26.8 |
| H1 | TIMEOUT | TIMEOUT | 13.67 (13.30–15.08) | —→18 | strict-ordinary-constructive | 0 | 27.5 |
| H2 | 1143.89 | 1159.62 | 13.74 (13.23–14.93) | 8→17 | strict-ordinary-constructive | 0 | 28.2 |
| H3 | TIMEOUT | TIMEOUT | 7.33 (6.84–8.39) | —→35 | strict-ordinary-constructive | 0 | 27.5 |
| H4 | 0.16 | 0.18 | 24.01 (20.81–30.59) | 0→18 | strict-ordinary-constructive | 0 | 26.5 |
| M1-extra1 | 107.65 | 101.04 | 4.05 (2.74–5.51) | 5→22 | strict-ordinary-constructive | 0 | 27.7 |
| M1-extra3 | 204.90 | 192.17 | 3.95 (2.70–5.55) | 5→32 | strict-ordinary-constructive | 0 | 28.9 |
| M2-extra1 | 784.65 | 800.12 | 7.45 (5.41–8.30) | 8→31 | strict-ordinary-constructive | 0 | 27.0 |
| M2-extra3 | TIMEOUT | TIMEOUT | 7.39 (6.14–11.12) | —→41 | strict-ordinary-constructive | 0 | 27.3 |
| H1-extra1 | TIMEOUT | TIMEOUT | 14.09 (12.85–17.06) | —→18 | strict-ordinary-constructive | 0 | 26.5 |
| H1-extra3 | TIMEOUT | TIMEOUT | 14.73 (13.63–17.05) | —→18 | strict-ordinary-constructive | 0 | 27.7 |


对于原先就成功的 13 例，按三次中位值比较，9 例更快、4 例更慢；13 例解更长，正向步数增加合计 191 步（逐例差值，不乘三次）。H4 原本为初始目标存在的零步控制，仍保留在分母和表中。5 个超时案例没有可比较的 RC 返回解，不能计算它们相对 RC 的解长膨胀或精确加速倍数。

## 冻结 159

| 配置 | 成功/运行 | 三次总搜索 ms | 成功单次中位 ms | 最大私有提交 MiB | 最大工作集 MiB |
|---|---:|---:|---:|---:|---:|
| rc | 477/477 | 17696.56 | 35.99 | 34.6 | 71.1 |
| off | 477/477 | 17991.24 | 37.42 | 34.8 | 71.0 |
| on | 477/477 | 16581.01 | 34.34 | 36.3 | 71.6 |


每种配置 159/159 例均三次成功，共 1431 条路径，逐步双重回放通过，并与既有 E-014 历史路径完全相同。全部保持 constructive-hybrid；新严格分支不适用。表中差异是同机串行实测的分布波动，不能把它解释为新路由改善了冻结构造算法。未控制后台桌面负载、CPU 亲和性或温度。

## 留出与可解释边界

24 例中 19 个可达正例每次合法成功，5 个预设负例每次 exhausted，均无非法解；详见 HOLDOUT_RESULTS.md。简单题上的额外计划成本与解长成本真实存在。默认保持关闭；结果只支持本次新普通域路由的覆盖收益，**不宣称全局性能提升、最短解或普通形状全覆盖**。

内存为进程高水位，包含导入/预热/验收工具，不能直接相减当作搜索增量。完整逐例三种配置、状态、路径哈希、路由、回退、内存和启动数据在 case-summary.json、formal.jsonl、MEASUREMENTS.csv 及 runs/formal/。总预算内的超时统计不删例，不做事后择优组合。

| 集合/配置 | 三次合计（超时按阈值计入）ms | 最大私有提交 MiB | 最大工作集 MiB |
|---|---:|---:|---:|
| new-common-v2/rc | 40268.40 | 275.7 | 305.6 |
| new-common-v2/off | 40209.08 | 274.7 | 304.6 |
| new-common-v2/on | 522.21 | 28.9 | 64.9 |
| independent-prespecified/rc | 7427.25 | 214.9 | 246.8 |
| independent-prespecified/off | 7724.91 | 214.5 | 246.3 |
| independent-prespecified/on | 484.03 | 28.2 | 64.7 |


上表累计值是本次固定集合在截止规则下消耗的预算统计；有超时组的真实完成时间未知，不能用累计值之比当作未删失的加速倍数。
