# Benchmark Source Data

本目录保存由项目所有者直接提供的 Benchmark 原始资料。

这些文件属于 benchmark construction 的人工源数据，不应被 Solver Optimization Agent 自动修改。

当前主要来源：

- `input_catalog.seed.json`
  - 游戏中允许出现的普通输入 shape；
  - 被排除的 shape；
  - 特殊输入；
  - refinement groups 及规定 multiplicity。

官方 Hard / Insane target 文件保留在现有 `benchmarks/` 目录中。

正式的：

- `benchmarks/input_catalog.json`
- benchmark instance manifests
- witness
- difficulty metadata

应由 Benchmark Builder 根据这里的人工源数据和：

`docs/benchmark/USER_RULES.md`

生成并验证。

如果机器生成规则与 `USER_RULES.md` 或本目录人工源数据发生冲突，应停止并报告歧义，而不是自行猜测。