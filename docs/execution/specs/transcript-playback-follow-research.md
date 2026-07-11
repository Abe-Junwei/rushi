# 调研：全局播放时文稿跟随播放头（对齐 Otter / Descript）

> **状态**：已采纳（用户确认实现方案 A · 2026-07-11）  
> **关联**：[`global-vs-segment-playback-ux-research.md`](./global-vs-segment-playback-ux-research.md)（全局/语段双入口已落地）  
> **Architecture**：[`desktop-waveform-engine.md`](../../architecture/desktop-waveform-engine.md)、CM6 Transcript Editor Core  
> **关联 spec**：[intent](./transcript-playback-follow-intent.md) · [plan](./transcript-playback-follow-plan.md) · [acceptance](./transcript-playback-follow-acceptance.md)  
> **门禁**：未完成本文签收 **不得** 进入 Plan 定稿与业务编码

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | 全局通读时，希望文稿**跟着正在播出的语段滚动/高亮**（Otter / Descript 听读同步），同时仍能点远处改稿且**不打断播放、不强制改选中**。 |
| **本仓现状** | 波形有 `playbackScrollFollow`（center/edge）。文稿**无** playhead 跟随：`list` 选中 reveal 但不 seek；无「当前播出语段」chrome。全局播时点远处文本 → 选中与出声分离，文稿停在旧处。波形 band 已有 `resolveVisitedSegmentIndexAtPlayhead`（visited 前沿），文稿未消费。 |
| **成功标准** | 全局播放中：播出语段行有独立「跟播」高亮，且在用户未抢滚时自动 `reveal` 进视口；**不**改 CM6 selection / `selectedIdx`。点远处文本仍可编辑且音频不 seek。自动化：跟播索引纯函数 + suppress 规则单测。 |

### 1.1 与上一薄片关系

全局 Space / 主钮已恢复；本薄片只补 **文稿侧跟播 UX**，不改 transport 双入口。

---

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表 | 核心机制 | 链接 |
|---|------|------|----------|------|
| **A** | **播放高亮与编辑光标分离** | Descript | 播放中 script 内 **word 级高亮跟 playhead**；**文本光标可独立移动/编辑**；停播后光标与 playhead 再对齐 | [Playback and navigation](https://help.descript.com/hc/en-us/articles/10164534109837-Playback-and-navigation) |
| **B** | **词级高亮 + 文稿自动跟随** | Otter | 播放时 transcript **逐词高亮并跟滚**；点词可跳音频（与 Rushi list 不 seek 矩阵不同，本薄片不照搬「点文即 seek」） | [Otter 功能说明](https://otter.ai/features) · [Conversation overview](https://help.otter.ai/hc/en-us/articles/5093228433687-Conversation-Page-Overview) |
| **C** | **仅时间轴跟随，文稿手动** | 部分字幕工 / 旧听打台 | 只有 timeline auto-scroll；文稿靠用户滚 | 对照用：说明通读体验弱 |

**共识（A+B）**：通读时文稿有 **播放焦点（playback focus）** 视觉；编辑选区可以暂时与播放焦点分离。  
**Rushi 约束**：`SegmentDto` **无词级时间戳** → v1 **不能**做 Otter/Descript 词级高亮，只能做 **语段行级** 跟播（与波形 visited 同粒度）。词级列为明确后续。

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用 | 冲突 | UX / 性能 |
|------|--------|----------|------|-----------|
| **A Descript 分离** | **高** | 播放焦点 ≠ selection；播放中允许点远处改稿 | 无词级时间 | 行级即可对齐「分离」心智 |
| **B Otter 跟滚** | **高**（行为） | 播放中自动滚到当前句 | 点词 seek **不做**（保留 list 不 seek） | 行级 reveal 即可 |
| **C 仅波形** | 低 | 已有波形 follow | 不解决文稿通读 | — |

**本仓已有、必须复用：**

- `resolveVisitedSegmentIndexAtPlayhead`（`segmentChrome.ts`）— playhead → 语段索引（与 band visited 同算法）
- `subscribePlayheadFrame` / playback frame bus — 跟播节流入口（勿另开 rAF）
- `revealSegmentInView`（CM6）— 文稿滚入视口；**禁止**为此调用 `dispatchTranscriptEditorSelection`
- `hoverSegmentField` 模式 — CM6 `StateEffect` + line decoration（新建 `playbackFocus` 字段，勿复用 hover/selection class）
- `selectionRevealSeekPolicy` — **保持** list 不 seek
- `playbackScrollFollow` — 波形跟随不变；文稿跟播为平行能力

---

## 4. 决策摘要（方案 A · 语段级跟播）

| 问题 | 结论 |
|------|------|
| **选定方案** | 引入 **Playback Focus（跟播焦点）**：与 CM6 selection **正交**。全局播放（及可选：任意 `isPlaying`）时，按 playhead 解析当前语段索引 → CM6 行装饰（弱高亮）+ 条件 `revealSegmentInView`。 |
| **粒度** | **v1 = 语段行**。不做词级（无时间戳）。 |
| **何时启用** | 默认：**媒体 `isPlaying` 且非语段 loop 抢戏时** 开启跟播。偏好：`rushi.p1.transcriptPlaybackFollow`（默认 **on**）；设置 → 偏好设置可关。 |
| **不改选中** | 跟播 **禁止** 写 `dispatchTranscriptEditorSelection` / 改 primary。选中高亮与跟播高亮可并存；跟播 class 弱于 selected。 |
| **自动 reveal 抑制（对齐 Descript「播放中可独立编辑」）** | 下列任一成立则 **只更新装饰、不强制滚文稿**：① 用户正在滚文稿（短 suppress）；② 用户刚点选了与跟播索引不同的语段（divert，至暂停或再次与 playhead 对齐）。**不**因 CM6 focus 抑制跟滚（Otter/Descript：编辑光标可独立，playhead 仍可跟视口）。暂停后清除跟播装饰。 |
| **跟播视觉 vs 选中** | 跟播 alone = 高级灰铺底（正文 + 左 meta + 右 stage）。选中 alone = saffron fill。**选中 ∩ 跟播** = 更深主题色 `--segment-fill-selected-playing-list`（三列同步）。无 inset 灰条。 |
| **点远处文本** | 仍不 seek、不打断全局播；进入「用户选中偏离」suppress，文稿可留在远处改稿；跟播装饰可继续在「当前播出行」更新（若该行在视口外可不滚）。 |
| **语段 scoped 播放** | 跟播仍可开（当前段本就在视口）；loop 时索引不变，无额外 reveal 抖动。 |
| **不做什么** | ❌ 词级 karaoke；❌ 播放中点文稿改 seek；❌ 跟播改 selection；❌ 第二套 playhead 时钟；❌ 跟播驱动波形 seek；❌ 默认把 list 矩阵改成 Otter「点词跳播」。 |
| **与 ADR / architecture** | 扩展 `desktop-waveform-engine` 或 desktop-capability 短节：「Playback Focus vs Selection」。Transport Authority 不变。 |
| **风险** | RISK-01：reveal 与用户滚抢滚动 — suppress 必测；RISK-02：500+ 段每帧 reveal — 仅索引变化时 reveal，装饰用 CM6 effect 合并；RISK-03：visited 算法在 gap 内指向上一段 — 可接受（与波形 visited 一致）。 |

### 4.1 能力—UI 矩阵

| 能力 | UI | 行为 |
|------|-----|------|
| 跟播高亮 | CM6 行 class（如 `cm-transcript-playback-focus`） | playhead 所在/visited 前沿语段；非 selection |
| 跟播滚动 | `revealSegmentInView` | 索引变化且未 suppress |
| 偏好开关 | 设置 → 偏好 | 关闭后无装饰无自动滚 |
| 选中 / 改稿 | 既有 | 播放中可偏离；不 seek |

---

## 5. 落位预告

| 层 | 模块 | 变更 |
|----|------|------|
| 纯函数 | `utils/transcriptPlaybackFocus.ts`（新） | playhead→idx；是否应 reveal（suppress 输入） |
| CM6 | `playbackFocusField.ts`（新，对标 hover） | effect + line deco；token 入 `tokens.css` |
| Hook | `useTranscriptPlaybackFollow.ts`（新） | 订 `subscribePlayheadFrame`；写 CM6 effect；条件 reveal |
| Prefs | `waveformPrefs` 或 editor prefs | `transcriptPlaybackFollow` |
| UI | `EnvPreferencesPanel` | 开关文案 |
| 文档 | architecture 短节 + acceptance | |
| 测试 | 纯函数 + field + hook 定向 | |

**预估**：1–1.5 日；无新播放引擎。

---

## 6. 签收

- [x] 调研 brief 完成（初版）
- [x] 用户确认选定方案（§4）可进入 Plan（2026-07-11 · 实现方案 A）
- [x] intent / plan / acceptance 已链接本文
- [x] 可进入编码

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-07-11 | 初版：方案 A 语段级跟播；对齐 Descript 分离 + Otter 跟滚；明确不做词级/点文 seek |
| 2026-07-11 | 用户确认实现；进入编码 |
