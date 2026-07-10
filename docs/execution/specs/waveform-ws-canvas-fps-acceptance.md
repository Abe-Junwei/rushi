# Acceptance：WaveSurfer canvas / progress 帧率（WS-FPS）

> **调研**：[`waveform-ws-canvas-fps-research.md`](./waveform-ws-canvas-fps-research.md)  
> **WS-2b 后备调研**：[`waveform-ws2b-viewport-render-research.md`](./waveform-ws2b-viewport-render-research.md)  
> **plan**：[`waveform-ws-canvas-fps-plan.md`](./waveform-ws-canvas-fps-plan.md)  
> **状态**：WS-2a 编码完成 · S4 fps **FAIL**（合成瓶颈）· WS-2b research ✅ · spike v4 **PASS** · [WS-2b Plan](./waveform-ws2b-viewport-render-plan.md) 定稿 · **生产化编码完成** · 待手测

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
- [x] S3 正确性不挡（WS-1 不固化）

---

## 2. WS-2a（编码完成 · fps 未过闸）

自动化：

- [x] wave-layer sticky + viewport 宽；overlay 仍 timeline 宽
- [x] `installWaveSurferTierScrollSync` + `syncWaveSurferScrollFromTier`
- [x] tier scroll / after-render 推送 `ws.setScroll`
- [x] focused tests + typecheck
- [x] **live progress tint 补偿（1A）**：`progressWrapper.width` 经 `setDirectLayoutStyle` + 百分比去重
- [x] **playback-follow defer（1B）**：`WAVEFORM_PLAYBACK_FOLLOW_DEFER_LAYOUT_COMMIT`

手测判据：

```js
__rushiScrollProfile.enable()
// 深 zoom 播放 8–10s；对比 audioTicks vs playbackFrames
__rushiScrollProfile.disable()
```

**阶段 0 判据结果（2026-07-10）**：`audioTicks≈playbackFrames`（稳态 ~16–24）→ **合成瓶颈** → 跳过 1C 边际 → 开 WS-2b research。

- [x] S4 深 zoom `playbackFrames≥45` → **FAIL**（触发 WS-2b）
- [ ] S5 快速横滚无不可接受右侧空白（WS-2b spike 再验）
- [ ] S6 seek / 空格 / overlay；已播放 tint（WS-2b 再验）

---

## 3. WS-2b（spike PASS · Plan 定稿 · 待生产化）

> 调研：[`waveform-ws2b-viewport-render-research.md`](./waveform-ws2b-viewport-render-research.md)  
> Plan：[`waveform-ws2b-viewport-render-plan.md`](./waveform-ws2b-viewport-render-plan.md)  
> Acceptance：[`waveform-ws2b-viewport-render-acceptance.md`](./waveform-ws2b-viewport-render-acceptance.md)

| 项 | 状态 |
|----|------|
| 选定方案 | Peaks **模型** + Rushi 视口 canvas；WS 降为 media；禁止迁移 Peaks.js |
| Plan / acceptance | **已定稿** |
| Architecture 修订 | 与生产化 PR 同步 |

Spike 闸门（≤1 天）：

| 项 | 通过 |
|----|------|
| 深 zoom `playbackFrames≥45` | **PASS**（v4 稳态 ~47–52） |

Spike 接线（2026-07-10）：

- [x] `WAVEFORM_WS2B_VIEWPORT_CANVAS_SPIKE=true`
- [x] `WaveformViewportPeaksCanvas` 复用 `PeakCache.getWaveSurferPeaksAsync(drawPxPerSec)`
- [x] WS 可见层 ready 后 **1×1 + opacity:0**（禁止 `display:none`）；viewport canvas 不订阅 playhead 帧
- [x] 纯函数测试：`drawWaveformViewportPeaks`
- [x] **v3** stub peaks + 禁用 zoom sync 回灌全长 canvas（`collapseWaveSurferToMediaOnlySpike`）
- [x] **v4** silence WS timer/progress；spike 下跳过 tier-scroll / played-region 补丁
- [x] 深 zoom 8–10s 手测：`playbackFrames≥45` → **v4 PASS**（稳态 ~47–52，峰值 54）

---

## 4. 签收

- [x] spike 报告完成（WS-1 未过闸）
- [x] 选定 **WS-2a**（非 WS-1b）并编码
- [x] S4 失败 + 合成瓶颈 → **WS-2b research ✅**
- [x] 用户确认可进入 WS-2b spike
- [x] WS-2b spike v4 PASS + Plan 定稿
- [ ] arch doc 修订（与 WS-2b 生产化 PR 同步）
- [ ] WS-2b 生产化签收（见 WS-2b acceptance）
