# 桌面端波形引擎（P1–P5′）

## 数据流

```text
导入/打开 (Tauri)
  ensure_waveform_peaks → projects/{id}/peaks/{fileId}_L{0,1,2}.dat

编辑器 (React)
  useWaveformPeaks → PeakCache.fromLevelUrls
  WaveformPeaksViewportLayer + WaveformPeaksCanvas  ← 可见 peaks 绘制（P3）
  useProjectWaveform + WaveSurfer                     ← 播放 / seek / 无 peaks 回退 decode
  useWaveformZoomSync                                 ← px/s 变更时 resample+load；peaks 路径 skip ws.zoom
  WaveformSegmentOverlay                              ← 语段 DOM（P4，非 WS Regions）
```

## 滚动真源

- **tier** `tierScrollRef.scrollLeft` 为 UI 真源（overlay、Canvas draw、ruler、全局条视口框）。
- WaveSurfer 内部 scroll 通过 `useTierScrollSync` 同步，不反向驱动语段位置。

## 偏好（localStorage）

| Key | 含义 |
|-----|------|
| `rushi.p1.waveformPxPerSec` | 横向缩放 |
| `rushi.p1.waveformHeightPx` | 主波形高度 |
| `rushi.p1.autoFitSelectionToViewport` | 跟随语段模式 |
| `rushi.p1.waveformGlobalStripCollapsed` | 全局条折叠（持久化，换文件不强制展开） |
| `rushi.p1.waveformGlobalPlaybackRate` | 全局播放速度（主 transport） |
| `rushi.p1.tabAdvanceLoopsSegment` | Tab 切段并播放时自动语段循环（默认开） |

## 播放头与全局条

- **主波形** playhead 由 `WaveformTimeRuler` / `WaveformLiveTimeRuler` 绘制；播放或缩放拖动时 `liveViewport` 拉高 tier scroll 采样率（`useWaveformViewportMetrics`）。
- **全局条展开**时另有 minimap playhead（`WaveformOverviewStrip`）；**折叠**后 minimap 隐藏，**主区 playhead 仍可见、仍随播放更新**。
- 选中语段后 seek 到 **语段起点**（非中点）。

## 已知限制

- 生产路径为 **PeakCache + WaveformPeaksCanvas + hook 编排**（`useProjectWaveform`、`useWaveformZoomSync`、`useTranscriptionViewportFit`）；曾规划的 `WaveformEngine` facade 已移除（2026-05-28，无接线）。
- WS 仍负责 MediaElement 播放与无 peaks 时的 decode 波形。
- peaks 为 mono mixdown。

## 相关 spec

- `docs/execution/specs/waveform-engine-refactor-acceptance.md`
- `docs/execution/specs/waveform-engine-refactor-p5-global-strip.md`
- `docs/execution/specs/waveform-engine-refactor-p6-overlay-split.md`
