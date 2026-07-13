# 调研：长音频高 zoom 下视口 peaks 细节（WS-2b 窗口采样）

> **状态**：调研 ✅；编码中  
> **关联**：[`waveform-segment-operable-zoom-research.md`](./waveform-segment-operable-zoom-research.md)（layout soft-cap 后遗症）  
> **关联 spec**：[waveform-viewport-peaks-detail-intent.md](./waveform-viewport-peaks-detail-intent.md) / [waveform-viewport-peaks-detail-acceptance.md](./waveform-viewport-peaks-detail-acceptance.md)

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 3h 级录音可放大到「视口约数十秒」，语段可操作，但主波形呈粗阶梯块（每柱约十余 CSS px）。 |
| 本仓现状 | WS-2b [`WaveformViewportPeaksCanvas`](../../../apps/desktop/src/components/WaveformViewportPeaksCanvas.tsx) 从 PeakCache 取**整轨** peaks，经 [`resampleWaveformForPxPerSec`](../../../apps/desktop/src/services/waveform/audiowaveformDat.ts) → `capWaveformPeakColumns(40960)`；再按 `timelineX/timelineWidth×columns` 画视口。Layout 已可达 ~27–100 px/s，整轨仍只有 ≈`40960/dur` ≈ **3.8 列/秒** → 视口被拉伸成块。 |
| 成功标准 | 3h · 视口约 14s（~85 px/s）：可见区有效列数 ≳ 视口宽（或受 LOD 上限，如 L2=200 pps 时 ≥ `visibleSec×200` 下采样到视口宽）；阶梯块消失；滚动不 OOM。 |

### 量化（3h · 视口 1200px · 可见 14s）

| 路径 | 视口内有效列数 | 观感 |
|------|----------------|------|
| 现状整轨 40960 | ≈53 | 极粗 |
| 视口窗口 × L2(200pps) | min(1200, 14×200)=1200 | 细 |
| 视口窗口 × L3(800pps) | 1200（下采样） | 细 |

---

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表 | 核心机制 | 链接 |
|---|------|------|----------|------|
| A | **视口/瓦片 peaks** | Audacity 显示、Peaks.js overview+zoomwave、本仓 WS-2b 计划 | 只对可见时间窗从多 LOD 取峰；zoom 换更细 LOD | [waveform-ws2b-viewport-render-research.md](./waveform-ws2b-viewport-render-research.md)；BBC Peaks.js |
| B | **整轨高密数组** | 早期 WaveSurfer 全长 peaks | `duration×px/s` 全长 Float32 | 内存 ∝ 时长×zoom；与 Rushi 长音频冲突 |
| C | **区域 on-demand 精解码** | 部分 DAW | 可见区从 PCM 现算 | CPU/IO 重；本仓已有 audiowaveform LOD |

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用 | 冲突 | 内存/UX |
|------|--------|----------|------|---------|
| A 视口窗口 | **高** | `PeakCache` LOD、`pickPeakLodLevel`、`computeWaveformViewportPeaksWindow`、paint 脏区 | 无 | 窗口数组 ~视口宽×2 float；可 LRU |
| B 抬整轨 cap | 低 | `MAX_WAVESURFER_PEAK_COLUMNS` | 与长音频预算冲突 | 易 OOM |
| C 现算 PCM | 低 | decode 回退 | 与 peaks 真源并行 | 卡顿 |

**已有模块**：`PeakCache`、`peakLevels`、`drawWaveformViewportPeaks`、`WaveformViewportPeaksCanvas`。

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| 选定方案 | **A**：从已选 LOD 按视口窗口同步提取 min/max 列（目标 **1 CSS px ≈ 1 列**；LOD 更密则窗口内下采样；更疏则最近邻，受 L3 上限）。 |
| 不做什么 | 不抬整轨 40960 作主波形细节；不新造 LOD 生成器；不改 layout soft-cap；WS stub 全轨 inject 可仍用旧路径。 |
| 对齐 | WS-2b「可见主波形 = 视口 canvas」；单一时间投影不变。 |
| 风险 | 滚动时同步提取；须复用已有 `needsRepaint` 脏区，避免每帧全量。 |

---

## 5. 落位预告

| 层 | 模块 | 变更 |
|----|------|------|
| UI service | `extractViewportPeaks.ts`（或 audiowaveformDat） | 窗口提取纯函数 |
| PeakCache | `getViewportWindowPeaks*` | 确保 LOD + 提取 |
| Canvas | `WaveformViewportPeaksCanvas` + draw | 窗口本地 peaks 1:1 绘制 |
| Docs/tests | architecture + focused tests | 3h 列数断言 |

---

## 6. 签收

- [x] 调研 brief 完成  
- [x] intent / acceptance 链接  
- [x] 用户确认执行  

| 日期 | 说明 |
|------|------|
| 2026-07-13 | 初版：整轨 40960 拉伸诊断 + 视口窗口采样决策 |
