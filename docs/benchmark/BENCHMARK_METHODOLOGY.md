# Benchmark Construction Methodology

Version: 4 (Trusted artifact content and replay-backed causal structure)

## 1. Authority and acceptance boundary

正式验收不是 artifact 自证。`benchmarks/policy/official-policy.v1.json` 是 repository-side allowlist，固定支持的 artifact/instance/catalog/release schema version、release profile、suite/partition、target membership/count、人工 seed、catalog、official target sources/manifest、canonical semantics identity/file set，以及 profile 的 cleanPainting/Splitter/质量门槛。

`validate-benchmark.mjs` 使用 Ajv 2020-12 实际执行固定 schema，然后再做 forward replay 与交叉绑定。它会：

1. 核验人工 seed、catalog、target manifest、原始 `hard_main.txt`/`hard_side.txt`、canonical semantics 文件集合的内容 hash；
2. 从两个原始 target 文件重建 53 个 Hard identity/line/target hash，检查 manifest 完整且无增删；
3. 机械比较 generated catalog 的 ordinary/special/refinement 内容与人工 seed，不能只信 catalog provenance；
4. 以 repository profile 决定 suite、partition、完整 target IDs、每 target 数量与规则开关；
5. 要求每个 instance provenance 精确等于 policy 的 seed/catalog/target/semantics 绑定；
6. 从 available multiset 正向 replay canonical operations 到严格相等 target；
7. 重算 difficulty、input multiset、replay-backed causal fingerprint 与 canonical instance/artifact hash；
8. 校验 policy pin 住的 release manifest 及其全部文件、generation/rejection log binding；
9. 对实际传入 artifact 重算 `canonical-json-v1` 完整 content hash，并与 trusted manifest 比较；如有公开 projection，再从该 artifact 重建并精确比较 released `solver-inputs.json`。

unknown version、unknown release、任意 suite/partition、缺失 target membership、非官方 target、伪造 catalog/semantics metadata、与 seed 不同的 catalog 均拒绝。

## 2. Causal construction representation v3

旧 signature 是 `strategy label + operation-name sequence`，后继 v2 又把 prepared piece 压成 `final shape + source kind`；前者受 label/schedule 影响，后者会丢失 Crystal/Pin/Stack 等真实 ancestry。两者均不作为当前 authority。v3 从成功 replay 的 token provenance 重建 result causal graph：

- token ID 与 witness step 顺序不进入表示；
- 只追踪 result ancestry，无关 waste 不制造 family；
- Rotator 被消去，shape component 采用 rotation-invariant abstraction；
- replay 证明完整输入/输出 state 相同的 unary identity transform 被消去，覆盖 identity Cutter 及其任意 empty-effect chain；
- 单 lineage 的 Cut/Paint preparation chain 可折叠为 prepared component，但完整 source causal graph 保留；
- 无碰撞横向 union 的 Stacker 只有在反转 concrete operands 仍 replay 为相同 output 时，才进行 associative/commutative flatten + child sort；
- 精确纵向 layer concatenation 进行 associative flatten，保留 bottom-to-top 顺序；
- Swapper 仅在反转 concrete operands 仍合法并产生同一非空 output shape multiset 时，按 replayed operand state 与 canonical child ancestry 归一输入顺序；output declaration 的表面排列不进入 identity，shape-bound downstream dependency 仍保留；
- shared multi-output dependency、Pin Pusher、Crystal Generator、Swapper、以及一般 gravity/collision/overflow Stack 保留显式节点。

validator 不读取 artifact signature 作为 authority，而从 `availableInputs + witness + canonical replay trace` 独立重算 SHA-256 signature，并按同 target 首次出现的 signature 确定 representative；后续相同 signature 标为 structural-duplicate 并指向 representative。`construction.strategy` 仅为日志，不参与判断。DAG edge 自然保留 causal partial order；只有 concrete reverse replay 证明可交换的 sibling（包括上述 Swapper symmetry）才排序，Crystal、Pin、destructive Stack/Cut、overflow 等其余顺序均保留。

旧 25 Pilot 的输入和 witness 原样保存在 `pilot/v1`；repository-bound `pilot/v2` 仍保留相同输入/witness，但按 causal v3 重算 metadata/signature。保留不同 source ancestry 后，当前结果为每个 target 5 个 family、总计 25 families；这是待 independent re-audit 的新结论，不是 53×5 放行。

## 3. Multi-strategy generation architecture

`generation-framework.mjs` 提供统一 forward-only `WitnessBuilder`、全部 canonical operation adapter、live token/byproduct tracking、lossless Cutter spatial partition、shared occurrence pools、catalog chunk、disjoint composition 与 multi-stage stacking。`build-coverage-pilot.mjs` 在其上组合策略；任何候选仍以 replay 为最终可解证明。

已实现能力：

- catalog chunk：直接使用 partial/half component 并整体 paint/rotate，不拆成独立 atom；
- shared occurrence extraction：一次 Cutter 的多个输出继续进入 result，支持 byproduct/occurrence reuse；
- Pin subassembly：从真实 upper assembly 推出 Pin mask，再与 lower assembly 组合；
- Crystal scaffold extraction：先构造 blocker scaffold，生成 Crystal，再无损切出非 uniform Crystal column/component；
- multi-stage Stack/Cut 与 Swapper adapter；
- canonical legal Crystal breakage adapter（coverage pilot 不为凑覆盖强行使用）；
- refinement A/B/C/D 由 target 唯一分类和完整 availability bundle 驱动；
- ordinary full/partial/half、main/side、refinement exclusion 共享同一 catalog/rules layer。

明确未支持或未启用：

- Splitter：接口存在但 disabled，throughput success semantics 待决；
- arbitrary upper/isolated Pin planner：当前没有对官方 target 的一般性构造证明；
- general mixed Pin/Crystal gravity planner：canonical evidence gaps 尚未关闭；
- arbitrary non-uniform multi-color fused Crystal planner：本轮只验证 scaffold-extracted non-uniform occupancy，不宣称全覆盖；
- 完整 53×5：明确不在本轮生成。

unsupported 会写入 capability/candidate log，不会换成容易 target 后宣称覆盖。

## 3.1 Two-stage construction and environment expansion

`environment-expansion.mjs` 位于 construction strategy 之后，输入是任何已经通过 replay 的 core witness，因此不绑定 atom-by-atom、catalog chunk、Pin 或 Crystal 模板。流程固定为：

`solvable construction -> coreWitnessBasis -> versioned environment expansion -> complete replay`。

Additive plan 保留 core bridge 并添加 catalog-neighborhood inputs。Transformative plan 先用 canonical operation adapter 从 presented resources 机械生成被替换的 core token，再在明确边界后重放原 core witness。该 v1 adapter 当前只实现单输入 unary derivation chain；arbitrary replacement 和 general multi-input preprocessing planner 明确记录为 unsupported，而不是靠猜测接受。

Generator 另外导出 `solver-inputs.json`。这个 evaluation view 不包含 core basis、expansion bridge、source witness 或 construction metadata，避免 proof-side information 进入 Solver 搜索。

`maximumAddedOrdinaryMultiplicity=3` 采用与现有 Pilot 兼容的保守解释：它是 core-to-presented delta 中新增 ordinary occurrence 的**总数**。generator 和 validator 都从 catalog 分类后的 multiset delta 执行该 gate；它不是 per-shape 上限的别名。

Generator 不预测每个 presented input 的最终用途。`unusedAvailableInputCount` 等分析值由 replay 后的实际 token selection/lineage 派生。

## 4. cleanPainting, duplicate rows, and Splitter

replay 现在严格尊重 `cleanPainting`：true 才施加单层/未染色前置条件，false 直接采用 canonical Painter。正式 profile 由 policy 固定 true，artifact 无法自行关闭。

metadata 对 input rows 先按 shape 聚合，再计算 inputTypes/inputMultiplicity/maxMultiplicity，消除了重复 row 覆盖。正式 artifact schema 之外还有 validator 的 unique-shape-row gate：重复 row 必须先 consolidate，避免两种表示同一 multiset。

Splitter 正式禁用。旧 4096→2048 假设已从 replay acceptance 与规则文档移除；2048/4096 怎样计入 throughput success 是公开待决项。

## 5. Release and traceability

`benchmarks/releases/*.release.json` 绑定：

- USER_RULES / BENCHMARK_RULES；
- input seed / generated catalog；
- official target manifest + raw source files；
- canonical semantics doc + implementation files；
- executed schemas；
- generator/framework version and files；
- validator/version/files；
- repository instance artifact、其 `canonical-json-v1` 完整 content identity、embedded witnesses；
- 如存在，公开 `solver-inputs.json` projection 的 canonical identity；
- generation/audit log 与 rejected/unsupported subset。

Artifact release identity 与 manifest revision identity 是两层不可变 identity。artifact 内的 `releaseId` 是 benchmark content identity；manifest v2 的 `artifactReleaseId` 必须与其相等。`manifestRevisionId` 则标识一次独立的 trusted binding declaration，policy 通过该 ID 和 manifest hash 选择 current revision。同一 immutable artifact 可以因 trusted documentation/source correction 获得新的 manifest revision，而不重写 artifact；每个 manifest revision 自身仍不可覆盖。修改正式实例仍必须创建新的 artifact release ID/目录；仅更新 trust declaration 必须创建新的 manifest revision ID，并保留 predecessor 与旧 manifest。

policy 进一步 pin release-manifest hash。正式 validation 对调用方实际提供的 artifact 比较完整 canonical content identity，self-declared `sha256` 只是一致性字段而非信任根；内容相同的复制件可位于任意路径并使用不同 JSON 空白/key order。`validateRelease=false` 明确只提供 development/adversarial validation，不产生 release acceptance。

Hard 53×3 使用独立的 composite manifest v4，而不改变上述普通 artifact release v1/v2 或 benchmark artifact/instance v2/v3 的语义。Composite release 只声明 frozen selection membership：source registry 以完整 canonical content identity 绑定六个 immutable sources，159 个 member reference 绑定 source instance、target、slot、family、structural signature 与 frozen selection entry。Validator 从引用解析原始 instance，并沿用 canonical replay、environment expansion 与 causal fingerprint 路径；它不会复制 instance 或发明新的 provenance。`benchmarks/policy/composite-releases.v1.json` 固定 composite canonical identity，final-selection binding 固定 `6e3efdece360e8dd338a49dd3edd8fe10620b288aa161d35a8d01ab966e1b47f`。对象 key 顺序与 JSON 空白不参与 identity，member 数组顺序与语义内容参与 identity。

## 6. Reproduction

```text
node benchmarks/tools/audit-pilot.mjs
node benchmarks/tools/build-coverage-pilot.mjs
node benchmarks/tools/build-expansion-pilot.mjs
node benchmarks/tools/validate-benchmark.mjs --release hard-pilot-audit-v2-manifest-r2
node benchmarks/tools/validate-benchmark.mjs --release hard-coverage-pilot-v1-manifest-r2
node benchmarks/tools/validate-benchmark.mjs --release hard-expansion-pilot-v1-manifest-r2
node benchmarks/tools/validate-benchmark.mjs --release hard-53x1-stage-v1-manifest-r2
node benchmarks/tools/validate-composite-release.mjs
node --test tests/benchmark.test.mjs
node --test tests/compositeRelease.test.mjs
```

这些命令不导入或运行 Solver search，也不依据 solve rate 接受、拒绝或排名 candidate。
