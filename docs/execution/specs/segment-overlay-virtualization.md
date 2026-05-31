# Spec: B15 — 密集语段显示（Display / Interaction 分离）

> **状态**：✅ 已实施（2026-05-30，取代 React viewport 裁剪方案）
> **关联**：[`fix-backlog.md` B15](./waveform-audit-2026-05/fix-backlog.md)、[`desktop-waveform-engine.md`](../../architecture/desktop-waveform-engine.md)

## 背景

B5 / B15 曾尝试 `pickVisibleSegmentIndices` + `WaveformSegmentOverlay` React viewport 裁剪。tier scroll 时 metrics 滞后会导致「滚到新区域语段不出现」（回归记录：`b03f717`、B15 手测矩阵）。**禁止**再启用 scroll 驱动的 overlay DOM 卸载。

5000+ 语段时全量 DOM overlay 造成 scroll/layout 卡顿；需在**不**复现 viewport cull 回归的前提下降本。

## 最终方案：Display / Interaction 分离

| 层 | 机制 | 文件 |
|----|------|------|
| **Display** | 视口宽 Canvas 绘制全部 packable 语段色带；scroll 时 imperative `resolveTierViewportMetrics` + rAF 重绘 | `WaveformSegmentBandCanvas`、`drawWaveformSegmentBands` |
| **Interaction** | DOM overlay **仅**选中语段 + 拖拽 draft（≤2 节点）；壳层 hit-test | `WaveformSegmentOverlay`、`selectOverlayInteractiveSegmentIndices` |
| **列表** | 转写列表 React 虚拟窗口 | `EditorSegmentList`、`segmentListVirtualWindow` |

## 不变量

- packable 集仍经 `selectOverlayRenderedSegmentIndices` / `isPlaceholderSegment`（dominant span 排除）。
- 拖拽 draft index 必须在 DOM overlay 中 pin（`selectOverlayInteractiveSegmentIndices`）。
- Canvas `paint()` **不得**依赖 stale React closure 的 `scrollLeftPx`；须读 tier DOM live metrics（wheel-forward 常跳过 scroll 事件）。
- 框选 / 命中 / 创建仍经 `resolveSegmentIndexAtWaveformPointer` 与 packable selector，与 band 绘制共用坐标真源。

## 验收

1. 纯函数：`drawWaveformSegmentBands`、`segmentListVirtualWindow`、`selectOverlayInteractiveSegmentIndices` 单测。
2. 5000 语段级素材：scroll 后 band 与 tier 同步移动（无「语段带 frozen」）。
3. 选中 / 拖拽 / 框选新建行为与 B14 一致。
4. 全量闸门：`npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs`。

## 完成定义

- [x] `WaveformSegmentBandCanvas` sticky 壳内绘制 + tier scroll/wheel 监听
- [x] `WaveformSegmentOverlay` 仅 interactive indices
- [x] `EditorSegmentList` 虚拟列表
- [x] 移除 scroll viewport React cull（`waveformSegmentOverlayVisibility` 仅保留 packable / interactive helpers）

## 历史（勿恢复）

- ~~`pickVisibleSegmentIndices` + overlay 按视口 unmount~~ — 已废弃，见上文回归说明。
