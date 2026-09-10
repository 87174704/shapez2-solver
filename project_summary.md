# Shapez 2 Solver 项目总结

## 1. 项目定位

这是一个面向游戏 **Shapez 2** 的纯前端形状求解工具。用户提供目标形状、已有形状和允许使用的机器操作后，应用在浏览器中搜索一条可行的制造路径，并用关系图展示步骤。项目同时包含：

- 形状配方求解器：寻找从输入形状到目标形状的操作序列。
- 可达空间探索器：枚举指定深度内的可达形状并展示 3D 关系图。
- 颜色混合求解器：根据已有/目标颜色数量寻找混色方案，或反推所需的 RGB 基础色投入。
- 形状码校验、二维 Canvas 预览、中英文界面、流程图复制等辅助能力。

整个项目没有后端、数据库或打包构建步骤。页面由静态 HTML/CSS、原生 ES Modules 和 Web Worker 组成，计算全部在浏览器本地完成。

## 2. 技术栈与运行模型

| 层次 | 实现 |
| --- | --- |
| 页面与交互 | 原生 HTML、CSS、JavaScript ES Modules |
| 后台计算 | 浏览器 Web Worker：`shapeSolver.js`、`mixingSolver.js` |
| 形状绘制 | Canvas 2D |
| 配方/混色图 | Cytoscape.js 3.29.2 + ELK.js 0.9.3 + cytoscape-elk 2.3.0 |
| 探索器 3D 图 | three.js 0.159.0 + 3d-force-graph 1.74.7 |
| 字体 | Google Fonts 的 Barlow |
| 测试 | Node.js 内置 `node:test` 与 `assert/strict` |
| 部署 | Gitea Actions，自托管 `solver-shell` runner |

图形库和字体均从公网 CDN 运行时加载；仓库内没有 npm 运行时依赖、锁文件或供应商副本。浏览器还需支持 Module Worker、Canvas、Clipboard、History 和 Local Storage API。

## 3. 总体架构

```text
index.html / cn/index.html / en/index.html
        │
        ├── styles.css                       页面布局与视觉样式
        └── main.js                          UI 状态、事件与任务编排
              │
              ├── shapeValidation.js         输入校验
              ├── shapeOperations.js         形状领域模型与机器操作
              ├── shapeRendering.js          Canvas 形状绘制
              ├── i18n.js / colorMode.js     国际化与配色模式
              ├── Worker: shapeSolver.js     配方搜索 + 可达空间枚举
              ├── Worker: mixingSolver.js    颜色混合搜索
              └── operationGraph.js          2D/3D 图渲染与图片复制
```

`main.js` 是页面唯一的模块入口。它持有界面状态，但把高耗时搜索交给两个 Worker，避免阻塞主线程。Worker 通过 `status` 和 `result` 消息回传进度或结果；主线程随后调用 `operationGraph.js` 渲染对应图形。

## 4. 目录与文件职责

```text
E:\solver
├── .gitea/
│   └── workflows/deploy.yml        推送 main 后部署静态文件
├── cn/index.html                    中文路径入口，base 指向上一级资源
├── en/index.html                    英文路径入口，base 指向上一级资源
├── images/
│   ├── operations/                 15 个操作图标
│   └── *.png / *.ico               导航、分类和站点图标等静态资源
├── tests/
│   └── shapeSolver.test.mjs        求解器与有界状态收集器测试
├── index.html                      根入口与完整应用页面
├── styles.css                      暗色界面、侧栏、图区域、弹窗等样式
├── main.js                         前端控制器与全局 UI 状态
├── shapeConstants.js               部件、颜色、混色表和配色常量
├── shapeOperations.js              形状对象、物理规则和操作实现
├── shapeSolver.js                  配方求解及探索 Worker
├── shapeSolver_web.js              与 shapeSolver.js 完全相同的副本
├── mixingSolver.js                 颜色混合算法及其 Worker 入口
├── shapeRendering.js               形状 Canvas 渲染器
├── operationGraph.js               Cytoscape/3D Force Graph 适配层
├── shapeValidation.js              形状码结构校验和错误提示
├── colorMode.js                    RGB/RYB/CMYK 显示模式选择
├── i18n.js                         中英文词典、路由和 DOM 翻译
├── deploy-shapez2-index.html       独立的 Shapez2 工具站导航页
├── package.json                    ESM 标记和 `npm test` 脚本
└── README.md                       项目简介、示例、来源和许可说明
```

当前 Git 共跟踪 48 个文件。`images/` 根目录有 13 个文件，`images/operations/` 有 15 个操作图标。

## 5. 核心模块

### 5.1 `main.js`：界面控制与任务编排

`main.js` 维护目标/起始形状、三个 Worker、混色候选解、当前图和状态栏信息。主要职责包括：

- 添加、删除和预览目标/起始形状。
- 启用/禁用 10 种形状操作。
- 读取最大层数、每层状态数、避免浪费、方向敏感、允许分流和干净涂色等选项。
- 在正式求解前校验形状码，并检查不可再生部件的输入数量是否足够。
- 启动、取消和清理 Solver、Explorer、Mixing Worker。
- 管理侧栏、折叠区、页签、语言、配色模式、图方向和复制按钮。
- 从目标形状按层、形状、颜色、形状+颜色或单部件提取起始素材。

默认起始形状为四种单色四分形：`CuCuCuCu`、`RuRuRuRu`、`SuSuSuSu`、`WuWuWuWu`。

### 5.2 `shapeConstants.js`：领域常量

形状码以 `:` 分隔层，每个部件由“形状字符 + 颜色字符”两位组成。主要部件编码包括：空位 `-`、圆 `C`、矩形 `R`、星 `S`、钻石 `W`、六边形 `H`、花 `F`、齿轮 `G`、销钉 `P`、水晶 `c`、精炼形 `X`、异形 `Y`。

颜色编码覆盖红、绿、蓝、黄、青、品红、白、黑和灰/未着色；同一逻辑颜色可通过 RGB、RYB、CMYK 三种显示映射呈现。文件还定义了完整的两两混色表、不可涂色部件、可被水晶替换的部件和不可再生部件集合。

### 5.3 `shapeOperations.js`：形状模型与操作规则

核心对象为：

- `ShapePart`：保存一个部件的形状和颜色。
- `Shape`：保存多层部件数组，负责形状码解析、序列化与空形判断，并缓存编码结果。
- `ShapeOperationConfig`：当前仅承载最大层数。

已实现的操作包括顺/逆时针旋转、180° 旋转、半边销毁、切割、交换、堆叠、顶层涂色、推针和生成水晶。切割、堆叠、推针等过程会模拟重力、部件连通、水晶融合/破裂和层数截断。交换与堆叠不支持每层部件数不同的两个输入。

辅助逻辑还提供全部旋转形态、目标素材提取、候选涂色/水晶颜色分析，以及用于搜索剪枝的相似度评分。相似度权重为部件类型 0.5、形状+颜色计数 0.3、旋转后的部件顺序 0.2。

### 5.4 `shapeSolver.js`：有界分层搜索

该文件同时是 ES 模块 Worker 和测试可导入模块，处理 `solve`、`explore`、`cancel` 消息。

配方求解以“当前可用形状的多重集合”为状态，逐深度扩展所有允许操作。它具有 BFS 的分层结构，但每层只保留相似度最高的有限状态，因此属于启发式有界搜索：通常优先得到较短且接近目标的方案，但在发生剪枝时不保证找到全局最优解，也不保证一定找到存在的解。

重要实现点：

- 形状码和分流吞吐 token 被整数化，减少重复字符串和对象占用。
- `BoundedStateCollector` 用固定容量堆边生成边剪枝，避免先物化整层候选再排序。
- 状态键按 token/count 排序，实现去重；`visited` 防止重复扩展。
- 单目标、无分流且允许废料时有快速目标判断；多目标会分配匹配的形状库存。
- 关闭方向敏感时，目标的全部旋转形态都可接受。
- 开启分流后，`Splitter` 把一个 token 变为两个半吞吐 token，最低吞吐为 `1/4096`。
- 开启避免浪费后，完成状态不能残留非目标形状。
- 开启干净涂色后，仅允许给单层且可涂部件均未着色的形状执行 Painter。
- Painter 只尝试目标实际需要的颜色，Crystal Generator 只尝试目标水晶相关颜色，以缩小分支。
- 求解轨迹以父链保存，命中目标后再回放为带稳定输入/输出 ID 的图形步骤。

安全预算如下：

| 项目 | 上限 |
| --- | ---: |
| 每层前沿状态 | 5,000 |
| 已访问状态 | 500,000 |
| 生成候选状态 | 5,000,000 |
| 唯一形状 | 150,000 |
| 单次搜索时间 | 120 秒 |
| 相似度/形状/涂色/操作输出缓存 | 100,000 / 20,000 / 15,000 / 75,000 |

达到预算时返回 `limitReached` 和具体原因，而不是继续耗尽浏览器内存。

同文件中的 Explorer 不做目标导向搜索，而是从起始形状按深度枚举新形状，输出 `{ shapes, ops, edges }`。一元操作只扩展本层新节点，二元操作将历史可用节点与本层前沿组合；带颜色的操作在探索模式中固定使用红色 `r`。

### 5.5 `mixingSolver.js`：颜色库存搜索

每次混合消耗两个颜色单位并产生两个结果颜色单位。算法分为两种模式：

- 手动输入：先用 BFS 找最短方案，再用 DFS 枚举不超过“最短步数 + 1”的不同方案。
- 自动优化：从目标总量开始，枚举最多 20 个 RGB 基础输入的所有分配，寻找可行方案。

单次枚举最多保留 40 个方案，DFS 时间预算为 2 秒。方案去重按操作三元组集合进行，结果按步骤数排序。这个模块也直接实现 Worker 消息入口。

### 5.6 `shapeRendering.js` 与 `operationGraph.js`：可视化

`shapeRendering.js` 将形状码解析为分层部件并绘制到 Canvas；不同层逐层缩小，部件围绕中心旋转排列。它对 6 部件形状使用专用六边形配置，其余情况使用默认四分形配置，并根据当前 RGB/RYB/CMYK 模式取色。

`operationGraph.js` 管理两套互斥图实例：

- Solver 和 Mixing 使用 Cytoscape，借助 ELK 生成 LR/TB/RL/BT 四向分层布局。
- Explorer 使用 3d-force-graph 和 three.js，把形状预览与操作图标作为 3D sprite；点击形状后可查看上游/下游操作并跳转。

形状节点支持点击复制形状码；完整 2D 或当前 3D 画面可通过 Clipboard API 复制为 PNG。切换颜色模式会重绘形状节点、带颜色的操作节点和混色连线。

### 5.7 `shapeValidation.js`、`i18n.js` 与本地化入口

校验器检查：输入必须为非空字符串、每层字符数为偶数、形状/颜色编码合法、空位和销钉必须使用 `-` 颜色、各层部件数量一致。错误通过翻译键生成并以浏览器 `alert` 展示。

国际化默认语言为中文，支持 `cn`、`en`。语言来源优先使用 URL 末段，其次读取 `localStorage` 的 `shapez2-solver-locale`。切换语言会更新 History URL、`html.lang`、带 `data-i18n*` 属性的 DOM、状态文本和已渲染图中的标签。

三个页面入口包含大体相同的应用标记：

- 根 `index.html` 根据已保存语言跳转到 `/cn/` 或 `/en/`。
- `cn/index.html` 设置 `lang="zh-CN"`，并通过 `<base href="../">` 复用根目录静态资源。
- `en/index.html` 设置英文语言环境，同样复用根目录静态资源。

## 6. 主要运行流程

### 形状求解

```text
用户输入 → 形状码/素材数量校验 → 创建 shapeSolver Worker
→ 按深度生成操作后继 → 相似度评分并保留 Top-K
→ 命中目标或达到安全预算 → 回传结果
→ Cytoscape + ELK 渲染配方图 → 状态栏显示耗时/深度/状态数
```

### 可达空间探索

```text
起始形状 + 操作集 + 深度 → shapeSolver Worker 的 explore 分支
→ 生成 shapes/ops/edges → 3D Force Graph
→ 点击形状查看来源与去向，并在节点间导航
```

### 颜色混合

```text
已有/目标颜色数量 → mixingSolver Worker
→ BFS 求最短解 + DFS 枚举近最短解
→ 返回候选列表 → 选择方案 → Cytoscape 渲染紧凑或展开混色图
```

## 7. 开发、测试与部署

### 本地运行

项目无需安装运行时依赖，但 ES Modules 和 Web Worker 不适合直接通过 `file://` 打开，应从仓库根目录启动任意静态 HTTP 服务器，然后访问根路径或 `/cn/`、`/en/`。例如：

```powershell
python -m http.server 8000
```

随后访问 `http://localhost:8000/`。

### 测试

```powershell
npm test
```

测试通过给 Node 环境注入最小 `self.postMessage`，直接导入 `shapeSolver.js`。当前 6 个测试覆盖：

1. 有界收集器只保留最高分且唯一的状态。
2. 有界堆结果与完整稳定排序一致。
3. 深度 0 即满足目标。
4. 新生成后继命中目标时立即返回。
5. 分流吞吐 token 不破坏求解结果。
6. Omni Swapper 集成案例在有界搜索下仍可求解。

本次盘点运行结果为 **6/6 通过**。

### 部署

`.gitea/workflows/deploy.yml` 在 `main` 分支 push 后触发：

1. 以浅克隆方式检出仓库，且不持久化凭据。
2. 验证源目录存在 `index.html`、目标目录 `/deploy/shapez2-solver` 已存在。
3. 清空目标目录。
4. 将仓库根目录除 `.git`、`.gitea` 外的全部内容复制到目标目录。

`deploy-shapez2-index.html` 不是应用入口，而是面向 `shapez2.ysc.icu` 的独立工具导航页，链接到 `/solver/`、`/solver/cn/` 和 `/solver/en/`。

## 8. 当前维护注意事项

- `shapeSolver_web.js` 与 `shapeSolver.js` 的 SHA-256 完全一致，但当前页面和测试只引用 `shapeSolver.js`；双份源码容易在后续修改时漂移。
- 根、中文、英文三个 HTML 页面大段重复；中文页除 `lang`、`base` 和一处默认帮助文本外与根页面基本一致，英文页主要只增加 `base`。这会增加 UI 标记同步成本。
- 生产运行依赖多个第三方 CDN 和 Google Fonts；离线或 CDN 不可用时，布局图、3D 图或字体会受影响。
- `package.json` 只有 ESM 声明和测试脚本，没有 `start`、格式化、静态检查或覆盖率配置。
- 自动测试集中在求解器和有界状态收集器，尚未直接覆盖形状物理操作、混色算法、校验、国际化、Canvas 渲染、图形交互和浏览器 Worker 集成。
- Explorer 复用 `shapeSolver.js`，但没有求解器同级的状态/形状/时间硬预算；较大的深度和操作集合可能快速扩大图规模。
- Explorer 对 Painter/Crystal Generator 固定只使用红色，因此它展示的是受限可达空间，而不是所有颜色组合的完整空间。
- README 声明项目使用 MIT 许可证，但仓库当前没有独立 `LICENSE` 文件；对外分发时建议补齐标准许可证文本。
- 仓库当前没有 `.gitignore`；虽然现有项目不产生依赖目录，后续加入工具链时应同步补充。

## 9. 总结

项目采用清晰的小型前端分层：领域常量和物理操作位于底层，求解与混色运行在 Worker，主线程负责输入、状态和任务编排，Canvas/Cytoscape/3D Force Graph 负责展示。最有价值的工程设计是有界状态收集、形状/吞吐 token 内部化、有限缓存和多重安全预算，它们共同控制组合搜索对浏览器内存和时间的压力。当前主要技术债集中在重复入口/重复 Worker 文件、浏览器侧测试覆盖不足，以及第三方 CDN 的运行时依赖。
