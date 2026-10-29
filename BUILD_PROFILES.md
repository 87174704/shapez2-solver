# Build Profiles 与复现

应用基础RC：ec9cc5cb633d021b6af276565223a392f8329b87 / 4e49a58cd2d89923ebea189ffbfc9ab9b1049d87。构建工具版本 shapez2-static-build/1.0.0；实际 Node v24.21.0。固定开发依赖：acorn@8.15.0, parse5@7.3.0, playwright-core@1.56.1, postcss@8.5.6。只使用HTML/CSS/JS解析器和无浏览器下载的测试驱动，无大型打包框架；这些依赖不发布到站点。

## 首次准备（在独立 Clone 根目录）

~~~powershell
$env:TEMP = Join-Path $PWD '.f1\tmp'
$env:TMP = $env:TEMP
$env:npm_config_cache = Join-Path $PWD '.f1\npm-cache'
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
