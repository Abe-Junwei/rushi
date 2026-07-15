# 调研：播放中 Seek Playhead Thrash — VisualSeeking + Edge Grounding + P1 Pipeline

> **状态**：P0 ✅；P1 Calculate→Commit + click seek snap 已落地（2026-07-15）  
> **关联**：[`waveform-visual-clock-smoothing-research.md`](./waveform-visual-clock-smoothing-research.md)、[ADR-0008](../../adr/0008-native-audio-playback-transport.md)

---

## 1. 已落地

### 1.1 VisualSeeking（时间层）

1. `beginVisualSeek(T)` — UI 抢占；有 snap 时 **defer** 首帧 publish  
2. `snapPlaybackViewport(T)` — scroll + `RenderSnapshot` + 同帧 flush  
3. `await setTime(T)`  
4. `endVisualSeek(T)` + display grounding 400ms  

Seek 窗内 follow suppress = `∞`（snap 不得清零）。

### 1.2 Edge Seek 几何着陆（方案 3 / P0）

| 项 | 实现 |
|----|------|
| 强制锚点 | `resolveEdgeSeekAnchorScrollPx` |
| 三清空 | `scrollLeft` + `frac=0` + `edgeDriving=false` |
| Grounding 尾窗 | `endVisualSeek` 后 follow suppress +120ms |

### 1.3 P1：原子几何管道（方案 2）

| 项 | 实现 |
|----|------|
| 纯 Calculate | `calculatePlaybackFollowGeometry` — 无副作用 |
| 原子 Commit | `commitPlaybackFollowGeometry` + `writePlaybackRenderSnapshot` |
| Playhead 读快照 | `WaveformViewportPlayhead` 帧内（`isTierScrollFrameActive()`）优先 `readPlaybackRenderSnapshot()`，帧外回落实时映射；快照仅由 playing/subpixel commit 与 snap 写入（暂停 commit 清空，避免跨帧陈旧） |
| 浮点连续性归属 | 连续 reconcile **保留亚像素残差**（`target-round(target)∈[-0.5,0.5]`，锚点/tint 对齐）；**销毁浮点仅在 seek**（`snapPlaybackViewportAfterSeek` edge 分支 `frac=0`） |
| Click seek 缺 snap | `useWaveformPlayback.seek` 接入 `snapPlaybackViewportAfterSeekRef` |
| 原子 seek 序 | `begin(defer)` → `snap`（schedule+flush）→ `setTime` → `end` |

落位：`waveformPlaybackRenderSnapshot.ts`、`tierScrollFrameCoordinator`、`useWaveformPlaybackScrollFollow`、`snapPlaybackViewportAfterSeek`、`applyPeaksOrderedSeek`。

### 1.4 不做

- UI `VirtualClock`（ADR-0008 冲突）

---

## 2. 手测验收

高缩放 + 翻页滚屏 + **点击波形** seek（空白/同段）：seek 瞬间一次焊死，无两三下拉扯。

---

## 3. 签收

- [x] VisualSeeking + display grounding  
- [x] Edge 强制锚点 + frac=0 + grounding 尾窗  
- [x] P1 RenderSnapshot（帧内作用域）+ seek 销毁浮点（连续 reconcile 保残差）+ click seek snap  
