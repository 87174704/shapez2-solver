# 统一术语与翻译来源

本轮新增语言为 **AI 辅助初译，尚未经过母语审校**。自动化验收证明覆盖、参数与运行行为，不等同于语言专业审校。所有新增语言、繁体中文及新增的中英文错误/无障碍文案都适用此说明。

英文及简体中文已有 163 个 Key 原样复用，包括英文原有单复数函数；新增语言计数文案采用“数量标签：数值”的形式，避免把英语的单复数规则套到其他语言。简体中文既有 Magenta“紫”保留以避免无故修改；繁体及其他新语言用明确的洋红/对应色名。

语义来源：维护分支 RC `465e66a00613a301fd3fb106af1fce927d6efc61` 的操作 ID、原中英文语言包、`shapeConstants.js`、`shapeOperations.js`。英文建筑含义交叉核对 [Shapez 2 官方 Wiki 的 Pin Pusher](https://shapez2.wiki.gg/wiki/Pin_Pusher)、[Crystal Generator](https://shapez2.wiki.gg/wiki/Crystal_Generator) 和 [Shapes](https://shapez2.wiki.gg/wiki/Shapes)，检索日期 2026-10-31。Wiki 用于核对英文概念；**未取得可靠的各语言官方字符串表，以下新译名均为本项目统一译法，不声称是游戏官方译名**。

| Locale | Cutter | Swapper | Stacker | Painter | Pin Pusher | Crystal Generator |
|---|---|---|---|---|---|---|
| zh-CN（既有） | 分割 | 交换 | 堆垛 | 染色 | 顶针 | 晶体生成 |
| zh-TW | 切割器 | 交換器 | 堆疊器 | 染色器 | 針腳推入器 | 晶體生成器 |
| en（既有） | Cutter | Swapper | Stacker | Painter | Pin Pusher | Crystal Generator |
| ja | カッター | 交換機 | 積み重ね機 | 塗装機 | ピン押し込み機 | 結晶生成機 |
| ko | 절단기 | 교환기 | 적층기 | 도색기 | 핀 밀어넣기 장치 | 결정 생성기 |
| fr | Découpeur | Échangeur | Empileur | Peintre | Pousseur de broches | Générateur de cristaux |
| de | Schneider | Tauscher | Stapler | Färber | Stiftschieber | Kristallgenerator |
| es-ES | Cortador | Intercambiador | Apilador | Pintor | Insertador de pines | Generador de cristales |
| pt-BR | Cortador | Trocador | Empilhador | Pintor | Inseridor de pinos | Gerador de cristais |
| ru | Резак | Обменник | Укладчик | Краситель | Вставщик штифтов | Генератор кристаллов |
| pl | Przecinarka | Wymiennik | Układarka | Malarka | Wciskarka kołków | Generator kryształów |
| tr | Kesici | Değiştirici | İstifleyici | Boyayıcı | Pim itici | Kristal üretici |
| th | เครื่องตัด | เครื่องสลับ | เครื่องซ้อน | เครื่องทาสี | เครื่องดันหมุด | เครื่องสร้างผลึก |

完整术语表（含旋转、半形销毁、颜色、层、部件、搜索剪枝）由 `tools/i18n/audit.mjs` 从实际语言包生成，见 `docs/release1/i18n/GLOSSARY.csv`。这样语言包和交付术语不会产生另一套手写分叉。

语义约定与不确定性：

- Half Destroyer 删除一半，Cutter 保留两半；新译名必须区分。Swapper 交换半形，Splitter 是求解器操作名，不能暗示实际资源可无代价复制。
- Pin 是无色支撑部件，不译成颜色；Crystal 是晶体/结晶，与 Pin 分开。新的日韩译名及德国 Half Destroyer 说明性译法须优先交母语玩家复核。
- 深度、状态、beam 剪枝属于求解器术语，不保证对应游戏菜单；“未找到”与“证明不存在”必须区分。beam 剪枝后不宣称无解。
- Shape Code、操作 ID、颜色 token（R/G/B 等）、RGB/RYB/CMYK、产品名、JSON 字段、Worker 协议以及异常中的外部诊断数据保持原值。面向用户的错误说明、上下文和验证错误已翻译；意外异常的 `message` 参数保留原诊断文本，不能把未知错误伪译成另一种含义。这是显式记录的诊断边界，不属于语言包缺 Key。
- 所有语言使用同一 `{{parameter}}` 插值与英语 fallback。无在线翻译请求。不存在地区检测或 China/Global 的语言行为分支。

默认语言优先级在所有入口相同：有效旧/新已存偏好 → `navigator.languages` 中首个支持项 → 英语。路径是选定语言的可刷新地址，不覆盖上述优先级。`cn` 存储迁移为 `zh-CN`；`/cn/` 旧入口继续可访问。中文 Hans/Hant 脚本优先于区域；HK/MO/TW 映射繁体，其他中文映射简体；西语区域映射 `es-ES`，葡语区域映射 `pt-BR`，其他语言忽略区域。

后续审校应直接修改同一语言文件并运行 Key/参数及双 Profile 验证；不能按站点创建翻译分支。
