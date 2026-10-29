# 资源加载审计

VERIFIED：直接读取 RC 的 index.html、cn/index.html、en/index.html、styles.css、main.js、operationGraph.js、自有 ES Module 依赖图、Worker 入口，以及实际下载的 CDN 响应；并以真实 Chromium 网络日志交叉检查。没有依赖 README 推断运行资源。

| 顺序 / 依赖 | 版本 | RC / global URL | china URL | 使用形式 | 许可证 |
| --- | --- | --- | --- | --- | --- |
| 1 / cytoscape | 3.29.2 | https://unpkg.com/cytoscape@3.29.2/dist/cytoscape.min.js | https://jsdelivr.topthink.com/npm/cytoscape@3.29.2/dist/cytoscape.min.js | classic UMD → window.cytoscape | MIT |
| 2 / elkjs | 0.9.3 | https://cdn.jsdelivr.net/npm/elkjs@0.9.3/lib/elk.bundled.js | https://jsdelivr.topthink.com/npm/elkjs@0.9.3/lib/elk.bundled.js | classic UMD → window.ELK；内含 bundled fake worker | EPL-2.0 |
| 3 / cytoscape-elk | 2.3.0 | https://cdn.jsdelivr.net/npm/cytoscape-elk@2.3.0/dist/cytoscape-elk.min.js | https://jsdelivr.topthink.com/npm/cytoscape-elk@2.3.0/dist/cytoscape-elk.min.js | classic UMD → window.cytoscapeElk；读取已有 ELK 并注册到 cytoscape | MIT |
| 4 / three | 0.159.0 | https://cdn.jsdelivr.net/npm/three@0.159.0/build/three.min.js | https://jsdelivr.topthink.com/npm/three@0.159.0/build/three.min.js | classic UMD → window.THREE | MIT |
| 5 / 3d-force-graph | 1.74.7 | https://cdn.jsdelivr.net/npm/3d-force-graph@1.74.7/dist/3d-force-graph.min.js | https://jsdelivr.topthink.com/npm/3d-force-graph@1.74.7/dist/3d-force-graph.min.js | classic UMD → window.ForceGraph3D；自身 bundle 也含 Three.js | MIT (bundled notices retained) |

五个经典脚本均在 main.js 的 type=module 之前同步加载，无 async/defer。cytoscape-elk 必须在 Cytoscape 与 ELK 之后；3D 渲染使用 ForceGraph3D 与 global THREE。各 UMD 文件含 CommonJS/AMD 分支，但普通页面不提供 module/exports/require，因此实际走浏览器全局分支；没有在浏览器新增 CommonJS 解析器或改为 ESM CDN 入口。

Barlow：原 CSS @import 来自 https://fonts.googleapis.com/css2?family=Barlow:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap。Google Fonts 原接口未固定版本，实测 Chrome UA 对应 s/barlow/v13；54个 WOFF2文件、normal/italic 的100–900九种字重及 latin/latin-ext/vietnamese 三个子集。China 原样托管这些字体二进制，CSS仅将URL改成本地；分发版本与每文件哈希固定在 resources.lock.json。OFL-1.1 的SHA-256为 186d750eb496a4c17a76385f82be6aea2ac1cf2de074a811d63786cf374ea73f，与RC已有授权文本一致；字体源快照 6cdf01867df0813c2390f90dff7dc66c87f14cf7。Global保留原有可随UA/时间变化的 Google CSS，因而不声称其返回字体在未来永远等于快照。

main.js → 同源 ES Module → new Worker(new URL('./shapeSolver.js', import.meta.url), {type:'module'})；Mixing 使用同样形式的 mixingSolver.js。业务模块的静态 import 全为本站相对路径，无运行期外站动态 import / importScripts。27个自有JS文件与RC绑定且两个产物字节相同。

ELK路径：operationGraph 的调色图 buildBaseLayout(name=elk) → cytoscape-elk 的 new ELK() → elk.bundled 的本地内置 fake Worker。应用不传 workerUrl，不额外下载 elk-worker 跨域主脚本；真实 ELK 布局已在浏览器运行。Solver的普通2D解图使用 preset 布局。

3D路径：renderSpaceGraph → ForceGraph3D → 默认 forceEngine=d3。bundle 包含 ngraph 的 new Function 代码，但应用没有选择 ngraph 分支；CSP不允许 unsafe-eval，实际3D运行成功。TextureLoader 读取本站操作图标及 shapeRendering canvas.toDataURL() 生成的 data:image。图像全部同源或 data:。导出 toBlob 用于剪贴板，不创建 blob Worker URL。

原RC无 CSP、SRI 或 crossorigin；F1仅在生成HTML中新增。各生成HTML配置同源 base，Global /shapez2-solver/，China /，可显式覆盖。保留原 locale redirect、查询串、hash、i18n逻辑与用户操作。原有 cn/en 源快照不作为额外维护模板。

VERIFIED：浏览器原生请求仅出现当前 Profile 的脚本域、Global Google Fonts域及本站资源，无额外业务网络来源。CDN bundle 中文档链接、SVG命名空间、shader说明不是网络请求。cytoscape-elk 的 sourceMappingURL=/sm/... 是DevTools可选 sourcemap，非业务运行加载；没有为它扩大 CSP。自动验收不打开 DevTools。

字体CSS的@import允许规则与字体二进制CORS分开配置。字体失败不阻塞核心。所有显式脚本均为 HTTPS 固定版本URL；下载字节和匿名CORS记录详见 CDN_VERIFICATION.md。
