# 归档：canvas / content-tile 波形路径（2026-05 前）

**状态**：`superseded` — 2026-05-29 起桌面端波形改为 **WaveSurfer-only** 主渲染，本目录内规格不再指导实施。

**现行真源**：[desktop-waveform-engine.md](../../../architecture/desktop-waveform-engine.md)

**相关 ADR**（已标 superseded，保留决策史）：

- [ADR-0004](../../../adr/0004-waveform-peaks-content-tile-renderer.md) — content-tile canvas peaks
- [ADR-0005](../../../adr/0005-waveform-single-scroll-authority.md) — tier scroll + layout/draw 双轨

## 目录说明

| 前缀 | 内容 |
|------|------|
| `waveform-content-tile-renderer-*` | ADR-0004 实施三件套 + spike / audit |
| `waveform-single-scroll-consolidation-*` | ADR-0005 tier scroll 收敛 |
| `waveform-engine-convergence-*` | canvas + WS 边界收敛（未完整落地即被 WS-only 取代） |
| `waveform-engine-refactor-*` | P1–P6 重构、全局条、overlay 拆分 |
| `waveform-maturity-*` | 成熟度调研与 gap 评估 |
| `waveform-navigation-product-decisions` | 导航/缩放产品决策（部分结论仍见 architecture 文档） |
| `waveform-transcription-ux-p1` | P1 转写 UX 手测登记 |

## 为何归档

- 已删除实现：`WaveformPeaksTileLayer`、`WaveformProgressOverlay`、全局 overview 条、`drawWaveformPeaksTile` / `tileGeometry` 等。
- 现行路径：`PeakCache` → `ws.load(peaks)` / `ws.zoom(decode)`；tier scroll + `waveformProjection` 坐标系保留。

勿在本目录基础上开新 PR；新需求直接改代码与 `desktop-waveform-engine.md`。
