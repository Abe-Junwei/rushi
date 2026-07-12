# 调研：文稿旁侧段播入口 + ↑↓ 听跳对齐业内

> **状态**：已采纳（用户确认 · 2026-07-12）  
> **关联**：[`transcript-click-seek-while-playing-research.md`](./transcript-click-seek-while-playing-research.md)（听跳；本薄片修订 **listKeyboard 亦 seek**）· [`global-vs-segment-playback-ux-research.md`](./global-vs-segment-playback-ux-research.md)  
> **关联 spec**：本文即 brief；实现落位见文末 §5  
> **门禁**：用户已确认产品方向后进入编码

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | (1) ↑↓/Tab 换句应像 Otter/Descript 一样带动 playhead；(2) 段播按钮应在文稿文本旁侧可见（Trint），不能只藏在波形浮层。 |
| **本仓现状** | `listKeyboard` 不 seek；段播仅 `WaveformSegmentPlaybackControls` 波形浮层。 |
| **成功标准** | ↑↓ 松键后 seek 段首；选中行 stage gutter 有 play/stop；复用既有 `playSegmentAtIndex` / transport，无第二套播放栈。 |

---

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表 | 核心机制 |
|---|------|------|----------|
| **A** | 导航驱动 playhead | Otter / Descript | 点选与键盘换句均可对齐时间轴 |
| **B** | 行旁段播控件 | Trint | 选中行旁 play；波形仍可有区域控件 |
| **C** | 本仓 v1 | Rushi | 键盘不 seek；段播仅波形浮层 |

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用 | 冲突 |
|------|--------|----------|------|
| A | 高 | `shouldSeekOnSegmentSelect` + `selectSegmentTransport` + burst finalize seek | 修订「listKeyboard 永不 seek」文档 |
| B | 高 | `playSegmentAtIndex` / `toggleSelectedWaveformPlayImpl`；stage gutter DOM | 禁止再造 transport |

**不做什么**：词级 karaoke；每行常驻 N 个按钮（仅 primary）；旁路 `wf.seek`；第二套 loop UI（loop 仍留波形浮层）。

---

## 4. 决策

| 问题 | 结论 |
|------|------|
| listKeyboard seek | **是**；burst **中途不 seek**，**keyup finalize** 与非 burst 立即 seek（防箭头条 scrub） |
| beginGlobalPlayback | listKeyboard seek 时同 list 听跳，解除 scoped end-bound |
| 跟播 divert | listKeyboard **不再** mark divert（seek 后 playhead 已对齐） |
| 段播落位 | CM6 `stageGutter`（文本右侧）primary 行 play/stop |
| loop | 仍仅波形浮层 |

---

## 5. 落位预告

| 层 | 文件 |
|----|------|
| Policy | `selectionRevealSeekPolicy.ts` · guard · docs |
| Transport / burst | `selectSegmentTransport.ts` · `useListKeyboardBurstSelection.ts` |
| UI | `stageGutter.ts` · `scopedPlayingField.ts` · `TranscriptEditorCore` · `EditorSegmentList` |
