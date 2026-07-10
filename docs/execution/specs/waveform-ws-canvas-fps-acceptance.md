# Acceptance：WaveSurfer canvas / progress 帧率（WS-FPS）

> **调研**：[`waveform-ws-canvas-fps-research.md`](./waveform-ws-canvas-fps-research.md)  
> **WS-2b 后备调研**：[`waveform-ws2b-viewport-render-research.md`](./waveform-ws2b-viewport-render-research.md)  
> **plan**：[`waveform-ws-canvas-fps-plan.md`](./waveform-ws-canvas-fps-plan.md)  
> **状态**：WS-1/WS-2a **FAIL（合成瓶颈）** → WS-2b spike PASS → **生产化签收**（2026-07-10）· S1–S6 PASS

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

**阶段 0 判据结果（2026-07-10）**：`audioTicks≈playbackFrames`（稳态 ~16–24）→ **合成瓶颈** → 跳过 1C 边际 → 开 WS-2b research。

- [x] S4 深 zoom `playbackFrames≥45` → **FAIL**（触发 WS-2b）
- [x] S5/S6 移交 WS-2b acceptance 签收（见下）

---

## 3. WS-2b（生产化签收）

> Acceptance：[`waveform-ws2b-viewport-render-acceptance.md`](./waveform-ws2b-viewport-render-acceptance.md)

| 项 | 状态 |
|----|------|
| 选定方案 | Peaks **模型** + Rushi 视口 canvas；WS = media-only |
| Spike v4 | **PASS**（~47–52 fps） |
| 生产化编码 | **完成**（去 spike flag；collapse / silence / viewport peaks / wash tint） |
| Architecture | **已修订**（`desktop-waveform-engine.md`） |
| 手测 | S1–S6 **全部 PASS**（含 S4 横滚手感，2026-07-10 用户确认） |

---

## 4. 签收

- [x] spike 报告完成（WS-1 未过闸）
- [x] 选定 **WS-2a**（非 WS-1b）并编码
- [x] S4 失败 + 合成瓶颈 → **WS-2b research ✅**
- [x] 用户确认可进入 WS-2b spike
- [x] WS-2b spike v4 PASS + Plan 定稿
- [x] arch doc 修订（与 WS-2b 生产化同步）
- [x] **WS-2b 生产化签收**（见 WS-2b acceptance；S1–S6 PASS）
