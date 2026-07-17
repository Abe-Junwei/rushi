# 调研：媒体基准目录外部改动的恢复路径（重连 / Relink）— 薄片 4

> **状态**：已采纳（2026-07-17 用户「直接做」签收）· Tier 1 已实现
> **关联路线图**：媒体基准目录系列（薄片 1～3 已落地）
> **关联 spec**：[`user-library-location-sync-research.md`](./user-library-location-sync-research.md)（§4.1/4.2 已决策的搬迁 + symlink + 网盘占位）· [`user-library-location-slice4-relink-intent.md`](./user-library-location-slice4-relink-intent.md) · [`user-library-location-slice4-relink-acceptance.md`](./user-library-location-slice4-relink-acceptance.md)
> **门禁**：未完成本文 **不得** 进入 Plan 定稿与业务编码（见 [`AGENTS.md`](../../../AGENTS.md) · [`.cursor/rules/feature-research-gate.mdc`](../../../.cursor/rules/feature-research-gate.mdc)）

---

## 0. 背景（为什么现在补这片）

薄片 2/3 已经处理了「**App 内点击搬迁**」这一条路径（搬迁进行中/失败/网盘占位/受控 symlink），但没有覆盖「**用户在 App 外部改动了媒体基准目录**」这一整类场景：手动删除、手动移动、往目录里塞无关文件。手测发现：

- 自定义媒体基准目录被删除或移动后，**「恢复默认」按钮会被永久禁用**，「选择新目录」也会因为要求先从已经不存在的旧目录读文件而必然失败 —— 用户在 UI 层面无路可走，只能手动删 `prefs/media_base_dir.txt` 才能脱困。
- 目录顶层的杂项文件不受影响（被忽略）；但塞进 `projects/{id}/` 内部的杂项文件，会在下次搬迁时被目录级「兜底扫尾」逻辑意外裹带走。

本片只解决「目录整体不可用后的恢复」这一类问题；网盘占位、受控 symlink、搬迁本身的失败处理沿用薄片 2/3 已有结论，不重复调研。

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 用户在 Finder/Explorer 里删除、重命名或搬移了媒体基准目录（或整个目录所在的网盘/外置盘掉线），回到 Rushi 后想要「换回默认」或「指向新位置」，但两个按钮都失效。 |
| 本仓现状 | `resolve_media_base`（[`media_base_dir.rs:76`](../../../apps/desktop/src-tauri/src/media_base_dir.rs)）在 pref 指向的目录不是 dir 时直接 `Err`；`get_media_base_dir_info`（[`media_base_dir.rs:290`](../../../apps/desktop/src-tauri/src/media_base_dir.rs) `resolve_media_base(st)?`）无兜底，整命令失败 → 前端 `info` 永远停在 `null` → 「恢复默认」按钮 `disabled={!info?.isCustom}` 恒为真。`relocate_all_to`（[`media_base_relocate.rs:248`](../../../apps/desktop/src-tauri/src/media_base_relocate.rs) `let src_base = resolve_media_base(st)?;`）第一行就要求**旧目录本身可解析**，否则直接拒绝——即使用户已经把文件搬到了新指向的位置。 |
| 成功标准（调研层） | (1) 明确「目录整体不可达」时的恢复语义（不是搬迁，是**重连/relink**）；(2) 业内 ≥2 条成熟路线对照，判断该走「结构化重连」还是「按文件名深度搜索重连」，或两者分层；(3) 与薄片 2/3 已决策的搬迁/symlink/占位逻辑不冲突，不引入第二套「路径解析」真源；(4) 明确「不做什么」，避免把 relink 做成过度设计。 |

---

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表实现 / 产品 | 核心机制 | 链接 |
|---|------|-----------------|----------|------|
| A（**选定，Tier 1**） | 结构化重连（父目录重指） | **Adobe Lightroom Classic** `Find Missing Folder` / `Update Folder Location`；DaVinci Resolve `Change Source Folder` | 假定内部相对结构未变，只需把「基准/父目录」重新指向新位置；点一次父目录，整棵子树（按相同相对路径）一次性恢复，**不搬文件、不碰数据库内容**，只重写指针 | [Lightroom Find Missing Folder](https://www.lightroomqueen.com/lightroom-photos-missing-fix/)、[Resolve Change Source Folder](https://www.steakunderwater.com/VFXPedia/__man/Resolve18-6/DaVinciResolve18_Manual_files/part533.htm) |
| B（**选定，Tier 2 兜底**） | 按文件名深度搜索重连 | **Zotero** Linked Attachment Base Directory 自动侦测（改 LABD 后按文件名在新基准下搜索并逐一提示重连）；DaVinci Resolve `Relink Selected Clips`（在指定目录下按文件名递归搜索匹配） | 结构不保证 1:1 保留时，在用户指定的搜索根下按**文件名**（Resolve 还加时间码）匹配候选，逐条或批量确认后回写路径；不要求源目录仍存在 | [Zotero 自动重连讨论](https://forums.zotero.org/discussion/126137/fixing-batches-of-broken-attachment-links-identifying-broken-paths-across-the-system)、[Resolve Relink Selected Clips](https://www.steakunderwater.com/VFXPedia/__man/Resolve18-6/DaVinciResolve18_Manual_files/part532.htm) |
| C（参考，不选） | 静默按需重新下载/hydrate | 云盘客户端（OneDrive/iCloud）目录整体缺失时提示「重新登录/重新挂载」，不做应用层 relink | 不适用：Rushi 的媒体基准是本地路径引用，云盘只是其中一种可能落点，本片要解决的是「路径层」问题，不是「同步层」问题 | — |

**关键共识（三方一致，与本仓现状形成对照）**：

1. **没有一款产品要求「旧路径仍然可解析」才能完成重连**——这正是 Rushi 当前 `relocate_all_to` 强制 `resolve_media_base(st)?` 在最前面的设计缺陷：把「正常搬迁」和「灾后重连」两种语义混在同一段代码里，用同一套前置校验。
2. 都区分「结构保留（重指针，秒级、零 IO）」与「结构被打散（按文件名搜索，耗时、需用户确认）」两档，**不会**用同一套逻辑处理。
3. 都在 UI 上用**明确的「离线/缺失」状态**（灰色问号图标 / offline 橙色标）主动提示，而不是等用户点开播放才报错——这点 Rushi 目前完全没有（见 §3 冲突点）。

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用的部分 | 与 Rushi 约束冲突 | 进度 / 内存 / UX |
|------|--------|----------------|-------------------|------------------|
| A 结构化重连 | **高** | `audio_project_dir`、`persist_audio_storage_path`（相对化逻辑已有）；只需新增一条「不搬文件、只验证 + 重指针」的命令路径，复用现有 `resolve_audio_path` 的 scoped 校验 | 需要新写一个不经过 `relocate_all_to` 的轻量校验函数（现有函数耦合了「搬」这个动作） | 秒级，无文件 IO；只需按 `files.audio_path` 中的相对段逐一 `is_file()` 探测新根下是否存在 |
| B 文件名深度搜索 | 中 | `list_audio_rows`（已有，按文件名匹配可直接复用行数据） | 需新增「按 basename 在候选目录树下 `walkdir` 搜索」的一次性命令；比 A 复杂，且需要用户逐条确认（避免误配对同名不同内容的文件） | 取决于目录规模；应做成用户主动触发、有取消入口的一次性诊断动作，不常驻 |
| C 静默重新下载 | 低（不选） | 无 | 与 ADR-0008「scoped resolve、不做静默 hydrate」的既有边界一致（薄片 3 已决策：网盘占位不自动 hydrate），本片沿用同一立场 | — |

**本仓已有可复用模块**（先列再决定扩展，不新造第二套路径真源）：

- [`resolve_media_base`](../../../apps/desktop/src-tauri/src/media_base_dir.rs) / [`resolve_audio_path`](../../../apps/desktop/src-tauri/src/media_base_dir.rs)（scoped 校验骨架不变，本片只加一条「探测新根是否结构吻合」的只读命令，不改校验规则本身）
- [`list_audio_rows`](../../../apps/desktop/src-tauri/src/media_base_relocate.rs)（DB 侧文件清单，纯查询，不受目录缺失影响，Tier 1/2 都能直接用）
- [`write_media_base_pref`](../../../apps/desktop/src-tauri/src/media_base_dir.rs)（重指针落盘，已有）
- 薄片 3 的网盘占位错误文案模式（`CLOUD_PLACEHOLDER_HINT`）——「缺失」态的用户可读文案范式可直接照搬到 relink 场景

**冲突点清单**：

- `get_media_base_dir_info` 当前**无兜底**，源目录不可达时整体 `Err`，导致前端 `info` 永久 `null`、「恢复默认」按钮永久禁用——这是本片必须打破的第一个硬冲突。
- `relocate_all_to` 把「校验源可达」与「执行搬迁」耦合在同一函数入口，本片新增的 Tier 1/2 重连命令必须是**独立命令**，不能复用 `relocate_all_to`（否则又会被同一条前置校验卡死）。
- 目前项目列表/编辑器完全没有「媒体缺失」的主动提示（只有打开/播放时才报错）——业内三方案共识都做了主动提示；本片是否补这一块，见 §4「不做什么」。

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| 选定方案 | **A + B 分层**：Tier 1「结构化重连」优先（父目录重指 + 按相对路径逐一探测，零 IO、秒级）；Tier 1 探测到部分/全部文件在新根下按原相对结构找不到时，才提示走 Tier 2「按文件名搜索重连」（用户主动触发，逐条确认）。 |
| 恢复默认 / 选新目录为何要拆开处理 | 「恢复默认」= 目标固定是 app_data 根，**且 app_data 根本身不会丢**（它不是用户可移动的自定义目录），所以恢复默认永远应该可点——即便当前自定义媒体基准已经彻底不可达，恢复默认也只需要「重指针到 app_data 根」这一步，不需要先解析旧目录。「选新目录」在旧目录不可达时，先跑 Tier 1 探测新目录是否结构吻合，吻合则直接重指针（零搬迁）；不吻合则提示用户改走「搬迁」（旧目录若后来又重新可达）或 Tier 2 搜索。 |
| `get_media_base_dir_info` 是否要因源不可达而整体失败 | **不应该**。改为返回 `isCustom: true` + 新增 `unavailable: bool` 字段，前端据此让「恢复默认」保持可点，且提示「已配置目录不可达，可恢复默认或重新连接」。 |
| 是否新增「媒体缺失」主动提示（项目列表级） | **本片不做**（见下「不做什么」），留给未来薄片；本片只解决「基准目录整体不可达时的重连入口」，不做单个文件缺失的列表级 badge。 |
| 与 ADR / 既有决策关系 | 不新增 ADR；延续薄片 3 「不自动 hydrate、scoped resolve 不放宽」的立场；不改 `resolve_audio_path` 的校验规则，只新增两条**只读探测 + 重指针**命令。 |
| 风险与 spike 项 | (1) Tier 1 探测的「结构吻合」判定粒度——按 `files.audio_path` 相对段逐一 `is_file()`，允许部分命中（不要求 100%才能重指针，未命中的落回缺失态，可再跑 Tier 2）；(2) Tier 2 的「同名不同文件」误配对风险——必须让用户逐条确认，不做全自动批量重连；(3) peaks 目录同理需要一并探测（结构固定为 `{base}/projects/{id}/peaks/`，可复用现成路径函数）。 |

---

## 5. 明确不做什么

- **不**做项目列表/编辑器级的「媒体缺失」主动 badge 提示（业内都有，但属于新的能力—UI 状态维度，需要单独走一轮"能力—UI 状态对齐"设计，超出本片"打通恢复入口"的范围）。
- **不**做 Tier 2 的全自动批量重连（不逐条确认直接回写）——同名误配对的数据风险不可接受。
- **不**放宽 `resolve_audio_path` 现有的 scoped 校验规则（app_data / 媒体基准 / relocate-allow 三选一），Tier 1/2 重连后写回的路径仍必须落在这三个根之一。
- **不**新增「自动检测外置盘插拔/网盘重新上线后自动重连」这类后台监控——重连仍是用户主动触发的一次性动作，不做常驻 watcher。
- **不**碰搬迁本身（`relocate_all_to`）的现有失败处理逻辑，Tier 1/2 是与搬迁并列的新命令，不改造搬迁流程。

---

## 6. 落位预告（非最终实现）

| 层 | 文件 / 模块 | 变更类型 |
|----|-------------|----------|
| Rust | `media_base_dir.rs`：`get_media_base_dir_info` 增加 `unavailable` 字段，源不可达时不再整体 `Err` | 修改 |
| Rust | 新建 `media_base_relink.rs`（或并入 `media_base_relocate.rs`，视体量决定是否拆文件——当前 `media_base_relocate.rs` 已 765 行，接近架构守卫阈值，倾向新文件）：`probe_structural_relink`（Tier 1，只读探测 + 命中则重指针）、`search_relink_candidates` + `commit_relink_selection`（Tier 2，按文件名搜索 + 逐条确认回写） | 新增 |
| UI | `EnvLibraryLocationSection.tsx`：源不可达时「恢复默认」保持可点；新增「重新连接…」入口触发 Tier 1，Tier 1 未完全命中时引导到 Tier 2 一次性对话框（列出未命中文件 + 逐条选择候选） | 修改 + 新增 |
| API | `projectAsrMaintenanceApi.ts`：对应新命令的 TS 绑定 | 新增 |
| 文档 | [`desktop-project-file-lifecycle.md`](../../architecture/desktop-project-file-lifecycle.md) 补「目录整体不可达 → 重连」一节 | 更新 |
| 测试 | Rust 单测：Tier 1 全命中/部分命中/零命中；Tier 2 文件名匹配 + 多候选歧义；`get_media_base_dir_info` 源不可达时仍返回可用信息 | 新增 |

---

## 7. 签收

- [x] 调研 brief 完成
- [x] intent / plan / acceptance 已链接本文
- [x] 用户确认可进入编码（「直接做」）

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-07-17 | 初版：业内对照 Lightroom / Zotero / DaVinci Resolve 三方重连模式，选定「结构化重指针（Tier 1）+ 文件名搜索兜底（Tier 2）」分层方案 |
| 2026-07-17 | Tier 1 已实现（`media_base_relink.rs` + `get_media_base_dir_info`/`resolve_audio_path` 容错）；用户决定 **Tier 2 不做**（按文件名深度搜索的批量重连向导），本片到此收尾 |
