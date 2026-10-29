import fs from 'node:fs/promises';
import path from 'node:path';
import { ROOT, readJson, sha, filesUnder } from './shared.mjs';
import { RC_COMMIT, RC_TREE } from './profiles.mjs';
const lock=await readJson('tools/static-build/resources.lock.json'),staticResult=await readJson('.f1/evidence/static-validation.json'),cdn=await readJson('.f1/evidence/cdn-validation.json'),probe=await readJson('.f1/evidence/cdn-probe.json'),browser=await readJson('.f1/evidence/browser-validation.json'),correctness=await readJson('.f1/evidence/correctness-validation.json');
const global=await readJson('dist/global/build-manifest.json'),china=await readJson('dist/china/build-manifest.json');
const write=async(name,text)=>fs.writeFile(path.join(ROOT,name),text.trim()+'\n');
const table=(heads,rows)=>[heads,heads.map(()=> '---'),...rows].map(r=>'| '+r.map(c=>String(c??'—').replaceAll('|','\\|').replaceAll('\n',' ')).join(' | ')+' |').join('\n');
const digest=async p=>sha(await fs.readFile(path.join(ROOT,p)));
const phase=name=>correctness.phases.find(p=>p.name===name);
const summary=await readJson('.f1/acceptance/acceptance.json').catch(()=>null);
const browserRows=browser.profiles.flatMap(p=>(p.checks??[]).map(c=>[p.profile,c.name,c.status,c.error??'实际执行通过']));
await write('REPORT.md', `# Phase F1 — 双 CDN 静态构建报告

日期：2026-10-30（Asia/Shanghai）。结论：双 Profile 构建、内容一致性、本机真实浏览器与原有正确性验收已完成。中国大陆独立网络可达性仍为 UNKNOWN；不将它写成国内全网可用或无条件部署通过。

## 身份与隔离

- VERIFIED：基础 RC Commit ${RC_COMMIT}，Tree ${RC_TREE}；未因远端变化升级。只读 ls-remote 也返回该分支 SHA，证据在 .f1/evidence/remote-ref.txt。
- VERIFIED：F1 在 E:\\solver-phase-f1-20261030、分支 codex/phase-f1-dual-cdn 中开发。两个产物的 Source Commit 都是 ${global.sourceCommit}，Tree 都是 ${global.sourceTree}；构建工具及锁文件的哈希同时写入各 build-manifest.json。
- VERIFIED：原有仓库文件无内容差异，新增内容仅为 tools/static-build、third-party 和这七份交付文档；根 package.json、锁文件、算法、Physics v2、HTML/CSS 源模板、冻结数据和 CI 均未编辑。Git checkout 的历史换行表示仅按已有哈希恢复；详见 .f1/evidence/input-representation.json。保留原有 cn/en 文件以满足原 RC 身份，构建只消费一个 index.html 模板。
- VERIFIED（操作记录）：原工作区只在开始读取身份、目录并执行一次 git status；未向原工作区执行文件编辑、checkout、分支或配置写操作。原索引未做事前字节快照，无法单独证明那次 status 未触发 Git 内部索引刷新；之后不再操作原工作区。未访问性能比较 Agent 的目录和结果。
- VERIFIED：用户确认性能比较 Agent 已结束后才启动浏览器和完整正确性测试。F1 的依赖、缓存、临时目录、浏览器配置和输出均在独立 Clone 内；不终止、不暂停其他任务。
- VERIFIED：未 push、部署、修改 ECS/Gitea、启用 Pages、创建 Release 或新增 Actions；本 Clone 的 origin push URL 被设为 DISABLED-F1-NO-PUSH。

## 验收结果

${table(['项目','证据标记','结果'],[
['双 Profile 构建及同配置重复构建',staticResult.status,`global ${staticResult.profiles.global.fileCount} 文件；china ${staticResult.profiles.china.fileCount} 文件；两次相同配置字节一致`],
['自有算法、Physics v2 与 Worker 一致性','VERIFIED',`${staticResult.sharedApplicationFiles} 个自有 JS 文件两份产物完全相同，源身份验证 valid=true`],
['冻结 Benchmark 哈希','VERIFIED',`${staticResult.identity.frozenFilesChecked}/461 匹配；原始哈希及 witness 未改`],
['当前回归',phase('regressions-v2')?.status,`${phase('regressions-v2')?.counts.pass}/229 PASS；总注册242，13项原有 HISTORICAL_V1_ONLY 另行运行`],
['独立 v1 历史回归',phase('historical-v1')?.status,`${phase('historical-v1')?.counts.pass}/198 PASS，0 skip`],
['159 个现行 Solver Benchmark',phase('current-solver-159')?.status,'159/159 solved、replayValid、exactE014Paths，未更改用例'],
['Physics v2 / 冻结 witness',phase('physics-v2-witnesses')?.status,`${summary?.summary?.allFrozenWitnessInstances}/331 witness 验证；159路径与冻结路径一致`],
['真实浏览器功能',browser.status,'global /shapez2-solver/ 与 china /；原生 CDN 请求、2D/3D、字体、Worker、刷新均通过'],
['第三方 JS 内容与本机请求','VERIFIED','5项×2来源：HTTP200、SHA-256一致、SRI/CORS验证；原版本未升级'],
['中国大陆独立网络可达性','UNKNOWN','没有经确认的大陆电信/联通/移动采样点；本机浏览器通过不等于大陆全网验收'],
['进入 F2 部署的技术条件','INFERRED / 有条件','本地构建、功能与正确性条件已满足；国内真实网络可达性需补证，部署仍须下一阶段独立授权']])}

## 资源选择与产物差异

Global 保留 unpkg.com、cdn.jsdelivr.net、fonts.googleapis.com / fonts.gstatic.com。China 五项 JS 使用 jsdelivr.topthink.com；字体使用同源 Barlow v13 WOFF2 快照与完整 OFL。JSDMirror 两个域名对探测资源返回521，未采用；BootCDN的三个测试路径404，未假定它们存在。所有 CDN 选择与不确定性见 CDN_VERIFICATION.md。

两份产物仅60个路径有差异：3份生成 HTML 的 CDN/CSP/base，1份 CSS 的字体 import，55份仅国内需要的字体文件/CSS，以及 build-manifest.json 的 Profile 元数据。自有 JavaScript、图片、许可证与说明相同。逐文件 SHA-256 与理由见 ARTIFACT_MANIFEST.md。

脚本有 SHA-384 SRI、crossorigin=anonymous，保持同步顺序。CSP 不允许通配域名、unsafe-inline 脚本、unsafe-eval 或 blob Worker。Barlow 使用 swap / 系统 sans 回退，实际阻断字体的独立页面仍可求解。继承的 three.js 弃用、重复 Three.js、Cytoscape 样式/滚轮提示是 warning，未升级依赖规避它们。

## 复现与其余交付

稳定调用方式：npm --prefix tools/static-build run build:global / build:china。构建阶段不联网；首次安装与固定字节准备见 BUILD_PROFILES.md。其余文件：DEPENDENCY_MATRIX.md、CDN_VERIFICATION.md、BROWSER_VALIDATION.md、ARTIFACT_MANIFEST.md、NEXT_DEPLOY_PLAN.md。

STOP：未执行任何部署、push、i18n 改造或算法优化。
`);
await write('DEPENDENCY_MATRIX.md', `# 资源加载审计

VERIFIED：直接读取 RC 的 index.html、cn/index.html、en/index.html、styles.css、main.js、operationGraph.js、自有 ES Module 依赖图、Worker 入口，以及实际下载的 CDN 响应；并以真实 Chromium 网络日志交叉检查。没有依赖 README 推断运行资源。

${table(['顺序 / 依赖','版本','RC / global URL','china URL','使用形式','许可证'],lock.dependencies.map((d,i)=>[i+1+' / '+d.name,d.version,d.global,d.china,['classic UMD → window.cytoscape','classic UMD → window.ELK；内含 bundled fake worker','classic UMD → window.cytoscapeElk；读取已有 ELK 并注册到 cytoscape','classic UMD → window.THREE','classic UMD → window.ForceGraph3D；自身 bundle 也含 Three.js'][i],d.license]))}

五个经典脚本均在 main.js 的 type=module 之前同步加载，无 async/defer。cytoscape-elk 必须在 Cytoscape 与 ELK 之后；3D 渲染使用 ForceGraph3D 与 global THREE。各 UMD 文件含 CommonJS/AMD 分支，但普通页面不提供 module/exports/require，因此实际走浏览器全局分支；没有在浏览器新增 CommonJS 解析器或改为 ESM CDN 入口。

Barlow：原 CSS @import 来自 ${lock.font.globalCss}。Google Fonts 原接口未固定版本，实测 Chrome UA 对应 s/barlow/v13；54个 WOFF2文件、normal/italic 的100–900九种字重及 latin/latin-ext/vietnamese 三个子集。China 原样托管这些字体二进制，CSS仅将URL改成本地；分发版本与每文件哈希固定在 resources.lock.json。OFL-1.1 的SHA-256为 ${lock.font.licenseSha256}，与RC已有授权文本一致；字体源快照 ${lock.font.licenseCommit}。Global保留原有可随UA/时间变化的 Google CSS，因而不声称其返回字体在未来永远等于快照。

main.js → 同源 ES Module → new Worker(new URL('./shapeSolver.js', import.meta.url), {type:'module'})；Mixing 使用同样形式的 mixingSolver.js。业务模块的静态 import 全为本站相对路径，无运行期外站动态 import / importScripts。27个自有JS文件与RC绑定且两个产物字节相同。

ELK路径：operationGraph 的调色图 buildBaseLayout(name=elk) → cytoscape-elk 的 new ELK() → elk.bundled 的本地内置 fake Worker。应用不传 workerUrl，不额外下载 elk-worker 跨域主脚本；真实 ELK 布局已在浏览器运行。Solver的普通2D解图使用 preset 布局。

3D路径：renderSpaceGraph → ForceGraph3D → 默认 forceEngine=d3。bundle 包含 ngraph 的 new Function 代码，但应用没有选择 ngraph 分支；CSP不允许 unsafe-eval，实际3D运行成功。TextureLoader 读取本站操作图标及 shapeRendering canvas.toDataURL() 生成的 data:image。图像全部同源或 data:。导出 toBlob 用于剪贴板，不创建 blob Worker URL。

原RC无 CSP、SRI 或 crossorigin；F1仅在生成HTML中新增。各生成HTML配置同源 base，Global /shapez2-solver/，China /，可显式覆盖。保留原 locale redirect、查询串、hash、i18n逻辑与用户操作。原有 cn/en 源快照不作为额外维护模板。

VERIFIED：浏览器原生请求仅出现当前 Profile 的脚本域、Global Google Fonts域及本站资源，无额外业务网络来源。CDN bundle 中文档链接、SVG命名空间、shader说明不是网络请求。cytoscape-elk 的 sourceMappingURL=/sm/... 是DevTools可选 sourcemap，非业务运行加载；没有为它扩大 CSP。自动验收不打开 DevTools。

字体CSS的@import允许规则与字体二进制CORS分开配置。字体失败不阻塞核心。所有显式脚本均为 HTTPS 固定版本URL；下载字节和匿名CORS记录详见 CDN_VERIFICATION.md。
`);
await write('BUILD_PROFILES.md', `# Build Profiles 与复现

应用基础RC：${RC_COMMIT} / ${RC_TREE}。构建工具版本 shapez2-static-build/1.0.0；实际 Node ${global.node}。固定开发依赖：${Object.entries(global.toolingPackages).map(([k,v])=>k+'@'+v).join(', ')}。只使用HTML/CSS/JS解析器和无浏览器下载的测试驱动，无大型打包框架；这些依赖不发布到站点。

## 首次准备（在独立 Clone 根目录）

~~~powershell
$env:TEMP = Join-Path $PWD '.f1\\tmp'
$env:TMP = $env:TEMP
$env:npm_config_cache = Join-Path $PWD '.f1\\npm-cache'
New-Item -ItemType Directory -Force $env:TEMP | Out-Null
npm ci --ignore-scripts --no-audit --no-fund
npm ci --prefix tools/static-build --ignore-scripts --no-audit --no-fund
npm --prefix tools/static-build run prepare:inputs
~~~

根 package.json / package-lock.json 属于 RC acceptance 的哈希绑定，故不加根 npm scripts；这是采用稳定子目录入口的原因。prepare:inputs仅在LF/CRLF/已有mixed配方可精确命中原哈希时恢复checkout表示，内容不一致直接失败。新增工具与字体目录以局部 .gitattributes 固定字节，不修改根属性或现有版本身份。

## 构建与静态校验

~~~powershell
npm --prefix tools/static-build run build:global
npm --prefix tools/static-build run build:china
npm --prefix tools/static-build run verify
npm --prefix tools/static-build run verify:cdn
~~~

输出 dist/global/ 与 dist/china/。build/verify不联网；verify:cdn是显式网络复核。构建固定使用仓库内资源锁和经核验的字体文件，不隐式更新SRI、不依赖CDN当时是否可达。不会调用部署或Git远端写操作。

index.html是唯一模板；parse5结构化修改script属性、base、语言与CSP，派生根/cn/en三个入口。PostCSS只改字体@import。算法/Worker/图片按RC固定文件列表复制，原始自有JS不压缩、不转译、不改变换行。不存在按IP/hostname选CDN的客户端逻辑。

Global默认base=/shapez2-solver/，China默认base=/。ECS如需明确子目录，使用 node tools/static-build/build.mjs china --base-path=/solver/。只接受以/结尾的安全目录路径；不要在构建后手改HTML。各入口包括 /cn/、/en/、对应 index.html；刷新依赖普通目录index服务，无SPA fallback要求。构建后为目录URL提供/重定向的静态服务即可。

本地预览：node tools/static-build/serve.mjs global 4173 或 node tools/static-build/serve.mjs china 4174。只绑定127.0.0.1，Global模拟项目子路径且不允许错误根 /main.js 回退；不是生产服务器。

## CSP、SRI 和字体

生成meta CSP在charset之后、可执行元素之前。script-src允许self、该Profile脚本域与locale引导脚本的精确SHA-384；无脚本unsafe-inline/unsafe-eval、无域名通配。worker-src/child-src均self，connect-src self，img-src self data:，object-src none，base-uri self。样式允许unsafe-inline，因为原页面和可视化实际使用内联style与动态style；Global另允许Google字体CSS，字体二进制只允许fonts.gstatic.com，China字体只允许self。没有无理由添加blob:。

5项经典JS的SRI均来自实际响应SHA-384，crossorigin=anonymous；原生浏览器也核对实际响应SHA-256。特别注意cytoscape-elk.min.js是jsDelivr动态生成的压缩入口，响应有相关提示。为保持原入口，本轮保留该URL并对当前已审核字节固定SRI；如果CDN重压缩，浏览器会拒绝加载，不能自动刷新哈希冒充等价。须重新检查字节差异，必要时在新授权阶段改用可固定字节的交付方式。Global Google Fonts CSS随UA变化，不伪造SRI；China本地字体字节全部固定，font-display=swap并保留sans-serif回退。

## 无竞争窗口下的验收

~~~powershell
$env:F1_EXCLUSIVE_WINDOW = '1' # 仅在确认性能比较Agent已结束后设置
npm --prefix tools/static-build run test:browser
npm --prefix tools/static-build run test:acceptance
node tools/static-build/reports.mjs
~~~

未确认窗口时两个重负载入口写BLOCKED、退出2，不启动浏览器/回归。测试采用已安装Chromium，不下载浏览器；profile、临时文件、结果均在.f1内。验收要求v2注册242、PASS229、历史专用skip13，v1 PASS198且skip0；没有为取得全绿修改或跳过失败用例。

维护资源：probe-cdn.mjs执行固定URL/包身份/许可证/54个字体的显式请求；review-lock.mjs只在人工审核探测内容后导入结果。二者均不由build自动调用。网络异常和字节漂移必须独立报告。生产CSP响应头、站点路径、MIME与缓存策略留到F2独立配置；本轮没有改ECS或Pages。
`);
const cand=[...(await readJson('.f1/evidence/mirror-candidates.json')),...(await readJson('.f1/evidence/mirror-packages.json'))];
await write('CDN_VERIFICATION.md', `# CDN 实际内容与可用性验证

日期2026-10-30（Asia/Shanghai）；原始证据时间戳为UTC。VERIFIED仅指实际采样主机与本轮原生Chromium请求，不代表大陆全网可达。

## 最终脚本来源

${table(['依赖 / Profile','实际URL','HTTP','SHA-256','匿名CORS / 结果'],cdn.records.map(r=>[r.name+' / '+r.profile,r.url,r.status,r.sha256,(r.acao??'—')+' / '+r.statusLabel]))}

每项均检查HTTPS、响应Content-Type、固定包名/版本、响应正文、最终URL、SHA-256与SHA-384。国际/国内的五对脚本字节完全相同，没有需要忽略的差异。SRI见 resources.lock.json；页面crossorigin=anonymous。两次原生网络复核均成功；浏览器实载也逐项匹配锁定SHA。未将HTTP200的HTML错误页当作JavaScript。

cytoscape-elk的.min.js是CDN生成文件，非npm原包发布的稳定minified字节，当前镜像复制了同一响应。保留RC入口且固定当前SRI，未来重压缩将fail closed；本轮不保证CDN永久保持该SRI，也不无审查更新锁。

Topthink资源可公开请求，无登录、API Key或付费套餐，且实测返回上述内容。UNKNOWN：可单独核验的长期免费服务条款/SLA；其根路径返回404，不将根主页或其他镜像项目的描述当作第一方可用性证明。国内定位属于INFERRED，独立大陆ISP可达性属于UNKNOWN，须在F2前补证。未选择付费方案，也未新增私有服务凭据。

## 候选探测（仅测试下列确切路径）

${table(['URL','HTTP / 网络结果','SHA-256'],cand.map(r=>[r.url,r.status??r.error,r.sha256]))}

JSDMirror .com 的最初失败详见 .f1/evidence/jsdmirror-failed-probe.json（521）；.cn亦521。BootCDN部分200且字节相同，elkjs/cytoscape-elk/3d-force-graph测试路径404，因此未选；这不推断其其他路径或其他版本一定不可用。Staticfile和Baomitu只验证了Cytoscape候选，没有用其单资源成功推断其全库可用。Topthink五项固定路径均实测，选用单一脚本域减少CSP白名单。

## 字体与许可

Google Fonts CSS实测HTTP200，源码SHA-256 ${lock.font.snapshotCssSha256}，Chrome UA返回Barlow分发v13。下面54份WOFF2均HTTP200、Content-Type为font/woff2、匿名CORS=*，并校验wOF2签名；China文件与下载正文完全一致。CSS只修改src URL，保留字重、斜体、unicode-range和swap。实际浏览器每Profile18种style/weight均加载成功；另外刻意屏蔽字体的新页面仍能初始化、运行Solver Worker并求解。

${table(['本地文件','Google Fonts固定文件URL','SHA-256','结果'],lock.font.fonts.map(f=>[f.localFile,f.url,f.sha256,'VERIFIED']))}

OFL来源：[固定Google Fonts提交](${lock.font.licenseUrl})；完整OFL与版权已复制到third-party/barlow/OFL.txt及两个产物。其SHA-256 ${lock.font.licenseSha256} 与RC许可快照相同。脚本包级许可证分别为MIT、EPL-2.0等，来源和SHA在resources.lock.json，完整文本在third-party/licenses；JS仍由CDN加载，无新增本地JS回退，也不将既有bundle的包级许可夸大为完整传递依赖SBOM。

Global字体CSS是原RC的动态接口，不能保证将来所有UA收到相同字节；不对它设置错误SRI。China没有Google字体运行期请求。字体回退不等于关闭CSP或绕过SRI。

资源选型参考仅用于发现候选，实际结果以上表为准：[BootCDN自身说明](https://www.bootcdn.cn/)、[JSDMirror官方项目](https://github.com/jsdmirror/JSDMirror)。
`);
await write('BROWSER_VALIDATION.md', `# 实际浏览器验证

总体 ${browser.status}。用户于本轮确认性能比较Agent已结束后，顺序运行本地实际Chromium验收；未与外部正式计时并发，未访问其目录或结果。浏览器版本：${browser.profiles[0]?.browserVersion}。本地HTTP服务模拟global项目子路径/shapez2-solver/和china站点根/，无生产试错。

${table(['Profile','检查项','证据标记','结果'],browserRows)}

所有正常流程的CDN请求均由浏览器原生发出，没有路由替换、镜像到本地或mock响应。5项外部JS实际响应也核对SHA-256，与SRI/锁文件匹配。正常流程控制台error=0、pageerror=0、CSP违规=0、CDN请求失败=0、本地404=0；请求域名只包含当前Profile允许域和同源资源。故通过不依赖unsafe-eval、blob Worker或脚本unsafe-inline。

字体故障检查是独立新页面，明确只拦截字体，验证系统字体回退和核心Worker；这些预期故障不混入正常网络通过计数。所有18种style/weight在正常流程先实际加载。初始形状画布、目标输入、一步Half Destroyer求解、2D实际节点/边、ELK真实布局、Explorer实际WebGL上下文、Mixing Worker、语言切换/刷新均检查。

首轮唯一失败是测试驱动尝试直接点击CSS隐藏的原生checkbox；改为点击用户可见toggle-track后重跑全部流程，未修改业务代码或降低断言。首轮原始结果保留在 .f1/evidence/browser-attempt-1.json，最终结果在 .f1/evidence/browser-validation.json。字体与本地路径验证从未把UNKNOWN写为PASS。

保留的warning：旧three.min.js弃用提示、bundle重复Three.js、Cytoscape滚轮/样式提示。这些来自RC继承的固定依赖与原配置；当前功能正常，未为消除warning升级版本。

截图：.f1/evidence/global-2d.png、global-3d.png、china-2d.png、china-3d.png及各Profile初始英文界面。使用软件WebGL验证渲染；不外推为所有显卡、Firefox/Safari或手机兼容性。中国大陆电信/联通/移动独立网络可达性仍为UNKNOWN，本机成功不代替该项。

静态HTTP另通过global ${staticResult.profiles.global.httpChecks}项、china ${staticResult.profiles.china.httpChecks}项路径/正文校验；这些是独立证据，没有替代上述浏览器测试。所有日志、浏览器profile与临时文件均保留在独立Clone的.f1中，测试结束关闭本轮自行启动的浏览器与预览服务。
`);
const maps={global:new Map(global.files.map(f=>[f.path,f])),china:new Map(china.files.map(f=>[f.path,f]))};
for(const p of ['global','china'])maps[p].set('build-manifest.json',{sha256:await digest(`dist/${p}/build-manifest.json`)});
const paths=[...new Set([...maps.global.keys(),...maps.china.keys()])].sort();
await write('ARTIFACT_MANIFEST.md', `# 静态产物清单

VERIFIED：两份产物由同一应用RC和同一工具源码生成。应用RC Commit ${RC_COMMIT}，Tree ${RC_TREE}。Source Commit ${global.sourceCommit}，Source Tree ${global.sourceTree}。Profile分别global与china；构建工具${global.buildTool}，Node ${global.node}。工具版本、工具文件SHA、第三方固定版本、最终CDN URL、SRI、每文件SHA和字节数详见各产物build-manifest.json。清单不写构建时间或本地绝对路径，不包含自身递归哈希；本文件另列其SHA。

global清单SHA-256：${maps.global.get('build-manifest.json').sha256}。
china清单SHA-256：${maps.china.get('build-manifest.json').sha256}。

重复相同配置构建结果一致。27个自有JS完全相同，shapeOperations.js SHA-256 ${maps.global.get('shapeOperations.js').sha256}；语义聚合 ${global.identity.semanticsSha256}。所有源RC文件无内容差异、461个冻结Benchmark匹配，产物未包括Benchmark测试缓存、node_modules、Git元数据、本地绝对路径或凭据。字体等二进制由许可与资源锁绑定。

## 每个不同路径及理由

${table(['路径','差异说明'],staticResult.differences.map(d=>[d.file,d.reason]))}

## 全部产物文件SHA-256

${table(['相对路径','global SHA-256','china SHA-256'],paths.map(p=>[p,maps.global.get(p)?.sha256??'不包含',maps.china.get(p)?.sha256??'不包含']))}

HTML仅CDN地址、最小CSP和部署base不同；CSS仅字体@import不同；China多54个WOFF2和1份本地字体CSS；清单记录相应配置及哈希。结构化规范化比较确认去除这些字段后HTML一致，移除字体import后CSS一致；其他文件必须相同，出现任何未授权差异会使verify失败。
`);
await write('NEXT_DEPLOY_PLAN.md', `# F2 候选部署计划（未执行）

F1本地构建、实际浏览器和原有正确性门禁已通过。INFERRED：具备进入F2准备的技术基础；UNKNOWN：中国大陆独立网络可达性与所选公共镜像长期免费条款/SLA。不能给出国内无条件可部署通过。下一步先补充大陆电信/联通/移动等实际采样点的固定URL/SRI/CORS验证；不得使用本机或CDN宣传代替，也不在生产ECS试错。

只有获得下一阶段独立授权后，才可执行下列候选步骤：

1. 固定审阅通过的F1源码Commit、两个Profile清单SHA和资源锁；复核外部CDN字节未漂移。如镜像不可用，另行批准等价替代或经许可审查的本地JS回退，不自动放宽CSP/SRI。
2. 明确GitHub Pages是否启用、发布方式及项目路径/shapez2-solver/。候选上传范围仅dist/global内容，带.nojekyll；不得把整个仓库、Benchmark或.f1缓存发布。没有新增push自动部署工作流。
3. 明确ECS静态根路径或专用子路径，路径改变必须重新构建china，禁止直接手改产物。先在独立预发布目录校验HTML/JS/CSS/WOFF2 MIME、HTTPS、普通目录index/尾斜线、Worker同源与缓存策略；不覆盖现有生产目录。
4. 依据产物CSP核对服务器响应头，不让未知旧策略阻断字体、Worker或可视化；保留SRI与匿名CORS。HTML/CSS/自有JS采用可回滚的一致版本发布策略；不得让旧HTML引用不一致的新文件。
5. 在预发布环境重做初始化、输入、Solver/Mixing Worker、2D/3D、字体/故障回退、locale刷新、网络与CSP检查；同时确认部署范围、备份及回滚目标后才进行被授权的生产切换。
6. 记录实际部署身份和清单哈希，检查预期URL的公开行为。失败时回滚到预先确认的上一版本；不就地修改算法解决部署问题。

预期国际地址是 https://87174704.github.io/shapez2-solver/，本轮未访问该地址来冒充已部署，也未启用Pages。国内生产站点、Gitea与ECS均未修改。F1到此STOP；不自动push、deploy、创建Release、切换生产CDN、做i18n或算法优化。
`);
const evidence={};for(const f of await filesUnder(path.join(ROOT,'.f1/evidence')))if(!f.endsWith('.png')&&f!=='SHA256SUMS.json')evidence[f]=await digest('.f1/evidence/'+f);
await fs.writeFile(path.join(ROOT,'.f1/evidence/SHA256SUMS.json'),JSON.stringify(evidence,null,2)+'\n');
console.log('Wrote all seven F1 deliverables and evidence checksums.');
