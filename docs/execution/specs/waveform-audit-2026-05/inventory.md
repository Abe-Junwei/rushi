# 波形区文件清单（轮次 0）

## 前端 — 装配层

| 文件 | 行数 | 测试 |
|------|------|------|
| `hooks/useWaveformTimelineController.ts` | ~213 | 间接 |
| `pages/useTranscriptionLayer.ts` | ~255 | ✅ |
| `components/editor/EditorWaveformPane.tsx` | ~268 | — |
| `pages/transcriptionLayerTypes.ts` | 小 | — |

## 前端 — WS / 挂载

| 文件 | 行数 | 测试 |
|------|------|------|
| `hooks/useProjectWaveform.ts` | ~174 | 弱 |
| `hooks/useProjectWaveformMount.ts` | ~253 | — |
| `hooks/useProjectWaveformTypes.ts` | ~32 | — |
| `hooks/projectWaveformWaveSurferEvents.ts` | ~100 | — |
| `utils/waveformMountPolicy.ts` | ~15 | ✅ |

## 前端 — Peaks

| 文件 | 行数 | 测试 |
|------|------|------|
| `hooks/useWaveformPeaks.ts` | ~250 | — |
| `services/waveform/PeakCache.ts` | ~150 | ✅ + bench |
| `services/waveform/audiowaveformDat.ts` | ~77 | ✅ |
| `services/waveform/peakLevels.ts` | ~22 | ✅ |
| `services/waveform/waveformPeaksPrewarm.ts` | ~18 | — |
| `services/waveform/waveformPeaksPhase.ts` | ~35 | ✅ |
| `tauri/waveformPeaksApi.ts` | ~56 | — |

## 前端 — Zoom / 滚动

| 文件 | 行数 | 测试 |
|------|------|------|
| `hooks/useWaveformZoomSync.ts` | ~264 | ✅ |
| `hooks/useWaveformZoom.ts` | ~69 | ✅ |
| `hooks/useTierScrollSync.ts` | ~220 | ✅ |
| `hooks/useTierScrollLayout.ts` | ~112 | ✅ |
| `hooks/useWaveformPlaybackScrollFollow.ts` | ~92 | ✅ |
| `pages/useTranscriptionViewportFit.ts` | ~150 | ✅ |
| `utils/pxPerSec.ts` | ~220 | ✅ |
| `utils/waveformZoomBarState.ts` | ~120 | ✅ |
| `utils/waveformZoomScroll.ts` | ~35 | ✅ |

## 前端 — 坐标 / Overlay

| 文件 | 行数 | 测试 |
|------|------|------|
| `utils/waveformProjection.ts` | ~145 | ✅ |
| `utils/waveformTimelineMetrics.ts` | ~43 | ✅ |
| `utils/waveformSegmentBounds.ts` | ~160 | ✅ |
| `utils/waveformSegmentOverlayGeometry.ts` | ~75 | ✅ |
| `components/WaveformSegmentOverlay.tsx` | ~100 | — |
| `hooks/useWaveformSegmentOverlay.ts` | ~88 | — |
| `hooks/useWaveformSegmentDrag.ts` | ~255 | — |

## 前端 — UI 组件

| 文件 | 行数 | 测试 | arch-guard |
|------|------|------|------------|
| `components/WaveformTimeRuler.tsx` | ~333 | 间接 | ⚠️ hotspot |
| `components/WaveformLiveTimeRuler.tsx` | ~101 | — | |
| `components/WaveformMinimapStrip.tsx` | ~148 | — | |
| `components/WaveformZoomBar.tsx` | ~209 | — | |
| `components/EditorToolbar.tsx` | ~353 | — | ⚠️ hotspot |
| `styles/components/waveform.css` | ~65 | — | |

## Rust — Peaks

| 文件 | 职责 | 测试 |
|------|------|------|
| `waveform_peaks_cmd.rs` | ensure / status | 间接 |
| `waveform_peaks_generate.rs` | Symphonia 解码生成 | ✅ fixture |
| `waveform_peaks.rs` | 锁、路径、stale | ✅ |
| `waveform_peaks_gc.rs` | 孤儿清理 | ✅ |
| `waveform_peaks_cache_cmd.rs` | clear cache | — |
| `waveform_peaks_ffmpeg.rs` | remux fallback | — |

## 死代码扫描（轮次 0）

已移除路径 **无残留引用**：

- `WaveformPeaksTileLayer` / `drawWaveformPeaksTile` / `useWaveformTileLifecycle`
- `WaveformOverviewStrip` / `WaveformGlobalStripShell`
- `ws.setScroll`

## 文档对照 `desktop-waveform-engine.md`

| 条目 | 代码一致 |
|------|----------|
| WS-only 渲染 | ✅ |
| tier scroll 真源 | ✅ |
| waveformProjection 坐标 | ✅ |
| defer mount + peaks 直挂 | ✅（2026-05-29 新增） |
| 8px 量子档 zoom | ✅ |
| C2 偏好 / minimap | ✅ |
| openFile 重复 prewarm | ✅ 已移除 |

## 测试覆盖空洞（轮次 8）

- `useWaveformPeaks.ts` — 无单测
- `useProjectWaveformMount.ts` — 无单测（defer + peaks-at-create）
- `WaveformSegmentOverlay.tsx` — 无单测
- `WaveformMinimapStrip.tsx` — 无单测
- E2E 波形路径 — **无**
