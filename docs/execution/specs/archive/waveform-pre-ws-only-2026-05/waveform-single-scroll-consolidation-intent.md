# Intent: waveform_single_scroll_consolidation

> 前置：[ADR-0004](../../../adr/0004-waveform-peaks-content-tile-renderer.md)（content-tile 已落地）  
> 审计：[`waveform-content-tile-renderer-audit-report.md`](./waveform-content-tile-renderer-audit-report.md)  
> 架构真源：[`desktop-waveform-engine.md`](../../../architecture/desktop-waveform-engine.md)  
> 决策：[ADR-0005](../../../adr/0005-waveform-single-scroll-authority.md)

## 目标

在 **保留** PeakCache + `.dat` + content-tile 绘制的前提下，把桌面端主波形从「tier + WaveSurfer 双时间轴 + 混合编排」收敛为：

1. **peaks 模式**：单一 scroll 真源（`tierScrollRef`）、WS 仅音频引擎  
2. **缩放语义清晰**：布局即时变化 + 拖动期冻结 peaks 绘制 px（见 plan S4.1 三轨）  
3. **编排下沉**：`useWaveformTimelineController` + 单一 `tierScrollLayout` 订阅  

从结构上消除：

- 主波形偶发不渲染（空白 tile / fit 竞态 / `ws.load` 时序）  
- 横滚停顿时左右闪动（tier ↔ WS scroll 回写环）  
- 缩放拖动期不必要的 generation / resample 风暴（若 naive 合并 px/s）

**Imperative tile 池（S3′）为可选**，仅在 S1+S2+S4 后手测仍不满足 H.02/H.03 时启动。

## 为什么 ADR-0004 之后仍要做本轮

ADR-0004 正确解决了 **viewport-fixed + sticky** 类问题，但未完成 **引擎边界** 收敛。

### 仍须整改（结构性）

| 残留 | 后果 |
|------|------|
| `tierScrollRef` 与 WaveSurfer **双向** sync + `autoScroll: true` | 停滚闪动、4px epsilon 缓冲 |
| `useWaveformZoomSync` peaks 路径仍 `ws.load` / `restoreScroll` | 与 viewport-fit 竞态 → 空白 |
| preview / committed 双 `pxPerSec` + `timelineWidthPx` 进 draw signature | 拖动期每帧 visible tile 重画（性能） |
| viewport-fit 与 peaks 无显式 FSM | 「视口对、canvas 空」 |

### 已部分改善（勿重复发明）

| 现状（2026-05 代码） | 说明 |
|----------------------|------|
| `useTierScrollSync.tierScrollLayout` | Pane / Tile 已共用 `{ scrollLeftPx, clientWidthPx }` |
| `interactionPxPerSec` vs `committedPxPerSec` | 点击时间映射已用 preview layout px（audit P1-1 类问题 largely 已修） |
| React tile P0/P1 修复 | `contentKey`、DPR、clearRect 等；S3′ 非默认必做 |
| `useTierScrollLeftPx` / `useWaveformViewportMetrics` | **已无生产引用**；S2 删除死代码并强化 `tierScrollLayout` 即可 |

**结论**：content-tile 范式无根本性错误；**半剥离 WaveSurfer 的混合编排** 是主矛盾。

## 用户任务（不变）

与 [`waveform-content-tile-renderer-acceptance.md`](./waveform-content-tile-renderer-acceptance.md) H.01–H.14 一致（另见本轮 R.01–R.04）。

## 目标内范围

### 必做（本轮）

| # | 项 |
|---|-----|
| 1 | **S1**：peaks 模式切断 WS scroll 环（`autoScroll` 关、无 `onWaveformScroll`→tier、无 peaks 路径 `ws.load`）；**fallback 保留**现有 WS scroll 行为 |
| 2 | **S1**：`useWaveformPlaybackScrollFollow` — 播放 / 跟随只写 tier |
| 3 | **S2**：从 `useTierScrollSync` 拆 `useTierScrollLayout` + `useWaveformTimelineController`；删死 hook |
| 4 | **S4**：viewport-fit FSM；px/s **三轨**（非 naive 单一 `pxPerSec` 每帧 bump generation） |
| 5 | **S4**：peaks 路径去掉 `committedPxPerSec` **对外 prop 链**（语义收敛为 `layoutPxPerSec` + `drawPxPerSec`，见 plan） |

### 可选（S3′）

- `WaveformPeaksTileRenderer` imperative 池 — **触发条件**：S1+S2+S4 完成后 H.02/H.03 仍有大面积空白或跨 tile 肉眼闪白

### 明确不做（本轮）

- 不替换 PeakCache / Rust `ensure_waveform_peaks`  
- 不引入 Peaks.js / WebGL  
- 不改语段 overlay / 全局条产品结构（只改 scroll/px 数据源）  

## 实施顺序

```text
S0 → S1 → S2 → S4 → S3′（可选）
```

S1 前建议 1–2h **spike**（见 plan §S1.0）：临时关 `autoScroll` + 注释 WS→tier 回写，验证闪动是否消失。

## 成功标准（摘要）

- peaks：`autoScroll === false`；无 `onWaveformScroll`→tier；无仅为 zoom 的 `ws.load`  
- fallback：R.03 通过；允许窄 scroll bridge  
- 机器闸门：`typecheck && test && check-architecture-guard`  
- 手测：H.01–H.14 + R.01–R.04；H.04′ 拖动性能 spot check  
