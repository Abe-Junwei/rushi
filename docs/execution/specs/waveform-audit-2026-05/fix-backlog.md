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

## P2 — 语段编辑（横向调研启示，2026-05-30）

> 来源：dominant-span 重叠 bug 根因复盘后对其他波形/字幕编辑器的横向调研。根因修复（单一 `selectPackableSegments` 真源 + 跨路径不变量测试 + 架构守卫）已落地，见 [`docs/architecture/desktop-waveform-engine.md` §语段语义真源](../../../architecture/desktop-waveform-engine.md)。以下为尚未实施的改进。

### ~~B12. 占位语段：启发式 → 显式类型~~ ✅（方案 A 持久化列）

- `SegmentDto.kind`（TS + Rust）+ DB `kind` 列（`migrate_segments_kind`）；ASR 整轨兜底标 `placeholder`、子句标 `speech`。
- `isPlaceholderSegment` / `is_placeholder_segment`：显式 kind 优先，缺省回退 0.85 启发式；selector 与 sanitize 共用。
- spec：[`segment-placeholder-explicit-type.md`](../segment-placeholder-explicit-type.md)

### ~~B13. 重叠策略升为「一等模式」~~ ✅（create 路径）

- `SegmentOverlapPolicy = "trim" | "reject" | "allow"` + 纯函数 `resolveCreateRangeForPolicy`（`segmentTimeRange.ts`）。
- `insertSegmentFromTimeRange` 接可选 `policy`，默认 `trim`（现行行为不变）。
- 暴露模式（修饰键 / 设置）→ **B14** ✅（Shift+框选 allow、Alt 关吸附）；拖拽 resize 统一策略仍留后续。

### ~~B14. 边界吸附 + 修饰键~~ ✅

- `segmentTimeSnap`（8px 等效阈值、packable 边界 + playhead + 轨道端点）；Alt 关吸附；Shift+框选 → B13 `allow`。
- 逻辑集中在 `useWaveformSegmentDrag` + 纯函数；spec：[`segment-boundary-snap-modifiers.md`](../segment-boundary-snap-modifiers.md)

## P3 — 语段编辑（横向调研启示，延后）

### ~~B15. overlay 虚拟化用可靠 viewport 指标重启~~ ✅

- `useTierViewportMetricsFrame` + `selectOverlayRenderedSegmentIndices`；unreliable viewport 全量 fallback；drag draft pin。
- spec：[`segment-overlay-virtualization.md`](../segment-overlay-virtualization.md)

### ~~B16. gap / 连续性策略集中化~~ ✅

- `segmentGapPolicy.ts`：邻接 clamp、insert-after 空档、插入 index；controller 接线。
- spec：[`segment-gap-policy.md`](../segment-gap-policy.md)
