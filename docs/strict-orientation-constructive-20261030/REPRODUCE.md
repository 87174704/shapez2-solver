# 当前验证入口

在仓库根目录安装版本化依赖并恢复被冻结的精确换行表示：

```powershell
npm ci --ignore-scripts --no-audit --no-fund
npm ci --prefix tools/static-build --ignore-scripts --no-audit --no-fund
node tools/release1/prepare-checkout.mjs
```

依次运行当前回归、历史认证、159 个 Benchmark、331 witness 和 461 个冻结哈希：

```powershell
$env:F1_EXCLUSIVE_WINDOW='1'
node tools/static-build/acceptance.mjs
node tools/i18n/ordinary.mjs
node tools/i18n/audit.mjs
```

普通案例与预先锁定的留出定义保留在 measured-cases.json、input-lock.json 及 tests/strict-routing/ 中。验收执行双重路径回放；不重新运行历史数千次性能测量。

双 Profile 与真实浏览器、Worker、2D/3D、CSP 和 13 种语言检查：

```powershell
node tools/static-build/build.mjs global
node tools/static-build/build.mjs china
node tools/static-build/verify.mjs
node tools/static-build/browser.mjs
node tools/static-build/i18n-browser.mjs
node tests/browser/workerLifecycle.browser.mjs
```

这些入口均从当前仓库定位源码，不需要历史 Clone、审计目录或未跟踪资源。测试输出位于被忽略的 .f1/、.ci-results/、dist/；多语言审计会刷新既有 docs/release1/i18n/ 证据，验证后可由 Git 还原。

原始 opt-in 实验的性能报告为历史摘要；原始逐次采样已从当前源码树移除，既有 Git 历史保持完整。可选的未来性能测量使用 tools/release1/measure.py 及同目录的 limiter.py，仅在明确需要时运行。
