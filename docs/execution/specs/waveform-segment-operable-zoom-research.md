# 调研：超长录音下波形语段可操作宽度 / 水平缩放策略

> **状态**：调研 ✅；intent / acceptance 已链；编码中  
> **关联路线图**：桌面编辑器波形 UX（长音频可编辑性）  
> **关联 spec**：[waveform-segment-operable-zoom-intent.md](./waveform-segment-operable-zoom-intent.md) / [waveform-segment-operable-zoom-acceptance.md](./waveform-segment-operable-zoom-acceptance.md)

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 导入约 3 小时录音后，时间轴可滚、波形可见，但典型口语语段（0.5–5s）在波形上极窄，难点选、难拖边界、易与 8px 边柄命中冲突。 |
| 本仓现状 | **单一线性投影** `timelineWidthPx ≈ durationSec × pxPerSec`（[`waveformProjection.ts`](../../../apps/desktop/src/utils/waveformProjection.ts)、[`pxPerSecConstants.ts`](../../../apps/desktop/src/utils/pxPerSecConstants.ts)）。开文件默认 `resolveDefaultEditingPxPerSec` = fit-all 与滑块上限的**几何平均**；「整段可见」=`viewport/duration`；「适配语段」目标占视口 80%，但最终经 `clampPxPerSecForWaveSurferRender` 受 **peaks 列数 / canvas 宽** 双上限约束。语段绘制 `widthPx = max(2, right−left)`，边柄命中 `WAVEFORM_SEGMENT_EDGE_HIT_PX = 8`（[`waveformSegmentBounds.ts`](../../../apps/desktop/src/utils/waveformSegmentBounds.ts)）。 |
| 成功标准 | 对 ≥2h 媒体：默认或一键缩放后，**中位口语语段（≈2s）可视宽度 ≥ ~48–96px**，边柄可分辨；仍保持单一时间投影（禁止非线性时间轴）；长滚与 peaks 内存可接受。 |

### 1.1 量化（视口 1200px · 时长 ≈10748s ≈3h）

| 缩放策略 | px/s | 2s 语段绘制宽 | 可操作性 |
|----------|------|---------------|----------|
| fit-all | ≈0.11 | clamp → **2px** | 不可用 |
| 几何默认 | ≈0.65 | clamp → **2px** | 不可用 |
| **当前硬上限** `min(40960,327680)/dur` | ≈**3.81** | **≈7.6px** | 仍 < 双边 8px 边柄 |
| 名义「适配语段」未封顶 | ≈480 | ≈960px | 理想，但会被 render cap 压回 ≈3.81 |
| Audacity 式「视口约 8s」 | 150 | 300px | 可用，但全轨宽 ≈1.6Mpx |
| 目标「2s→96px」 | 48 | 96px | 可用，全轨宽 ≈516kpx |

**结论（现状）**：问题不只是「默认太贴 fit-all」，而是 **WS-era 全轨 peaks/canvas 上限把长音频的最大可编辑 zoom 锁死**；在 3h 上连「适配语段」也救不回可操作宽度。WS-2b 已改为视口窗口画 peaks，该上限对 **layout px/s** 是否仍必要，是本调研的核心决策点。

---

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表实现 / 产品 | 核心机制 | 链接或路径 |
|---|------|-----------------|----------|------------|
| A | **多档线性 zoom + Fit Project / Fit Selection / Normal** | [Audacity Zooming](https://manual.audacityteam.org/man/zooming.html)；Premiere / DaVinci 时间轴 | 始终线性时间→像素；**编辑默认不是 Fit Project**，而是「Normal」（约数秒～数十秒入视口）或 Fit Selection；Fit Project 仅作总览 | Audacity manual · 桌面 NLE 惯例 |
| B | **命中扩容 / 最小可操作 clip 宽（几何仍线性）** | Premiere / Resolve / 多数 NLE | 绘制可很窄，但 **hit-test / 边柄热区** 有最小像素（或独立 handle）；时间真源不变 | 产品观察；与 Rushi `hitSegmentEdgeFromLocalPx` 同族 |
| C | **语义/鱼眼非线性缩放** | 学术 fisheye timeline、少数原型 | 选区/playhead 附近局部放大，远处压缩 | 研究原型；**与「单一水平投影」ADR 冲突** |
| D | **按中位语段跨度反推默认 px/s** | 字幕/转写工具常见启发式 | `px/s = targetSegPx / median(span)`，再 clamp 到滑块与内存预算 | 可落在 Rushi `resolveDefaultEditingPxPerSec` |

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用的部分 | 与 Rushi 约束冲突 | 进度 / 内存 / 运维 |
|------|--------|----------------|-------------------|---------------------|
| A 多档线性 + Normal/Fit Selection | **高** | 已有 fit-all / fit-selection / geometric default / zoom bar | 无；需重定「长音频默认」与 **layout cap** | 提高默认 zoom → 时间轴更长；WS-2b 视口 canvas 已按窗口采样，主成本在 scroll 虚拟化（已有） |
| B 命中扩容 | **高** | `WAVEFORM_SEGMENT_EDGE_HIT_PX`、`segmentOverlayGeometry` | 无；须避免「画 2px、热区 32px」导致误点邻段（需按空隙收缩） | 几乎零内存；不解决「看得见」 |
| C 非线性 | **低** | — | **高**：打破 `effectiveTimelinePxPerSec` 单一投影、ruler/overlay/seek 全链 | 高复杂、易回归 |
| D 中位语段默认 | **中高** | `resolveDefaultEditingPxPerSec`、`computeFitSelectionPxPerSec` | 无语段时需回退 A | 与 A 组合；依赖 segments 已加载 |

**本仓已有可复用模块**（必须先列再决定是否扩展）：

- [`pxPerSecFit.ts`](../../../apps/desktop/src/utils/pxPerSecFit.ts) — fit-all / fit-selection / 滑块区间 / 几何默认  
- [`pxPerSecClamp.ts`](../../../apps/desktop/src/utils/pxPerSecClamp.ts) — `clampPxPerSecForWaveSurferRender`（**长音频瓶颈**）  
- [`pxPerSecConstants.ts`](../../../apps/desktop/src/utils/pxPerSecConstants.ts) — `MAX_WAVESURFER_PEAK_COLUMNS`、`TIMELINE_PX_PER_SEC`  
- [`useTranscriptionViewportFit.ts`](../../../apps/desktop/src/pages/useTranscriptionViewportFit.ts) — 适配语段命令  
- [`waveformSegmentBounds.ts`](../../../apps/desktop/src/utils/waveformSegmentBounds.ts) — 几何与边柄命中  
- [`desktop-waveform-engine.md`](../../architecture/desktop-waveform-engine.md) — WS-2b 视口 peaks；**单一水平投影**硬约束  

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| 选定方案 | **A + D 为主，B 为辅**：① 评估并放宽/拆分 **layout zoom 与 peaks 列数上限**（WS-2b 下 layout 不必再绑死 `40960/duration`）；② 长音频默认改为「目标可视秒数」或「中位语段→目标像素」的线性 px/s（Audacity Normal 同类）；③ 保留并强化 fit-selection；④ 为极窄段增加 **命中最小宽**（不改时间真源）。 |
| 不做什么 | **不做** 非线性/鱼眼时间轴；**不做** 第二套投影；**不**为总览强行保持 fit-all 作为编辑默认。 |
| 与 ADR / architecture 关系 | 对齐「单一水平投影」；修正 pre-WS-2b 全轨 canvas 假设对 layout zoom 的过度约束（architecture 应注明：peaks LOD/列数上限约束 **draw**，不等价于 layout 上限）。 |
| 风险与 spike 项 | **Spike（≤0.5 天）**：在 3h 文件上将 layout px/s 提到 48–56，确认 PeakCache 视口绘制、scroll、fit-selection、内存；量测 `timelineWidthPx` 与滚动流畅度。若仍卡，再定 soft max（例如 timeline ≤ 512k–1M px）而非 `40960/dur`。 |

### 4.1 推荐算法（落码前定稿用）

1. **`resolveLongMediaEditingPxPerSec(viewport, duration, segments?)`**  
   - 优先：若有 packable 语段，取中位跨度 `m`，`px = clamp(targetSegPx / m)`（`targetSegPx` 建议 64–96）。  
   - 否则：Audacity 式 `px = viewportWidth / targetVisibleSec`（`targetVisibleSec` 建议 30–60）。  
   - 再与滑块 max、**新的 layout soft-cap**（非旧 peaks 列硬顶）取 min。  

2. **Layout vs draw cap 分离**  
   - `layoutPxPerSec`：服务操作宽度与 scroll。  
   - `drawPxPerSec` / peaks resample：继续受 LOD 与性能约束（可低于 layout 或 quantize）。  

3. **Hit expansion**  
   - `effectiveHitWidth = max(paintedWidth, MIN_HIT_PX)`，向段心扩展；与邻段冲突时对半收缩。边柄在 hit 坐标系计算，避免 2px 段被 16px 边柄吞掉。  

---

## 5. 落位预告（非最终实现）

| 层 | 文件 / 模块 | 变更类型 |
|----|-------------|----------|
| Rust | — | 无 |
| UI utils | `pxPerSecConstants.ts` / `pxPerSecClamp.ts` / `pxPerSecFit.ts` | 拆 layout/draw cap；新增长音频默认 |
| UI hook | `useWaveformZoom` / `useWaveformMediaZoomResetEffect` / viewport fit | 换文件默认走新算法 |
| Overlay | `waveformSegmentBounds.ts` | 最小命中宽 |
| 文档 | `desktop-waveform-engine.md` | 注明 WS-2b layout≠peaks 列上限 |
| 测试 | `pxPerSec*.test.ts`、segment bounds tests | 3h 数值用例：2s 段 ≥ 阈值 |

---

## 6. 签收

- [x] 调研 brief 完成  
- [x] intent / plan / acceptance 已链接本文  
- [x] 用户或路线图确认可进入编码  

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-07-13 | 初版：线性投影现状 + 3h 量化；Audacity/NLE/命中扩容/非线性对照；选定 A+D+B，明确 WS-2b 下应重审 layout render cap |
| 2026-07-13 | 签收：进入编码；layout soft-cap / 长音频默认 45s / 命中扩容 |
