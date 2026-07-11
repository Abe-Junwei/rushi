# 调研：全局播放 vs 语段播放（产品入口恢复）

> **状态**：已采纳（用户确认 §4 · 2026-07-11）  
> **关联 architecture**：[`desktop-waveform-engine.md`](../../architecture/desktop-waveform-engine.md) §坐标 / §Transport Authority  
> **承接**：[`waveform-transport-authority-research.md`](./waveform-transport-authority-research.md)、[`editor-workbench-toolbar-layout-research.md`](./editor-workbench-toolbar-layout-research.md)、[`editor-keyboard-shortcuts-research.md`](./editor-keyboard-shortcuts-research.md)  
> **关联 spec**：[intent](./global-vs-segment-playback-ux-intent.md) · [plan](./global-vs-segment-playback-ux-plan.md) · [acceptance](./global-vs-segment-playback-ux-acceptance.md)  
> **门禁**：未完成本文签收 **不得** 进入 Plan 定稿与业务编码（见 `AGENTS.md` · feature-research-gate）

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | 听打通读：从播放头连续听整轨；校对单句：只播当前选中语段（可 loop）。两种任务都常见，入口须一眼可分。 |
| **本仓现状** | 底层 `useWaveformPlayback.togglePlay`（整轨 play/pause）仍在，并经 `useProjectWaveform` / `useTranscriptionLayer` 导出。**产品入口已全部切到语段 scoped**：工作条播放钮、`Space` / `⇧⌘Space`、波形浮层 play → `handleToggleSelectedWaveformPlay`；无选中则禁用 / no-op。全局倍速仍在。文档漂移：`editor-workbench-toolbar-layout-acceptance.md` 仍写「全局播放/暂停」，与 `desktop-waveform-engine.md` 及实现不符。 |
| **成功标准** | 手测：有音频、无选中语段时 Space/主钮可从 playhead 续播至文件尾；选中语段时辅钮/浮层可 scoped 播且段尾停或 loop；自动化：快捷键与工具条接线单测锁定「主=全局 / 辅=语段」。 |

### 1.1 关键路径（现状）

```text
Space / 工具条主钮 / 浮层 play
  → handleToggleSelectedWaveformPlay → toggleSegmentPlay intent
  → 段尾 bound（playback frame）

togglePlay（全局）→ 仅 hook 导出，无 UI / 无快捷键
```

---

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表 | 核心机制 | 链接 |
|---|------|------|----------|------|
| **A** | **主=全局 transport** | Descript、Otter | Space / 主 Play = 从 playhead 连续播；倍速在 transport；场景/段跳转是导航而非「唯一播放」 | [Descript Playback](https://help.descript.com/hc/en-us/articles/10164534109837-Playback-and-navigation) · [Otter Shortcuts](https://help.otter.ai/hc/en-us/articles/29431724341399-Keyboard-Shortcuts) |
| **B** | **双钮：全局 + 选区** | Trint | 波形条 **主 Play** = 整轨；旁侧 **小黄钮** = 只播高亮/选区 | [Trint playback](https://info.trint.com/knowledge/how-do-i-playback-my-transcript-trint-help-center) |
| **C** | **主=全局，选区独立命令** | Audacity / Premiere | Space = 从播放头；Play Selection / Loop Selection 为独立命令 | Audacity Selection · NLE transport 惯例 |

**共识**：听打产品几乎都把「从 playhead 连续播」当主路径；语段/选区播放是辅入口。把 scoped 段播做成唯一 Space/主钮，更接近「逐句字幕校对台」，不符合 Rushi 听打通读主场景。

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用的部分 | 与 Rushi 约束冲突 | 进度 / UX |
|------|--------|----------------|-------------------|-----------|
| **A** Descript/Otter | **高** | Space→全局；倍速已全局唯一真源 | 无；须恢复主钮接线 | 改动面最小（接线 + 文案） |
| **B** Trint 双钮 | **高** | 工作条主钮=全局；浮层/第二钮=语段 | 窄窗宽度：左 transport pill 已挤；优先复用浮层，避免再塞第三圆钮 | 视觉清晰；实现量小 |
| **C** NLE 选区命令 | **中** | 「Play Selection」语义对标语段 play | 不做完整 time-range selection 工具栏 | 仅借鉴语义，不引入 DAW 选区模型 |

**本仓已有、必须复用（禁止第二套播放栈）：**

- `useWaveformPlayback.togglePlay` / `useProjectWaveform.togglePlay` — 全局起停（先 `clearSegmentPlaybackBound`）
- `handleToggleSelectedWaveformPlay` + `segmentPlaybackBound` — 语段 scoped / loop
- `dispatchTransportIntent` — 所有 seek/play 仍走 Transport Authority
- `WaveformGlobalPlaybackSpeed` — 全局倍速唯一真源（语段 overlay **无**独立倍速）
- `editorShortcutRegistry` / `executeEditorShortcut` — 快捷键真源
- `WaveformSegmentPlaybackControls` — 浮层 play + loop（辅入口已存在）

---

## 4. 决策摘要（最小改动 · Trint 式双入口）

| 问题 | 结论 |
|------|------|
| **选定方案** | **主入口恢复全局；语段保持辅入口（浮层 play/loop）。** 对标 Trint：工作条左侧 **主圆钮** + Space = `togglePlay`（从 playhead 连续播，**无**段尾硬停）。波形浮层 play/loop +（可选）独立快捷键 = 语段 scoped。 |
| **Space 语义** | **全局** `togglePlay`。正文内仍用 **⇧⌘Space**（避开 macOS Spotlight / 空格输入），语义与 Space 相同（全局），**不再**绑语段 scoped。 |
| **语段播放入口** | ① 波形选中浮层 play/loop（保留）；② 工作条 **不**再把主钮当语段钮（acceptance 旧文「全局播放」回归真意）。窄窗优先不加第二圆钮；若手测发现浮层难发现，再在主钮旁加 ghost 小钮（Trint 黄钮等价）。 |
| **无选中语段** | 全局主钮 / Space **可用**（只要 `isReady`）；语段浮层 play 仍 disabled。 |
| **播放中切段** | 选中另一语段：seek 策略沿用现有 Transport Authority / `selectionRevealSeekPolicy`；**不**自动改成 scoped。用户要段播须点浮层 play 或语段快捷键（若加）。 |
| **全局 → 语段切换** | 点浮层 play：经既有 `playSegmentAtIndex` / bound 路径，清除「无限续播」语义并装上段尾 bound（`togglePlay` 已会 `clearSegmentPlaybackBound` 的对偶路径保持对称）。 |
| **语段 → 全局切换** | 点主钮 / Space：`clearSegmentPlaybackBound` 后 `togglePlay`（现有 `useProjectWaveform.togglePlay` 已做 clear）。 |
| **不做什么** | ❌ 不新造第二套 VAD/分段/播放引擎；❌ 不恢复语段独立倍速；❌ 不做「无选中时 Space=全局、有选中时 Space=语段」的双义 Space（认知负担大，且与竞品不一致）；❌ 不改 single-clock / Transport Intent 架构；❌ 本薄片不做脚踏板 / 自定义绑定 UI。 |
| **与 ADR / architecture** | 更新 `desktop-waveform-engine.md`：Space/工具栏主钮 → `togglePlay`；浮层 → scoped。修正 `editor-workbench-toolbar-layout-acceptance.md` 能力矩阵与 shortcut panel 文案。Transport Authority 仍为唯一 seek/play 管道；可补 `toggleGlobalPlay` intent 或薄封装现有 `togglePlay`，禁止组件直调 `ws.play`。 |
| **风险** | RISK-01：依赖「语段主钮」的用户会短暂不适 — 用浮层 play + 设置页快捷键文案缓解；RISK-02：测试大量断言「Space≠togglePlay」须整体翻转；RISK-03：全局播时浮层 `isSelectedSegmentPlaying` 须正确为 false（bound 未装）。 |

### 4.1 能力—UI 矩阵（本薄片）

| 能力 | UI / 快捷键 | 行为 |
|------|-------------|------|
| 全局播放/暂停 | 工作条主圆钮；Space；正文 ⇧⌘Space | 从 playhead 续播至 EOF 或用户暂停；应用全局倍速 |
| 全局倍速 | 工作条 `WaveformGlobalPlaybackSpeed` | 唯一真源 |
| 语段播放/暂停 | 波形浮层 play | 选中语段 scoped；段尾停 |
| 语段 loop | 波形浮层 loop | 既有偏好 |
| 滚屏跟随 | 工作条 follow mode | 不变 |

---

## 5. 落位预告（非最终实现）

| 层 | 文件 / 模块 | 变更类型 |
|----|-------------|----------|
| UI | `EditorWorkbenchToolbar.tsx` | 主钮 → `tx.togglePlay`；`isPlaying`；无选中也可点（仅 `!isReady`/`busy` 禁用） |
| UI | `WaveformSegmentPlaybackControls` / `EditorWaveformPeaksStage` | 保持语段 play/loop；不改倍速 |
| 快捷键 | `executeEditorShortcut.ts` · `editorShortcutDefinitions.ts` | `playback.toggle` → `togglePlay`；panel 文案改「全局播放」 |
| 文档 | `desktop-waveform-engine.md` · toolbar acceptance · Env 快捷键面板文案 | 对齐双入口 |
| 测试 | `executeEditorShortcut.test.ts` · `useEditorShortcutDispatcher.test.ts` · `EditorWorkbenchToolbar.test.tsx` | 翻转「Space≠全局」断言；补主钮全局接线 |
| Transport（可选薄） | `dispatchTransportIntent` | 若需对称 intent，加 `toggleGlobalPlay`；否则复用现有 `togglePlay` 包装即可 |

**预估**：接线 + 文案 + 测例翻转，约 0.5–1 日；**无**新架构。

---

## 6. 签收

- [x] 调研 brief 完成（初版）
- [x] 用户确认选定方案（§4）可进入 Plan（2026-07-11）
- [x] intent / plan / acceptance 已链接本文
- [x] 可进入编码

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-07-11 | 初版：竞品矩阵（Descript/Otter/Trint/NLE）+ 最小改动双入口决策 |
| 2026-07-11 | 用户确认 §4；进入接线实现 |
| 2026-07-11 | 修复：全局 play 被 `syncSelectedSegmentPlayingUi` 自动挂段尾 bound；加 `beginGlobalPlayback` |
