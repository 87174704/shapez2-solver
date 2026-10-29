# Phase F1 — 双 CDN 静态构建报告

日期：2026-10-30（Asia/Shanghai）。结论：双 Profile 构建、内容一致性、本机真实浏览器与原有正确性验收已完成。中国大陆独立网络可达性仍为 UNKNOWN；不将它写成国内全网可用或无条件部署通过。

## 身份与隔离

- VERIFIED：基础 RC Commit ec9cc5cb633d021b6af276565223a392f8329b87，Tree 4e49a58cd2d89923ebea189ffbfc9ab9b1049d87；未因远端变化升级。只读 ls-remote 也返回该分支 SHA，证据在 .f1/evidence/remote-ref.txt。
- VERIFIED：F1 在 E:\solver-phase-f1-20261030、分支 codex/phase-f1-dual-cdn 中开发。两个产物的 Source Commit 都是 6faee896e51979359284736f78ab820d7ab4d110，Tree 都是 0b38e4b110ec605fdc11f103ebd2d103513d1646；构建工具及锁文件的哈希同时写入各 build-manifest.json。
- VERIFIED：原有仓库文件无内容差异，新增内容仅为 tools/static-build、third-party 和这七份交付文档；根 package.json、锁文件、算法、Physics v2、HTML/CSS 源模板、冻结数据和 CI 均未编辑。Git checkout 的历史换行表示仅按已有哈希恢复；详见 .f1/evidence/input-representation.json。保留原有 cn/en 文件以满足原 RC 身份，构建只消费一个 index.html 模板。
- VERIFIED（操作记录）：原工作区只在开始读取身份、目录并执行一次 git status；未向原工作区执行文件编辑、checkout、分支或配置写操作。原索引未做事前字节快照，无法单独证明那次 status 未触发 Git 内部索引刷新；之后不再操作原工作区。未访问性能比较 Agent 的目录和结果。
- VERIFIED：用户确认性能比较 Agent 已结束后才启动浏览器和完整正确性测试。F1 的依赖、缓存、临时目录、浏览器配置和输出均在独立 Clone 内；不终止、不暂停其他任务。
- VERIFIED：未 push、部署、修改 ECS/Gitea、启用 Pages、创建 Release 或新增 Actions；本 Clone 的 origin push URL 被设为 DISABLED-F1-NO-PUSH。

## 验收结果

| 项目 | 证据标记 | 结果 |
| --- | --- | --- |
| 双 Profile 构建及同配置重复构建 | VERIFIED | global 89 文件；china 144 文件；两次相同配置字节一致 |
| 自有算法、Physics v2 与 Worker 一致性 | VERIFIED | 27 个自有 JS 文件两份产物完全相同，源身份验证 valid=true |
| 冻结 Benchmark 哈希 | VERIFIED | 461/461 匹配；原始哈希及 witness 未改 |
| 当前回归 | VERIFIED | 229/229 PASS；总注册242，13项原有 HISTORICAL_V1_ONLY 另行运行 |
| 独立 v1 历史回归 | VERIFIED | 198/198 PASS，0 skip |
| 159 个现行 Solver Benchmark | VERIFIED | 159/159 solved、replayValid、exactE014Paths，未更改用例 |
| Physics v2 / 冻结 witness | VERIFIED | 331/331 witness 验证；159路径与冻结路径一致 |
| 真实浏览器功能 | VERIFIED | global /shapez2-solver/ 与 china /；原生 CDN 请求、2D/3D、字体、Worker、刷新均通过 |
| 第三方 JS 内容与本机请求 | VERIFIED | 5项×2来源：HTTP200、SHA-256一致、SRI/CORS验证；原版本未升级 |
| 中国大陆独立网络可达性 | UNKNOWN | 没有经确认的大陆电信/联通/移动采样点；本机浏览器通过不等于大陆全网验收 |
| 进入 F2 部署的技术条件 | INFERRED / 有条件 | 本地构建、功能与正确性条件已满足；国内真实网络可达性需补证，部署仍须下一阶段独立授权 |

## 资源选择与产物差异

Global 保留 unpkg.com、cdn.jsdelivr.net、fonts.googleapis.com / fonts.gstatic.com。China 五项 JS 使用 jsdelivr.topthink.com；字体使用同源 Barlow v13 WOFF2 快照与完整 OFL。JSDMirror 两个域名对探测资源返回521，未采用；BootCDN的三个测试路径404，未假定它们存在。所有 CDN 选择与不确定性见 CDN_VERIFICATION.md。

两份产物仅60个路径有差异：3份生成 HTML 的 CDN/CSP/base，1份 CSS 的字体 import，55份仅国内需要的字体文件/CSS，以及 build-manifest.json 的 Profile 元数据。自有 JavaScript、图片、许可证与说明相同。逐文件 SHA-256 与理由见 ARTIFACT_MANIFEST.md。

脚本有 SHA-384 SRI、crossorigin=anonymous，保持同步顺序。CSP 不允许通配域名、unsafe-inline 脚本、unsafe-eval 或 blob Worker。Barlow 使用 swap / 系统 sans 回退，实际阻断字体的独立页面仍可求解。继承的 three.js 弃用、重复 Three.js、Cytoscape 样式/滚轮提示是 warning，未升级依赖规避它们。

## 复现与其余交付

稳定调用方式：npm --prefix tools/static-build run build:global / build:china。构建阶段不联网；首次安装与固定字节准备见 BUILD_PROFILES.md。其余文件：DEPENDENCY_MATRIX.md、CDN_VERIFICATION.md、BROWSER_VALIDATION.md、ARTIFACT_MANIFEST.md、NEXT_DEPLOY_PLAN.md。

STOP：未执行任何部署、push、i18n 改造或算法优化。
