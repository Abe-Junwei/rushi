# 调研：播中点文稿 seek（听跳）

> **状态**：已采纳（用户确认：F1 听跳 + F2 暂停也 seek · 2026-07-12）  
> **关联**：[`transcript-playback-follow-research.md`](./transcript-playback-follow-research.md)（跟播已签收；当时明确 **不做** 点文 seek）  
> **前置真源**：[`waveform-selection-reveal-seek-acceptance.md`](./waveform-selection-reveal-seek-acceptance.md)（列表导航默认 **不 seek**）· [`desktop-waveform-engine.md`](../../architecture/desktop-waveform-engine.md) Transport Authority  
> **关联 spec**：[intent](./transcript-click-seek-while-playing-intent.md) · [plan](./transcript-click-seek-while-playing-plan.md) · [acceptance](./transcript-click-seek-while-playing-acceptance.md)  
> **门禁**：未完成本文签收 **不得** 进入业务编码

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | 全局通读时，想点文稿某一句 → 播放头跳到该句并继续听（Otter「点词跳播」的语段级等价）。 |
| **本仓现状** | `shouldSeekOnSegmentSelect`：**仅** `waveform` / `waveformKeyboard` seek；`list` / `listAdvance` / `listKeyboard` **永不** seek（校对改稿不拽 playhead）。跟播：点远处会 `selectionDiverted`、停强制滚，但音频继续在旧 playhead。链路：`selectSegmentAt` → `selectSegmentTransport` → `syncWaveformSegmentSelectSeek`（transport `selectSegmentTransport` / `segmentStart`）。 |
| **成功标准** | 播放中点另一语段：选中 + seek 到段首 + **续播**；暂停时点文稿仍不 seek。自动化：policy 纯函数 + transport 单测锁定。 |

### 1.1 与跟播薄片张力

跟播 research §4「点远处文本仍不 seek」是当时刻意不做。本薄片是 **显式修订**：在 **播放中** 把「点选 = 听跳」打开，暂停时保留「点选 = 只选中不 seek」。

---

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表 | 核心机制 | 链接 |
|---|------|------|----------|------|
| **A** | **播中点文 → seek 续播** | Otter | 点词/句跳到对应时间并继续播 | [Otter Features](https://otter.ai/features) · Conversation overview |
| **B** | **文稿点击可移动 playhead；编辑光标可分离** | Descript | script 内点击对齐 playhead；播放中仍可改稿 | [Playback and navigation](https://help.descript.com/hc/en-us/articles/10164534109837-Playback-and-navigation) |
| **C** | **列表永不 seek；仅时间轴 seek** | 本仓 v1（现状） | 点列表只 reveal；波形点选才 seek | `selectionRevealSeekPolicy` · H1 手测 |

**共识（A+B）**：听读产品把「点文稿跳到正在听的位置」当一等交互。  
**Rushi 约束**：无词级时间戳 → v1 **只能** seek 到 **语段 `start_sec`**（与波形点选同粒度）。

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用 | 冲突 | UX |
|------|--------|----------|------|-----|
| **A Otter 播中跳** | **高** | 播放中 list 点选 → seek | 与「列表永不 seek」H1 冲突 → 须 **按 isPlaying 条件化** | 通读直觉强 |
| **B Descript** | 中 | 选中≠跟播已有；点跳对齐 | 词级不做 | 行级足够 |
| **C 现状** | — | 已落地 | 不满足本需求 | — |

**本仓必须复用（禁止第二套 seek）：**

- `shouldSeekOnSegmentSelect` / `selectSegmentTransport` — 扩展 policy，勿旁路直接 `wf.seek`
- `syncWaveformSegmentSelectSeek` / `dispatchTransportIntent({ kind: "selectSegmentTransport", seekPolicy: "segmentStart" })`
- `suppressPlaybackFollowForSelectionSeek` — 已有，防 seek 后波形跟播回拽
- 跟播 `selectionDiverted` — seek 后 playhead 与选中对齐时应 **清 divert**，恢复跟滚

---

## 4. 决策摘要（推荐方案 · 待确认）

| 问题 | 推荐结论 |
|------|----------|
| **选定方案** | **点句即 seek（含暂停）**：source ∈ `{ list, listAdvance }` 且非 multi（无 shift/toggle）且 `idxChanged` → seek 段首；播放中则续播。`listKeyboard` 永不 seek。 |
| **不 seek 的源** | `listKeyboard`（↑↓/Tab 仍只 reveal，避免箭头条 scrub）；`contextMenu` / `multiSelect`；`shift`/`toggle` 多选手势。 |
| **seek 目标** | 语段 `start_sec`（与波形 `selectSegmentTransport` 一致）。不做词内偏移。 |
| **scoped 段播中点另一句** | seek 到新段首；**解除**语段 end-bound，回到全局续播（与「点句听跳」一致；避免 bound 立刻停在旧段逻辑）。 |
| **跟播 divert** | 点选触发 seek 后：清除 divert（选中已对齐新 playhead）。若未来加「仅选中不 seek」修饰键，再保留 divert。 |
| **偏好** | v1 **无新开关**（行为绑在「正在播放」）。若手测争议，再加 `rushi.p1.transcriptClickSeekWhilePlaying`（默认 on）。 |
| **不做什么** | ❌ 暂停时 list seek；❌ 词级 seek；❌ listKeyboard seek；❌ 旁路 Transport Authority；❌ 改波形点选矩阵；❌ 双击才 seek（增加发现成本）。 |
| **与既有 acceptance** | 修订 H1 语义：「**暂停 / 非播放** 时列表点选不 seek」；播放中为例外。须更新 `waveform-selection-reveal-seek-acceptance` 一句交叉引用。 |
| RISK-04 | CM6 mousedown 先 `selectSegmentCommand` 再 bridge → projection 已是目标 idx，`idxChangedFromAuthority` 假阴性跳过 seek | list seek baseline 改用 `selectedIdxRef` / React selectedIdx（2026-07-12 修复） |

### 4.1 备选（不推荐作 v1）

| 备选 | 说明 | 为何不优先 |
|------|------|------------|
| 修饰键才 seek（⌥/⌘+点） | 暂停也可跳 | 发现性差；通读主路径变重 |
| 仅 meta gutter 点击 seek | 正文只编辑 | 左右命中区不一致，难学 |
| 永远 list seek | 对齐 Otter 全时 | 破坏已签收「改稿不拽头」 |

### 4.2 能力—UI 矩阵

| 能力 | 条件 | 行为 |
|------|------|------|
| 播中点句听跳 | playing + list/listAdvance + 换句 | 选中 + seek 段首 + 续播（不清 divert：不 mark divert） |
| 暂停点句听跳 | !playing + list/listAdvance + 换句 | 选中 + seek 段首（playhead 对齐） |
| 播中 ↑↓ | listKeyboard | 选中 + reveal；**不** seek |
| 播中点当前跟播句（同 idx） | idx 未变 | 不重复 seek（既有 idxChanged 门） |

### 4.3 功能详解 + 与现网冲突审查

#### F1 · 播中点另一句 → seek 段首并续播

**做什么**：`isPlaying` 时，文稿单击（`list`）或连点（`listAdvance`）换到另一语段 → 与波形点选相同：`selectSegmentTransport` + `seekPolicy: "segmentStart"`，音频**不停**，从新段首继续。

**用户心智**：通读时「点哪听哪」（Otter 语段级）。

| 现有能力 | 关系 | 结论 |
|----------|------|------|
| 列表默认不 seek（H1 / `selectionRevealSeekPolicy`） | **修订**：H1 收窄为「非播放时不 seek」 | 须改 acceptance 文案，否则文档打架 |
| 波形点选 seek | 同路径复用 transport | **不打架**；list 仅在 playing 对齐波形 |
| Transport Authority / `suppressPlaybackFollowForSelectionSeek` | seek 必须走既有 suppress | **不打架**（禁止旁路 `wf.seek`） |
| Space 全局播 | 听跳后仍全局续播 | **加强**通读，不冲突 |
| 跟播灰底 | seek 后 playhead 进新段 → focus 跟上 | **对齐**；见 F5 |

#### F2 · 暂停时点文稿 → 仍不 seek

**做什么**：`!isPlaying` 时 list* 行为完全保持现状：选中 + 波形 reveal，playhead 不动。

| 现有能力 | 关系 | 结论 |
|----------|------|------|
| 校对改稿不拽头（已签收） | 原样保留 | **不打架** |
| 跟播 | 暂停无跟播装饰 | **不打架** |

#### F3 · 播中 ↑↓ / Tab（`listKeyboard`）→ 仍不 seek

**做什么**：键盘换句只改选中/reveal，不 scrub 音频。

**为何单独砍**：连按 ↑↓ 若 seek，等于用键盘 scrub 整轨，和「箭头条浏览文稿」冲突；波形另有 keyboard seek 源。

| 现有能力 | 关系 | 结论 |
|----------|------|------|
| listKeyboard 不 seek（architecture 表） | 维持 | **不打架** |
| 播中点选 seek（F1） | 鼠标 vs 键盘分流 | **刻意不一致**——须在 UI/帮助里可说清，否则体感「有时跳有时不跳」 |

#### F4 · Shift / toggle 多选 → 不 seek

**做什么**：多选手势只改选区，不跳 playhead（与波形 `selectOnly` 一致）。

| 现有能力 | 关系 | 结论 |
|----------|------|------|
| 多选 / lasso / 右键不 seek | 一致 | **不打架** |

#### F5 · 与跟播 divert 的关系（**最大潜在打架点**）

**现状**：播中点远处 → `notifyUserSegmentSelect` 置 `selectionDiverted` → **停文稿强制跟滚**，但音频仍在旧位置（改稿模式）。

**本薄片**：同一操作改为 **seek** → 选中与 playhead 应对齐 → divert 应 **清除**，跟滚恢复。

| 风险 | 说明 | 缓解 |
|------|------|------|
| 时序打架 | 先 mark divert，后 seek，focus 一帧未到 → 短暂停滚 | transport seek 成功路径显式清 divert；或 `primary===focus` clear 已覆盖时补测 |
| 产品语义变了 | 跟播 research 写「点远处不 seek、可偏离改稿」 | **显式废止该句**；偏离改稿改为：**先暂停再点**，或未来「修饰键点选不 seek」 |

**结论**：与「播中可点远处静默改稿」**产品打架**——本薄片选择通读听跳优先。若仍要播中改远处稿不跳音频，必须另开修饰键方案（research §4.1），不能与 F1 同开无修饰。

#### F6 · 语段 scoped 播放中点另一句 → 解 bound + 全局续播

**现状**：浮层段播在段尾有 end-bound；全局播用 `beginGlobalPlayback` 防 sync 重武装 bound。

**本薄片**：播中 list seek 时调用 `beginGlobalPlayback()`（或等价清 bound），否则跳到新段后仍可能被**旧段** bound 逻辑误伤，或新段被错误武装。

| 现有能力 | 关系 | 结论 |
|----------|------|------|
| 浮层段播 / loop | 点他句 = 放弃「只播这一句」契约，改通读 | **产品语义变化**，合理但须手测；loop 中点他句同理退出 loop 边界 |
| `globalPlayGenRef` | 复用，不新造 | **不打架** |

#### F7 · 同 idx 再点 → 不 seek

**做什么**：沿用 `idxChanged` 门；已选中行再点只 caret/focus（architecture：CM6 再点击不走 select）。

| 现有能力 | 关系 | 结论 |
|----------|------|------|
| 同行再点不抖 | 维持 | **不打架** |

#### F8 · 不做词级 / 不做暂停 list seek / 无新偏好

与既有「无词时间戳」「H1 校对」一致；无开关则少一条能力矩阵分裂。

---

### 4.4 冲突总表（一眼）

| 现网功能 | 冲突等级 | 处理 |
|----------|----------|------|
| H1 列表永不 seek | **文档/验收修订** | 改为「非播放不 seek」 |
| 跟播「点远处不 seek + divert 改稿」 | **产品取代** | 播中单击 = 听跳；改稿请暂停（或后续修饰键） |
| 段播 end-bound / loop | **低·须接线** | seek 时 `beginGlobalPlayback` |
| listKeyboard / 多选 / 暂停点选 | 无 | 保持 |
| 波形 seek / Transport / 跟播灰底 | 无 | 复用 |
| 全局 Space / 主钮 | 无 | 互补 |

**唯一需要产品拍板的打架**：播中单击文稿，要 **听跳（F1）** 还是 **静默改稿（旧跟播 divert）**——二者互斥，不能无修饰并存。

### 4.5 F1 确认 + F2「暂停也 seek」风险（2026-07-12）

| 项 | 结论 |
|----|------|
| **F1** | 用户确认：**听跳**（播中点文 seek 续播）。旧 divert 静默改稿废止。 |
| **F2 若改为暂停也 seek** | 技术风险 **低**；产品/校对风险 **中**（见下）。 |

**暂停也 seek 的好处**

- 与波形点选、Otter/Descript「点文 = 对齐 playhead」一致，心智一条规则：**点句就跳头**（仅键盘/多选例外）。
- 实现更简单：`shouldSeekOnSegmentSelect` 对 `list`/`listAdvance` **恒 true**，不必吃 `isPlaying`。
- 与 F1 无条件分支打架。

**暂停也 seek 的风险**

| 风险 | 等级 | 说明 |
|------|------|------|
| 丢失「听读书签」 | **中** | 暂停后想点远处改一句，playhead 被拽走；再按 Space 从错的地方续播。这正是当年 H1「列表不 seek」要防的。 |
| 已签收 H1/H2 语义 | **文档** | 须废止「Hub 点语段播放头不跳」；改为 list 单击 seek（↑↓ 仍不跳）。 |
| 批量校对节奏 | **中低** | 快速点多句只为选中编辑 → 波形/跟播会跟着跳，视觉吵（暂停无跟播灰底，主要是 playhead/波形 reveal）。 |
| 技术 / Transport | **低** | 与波形同路径；无新时钟。 |
| 段播 bound | **低** | 暂停时通常无 playing bound；若 paused 但仍挂着 scoped UI 态，点他句只 seek 不 play，bound 可按「下次播再清」处理。 |

**缓解（若采纳暂停也 seek）**

1. **保留** `listKeyboard` 不 seek → 用 ↑↓ 换句改稿、playhead 不动。  
2. 可选后续：⌥/⌘+点 = 只选中不 seek（给重度校对）。v1 可不做。  
3. 手测加一条：暂停 → 点远处改稿 → Space，确认用户能接受「从新句起播」。

**建议**：若通读/听跳是主场景，**F2 暂停也 seek 可接受**，用键盘保校对；若「暂停点选改稿保书签」仍是刚需，则 F2 维持不 seek，仅 F1 playing seek。

## 5. 落位预告

| 层 | 模块 | 变更 |
|----|------|------|
| 纯函数 | `selectionRevealSeekPolicy.ts` | `shouldSeekOnSegmentSelect(source, { isPlaying })` |
| Transport | `selectSegmentTransport.ts` | 传入 `isPlaying`；seek 后通知跟播清 divert（或 policy 侧由 follow 见 primary==focus） |
| Selection | `useTranscriptionLayerSelection` | 把 `isPlaying` 传入 transport |
| 跟播 | `useTranscriptPlaybackFollow` / divert helpers | seek 对齐后清 divert（若 primary===focus 已有 clear，确认 seek 后 focus 更新时序） |
| 段播 bound | `useWaveformSegmentPlaybackControls` 或 transport 后钩 | 播中 list seek 时 `beginGlobalPlayback` / 清 bound |
| 文档 | architecture 表 + 旧 reveal-seek acceptance 交叉引用 | |
| 测试 | policy + profile「playing list seeks」+ 非 playing 不 seek | |

---

## 6. 签收

- [x] 调研 brief 完成（初版）
- [x] intent / plan / acceptance 已链接本文
- [x] **用户确认**：F1 听跳 + F2 暂停也 seek（2026-07-12）→ 可编码

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-07-12 | 初版：推荐「仅播放中 list/listAdvance seek」；明确与跟播 / H1 的修订关系 |
