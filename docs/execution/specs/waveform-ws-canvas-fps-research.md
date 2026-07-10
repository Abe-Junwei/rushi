# 调研：WaveSurfer 超宽 canvas / progress 饿死播放帧率（WS-FPS）

> **状态**：WS-2a 已编码 · S4 fps **FAIL**（合成瓶颈）· 后备见 [`waveform-ws2b-viewport-render-research.md`](./waveform-ws2b-viewport-render-research.md)
> **关联 spec**：[`waveform-ws-canvas-fps-plan.md`](./waveform-ws-canvas-fps-plan.md) / [`waveform-ws-canvas-fps-acceptance.md`](./waveform-ws-canvas-fps-acceptance.md)
> **前序**：
> - [`waveform-visual-raf-playhead-research.md`](./waveform-visual-raf-playhead-research.md)（VRP：独立 rAF 轮询 media）
> - [`waveform-unified-scroll-stage-research.md`](./waveform-unified-scroll-stage-research.md)（巨宽 host 反模式已记录）
> - 2026-07-10 手测：band/ruler skip≈100% 后 `playbackFrames` 仍常 10–30；`scrollW` 可达 40960
> **并行轨**：[`waveform-selection-click-latency-research.md`](./waveform-selection-click-latency-research.md)（SEL-1，不挡本轨 spike）
> **门禁**：未完成本文 **不得** 进入 Plan 定稿与业务编码（WS-1 spike 除外，须标注 spike）

---

## 0. 为什么 VRP + 脏区后仍不够 60fps

本仓播放热路径已做到：

- 视觉时间：playing 态 rAF 读 `media.currentTime`（VRP）
- band/ruler：稳态 skip≈100%，选中脏区 `bandPaint≈0–1ms`

但稳态仍常见：

| 指标 | 目标 | 实测（62 段 / 深 zoom） |
|------|------|------------------------|
| `playbackFrames` / sec | ≥45 | **10–30**（偶发 24–29） |
| `tierSub` / `bandPaint` | ~0 | ~0 ✅ |
| `scrollW` | 视口级 | **可达 40960**（`cols_cap`） |
| `frameLag` | ~16ms | 常 **80–200ms+** |

结论：帧率瓶颈已不在 Rushi band/ruler，而在 **WaveSurfer 全长 canvas + progress 层** 占用主线程/合成。

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 播放时 playhead 仍不够顺；深 zoom 后更明显 |
| 本仓现状 | `WaveSurfer.create({ fillParent:false, hideScrollbar:true, progressColor, … })`；`installWaveSurferPlayedRegionDisplayFix` 每帧改 `progressWrapper`；timeline 宽随 `minPxPerSec` 膨胀。文件：`useProjectWaveformMount.ts`、`waveformSurferProgressCoverage.ts`、`WaveformViewportPlayhead.tsx` |
| 成功标准 | 稳态 `playbackFrames≥45`；`band/ruler` 稳态仍≈0 repaint；seek/pause/空格正确性不回退 |

---

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表 | 核心机制 | 链接 / 路径 |
|---|------|------|----------|-------------|
| A | **原生 scroll + 分 canvas 虚拟化** | WaveSurfer v7 | `scrollWidth=ceil(dur*minPxPerSec)`；renderer 分片 canvas、清理离屏；progress 不重绘整波形 | WS 源码 / unified-scroll research |
| B | **frameOffset 视口重绘** | BBC Peaks.js | 逻辑 offset；只画可见窗；播放 auto-scroll 改 offset | Peaks API |
| C | **自管 playhead，弱化宿主 progress** | 桌面 DAW / 本仓 DOM playhead | 宿主波形作静态层；进度用独立 DOM/canvas | 本仓已有 `WaveformViewportPlayhead` |

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用 | 冲突 |
|------|--------|----------|------|
| C 关/冻 WS progress | **高** | DOM playhead + VRP 已是真源；`PlayedRegionDisplayFix` 可降级 | 须保留「已播放着色」产品语义或明确改为不着色 |
| A 去巨宽 host | **中** | unified-scroll 已规划；geom 日志已有 | lazy 尾部空白风险 → 必须 spike |
| B Peaks 式 | **低（本轮）** | 概念对齐 band canvas | 改动过大，作 WS-2 失败后备 |

**本仓已有模块**：

- `WaveformViewportPlayhead` + VRP clock — 视觉进度真源
- `waveformSurferProgressCoverage` — progress 补丁入口（spike 改这里）
- `[wf-geom]` / `__rushiScrollProfile` — 验收探针
- unified-scroll research — 巨宽 host 已知债

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| 选定方案 | **先 WS-1 spike**：播放态冻结/透明化 WS progress 更新，只留 DOM playhead。若 `playbackFrames≥45` → 固化为默认。若仍 <45 → **WS-2a** 去掉巨宽 host / 对齐 WS 原生虚拟化（引用 unified-scroll）。WS-2b Peaks 式仅作失败后备。 |
| 不做什么 | ❌ 不 fork WaveSurfer；❌ 不恢复 ruler 每帧重绘；❌ 不把 playhead 画回 WS canvas；❌ 本轨不修 SEL-1 / WR-4 |
| 与 architecture 关系 | 修订 `desktop-waveform-engine.md`：播放视觉进度以 DOM playhead + VRP 为准；WS progress 为可选着色层 |
| 风险 | RISK-01：去掉已播放着色 → 需产品确认可接受或用轻量替代；RISK-02：去巨宽后 lazy 空白；RISK-03：WKWebView 合成瓶颈可能仍在，spike 必须量化 |

---

## 5. 落位预告 + 后续

### 本薄片

| ID | 内容 |
|----|------|
| **WS-0** | 本文 + plan/acceptance |
| **WS-1** | spike：no-op / 透明 progress；对比 fps |
| **WS-1b** | spike 通过则固化；更新 arch doc |

### 条件后续

| ID | 触发 | 内容 |
|----|------|------|
| **WS-2a** | WS-1 后 fps 仍 <45 | 去巨宽 host + lazy 尾部验收 |
| **WS-2b** | WS-2a 失败 / 合成瓶颈 | 视口窗口绘制 — [`waveform-ws2b-viewport-render-research.md`](./waveform-ws2b-viewport-render-research.md) ✅ |
| **WR-2/4** | 并行 | zoom 去抖 / resample worker（不挡 WS-1） |

---

## 6. 签收

- [x] 调研 brief 完成
- [x] plan / acceptance 已链接
- [x] 用户确认可进入 **WS-1 spike**（非终态编码；与 SEL-1 并行）

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-07-10 | 初版：证伪「本仓 canvas 仍是 fps 瓶颈」；采纳先冻 progress 再动巨宽 host |
| 2026-07-10 | WS-2a 后 S4 FAIL + 合成瓶颈 → 链接 WS-2b research |
