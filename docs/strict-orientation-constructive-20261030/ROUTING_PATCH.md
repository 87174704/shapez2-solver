# Strict-orientation Constructive 路由补丁

固定基线：`ec9cc5cb633d021b6af276565223a392f8329b87`。仅修改 `shapeSolver.js`，新增 `constructive/validate-strict-plan.js`，其余新增文件均为测试与本报告目录的证据/脚本。历史 benchmark、witness、Physics v2、构造核心、通用搜索、Beam、缓存、版本清单及部署文件无提交改动。

## 开关与路由

默认关闭，原九个位置参数保持兼容。显式第十参数：

```js
await shapeSolver(targets, sources, operations, maxLayers, beam,
    preventWaste, orientationSensitive, allowSplitting, cleanPainting,
    { strictOrientationConstructive: true });
```

Worker 请求通过 `data.solverFeatures.strictOrientationConstructive` 传递同一开关。未添加 UI 控件或修改产品默认值。只有严格布尔值 true 才启用。

新增尝试仅适用于：单目标、maxLayers=4、orientationSensitive=true、allowSplitting=false、cleanPainting=true、preventWaste=false；目标及资源均为最多四层/每层四象限的普通合法材料（不含 Pin/Crystal），资源 token 不超过 64。材料/结构/数量门槛是通用域约束，不读取 case ID、目标常量、witness 或测试数据；域外直接走原入口。Refined/Exotic 保持项目现有不可涂色规则。

既有 `orientationSensitive=false` Constructive-hybrid gate、调用及失败回退块原样保留；开关关闭完全跳过新分支。`check-identity.mjs` 比较旧 dispatch、core/Explorer、operations/cache/Beam 源码块逐字节相同。只有开关开启且新域满足时，才有新行为。

## 预算

现有 `interiorCrystalColumnSolve` 原样复用。新配置独立为 `strict-ordinary-v1`：maxWallMs=50，maxExtractionOperations=8，maxExtractionStates=6000，maxMatchingTransitions=20000，maxOperations=256。既有非严格配置 PCHA-A（包括 12 秒原预算）不变。

新分支从尝试开始计时，共享一次 50 ms 验收截止，包含构造、内部委派、生产回放；每个回放步骤和返回前检查时间。即便构造器返回解，截止后也拒绝候选。异常、无路径、非法路径、预算耗尽均回退 core。原 core 的时间上限通过既有 limits 能力扣除路由已花费时间，不重新赠予一个完整求解预算。返回 `searchWallMs` 为入口总用时，`strictConstructiveAttempt` 给出 budgetMs/elapsedMs/accepted/fallback/reason/architectureStatus。

这是基于既有同步构造器的**协作式预算及候选截止**，并非 JavaScript 同步调用的强制抢占。构造器某些共享池阶段只在完成时查时；可能小幅超支后回退。64 token/4 层域上限及工作量/解长上限约束额外工作，不声称 50 ms 是进程级硬终止保证。性能测量另用原 2 秒 Windows 进程硬截止，不提升任何内存或搜索上限。该限制在默认关闭状态下交付，未扩大到无界输入池。

## 严格生产验收

新模块不导入 Node、测试 oracle 或 benchmark。复用原生产 operation registry 和 Physics v2 函数。它从原始输入 ID 0..N-1 建立有限库存；每一步检查：操作开启、精确输入数量、已存在且 shape 匹配的输入 ID、同一步无重复消费、颜色参数/cleanPainting、完整物理输出（含所有非空副产物）、输出全新非负安全整数 ID。消费后立即移除输入；所有历史 ID 保留在 used 集合中，防止复用已消费 ID。

每个 token 表示一个完整输入流，新增域禁止 Splitter，因此不存在隐式复制或分流单位折算。Swapper 按原 oracle 的无序输出多重集语义比较，其余操作按顺序比较。最终必须在真实剩余库存中找到**原目标精确字符串**；不会引入旋转等价接受。模块亦支持检查终态 waste，但新路由将 preventWaste=true 保留给旧入口。

验收成功才返回 `solverRoute: 'strict-ordinary-constructive'`。失败返回路径不暴露候选，进入 `general-search` 并保留 attempt 原因。旧非严格路由仍报告 `constructive-hybrid`；旧通用入口的原结果结构不变。

## 测试边界

留出集先于实现锁定为提交 `db25eb4`。故障注入仅通过额外导出的 frozen `strictRoutingTestOnly` seam，测试构造异常、错误候选及构造/回放时间耗尽；不允许公共 API 注入构造器或改预算。实际失败回退由留出负例及初始目标控制验证。全部返回路径另由 Node 测试 oracle 和不导入生产物理代码的分析模型独立回放。

源码 SHA、完整逐案例原始数据和复现命令见 `identity-validation.json`、`runs/formal/`、`REPRODUCE.md`。这是可行解优先策略，允许更长解；未改变短解偏好默认行为，未声称新路线最短。
