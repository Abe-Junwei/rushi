# Acceptance：WaveSurfer canvas / progress 帧率（WS-FPS）

> **调研**：[`waveform-ws-canvas-fps-research.md`](./waveform-ws-canvas-fps-research.md)
> **plan**：[`waveform-ws-canvas-fps-plan.md`](./waveform-ws-canvas-fps-plan.md)
> **状态**：WS-2a 已编码 · 待手测 fps / lazy 尾部

---

## 1. Spike 闸门（WS-1）

| 项 | 通过 | 失败处置 |
|----|------|----------|
| 稳态 `playbackFrames` | ≥45 / sec（≥8s hands-off） | 记数字 → WS-2a |
| `bandRepaint`/`rulerRepaint` 稳态 | ≈0 | 回归，先修 |
| 空格起播 / seek / pause | 无回退、无残影 | 不固化 |
| 已播放着色 | 可接受或有替代说明 | 产品确认 |

手测证据（2026-07-10，`scrollW` 至 40960）：

- 稳态 `playbackFrames` 常见 **3–13 /s**，峰值约 **23**，**远低于 45**
- `band`/`ruler` skip 常 96–100%（非本轨瓶颈）
- `frameLag` 常 100–600ms+

- [x] S1/S2 fps 已采（失败）
- [ ] S3 正确性（WS-1 不固化；随 WS-2a 再验）

---

## 2. WS-2a（编码完成 · 待手测）

自动化：

- [x] wave-layer sticky + viewport 宽；overlay 仍 timeline 宽
- [x] `installWaveSurferTierScrollSync` + `syncWaveSurferScrollFromTier`
- [x] tier scroll / after-render 推送 `ws.setScroll`
- [x] focused tests + typecheck
- [x] **live progress tint 补偿（1A）**：`progressWrapper.width` 经 `setDirectLayoutStyle` + 百分比去重；静态 clip/overflow/cursor 仍 nonce CSP 一次写入
- [x] **playback-follow defer（1B）**：`WAVEFORM_PLAYBACK_FOLLOW_DEFER_LAYOUT_COMMIT`（默认 true）；播放跟随延迟 React `tierScrollLayout`，暂停 snap 立即 commit

手测：

```js
__rushiScrollProfile.enable()
// 深 zoom 播放 8–10s；对比 audioTicks vs playbackFrames（JS vs 合成判据）
// 快速横滚看右侧空白；确认已播放 tint 与 playhead 同帧
__rushiScrollProfile.disable()
```

期望 `[wf-geom]`：`clientW≈viewport`、`scrollable=true`、`drawn≈3`（非 `drawn=needed=6`）。

**阶段 0 判据**：`audioTicks` 明显高于 `playbackFrames` → 继续 1C rAF 统一；两者都低（≈23）→ 跳过边际优化，开 WS-2b research。

- [ ] S4 深 zoom `playbackFrames≥45`（须在 live tint + direct-style 基线上采）
- [ ] S5 快速横滚无不可接受右侧空白
- [ ] S6 seek / 空格 / overlay 点选对齐；已播放 tint 与 playhead 同步

---

## 3. 签收

- [x] spike 报告完成（未过闸）
- [x] 选定 **WS-2a**（非 WS-1b）
- [ ] 用户手测 S4–S6 通过
- [ ] arch doc 已修订（手测通过后）
