# 调研：嵌入时间尺 Canvas 化（与 band / scroll frame 对齐）

> **状态**：规划门禁（2026-06-20）  
> **触发**：滚动回退修复后，DOM 时间尺仍出现同步/空白/渲染问题；架构上 ruler 与 `WaveformSegmentBandCanvas` 不同范式。  
> **关联**：[`desktop-waveform-engine.md`](../../architecture/desktop-waveform-engine.md)、[`waveform-playhead-clock-unification-research.md`](./waveform-playhead-clock-unification-research.md)、[`waveform-unified-scroll-stage-research.md`](./waveform-unified-scroll-stage-research.md)  
> **门禁**：Plan / acceptance 须链接本文后再编码。

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | 编辑长音频时横滚、播放跟随（center/edge）、缩放时间尺；期望底边 22px 嵌入标尺与波形、语段、playhead **同帧对齐**，无空白、无拖影、无跳动。 |
| **本仓现状** | 舞台 split：timeline 内容层 native scroll（WS / band / overlay）；sticky viewport chrome（playhead + `WaveformLiveTimeRuler`）。标尺用 **React DOM**（`WaveformTimeRulerTickLayer` SVG + `<span>` 标签）+ **`useWaveformTimeRulerMetrics`** 虚拟 tick 窗 + imperative **`translate3d(base - scrollLeft)`**（`WaveformTimeRuler.tsx`）。Band 用 **`drawWaveformSegmentBands` + `subscribeTierScrollFrame`**（`WaveformSegmentBandCanvas.tsx`）。两套 scroll 热路径范式并存；曾试 scroll-track（全 timeline 宽 + translate）与 viewport+delta，均难在 sticky 壳下长期稳定。架构 doc 仍引用 `useWaveformRulerScrollTrack` 为生产路径，与代码不一致。 |
| **成功标准** | scroll / 播放跟随 / zoom 手测标尺与波形对齐；scroll 热路径无 React commit；`npm run test` + 架构守卫绿；与 band/playhead 同读 `resolveTierScrollLeftPx` + 同帧 `tierScrollFrame`。 |

### 1.1 当前拓扑（问题点标注）

```text
tierScrollRef.scrollLeft  ──真源──► band canvas (imperative rAF)     ✅
                              ├──► playhead (imperative rAF)         ✅
                              └──► ruler DOM + translate + React rebuild ⚠️ 双路径
```

---

## 2. 业内成熟路线（≥3）

| # | 路线 | 代表 | 核心机制 | 链接 |
|---|------|------|----------|------|
| **A** | **Canvas / 命令式每帧重画可见 tick** | [Peaks.js](https://github.com/bbc/peaks.js) ZoomView | 单 rAF；`timeToPixels` + 可见窗；刻度与波形同循环 | [player / zoomview 源码](https://github.com/bbc/peaks.js) |
| **B** | **Renderer 内 timeline 插件** | [WaveSurfer.js v7](https://github.com/katspaugh/wavesurfer.js) TimelinePlugin | Canvas 画 major/minor tick；scroll/zoom 触发 redraw | [plugins/timeline](https://github.com/katspaugh/wavesurfer.js/tree/main/src/plugins) |
| **C** | **DAW 单次刷新** | Audacity / Logic | 标尺与 track 同坐标或同刷新；center 模式 playhead 固定、内容滚 | [Audacity Viewport](https://doxy.audacityteam.org/_viewport_8cpp_source.html) |
| **D** | **本仓已验证范式** | `WaveformSegmentBandCanvas` | viewport canvas + `paddedVisibleTimeWindow` + `subscribeTierScrollFrame` + 纯函数 draw | `apps/desktop/src/components/WaveformSegmentBandCanvas.tsx` |

**共识**：标尺不应在 scroll 热路径依赖 React reconciliation；应用 **scrollLeft + 可见时间窗 → 纯函数绘制 → 单 rAF 合并**。

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用 | 与 Rushi 约束冲突 |
|------|--------|----------|-------------------|
| A Peaks | **中** | 可见窗 tick 步长、canvas 绘制思路 | 无 Konva；须适配 sticky viewport + tier scroll 真源 |
| B WS Timeline | **中** | tick 密度算法可参考 | 标尺在 sticky 壳，不能假设 WS scroll |
| C DAW | **低（模式）** | 「一次刷新多图层」 | 非 React；仅借架构 |
| **D 本仓 band** | **高** | `tierScrollFrameCoordinator`、`waveformProjection`、`waveformRulerTicks.ts`、`resolveTierViewportMetrics` | 无；**首选扩展点** |

**本仓必须先复用（禁止第二套 tick 算法）**：

- `waveformRulerTicks.ts` — `pickRulerTickSteps` / `buildVisibleRulerTicks` / `computeEmbeddedRulerLabelStride`
- `waveformProjection.ts` — `paddedVisibleTimeWindow` / `timeToTimelinePx` / `effectiveTimelinePxPerSec`
- `tierScrollFrameCoordinator.ts` — scroll 热路径单 rAF
- `waveformThemeColors.ts` 模式 — CSS var resolve 后 canvas 用 rgb

**不做什么**：

- ❌ 不把标尺移回 timeline 内容层（会改 embedded overlay 产品形态，另开 spec）
- ❌ 不恢复 scroll-track 全宽 DOM + translate（已在生产验证失败）
- ❌ 不用 WS TimelinePlugin 替代（与 sticky 壳、CSP、autoScroll:false 栈不一致）
- ❌ scroll 热路径禁止 React `setState` 驱 tick 位移

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| **选定方案** | **Canvas 嵌入标尺（sticky viewport）**：新增 `drawWaveformTimeRuler` 纯函数 + `WaveformTimeRulerCanvas` 组件，模式对齐 `WaveformSegmentBandCanvas`；每帧读 DOM-first `scrollLeft`，在 viewport 坐标画 tick/label；交互保留透明 pointer 层或 canvas hit-test。 |
| **不做什么** | 见 §3；保留 `WaveformTimeRuler` 供 ink/light 独立条（非 embedded overlay）后续再迁或维持 DOM。 |
| **与架构关系** | 对齐 `desktop-waveform-engine.md` viewport chrome 栈；消 `useWaveformRulerScrollTrack` 生产 dead code；更新 guard allowlist。 |
| **风险** | **R1** Canvas 文字清晰度（DPR、`fillText` 字重）；**R2** 拖拽/点击寻位坐标；**R3** 主题切换须 `subscribeAppAppearance` 重绘；**R4** 与 `useWaveformLiveClock` 高亮 major tick 同步。 |

---

## 5. 落位预告

| 层 | 文件 | 变更 |
|----|------|------|
| 纯函数 | `services/waveform/drawWaveformTimeRuler.ts` | 新增：viewport canvas 画 tick + label |
| 颜色 | `utils/waveformRulerCanvasColors.ts` | resolve `--notion-text*` / embedded 透明度 |
| 组件 | `components/WaveformTimeRulerCanvas.tsx` | 新增：mirror band canvas lifecycle |
| 编排 | `components/editor/EditorWaveformPeaksStage.tsx` | embedded overlay 改接 Canvas |
| 删除/瘦身 | `WaveformTimeRuler.tsx`、`useWaveformTimeRulerMetrics.ts`、`WaveformTimeRulerTickLayer.tsx` | embedded 路径移除 DOM tick；保留 ink/light |
| Hook | `useWaveformRulerScrollTrack.ts` | 生产移除引用；测试保留或删 |
| 文档 | `desktop-waveform-engine.md` | 舞台栈与 chroming 表 |
| 守卫 | `check-architecture-guard.mjs` | Canvas ruler 白名单；禁止 ruler DOM translate 新增 |

---

## 6. 签收

- [x] 调研 brief 完成
- [ ] Plan / acceptance 链接本文并定稿
- [ ] 用户确认进入编码

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-06-20 | 初版：对照 Peaks/WS/DAW/band；定 Canvas sticky ruler |
