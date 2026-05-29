---
adr: "0005"
title: 桌面端波形 — 单一 scroll 真源（peaks），WaveSurfer 降级为音频引擎
status: accepted
date: 2026-05-28
---

# ADR-0005：桌面端波形 — 单一 scroll 真源与 WS 角色收敛

## 上下文

[ADR-0004](./0004-waveform-peaks-content-tile-renderer.md) 已将 peaks 绘制改为 **content-tile**。  
生产仍保留 **混合编排**（半剥离 WaveSurfer）：

- `tierScrollRef` 与 WaveSurfer **双向** scroll 同步
- `autoScroll: true`（peaks 路径亦然）与 WS `scroll` 写回 tier
- peaks 路径 `useWaveformZoomSync` 仍 `ws.load` / `restoreScroll`
- `pxPerSec` / `committedPxPerSec` 与 `timelineWidthPx` 进 draw 路径 → 拖动期性能与 fit 竞态

**已部分收敛（2026-05，实施本 ADR 前）：**

- `useTierScrollSync.tierScrollLayout` 供 Pane / Tile 共用 scroll 状态  
- `interactionPxPerSec` 用于点击时间（layout px）  
- `useTierScrollLeftPx`、`useWaveformViewportMetrics` 已无生产引用  

表现为：偶发不渲染、横滚停闪、多轮 epsilon 修补。根因是 **peaks 模式仍保留第二条 WS timeline**，而非 content-tile 几何错误。

## 决策

### 1. Scroll 真源（分模式）

| 模式 | scroll 真源 | WaveSurfer |
|------|-------------|------------|
| **peaks**（`peakCache != null`） | 仅 `tierScrollRef.scrollLeft` | `autoScroll: false`；不读/写 scroll 驱动 UI；不将 `scroll` 回写 tier |
| **decode-fallback** | tier 为主 | **保留**现版 `autoScroll` + 窄 tier↔WS bridge |

播放跟随（peaks）：**只写 tier**（`useWaveformPlaybackScrollFollow`），不从 WS `scroll` 事件驱动 UI。

### 2. 缩放 / peaks 数据（peaks 模式）

- **不**为缩放调用 `ws.load` / `ws.zoom`  
- `PeakCache` resample + tile generation bump 由 `drawPxPerSec` 变更触发（见 §5）

### 3. WaveSurfer 职责（peaks 模式）

保留：播放、`setTime`/seek、`timeupdate`、decode 回退、`clientXToTimeSec` 几何。  
移除：`autoScroll`、scroll 驱动 UI、为 zoom 服务的 `ws.load(peaks)`。

### 4. Tile 绘制

- **默认**：继续 React `WaveformPeaksTileLayer` + content-tile（ADR-0004）  
- **可选 S3′**：imperative `WaveformPeaksTileRenderer` — 仅当 S1+S2+S4 后 H.02/H.03 仍不达标  

参数真源（与代码一致）：**LRU cap = 24**，**overscanTiles = 5**。

### 5. px/s：三轨，非 naive 单值

| 轨道 | 用途 | 拖动滑块 |
|------|------|----------|
| `layoutPxPerSec` | `timelineWidthPx`、语段布局、hit-test | 每帧更新 |
| `drawPxPerSec` | `contentKey`、resample、canvas draw | **冻结**，pointerup/debounce 后更新 |

禁止：单一 `pxPerSec` 同时进入 `contentKey` 与每帧 layout → 拖动期 generation 每帧 bump（性能回归）。  
对外 API 可重命名 `committedPxPerSec` → `drawPxPerSec`，**语义保留双轨**。

## 实施顺序

```text
S0 → S1 → S2 → S4 → S3′（可选）
```

S1 前建议 spike：临时关 autoScroll + 断 WS→tier 回写，验证闪动（见 plan §S1.0）。

## 后果

### 正面

- 消除 peaks 模式 tier↔WS 反馈环  
- fit 与 peaks generation 可对齐 FSM  
- 编排层可退出 hotspot  

### 负面

- peaks 模式需自实现播放 scroll follow  
- fallback 路径须单独回归（R.03）  
- S3′ 若启动工期 4–5d  

### 回滚

按 PR 阶段 revert。

## 参考

- [`waveform-single-scroll-consolidation-plan.md`](../execution/specs/waveform-single-scroll-consolidation-plan.md)  
- [ADR-0004](./0004-waveform-peaks-content-tile-renderer.md)  
- WaveSurfer v7 renderer：https://github.com/katspaugh/wavesurfer.js/blob/main/src/renderer.ts
