# Plan：WaveSurfer canvas / progress 帧率（WS-FPS）

> **调研**：[`waveform-ws-canvas-fps-research.md`](./waveform-ws-canvas-fps-research.md)
> **WS-2b 后备调研**：[`waveform-ws2b-viewport-render-research.md`](./waveform-ws2b-viewport-render-research.md)
> **WS-2b Plan**：[`waveform-ws2b-viewport-render-plan.md`](./waveform-ws2b-viewport-render-plan.md)
> **acceptance**：[`waveform-ws-canvas-fps-acceptance.md`](./waveform-ws-canvas-fps-acceptance.md)
> **前序 VRP**：[`waveform-visual-raf-playhead-plan.md`](./waveform-visual-raf-playhead-plan.md)
> **状态**：WS-2a 编码完成 · S4 fps **FAIL**（合成瓶颈）· WS-2b research ✅ · spike v4 **PASS** · WS-2b Plan 定稿 · **生产化签收** · S1–S6 PASS

---

## 0. 假设与证伪顺序

```
H0: band/ruler 已不是 fps 瓶颈          ← 已证伪为「不是」
H1: WS progress 每帧更新饿死 rAF         ← WS-1 spike：未过闸（峰值~23）
H2: 超宽 scrollW/canvas 合成饿死 rAF     ← WS-2a：viewport host + setScroll；fps 仍 FAIL
H3: Peaks 式视口窗口绘制（Rushi canvas） ← WS-2b spike v4 PASS（~47–52fps）
```

---

## 1. WS-1 spike（已完成 · 未过闸）

手测证据见 acceptance：深 zoom `playbackFrames` 峰值约 23 ≪ 45 → **不固化 WS-1b**，进入 WS-2a。

---

## 2. WS-2a（已完成 · fps 未过闸）

1. `EditorWaveformPeaksStage`：`waveform-timeline-wave-layer` → sticky + viewport 宽（overlay 仍 timeline 宽）。
2. 替换 `installWaveSurferInternalScrollLock` → `installWaveSurferTierScrollSync`：`ws.setScroll(tier.scrollLeft)` 单向同步；内部 overflow 仍 hidden。
3. `useTierScrollSync` / after-render：推送 scroll。
4. 1A/1B：progress direct-style + playback-follow defer。
5. 验收：S4 `playbackFrames≥45` **FAIL**；`audioTicks≈frames` → 合成瓶颈 → **进入 WS-2b**。

---

## 3. WS-2b（spike PASS · Plan 定稿）

见：

- 调研 [`waveform-ws2b-viewport-render-research.md`](./waveform-ws2b-viewport-render-research.md)
- Plan [`waveform-ws2b-viewport-render-plan.md`](./waveform-ws2b-viewport-render-plan.md)
- Acceptance [`waveform-ws2b-viewport-render-acceptance.md`](./waveform-ws2b-viewport-render-acceptance.md)

选定：Peaks **模型** + Rushi 视口 peaks canvas；WS = media-only（stub peaks + silence timer）。下一步：按 Plan §2 生产化（去 spike flag、architecture 修订、可选 played tint）。

---

## 4. 明确不做（WS-2a 轮已遵守；WS-2b 仍遵守）

- 不 fork WS
- 不 npm 迁移 Peaks.js / Konva
- 不与 SEL-1 混在同一 PR（SEL-1c 已签收，正交）
- 不恢复 mirror `translate3d`
- 默认不做 WR-4 worker

---

## 5. 与 SEL-1 / WR 关系

| 轨 | 关系 |
|----|------|
| SEL-1 | **已签收**（listCommit ≤35ms）；不挡 WS-2b |
| WR-2 | zoom 去抖已编码；H4 手测可并行 |
| WR-4 | 触发式后备，默认不做 |
