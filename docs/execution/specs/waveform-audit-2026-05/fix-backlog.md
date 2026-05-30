# 波形区修复 backlog（按优先级）

## P1 — 下一刀建议

### ~~B1. defer mount 超时降级~~ ✅ F6

### ~~B2. 长音频 mismatch 不再 force 全量再生~~ ✅ F7

### ~~B3. contextMenu 下沉 controller~~ ✅

- `useTranscriptionLayer.openSegmentContextMenuFromPointer`
- `utils/waveformSegmentContextMenu.ts` + test
- `EditorWaveformPane` 不再内联 hit-test / querySelector

### ~~B4. peakCache 变更不重建 WS~~ ✅ F8

## P2 — 性能 / 结构

### ~~B5. 语段 overlay 虚拟化~~ ✅

- `pickVisibleSegmentIndices` + `WaveformSegmentOverlay` 视口裁剪

### ~~B6. peaks 主线程卸载~~ ✅（rAF 分块）

- `waveformDataToWaveSurferPeaksAsync` + `PeakCache.getWaveSurferPeaksAsync`
- `useWaveformZoomSync` 异步 load

### ~~B7. Rust peaks 缓存命中跳过 probe~~ ✅

- `stale_check_options_cache_fresh` 当全 LOD 存在时用 meta/前端 duration

### ~~B8. 拆分 `useWaveformTimelineController`~~ ✅（部分）

- `useWaveformTimelineMountGate` / `useWaveformTimelineDurationSync`

### ~~B9. 拆分 `WaveformTimeRuler` / `EditorToolbar`~~ ✅

- `WaveformTimeRulerTickLayer` / `EditorToolbarWaveformMenu`

## P3 — 可观测性

### ~~B10. E2E smoke~~ ✅（vitest 链式替代）

- `services/waveform/waveformEngineSmoke.test.ts`
- 完整 Tauri Playwright 待独立 CI 项目

### B11. 手测矩阵填实测

- 见 [hand-test-matrix.md](./hand-test-matrix.md)（自动化列已补）
