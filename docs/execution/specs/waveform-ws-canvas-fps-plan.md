# Plan：WaveSurfer canvas / progress 帧率（WS-FPS）

> **调研**：[`waveform-ws-canvas-fps-research.md`](./waveform-ws-canvas-fps-research.md)
> **acceptance**：[`waveform-ws-canvas-fps-acceptance.md`](./waveform-ws-canvas-fps-acceptance.md)
> **前序 VRP**：[`waveform-visual-raf-playhead-plan.md`](./waveform-visual-raf-playhead-plan.md)
> **状态**：WS-2a 编码中 · 待手测 fps / lazy 尾部

---

## 0. 假设与证伪顺序

```
H0: band/ruler 已不是 fps 瓶颈          ← 已证伪为「不是」
H1: WS progress 每帧更新饿死 rAF         ← WS-1 spike：未过闸（峰值~23）
H2: 超宽 scrollW/canvas 合成饿死 rAF     ← WS-2a：viewport host + setScroll
```

---

## 1. WS-1 spike（已完成 · 未过闸）

手测证据见 acceptance：深 zoom `playbackFrames` 峰值约 23 ≪ 45 → **不固化 WS-1b**，进入 WS-2a。

---

## 2. WS-2a（本轮）

1. `EditorWaveformPeaksStage`：`waveform-timeline-wave-layer` → sticky + viewport 宽（overlay 仍 timeline 宽）。
2. 替换 `installWaveSurferInternalScrollLock` → `installWaveSurferTierScrollSync`：`ws.setScroll(tier.scrollLeft)` 单向同步；内部 overflow 仍 hidden。
3. `useTierScrollSync` / after-render：推送 scroll。
4. 验收：`[wf-geom]` 期望 `clientW≈viewport`、`scrollable=true`、`drawn≈3`；深 zoom 横滚无右侧空白；`playbackFrames≥45`。

---

## 3. 明确不做（本轮）

- 不 fork WS
- 不落地 Peaks 式全重写（除非 2a 失败另开 research）
- 不与 SEL-1 混在同一 PR（可同迭代，分 commit）
- 不恢复 mirror `translate3d`

---

## 4. 与 SEL-1 / WR 关系

| 轨 | 关系 |
|----|------|
| SEL-1 | 并行；波形点选仍偏慢，不挡 WS-2a |
| WR-2/4 | zoom 卡顿独立；不挡 fps |
