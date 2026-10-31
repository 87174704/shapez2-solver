# Shapez 2 Solver：统一多语言扩展验收报告

日期：2026-10-31（Asia/Shanghai）。范围：独立 Clone、本地分支 `codex/unified-i18n-20261031`；不推送、不部署、不发布。

最终验收状态：**PASS**。执行验收的源码提交：`6179850d95a45074730f9f64f34e04d2b867332e`。本报告及证据另作本地文档提交，位于既有 `docs/release1/**` 身份排除目录，不改变应用、语言资源或构建逻辑。

## 源码身份与国内外一致性

开始时核实 GitHub `87174704/shapez2-solver` 的 HEAD 和维护分支 `codex/maintained` 均为 `465e66a00613a301fd3fb106af1fce927d6efc61`，即指定 Release 1 RC。独立 Clone 位于 `E:\shapez2-i18n-20261031`，未在原 `E:\solver` 工作目录修改源码。

Gitea `https://git.ysc.icu/ysc/solver.git` 的 HEAD/main 为 `0647b8502f75145936faf8fbcde7cf2ab5371f75`，当时落后 GitHub 维护分支 11 个提交。该提交是维护分支祖先，**没有历史分叉**。因本轮禁止 push，实际远端仍保留各自原 HEAD；这里不声称两个远端已同步。交付前的只读复核见 [remote-heads.json](evidence/remote-heads.json)。

为验证可共享同一 Git 身份，创建了 GitHub 源码的本地裸仓库副本，以及从实际 Gitea 只读 Clone 的本地裸仓库副本。向后者导入完全相同的本地提交，确认可从其原 main 快进，两份本地副本的 Commit SHA 与 Tree SHA 完全相同。未写入任何远端引用。完整记录见 [source-and-profile-proof.json](evidence/source-and-profile-proof.json)。

- 两个 Profile 共享源码 SHA-256：`68252508acf924fab921634c9ac266f23f3d3ccfaed1935568f9ea0c62fdebfb`。
- 两个 Profile 共享 Physics v2 语义 SHA-256：`28aac91525a7f15a1ab081ed73f425f39f4f2e68d30599fbf8b46e1a9bf09a97`。
- 41 个应用脚本逐字节相同；其中 14 个国际化模块（旧中英包、统一注册表及新增语言模块）全部相同。
- 所有语言都来自同一源码树，无地区语言列表、默认值、翻译策略、条件排除或站点专用翻译分支。
- 对 RC 的 55 个受保护运行文件逐一校验字节哈希，全部一致，包括 Solver、Physics、O1/Constructive、Beam/缓存相关实现、Worker、操作和验证模块。详见 [protected-source.json](evidence/protected-source.json)。冻结 Benchmark 无 Git 内容差异。

## 实现与兼容性

保留原中英文 163 个 Key 的译文及函数，包括英文原有单复数处理；测试从指定 RC 直接载入旧 `i18n.js`，逐条对比 0/1/2/17 等参数组合，输出完全一致。新增的 7 个 Key 用于搜索预算提示、beam 提示复用和图形无障碍名称。旧中英文资源仍在 `i18n.js`，11 个新语言包在 `locales/`，统一配置在 `localeConfig.js`。

默认选择在所有入口、两个 Profile 均遵循：有效已保存选择 → 浏览器语言列表中首个支持项 → 英语。旧存储键不变，旧值 `cn` 自动映射并保存为 `zh-CN`。支持大小写及下划线、区域和 Unicode 扩展标签；中文 Hans/Hant 脚本优先，HK/MO/TW 映射繁体；西语区域统一映射 `es-ES`，葡语区域统一映射 `pt-BR`，其他支持语言忽略区域。存储被拒绝时仍可自动选择、手动切换。

语言路径是当前选择的可刷新地址，不覆盖上述默认选择优先级；这是按本轮规则对旧“路径优先”行为作的统一调整。旧 `/cn/`、`/en/` 入口继续可访问。切换通过已有 history/文案刷新流程完成，保留查询串、hash 和部署前缀，不重载页面。

菜单始终以 13 种语言的原生名称显示。静态文案、状态、验证错误、预算错误、操作全称/短名、颜色、提取对话框、2D/3D 文案、标题及无障碍名称均使用同一 Key 系统。原先硬编码的中英文预算错误已迁入语言包。补齐折叠按钮、输入框、混色输入、切换控件、提取选项、操作按钮和图区域的无障碍名称；操作按钮可使用键盘。

切换语言只更新图上的显示标签，保持 2D 实例、节点/边、缩放、平移以及 3D canvas/场景和已选节点。保留编辑草稿、输入输出资源、设置、混色库存、方案选择和求解结果；不发送新任务，不取消现有 Worker，不重新运行 Solver。Shape Code、操作 ID、颜色 token、Worker 协议、JSON 字段和导出数据结构未修改。

## 翻译覆盖与审校状态

每种语言 **170 个 Key**，总计 **2,210 项**；缺失 0、额外 Key 0、占位符差异 0。所有消息均完成实际插值渲染检查。统计来自实际加载的资源，见 [COVERAGE.json](COVERAGE.json)。

| 语言 | 代码 | Key | 缺失/参数差异 |
|---|---|---:|---:|
| 简体中文 | zh-CN | 170 | 0 / 0 |
| 繁體中文 | zh-TW | 170 | 0 / 0 |
| English | en | 170 | 0 / 0 |
| 日本語 | ja | 170 | 0 / 0 |
| 한국어 | ko | 170 | 0 / 0 |
| Français | fr | 170 | 0 / 0 |
| Deutsch | de | 170 | 0 / 0 |
| Español | es-ES | 170 | 0 / 0 |
| Português (Brasil) | pt-BR | 170 | 0 / 0 |
| Русский | ru | 170 | 0 / 0 |
| Polski | pl | 170 | 0 / 0 |
| Türkçe | tr | 170 | 0 / 0 |
| ไทย | th | 170 | 0 / 0 |

**新增译文为 AI 辅助初译，未经过母语或专业语言审校。** 原中英文 326 项保持原文；11 个新包的 1,870 项以及旧语言新增的 14 项适用此审校说明。功能验收不代表专业翻译审校。

完整术语表从实际资源生成：[GLOSSARY.csv](GLOSSARY.csv)。来源、术语约定与不确定性见 [TERMINOLOGY.md](../../i18n/TERMINOLOGY.md)。英文语义核对了 Shapez 2 官方 Wiki 的 Pin Pusher、Crystal Generator 和 Shapes；未取得各语言可靠官方字符串表，因此新译名标为本项目一致译法，未冒称游戏官方名称。

已明确的边界：产品名、RGB/RYB/CMYK、Shape Code、操作 ID、颜色 token、数值和外部诊断数据保持原值。错误说明与验证错误已翻译；意外异常的 `message` 参数保留原诊断文本，不能任意改写其含义。没有未披露的缺 Key 或静默以英语填充的新语言条目，也没有运行时在线翻译服务。英语 fallback 和未知 Key 行为另有测试。

## 双 Profile 构建与真实浏览器

| Profile | 默认部署路径 | HTML 入口 | 应用 JS | 重复构建 |
|---|---|---:|---:|---|
| Global | `/shapez2-solver/` | 15 | 41 | 字节一致 |
| China | `/` | 15 | 41 | 字节一致 |

15 个入口包括根入口、13 个规范语言目录和旧 `cn` 目录。所有语言入口及其 `index.html` 均以 HTTP 实测；Global 子路径外的根资源按预期返回 404，不依赖 SPA fallback。两个 Profile 的语言菜单、默认逻辑、全部资源和行为完全相同。

[static-validation.json](evidence/static-validation.json) 对全部文件进行语法、引用、哈希、HTTP、重复构建及跨 Profile 比较。72 个产物差异全部可解释为 15 份 HTML 的既有 CDN/CSP/base 配置、字体 @import、55 个 China 本地字体文件以及构建清单；去除这些配置字段后的 HTML 结构和 CSS 内容一致。没有其他源码或语言资源差异。

真实浏览器：Chrome/Chromium `156.0.8078.74`，Windows，1440×1000 和 390×844。专项 [browser.json](evidence/browser.json) 覆盖两个 Profile，每种语言均执行：

- 真实菜单切换、`html.lang`、已存偏好、状态和校验错误对话框；确认 Shape Code 原值保留。
- 对照切换前后的输入草稿、资源库存、配置、完整 Worker 消息、输出路径、2D 实例/拓扑/缩放/平移，均不变。
- 正在运行时切换：同一原生 Worker 继续完成，切换前后创建、发送、终止记录不变。
- 每个 Profile 在 13 个语言状态下各运行同一实际 Solver Worker 输入：26 份路径逐条相同，均经独立库存/物理回放。
- 13 种语言下均保留真实 3D WebGL canvas 和 Explorer 结果；混色方案及库存也保持不变。
- 刷新持久化、旧 cn 偏好、区域映射、不支持语言的英语 fallback、存储拒绝。
- 长法语/德语文案、简繁中文、日文、韩文和泰文的窄屏可达性；使用浏览器平台字体记录确认有实际字形，并人工查看截图。修复德语混色列标题挤压，统一设置系统字体 fallback 和文字换行。

F1 冒烟详见 [f1-browser-validation.json](evidence/f1-browser-validation.json)：实际五个 CDN 响应的字节/SRI、CSP、原生 Solver/Mixing/Explorer Worker、2D/ELK、3D/WebGL、18 组 Barlow 字重/字形和字体故障回退。初始验证使用真实网络，无资源替换；仅专门的字体故障测试主动阻断字体。无未授权域、CSP 违例、本地 404 或未解决请求失败。

旧浏览器测试中的固定语言假设已改为显式测试偏好；调色测试等待实际方案与图片响应完成后再刷新，避免把测试自身取消图片请求误判为站点故障。默认严格路由断言确认实际发起 strict 尝试；若冷浏览器用尽既有 50ms 合作预算，只接受标明 budget 的安全回退，且路径仍须双重回放。未改动预算、路由、构造算法、通用搜索或缓存。浏览器 Worker 生命周期套件另外验证取消、重启、错误清理、连续求解和 Explorer 结果恢复。

## Solver、历史与冻结验收

最终串行验收记录：[final-phases.json](evidence/final-phases.json)。

| 项目 | 结果 | 证据 |
|---|---|---|
| 当前完整测试 | 262 项：249 通过、0 失败、13 个既有历史 v1 项跳过 | [regressions-v2.log](evidence/regressions-v2.log) |
| 历史 v1 独立环境 | 198/198 通过，0 跳过；历史字节与身份验证通过 | [historical-v1.log](evidence/historical-v1.log) |
| 冻结结果完整性 | 159 条记录、配置、聚合和复合发布绑定一致 | [frozen-evidence-v1.log](evidence/frozen-evidence-v1.log) |
| 159 冻结生产案例 | 159/159 成功、独立回放合法、路径与 E-014 历史完全一致、重复资源消耗 0 | [current-solver-159.log](evidence/current-solver-159.log) |
| Physics v2 与历史路径 | 159 条实际/冻结路径、331 个 witness、67,855 次物理输出检查通过，差异 0 | [physics-acceptance.json](evidence/physics-acceptance.json) |
| 冻结文件身份 | 461 个冻结文件逐一 SHA 验证通过 | [correctness-validation.json](evidence/correctness-validation.json) |
| O1 普通与留出 | 普通 18 + 留出 24；37 个可解案例双重回放通过，5 个负例 exhausted | [ordinary.json](evidence/ordinary.json) |
| 浏览器 Worker 生命周期 | 原有完整生命周期套件通过 | [worker-lifecycle.log](evidence/worker-lifecycle.log) |

当前测试中的 13 个跳过项均明确标记 HISTORICAL V1 ONLY，并在独立历史环境验证，未作为 v2 通过数计算。331 个 witness 均为唯一实例，冻结数据与 holdout 锁文件未修改。完整路径、输入、回放结果和哈希保留于证据文件；此轮不作性能提升或全域完备性宣称。

Release 1 的新运行/源码身份清单因新增 UI/语言文件按既有封存工具更新；旧 Physics v2 语义信任根、v1 清单和冻结库存均未改动。Windows 历史换行按已有精确恢复规则认证；当前测试源文件保留其 Git 原始内容及换行，不留未提交源码差异。

## 复现与交付状态

在本地交付分支的干净独立 Clone 中安装既有依赖后执行（Node 24）：

```powershell
npm ci --ignore-scripts
npm ci --ignore-scripts --prefix tools/static-build
node tools/static-build/prepare.mjs
node tools/i18n/audit.mjs
node tools/static-build/verify.mjs
node tools/static-build/i18n-browser.mjs
node tests/browser/workerLifecycle.browser.mjs
$env:F1_EXCLUSIVE_WINDOW='1'
node tools/static-build/browser.mjs
node tools/static-build/acceptance.mjs
node tools/i18n/ordinary.mjs
```

`F1_EXCLUSIVE_WINDOW=1` 表示独占运行这些测试，避免与其他基准测量重叠。`verify.mjs` 分别重复构建两个 Profile，检查可重现性及允许的差异；浏览器工具使用已安装的 Chrome/Edge，不自动下载浏览器。原始 `.f1` 输出保留在本地，验收所需输出另复制到本报告的 evidence 目录。

证据完整性清单：[EVIDENCE_MANIFEST.sha256](EVIDENCE_MANIFEST.sha256)。本地构建产物为 `dist/global/`、`dist/china/`，其构建清单记录同一验收源码提交、源码身份与语言列表。后续仅增加报告文件的提交不会改变已验收的应用字节；完整最终交付 SHA 以本地分支 HEAD 为准。

**STOP：已完成本地修改、验证和提交。未 push GitHub/Gitea，未修改生产部署、CDN 配置、站点或发布流程，未自动发布。** 母语审校状态及诊断数据边界如上明确披露。
