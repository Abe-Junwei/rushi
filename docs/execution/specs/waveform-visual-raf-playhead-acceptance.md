# Acceptance：视觉播放头独立 rAF 轮询 media

> **调研**：[`waveform-visual-raf-playhead-research.md`](./waveform-visual-raf-playhead-research.md)
> **plan**：[`waveform-visual-raf-playhead-plan.md`](./waveform-visual-raf-playhead-plan.md)
> **状态**：待执行

---

## 1. 行为矩阵

| 场景 | 修复前 | 期望 |
|------|--------|------|
| 稳态播放 | `playbackFrames`≈10–12/sec，playhead 肉眼卡顿 | `playbackFrames`≥45/sec；playhead 视觉顺滑 |
| 时间真源 | `visualTimeSecRef` 仅由稀疏 `audioprocess` 推 | 每帧 = `getRawMediaPlayheadTimeSec()`（无外推） |
| 空格起播语段 | display/decision 同源（single-clock） | **保持**：起播位置与视觉差 < 16ms，不跳段头 |
| Seek（Peaks 序） | `syncDisplayPlayheadAfterSeek` → `setTime` | 不变 |
| Pause | `lastTimeUiCommitRef` / `syncPausedTime` | 不变；停播取消 rAF |
| 标尺 | WR-1 后稳态不重绘 | **保持** `rulerRepaint≈0`（不重新订阅 playhead 重绘） |

---

## 2. 自动化

- [x] `useWaveformVisualPlayheadClock.test.ts`：playing 启动 rAF；raw 递增触发 frame；pause 停止；无 rate-based lead
- [x] seek / paused sync 既有测试不回归
- [x] `WaveformViewportPlayhead` / scroll-follow 相关测试不回归
- [x] `npm run typecheck` / focused tests / `node scripts/check-architecture-guard.mjs` 绿

---

## 3. 手测（desktop.dev + profile）

```js
__rushiScrollProfile.enable()
// 播放 8–10s hands-off
__rushiScrollProfile.disable()
```

- [ ] H1 稳态：`playbackFrames`≥45；`audioHandler`/`playbackSub` 仍接近 0
- [ ] H2 `audioTicks` 可仍 <30（对照）；视觉顺滑不依赖它
- [ ] H3 空格起播：不跳段头；与 playhead 对齐
- [ ] H4 pause/seek：无回退、无残影
- [ ] H5 `rulerRepaint` 稳态仍≈0

---

## 4. 文档

- [x] `desktop-waveform-engine.md` §播放时钟已修订
- [x] single-clock research 脚注：驱动源由本文 supersede
- [x] 三件套互链

---

## 5. 签收

- [x] VRP 编码完成并验证（机器闸门）
- [ ] 用户手测 H1–H5 通过
- [ ] WR-2 / WR-4 / SEL-1 已记入后续队列（不阻塞本薄片签收）
