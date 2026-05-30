# Spec: B15 — overlay 虚拟化（可靠 viewport 指标）

> **状态**：✅ 已实施
> **关联**：[`fix-backlog.md` B15](./waveform-audit-2026-05/fix-backlog.md)

## 背景

B5 引入 `pickVisibleSegmentIndices`，后因 tier scroll 时 metrics 滞后导致「滚到新区域语段不出现」，虚拟化被关闭（全量渲染）。此后 `useTierViewportMetricsFrame` + `resolveTierViewportMetrics` 已在 scroll/wheel/resize 上 bump 帧（TRUTH-006），具备重启条件。

## 目标

- `WaveformSegmentOverlay` 经 `useTierViewportMetricsFrame` 读 scroll/viewport，再 `pickVisibleSegmentIndices` 裁剪。
- `viewportWidthPx < 32` 时仍全量 fallback（既有不变量）。
- 拖拽 draft 语段 index **pin** 在可见集，避免拖出视口时 DOM 卸载。
- dominant span 仍排除。

## 验收

1. 纯函数：视口内裁剪、unreliable fallback、dominant 排除、pinned draft。
2. scroll 到新 time window 时 picked 集变化（模拟 scrollLeft 变更）。
3. 全量闸门通过。

## 完成定义

- [x] `selectOverlayRenderedSegmentIndices` + `WaveformSegmentOverlay` 经 `useTierViewportMetricsFrame` 接线
- [x] pinned draft index；dominant 排除；unreliable viewport fallback
- [x] 测试 + 全量闸门
