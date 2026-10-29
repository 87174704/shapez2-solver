# 实际浏览器验证

总体 VERIFIED。用户于本轮确认性能比较Agent已结束后，顺序运行本地实际Chromium验收；未与外部正式计时并发，未访问其目录或结果。浏览器版本：156.0.8078.48。本地HTTP服务模拟global项目子路径/shapez2-solver/和china站点根/，无生产试错。

| Profile | 检查项 | 证据标记 | 结果 |
| --- | --- | --- | --- |
| global | entry redirect, initialization and shape rendering | VERIFIED | 实际执行通过 |
| global | shape input, Solver Worker, solution and 2D graph | VERIFIED | 实际执行通过 |
| global | 2D direction control and actual ELK adapter execution | VERIFIED | 实际执行通过 |
| global | Explorer Worker and actual 3D WebGL graph | VERIFIED | 实际执行通过 |
| global | Barlow original normal/italic weights and fallback policy | VERIFIED | 实际执行通过 |
| global | Mixing Worker and mixing graph | VERIFIED | 实际执行通过 |
| global | locale switch and refresh under deployment prefix | VERIFIED | 实际执行通过 |
| global | all five real CDN responses match reviewed bytes | VERIFIED | 实际执行通过 |
| global | no unexpected domains, local 404, console error or CSP violation | VERIFIED | 实际执行通过 |
| global | font failure leaves Solver functional | VERIFIED | 实际执行通过 |
| china | entry redirect, initialization and shape rendering | VERIFIED | 实际执行通过 |
| china | shape input, Solver Worker, solution and 2D graph | VERIFIED | 实际执行通过 |
| china | 2D direction control and actual ELK adapter execution | VERIFIED | 实际执行通过 |
| china | Explorer Worker and actual 3D WebGL graph | VERIFIED | 实际执行通过 |
| china | Barlow original normal/italic weights and fallback policy | VERIFIED | 实际执行通过 |
| china | Mixing Worker and mixing graph | VERIFIED | 实际执行通过 |
| china | locale switch and refresh under deployment prefix | VERIFIED | 实际执行通过 |
| china | all five real CDN responses match reviewed bytes | VERIFIED | 实际执行通过 |
| china | no unexpected domains, local 404, console error or CSP violation | VERIFIED | 实际执行通过 |
| china | font failure leaves Solver functional | VERIFIED | 实际执行通过 |

所有正常流程的CDN请求均由浏览器原生发出，没有路由替换、镜像到本地或mock响应。5项外部JS实际响应也核对SHA-256，与SRI/锁文件匹配。正常流程控制台error=0、pageerror=0、CSP违规=0、CDN请求失败=0、本地404=0；请求域名只包含当前Profile允许域和同源资源。故通过不依赖unsafe-eval、blob Worker或脚本unsafe-inline。

字体故障检查是独立新页面，明确只拦截字体，验证系统字体回退和核心Worker；这些预期故障不混入正常网络通过计数。所有18种style/weight在正常流程先实际加载。初始形状画布、目标输入、一步Half Destroyer求解、2D实际节点/边、ELK真实布局、Explorer实际WebGL上下文、Mixing Worker、语言切换/刷新均检查。

首轮唯一失败是测试驱动尝试直接点击CSS隐藏的原生checkbox；改为点击用户可见toggle-track后重跑全部流程，未修改业务代码或降低断言。首轮原始结果保留在 .f1/evidence/browser-attempt-1.json，最终结果在 .f1/evidence/browser-validation.json。字体与本地路径验证从未把UNKNOWN写为PASS。

保留的warning：旧three.min.js弃用提示、bundle重复Three.js、Cytoscape滚轮/样式提示。这些来自RC继承的固定依赖与原配置；当前功能正常，未为消除warning升级版本。

截图：.f1/evidence/global-2d.png、global-3d.png、china-2d.png、china-3d.png及各Profile初始英文界面。使用软件WebGL验证渲染；不外推为所有显卡、Firefox/Safari或手机兼容性。中国大陆电信/联通/移动独立网络可达性仍为UNKNOWN，本机成功不代替该项。

静态HTTP另通过global 11项、china 12项路径/正文校验；这些是独立证据，没有替代上述浏览器测试。所有日志、浏览器profile与临时文件均保留在独立Clone的.f1中，测试结束关闭本轮自行启动的浏览器与预览服务。
