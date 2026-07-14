# 调研：语段冻结（Freeze · 保留分段/正文 · 播放跳过 · 不可编辑 · 可解冻）

> **状态**：已采纳（用户确认 §6 · 2026-07-14）  
> **关联路线图**：编辑工作台 · 纵向薄片（待挂 [`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md)）  
> **关联 spec**：[`segment-freeze-intent.md`](./segment-freeze-intent.md) · [`segment-freeze-plan.md`](./segment-freeze-plan.md) · [`segment-freeze-acceptance.md`](./segment-freeze-acceptance.md)  
> **正交能力**：[`segment-edit-stage-indicator-research.md`](./segment-edit-stage-indicator-research.md)（定稿阶段）· [`segment-annotation-research.md`](./segment-annotation-research.md)（备注）· [`global-vs-segment-playback-ux-research.md`](./global-vs-segment-playback-ux-research.md)（全局/语段双入口）  
> **门禁**：未完成本文签收 **不得** 进入 Plan 定稿与业务编码（见 [`AGENTS.md`](../../../AGENTS.md) · `.cursor/rules/feature-research-gate.mdc`）

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | 口述史 / 听打审校时，部分语段（闲聊、录音噪声、暂不处理段落）仍需 **保留分段边界与正文** 以便日后对照；听通读时应 **跳过这些时间**；正文应 **不可误改**；确认需要后再 **解冻** 恢复正常编辑与播放。 |
| **本仓现状** | **数据**：[`SegmentDto`](../../../apps/desktop/src/tauri/projectTypes.ts) 已有 `kind` / `text_stage` / `annotation` / `detail`；**无** 冻结/跳过播放字段。SQLite `segments` 与 `file_save_segments` 同构持久化。<br>**播放**：全局 `togglePlay` 从 playhead **连续播至 EOF**（[`useWaveformPlayback`](../../../apps/desktop/src/hooks/useWaveformPlayback.ts)）；语段 scoped 用 [`segmentPlaybackBound`](../../../apps/desktop/src/utils/segmentPlaybackBound.ts) 在段尾停/loop（[`useWaveformSegmentPlaybackBoundSync`](../../../apps/desktop/src/hooks/useWaveformSegmentPlaybackBoundSync.ts)）。**无**「时间区间跳过」管道。<br>**编辑**：CM6 一行一段；[`transcriptLineCountGuard`](../../../apps/desktop/src/components/editor/core/transcriptEditorKeymap.ts) 禁用户改行数；**无** 按行只读 filter。`text_stage=finalized` 仍可改字（定稿 ≠ 锁稿）。<br>**近邻概念**：`kind=placeholder` 为 ASR 整轨占位（波形不画），**不是**用户冻结；`annotation` 是备注，**不**驱动播放。 |
| **成功标准** | （1）右键/快捷键冻结选中语段 → 正文仍在、分段时间不变；（2）全局通读进入冻结区间时 **seek 跳到区间结束**（可听测连续跳过）；（3）冻结行 **无法改字**（结构合并/拆分默认拒绝，须先解冻）；（4）解冻后编辑/播放恢复；（5）重开文件 / 自动保存后状态仍在；（6）`typecheck` + 定向单测 + architecture guard 通过。 |

### 1.1 与现有概念边界

| 概念 | 关系 |
|------|------|
| `text_stage` / 定稿 | **编辑阶段**；与冻结 **正交**。已定稿语段仍可冻结；冻结不自动改 stage。 |
| `annotation` | **自由备注**；不表达播放/编辑策略。 |
| `kind=placeholder` | **ASR 占位**；禁止复用为用户冻结。 |
| `detail` | **引擎元数据**；禁止写入冻结标志。 |
| Descript Delete | **从构图移除媒体** — Rushi **不做**（口述史音频文件为归档真源，冻结不得裁切/删除媒体）。 |
| 列表 Filter | 可后做「仅看冻结」；v1 **不做** 独立筛选，仅视觉区分。 |

---

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表实现 / 产品 | 核心机制 | 链接或路径 |
|---|------|-----------------|----------|------------|
| **A** | **文稿 Ignore / Strike（跳过播放 · 保留可见正文）** | [Descript Ignore](https://help.descript.com/hc/en-us/articles/10164872017933-Deleting-vs-ignoring-script-text) · [Trint Strike](https://info.trint.com/knowledge/strike-trint-help-center) | 选区删除式快捷键或工具栏 → **删除线**；正文仍可见；**播放跳过**；可 Restore / un-strike。Descript：Ignore 可进转写导出，但不进字幕/成片媒体。Trint：强调保留 timecode、避免删字破坏时间码。 | Descript Help · Trint Knowledge |
| **B** | **时间线 Mute / Disable clip（静音或禁用 · 时间仍流逝）** | [Pro Tools Mute Clip](https://www.avid.com/pro-tools/user-guide/mute-clip) · [Premiere Enable/Disable Clip](https://helpx.adobe.com/au/premiere/desktop/edit-projects/change-clip-sequence/enable-or-disable-a-clip.html) · Reaper Item Mute | 夹子变暗；**不删媒体**；Mute=静音但时钟前进；Disable=预览/导出不出现。偏 NLE/DAW，**通常不锁转写正文**。 | Avid UG · Adobe Help · Reaper forum |
| **C** | **CAT 段锁 / 状态锁** | memoQ Locked · LILT segment state | 段级 **锁定禁止编辑**；与「播放跳过」常分离；偏翻译网格。 | LILT segment state indicators |
| **D** | **口述史分层（参考，非直接 UX）** | ELAN tiers | 注释与转写分层；无「冻结=跳过听审」一等公民，但「保留层、不进交付」原则可借鉴。 | MPI ELAN |

### 2.1 与 Rushi 诉求对照

| 维度 | Rushi 目标 | A Ignore/Strike | B Mute/Disable | C CAT Lock |
|------|------------|-----------------|----------------|------------|
| 保留分段+正文 | ✅ | ✅ | 媒体夹子 ✅；转写常无关 | ✅ 锁正文 |
| 播放跳过（时间跳） | ✅「跳过」 | ✅ seek/skip composition | ❌ 多为静音/禁用，时钟仍走 | ❌ |
| 不可编辑 | ✅ | 弱（可 restore，非强锁） | ❌ | ✅ |
| 可逆 | ✅ | ✅ | ✅ | ✅ |
| 不改音频文件 | ✅ 口述史硬约束 | Descript 改 composition，非源文件；语义需转译 | ✅ | n/a |
| 粒度 | **整段**（一行一段） | 常为 **选区/词级** | 夹子级 | 段级 |

**产品结论**：交互语义对齐 **A（跳过播放 + 删除线可见）** + **C（强只读）**；实现上 **不** 走 Descript「改 composition 时间线」，因 Rushi 媒体是整轨文件 + 语段时间窗。播放跳过 = 在全局 transport 上对冻结时间窗做 **seek-jump**（对标 Strike/Ignore 的听感），而非 Mute（静音但时间仍流逝——与用户「跳过」不符）。

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用的部分 | 与 Rushi 约束冲突 | 进度 / 内存 / 运维 |
|------|--------|----------------|-------------------|---------------------|
| **A Descript/Trint** | **高（产品）/ 中（实现）** | 删除线 + 播放跳过 + 可恢复；右键/快捷键入口 | ❌ 不可做「删媒体构图」；粒度用 **整段** 而非词级 v1 | 本地 SQLite 一列；无云 |
| **B NLE Mute** | **中** | 波形变暗视觉；非破坏 | ❌ 静音≠跳过；勿引入第二套 timeline composition | — |
| **C CAT Lock** | **高（编辑锁）** | 段级只读、须显式解锁 | 无播放跳过，须与 A 合并 | — |
| **D ELAN** | **低** | 「分层不丢信息」原则 | 独立 tier UI 过重 | — |

**本仓已有可复用模块**（必须扩展，禁止平行真源）：

| 模块 | 路径 | 复用于冻结 |
|------|------|------------|
| 语段 DTO / 持久化 | `projectTypes.ts` · `segment_cmd.rs` · `file_cmd.rs` | 新增 `frozen` 列（或等价），走现有 upsert |
| 脏检查 | `segmentsEqualForPersist` / `segmentFingerprint` | 纳入 `frozen` |
| 右键菜单 | `segmentTextContextMenuModel.ts` · `EditorView` 路由 | `freeze` / `unfreeze` |
| 阶段徽标列 | `SegmentRowStageBadge` / CM meta gutter | 并列锁/雪花图标；**不加第三层 border** |
| CM 守卫范式 | `transcriptLineCountGuard`（`transactionFilter`） | 冻结行 `changeFilter` / 按行拒绝 doc 变更 |
| Meta 字段 | `segmentMetaField` | 扩展 `frozen: boolean`，结构命令同步 |
| 语段播边界 | `segmentPlaybackBound` + `enforceSegmentPlaybackBound` | **仿造** `enforceFrozenPlaybackSkip`：全局播帧检测进入冻结窗 → `dispatchTransportIntent` seek 到窗尾 |
| Transport Authority | `dispatchTransportIntent` / `useWaveformPlayback.seek` | 跳过必须走现有 seek，禁止直调 media |
| 合并/拆分 | `mergeTwoSegments` / `buildSplitPair` | v1：**任一冻结则拒绝结构变更**（或要求先解冻） |
| 标注/阶段继承 | `mergeSegmentAnnotations` / `mergeSegmentStageFields` | 冻结为独立布尔；解冻前不合并 |

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| **选定方案** | **整段布尔 `frozen`（用户冻结）**：保留 `start/end/text`；UI 删除线/变暗 + 锁标；**全局通读**遇冻结窗 **seek 跳到 `end_sec`（合并相邻冻结窗）**；**正文与结构编辑默认禁止**；解冻后恢复。与 `text_stage` / `annotation` 正交。 |
| **产品名** | UI 文案用「冻结 / 解冻」（口语史友好）；英文域字段 `frozen`；内部注释可对照 Descript Ignore / Trint Strike，避免与 WKWebView「media freeze」混淆。 |
| **不做什么（v1）** | ❌ 词级/选区级 Ignore；❌ 裁切、删除或重写音频文件；❌ Mute（静音但时钟前进）当默认；❌ 复用 `kind`/`detail`/`text_stage`；❌ 冻结=定稿；❌ 第二套播放引擎；❌ 导出「可选包含冻结」开关（v1 固定排除）；❌ 协作锁 / 他人权限。 |
| **语段 scoped 播放** | **允许**浮层试听冻结段（含 loop）；仅全局 Space/主钮通读跳过。 |
| **导出** | **排除冻结语段**（DOCX / SRT / 文本等交付导出默认不含 `frozen` 行；存档 bundle 仍保留字段以便重开）。 |
| **快捷键** | v1 **要**：冻结/解冻 toggle（具体绑定见 plan · shortcut registry）。 |
| **视觉** | 冻结语段用 **斜纹（diagonal hatch）** 提示：文本行底/侧与波形色带一致语言；可辅删除线，斜纹为必达。 |
| **与 ADR / architecture** | 对齐 `desktop-waveform-engine.md` Transport Authority；扩展 SegmentDto 单真源；CM meta 与投影一致。能力—UI 矩阵见 §4.2。 |
| **风险与 spike** | **RISK-01** 连续冻结窗 seek 抖动 / 与 center-follow 抢滚 — 合并窗 + 单次 seek；**RISK-02** CM 只读与 IME/粘贴 — `transactionFilter` 测中日输入；**RISK-03** 找替换/LLM 写回误改冻结行 — 写路径统一 `assertNotFrozen`；**Spike（≤0.5d，可选）** 仅全局播帧 hook 原型，标注 `spike/`，不可当终态。 |

### 4.1 数据模型

```text
SegmentDto.frozen?: boolean   // 缺省 / null / false = 未冻结
SQLite: segments.frozen INTEGER NOT NULL DEFAULT 0
```

- 旧库：迁移 `ADD COLUMN frozen INTEGER NOT NULL DEFAULT 0`
- 重转写整文件替换：新语段默认 `frozen=false`（不保留旧冻结，与 stage 重置策略一致；若需保留须另议，v1 **不**保留）
- LLM / 后处理写回：默认 **跳过** `frozen=true` 的 uid（文档化）

### 4.2 能力—UI 状态矩阵

| 能力 | UI / 快捷键 | 行为 |
|------|-------------|------|
| 冻结 | 右键「冻结」；可选 ⌘⇧F（plan 定） | `frozen=true`；删除线；锁标 |
| 解冻 | 右键「解冻」；同快捷键 toggle | `frozen=false` |
| 全局通读 | Space / 主钮 | 进入冻结 `[start,end)` → seek `end`（相邻合并） |
| 语段试听 | 浮层 play | **可播**冻结段（不跳过） |
| 编辑正文 | CM 打字/粘贴 | 冻结行拒绝变更 |
| 合并/拆分/删除 | 结构命令 | v1 涉及冻结段 → no-op + toast「先解冻」 |
| 定稿 / 标注 | 现有入口 | 允许（备注可读；定稿正交）；改字仍被锁 |
| 冻结视觉 | 文本行 + 波形色带 | **斜纹 hatch**（必达）；可选辅删除线 |
| 快捷键 | shortcut registry toggle | 冻结 ↔ 解冻 |
| 导出 DOCX/SRT | 现有导出 | **排除** `frozen` 语段 |

### 4.3 播放跳过算法（预告）

```text
onPlaybackFrame(t):
  if segmentBound active → 既有段尾逻辑（优先）
  else:
    window = coalesceFrozenRanges(segments).find(r => t >= r.start && t < r.end - ε)
    if window → seek(window.end) via Transport Authority
```

- 播放头 **落在冻结窗内启动** 全局播：先 seek 到窗尾再 play，或 play 后首帧跳过（plan 定一种，acceptance 锁）
- 用户 **主动 seek 进冻结窗**：允许停针；仅在 **isPlaying** 时跳过（避免无法点进冻结段看波形）

### 4.4 合并 / 拆分（v1）

| 操作 | 规则 |
|------|------|
| 合并 | 任一端 `frozen` → **拒绝** |
| 拆分 | 源段 `frozen` → **拒绝** |
| 删除 | 冻结段 → **拒绝** 或要求确认解冻后删（plan 定：拒绝更简单） |

P2 可改为：合并结果 `frozen = a.frozen || b.frozen`；拆分两侧继承。

---

## 5. 落位预告（非最终实现）

### 5.1 纵向薄片

| 薄片 | 范围 | 预估 | 验证 |
|------|------|------|------|
| **S1 数据** | DTO + SQLite 迁移 + load/save + `segmentsEqualForPersist` + meta 字段 | 0.5–1d | Rust + TS 单测 |
| **S2 编辑锁 + UI** | 右键冻结/解冻；CM `transactionFilter`；删除线装饰；波形 band 变暗；结构命令守卫 | 1–1.5d | 打字/粘贴/合并手测 + 单测 |
| **S3 播放跳过** | `coalesceFrozenRanges` + 全局播帧 enforce + Transport seek | 1d | 连续冻结窗 / 窗内起播 / 主动 seek 停针 |
| **S4（P2）** | 导出排除开关、列表筛选「仅冻结」、词级 Ignore | 另开 research | — |

### 5.2 文件落位表

| 层 | 文件 / 模块 | 变更类型 |
|----|-------------|----------|
| Rust | `segment_cmd.rs` · `file_cmd.rs` · schema migration · `SegmentDto` | 加 `frozen` |
| TS DTO | `projectTypes.ts` · `segmentListHelpers.ts` · `segmentMetaField.ts` | 字段 + 相等性 |
| 编辑锁 | 新 `frozenLineGuard.ts`（CM filter）· `structureCommands.ts` | 拒写 / 拒结构 |
| UI | `segmentTextContextMenuModel.ts` · gutter/装饰 · band canvas 样式 | 冻结/解冻入口 + 视觉 |
| 播放 | 新 `frozenPlaybackSkip.ts` · 挂到 segment playback frame / timeline controller | 全局跳过 |
| 测试 | `frozenPlaybackSkip.test.ts` · guard 单测 · menu 模型 | 行为锁 |
| 文档 | CONTEXT 词条「语段冻结」；architecture 一句挂 Transport | 词汇一致 |

### 5.3 Plan 入口（签收后）

1. 写 `segment-freeze-intent.md`（场景 + 非目标）  
2. 写 `segment-freeze-plan.md`（S1→S3 任务序 + 文件级 diff 预期）  
3. 写 `segment-freeze-acceptance.md`（能力—UI 矩阵 + 手测脚本）  
4. 路线图挂薄片「调研 ✅」后再标「编码中」

---

## 6. 签收

- [x] 调研 brief 完成
- [x] intent / plan / acceptance 已链接本文
- [x] 用户确认可进入编码（2026-07-14）

**用户确认（2026-07-14）**

1. 冻结段浮层试听：**允许**  
2. 导出：**排除冻结**  
3. 快捷键：**要**  
4. 视觉：冻结后用 **斜纹** 提示  

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-07-14 | 初版：业内 A/B/C 对照；选定整段 `frozen` + seek-jump + CM 锁；分 S1–S3 |
| 2026-07-14 | 用户签收：试听允许、导出排除、快捷键、斜纹视觉 → 已采纳 |
