# 波形听打体验 P1/P2

> 2026-05-28 实施清单与验收。

## P1 — 体验闭环

| 项 | 状态 |
|----|------|
| 全文件级播放速度（与 px/s 分离） | ✅ `WaveformGlobalPlaybackSpeed` + `useWaveformGlobalPlayback` |
| 跳转到时间（m:ss / h:mm:ss） | ✅ `WaveformGoToTime` + `parseMediaTimeInput` |
| 全局条与主区 playhead 策略文档化 | ✅ `desktop-waveform-engine.md` + hand-test §P5′ |
| fit 减少 ws.load（8px/s 分档） | ✅ `quantizePxPerSecForPeaksLoad` |
| 选中语段 seek 到起点 | ✅ `segmentStartSec` + `selectSegmentAt` |

## P2 — 可选增强

| 项 | 状态 |
|----|------|
| Tab 播下一段自动 loop | ✅ `readStoredTabAdvanceLoopsSegment`（默认开）+ `preserveLoopForNextSegmentSelect` |
| Tab/语段播放用全局变速 | ✅ `playSegmentAtIndex({ useGlobalPlaybackRate: true })` |
| 低置信波形标色 | ✅ 已有 `waveformRegionFillColor`（`low_confidence`） |

## 偏好

- `rushi.p1.tabAdvanceLoopsSegment`：`1` 开 / `0` 关；缺省 **开**。
