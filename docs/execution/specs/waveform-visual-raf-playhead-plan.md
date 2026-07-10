# Plan：视觉播放头独立 rAF 轮询 media

> **调研**（编码前必读）：[`waveform-visual-raf-playhead-research.md`](./waveform-visual-raf-playhead-research.md)
> **acceptance**：[`waveform-visual-raf-playhead-acceptance.md`](./waveform-visual-raf-playhead-acceptance.md)
> **架构**：[`desktop-waveform-engine.md`](../../architecture/desktop-waveform-engine.md) §播放时钟（本轮须修订）
> **状态**：待用户确认后编码（VRP 先行；WR-2/WR-4/SEL-1 后续）

---

## 0. 目标数据流（修复后）

```
播放中 (isPlaying && isReady)
  └─ rAF loop（本仓自驱，~60Hz）
       └─ t = getRawMediaPlayheadTimeSec()   // ws.getCurrentTime()，无外推
       └─ visualTimeSecRef = clamp(t)
       └─ schedulePlaybackViewportFrame(t)
            ├─ scroll-follow (priority 0)
            └─ playhead DOM transform (priority 1)  // setDirectLayoutStyle

WS audioprocess（稀疏，13–17Hz）
  └─ 可选：仍写 visualTimeSecRef = t（同值，无害）
  └─ 不再作为「唯一」视觉帧源；probe 保留 audioTicks 对照

Seek / pause
  └─ syncDisplayPlayheadAfterSeek / syncPausedTime（不变）
  └─ 停播：cancel rAF loop
```

**正确性契约（相对 single-clock，不回退）**：

- display = decision = `getDisplayPlayheadTimeSec()` → ready 时 = `visualTimeSecRef`
- `visualTimeSecRef` 永远等于「最近一次读到的 media 时间」或 seek 同栈写入，**从不** `last + dt * rate`
- 空格起播仍用 display 时间决策

---

## 1. 分片 VRP（本轮唯一编码薄片）

### VRP-1　playing 态 rAF 驱动

**落位**：`useWaveformVisualPlayheadClock.ts`

1. `useEffect` 依赖 `[isPlaying, isReady]`：
   - `isPlaying && isReady`：`requestAnimationFrame` 循环；每帧读 `getRawMediaPlayheadTimeSec()`，clamp 到 duration，写 `visualTimeSecRef`，调 `schedulePlaybackViewportFrame(t)`。
   - 否则：`cancelAnimationFrame`，清 loop id。
2. `onWsAudioprocess`：保留写 ref（锚点/兼容），**可**仍 schedule 一帧；但即使 WS 稀疏，rAF 已保证视觉帧率。为避免双 schedule 浪费，推荐：**playing 时 `onWsAudioprocess` 只更新 ref，不 schedule**；由 rAF 统一 schedule。暂停态 seeking 仍走 `syncDisplayPlayheadAfterSeek` → schedule。
3. 禁止任何 `playbackRate * elapsed` 外推。

**验证**：单测 mock `requestAnimationFrame` + `getRawMediaPlayheadTimeSec` 递增 → `subscribePlayheadFrame` 收到多次；停播后不再回调。

### VRP-2　coordinator / 订阅者边界

**落位**：`tierScrollFrameCoordinator.ts`（尽量少改）

- 保持 `schedulePlaybackViewportFrame` 单 rAF 合并语义。
- rAF loop 在 clock 内自管即可，**不必**在 coordinator 再开第二套 loop（避免双 rAF）。
- 确认 `useWaveformPlaybackScrollFollow` 在 60fps 下仍有自身节流/阈值（若无，VRP-3 补）。

### VRP-3　playback-follow 节流检查

**落位**：`useWaveformPlaybackScrollFollow.ts`

- 读现有逻辑：若每帧都写 `scrollLeft`，60fps 可能抖/费。
- 若已有「仅当 playhead 近边缘才 scroll」或像素阈值，保留。
- 若无：加最小像素阈值（例如 scroll 变化 < 0.5px 跳过），避免无意义 DOM scroll。

### VRP-4　文档 + probe 验收字段

- `desktop-waveform-engine.md`：删除「audioprocess ~16ms 保证」；改为「media 真源 + playing rAF 轮询」。
- acceptance 手测：`playbackFrames` 稳态 ≥ 45/sec；`audioTicks` 可仍低（对照用）。
- 更新 `waveform-playhead-single-clock-research.md` §2 脚注：前提「audioprocess≈60」在 WKWebView 不成立；终态由本文 supersede 驱动源，**不**恢复 extrapolation。

### VRP-5　测试

| 文件 | 断言 |
|------|------|
| `useWaveformVisualPlayheadClock.test.ts` | playing 启动 rAF；raw media 变化 → frame 回调；pause 停止；seek sync 仍写 ref |
| `WaveformViewportPlayhead.test.tsx` | 不回归 |
| `visualPlayheadClock` / display | 仍无外推 |
| probe 可选 | 文档化手测命令，不强制 CI 读 desktop.log |

---

## 2. 后续分片（方案级，本轮不编码）

### WR-2　zoom 去抖（中风险）

- 入口对 `load-peaks` 尾沿去抖 120–160ms；中间步 `finish-zoom` + LOD 拉伸。
- 复用 `peaksLoadSeqRef` 取消陈旧 load。
- 验证：连续 N 步 zoom 只 1 次 `load-peaks`。

### WR-4　resample Worker（高风险，需 spike）

- spike：Vite module worker + Tauri CSP `worker-src`。
- `PeakCache.getWaveSurferPeaksAsync` 走 worker；失败回退同步。
- 验证：深 zoom 无 >50ms 主线程 resample 长任务。

### SEL-1　点击语段延迟（独立调研）

- 扩展 `selection-profile`：记录 profile 起点前等待、React commit、`flushSelectedIdx` 细分。
- 先修已暴露的 `flushSelectedIdx=217ms`；再查 `total − syncPath` 缺口（常 >1s）。

---

## 3. 执行时序

| 步 | 内容 | 闸门 |
|----|------|------|
| 1 | 用户确认本 plan | — |
| 2 | 编码 VRP-1…5 | typecheck + test + guard；手测 H1–H4 |
| 3 | 手测确认顺滑后 | 再开 WR-2 / WR-4 / SEL-1 各自 research 更新或新 brief |

---

## 4. 明确不做（本轮）

- 不恢复 extrapolation
- 不改 CSP / `setDirectLayoutStyle` 边界
- 不让 ruler 重新订阅 playhead 帧重绘
- 不在本 PR 做 Worker / selection 大改
