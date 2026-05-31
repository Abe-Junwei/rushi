# Plan: waveform_single_scroll_consolidation

> Intent：[`waveform-single-scroll-consolidation-intent.md`](./waveform-single-scroll-consolidation-intent.md)  
> Acceptance：[`waveform-single-scroll-consolidation-acceptance.md`](./waveform-single-scroll-consolidation-acceptance.md)  
> ADR：[ADR-0005](../../../../adr/0005-waveform-single-scroll-authority.md)

## 架构目标态

```text
                    ┌─────────────────────────────────────┐
                    │     useWaveformTimelineController    │
                    │  layoutPxPerSec · drawPxPerSec       │
                    │  timelineWidthPx · tierScrollLayout  │
                    │  viewport-fit FSM · tierScroll API   │
                    └──────────────┬──────────────────────┘
                                   │
         tierScrollRef (peaks 模式唯一 scroll)
                    ┌──────────────┴──────────────────────┐
                    │  inline-block timeline (width = tw)  │
                    │  ├ WaveformPeaksTileLayer (React)    │  ← S3′ 可换 imperative
                    │  ├ WaveformSegmentOverlay              │
                    │  ├ WaveSurfer (peaks: audio-only)      │
                    │  └ WaveformLiveTimeRuler               │
                    └──────────────────────────────────────┘

Peaks 模式 WaveSurfer：
  · MediaElement + seek + play + timeupdate
  · autoScroll: false；不消费 scroll 写 tier；无 ws.load/ws.zoom 仅为缩放

decode-fallback：
  · 保留现版 WS 自绘 + autoScroll + 窄 tier↔WS bridge（S1 不激进改动）
```

---

## 阶段划分

**推荐顺序：`S0 → S1 → S2 → S4 → S3′（可选）`**

| 阶段 | 主题 | 估时 | 必做 |
|------|------|------|------|
| **S0** | ADR-0005、类型、文档与代码参数对齐 | 0.5d | ✅ |
| **S1** | 切断 peaks 模式 WS scroll 环 + playback follow | 1–1.5d | ✅ |
| **S2** | `useTierScrollLayout` 抽离 + timeline controller | 2–2.5d | ✅ |
| **S4** | px/s 三轨 + viewport-fit FSM + 收尾 | 2d | ✅ |
| **S3′** | Imperative tile renderer | 4–5d | ❌ 见触发条件 |

每阶段独立 PR，4 闸：`typecheck && test && check-architecture-guard`。

---

## S0 — 决策、契约与文档真源

### 交付

1. ADR-0005（已接受）与 intent/acceptance 对齐  
2. `apps/desktop/src/services/waveform/waveformTimelineTypes.ts`  
   - `WaveformTimelineMode: 'peaks' | 'decode-fallback'`  
   - `ViewportFitPhase: 'idle' | 'pending-scroll' | 'pending-peaks' | 'done'`  
3. 更新 `desktop-waveform-engine.md`：  
   - scroll 真源 → ADR-0005  
   - tile LRU **cap = 24**、`overscanTiles = 5`（与 `WaveformPeaksTileLayer.tsx` 一致）  
   - `tierScrollLayout` 已合并 Pane/Tile；`useTierScrollLeftPx` 已废弃  

### 不改行为

---

## S1.0 — 实施前 spike（1–2h，建议 S1 PR 前完成）

| 步骤 | 操作 | 验证 |
|------|------|------|
| A | `useProjectWaveformMount.ts` 临时 `autoScroll: false`（可全模式试） | H.07 播放跟随是否可仅靠手滚 tier 验证 |
| B | `useTranscriptionLayer` 临时 peaks 路径不接 `syncWaveformScrollPx` | H.02 停滚是否仍左右闪 |

若 A+B 后闪动明显减轻 → S1 go；否则先补日志再实施。

---

## S1 — 切断 peaks 模式 WS 第二条时间轴

> 针对横滚闪动、`ws.load` 与 fit 竞态。

### S1.1 播放滚动与 autoScroll（**分模式**）

| 模式 | `autoScroll` | 播放跟随 |
|------|--------------|----------|
| **peaks** | `false` | **新增** `useWaveformPlaybackScrollFollow.ts`：rAF 合并，只写 `tierScrollRef.scrollLeft` |
| **decode-fallback** | **保留 `true`**（与 ADR-0005 §1 一致） | 仍可由 WS autoScroll；tier bridge 保留 |

| 文件 | 改动 |
|------|------|
| `useProjectWaveformMount.ts` | 按 `WaveformTimelineMode` 设置 `autoScroll`（非「全关」） |
| `useWaveformPlaybackScrollFollow.ts` | **新增**；仅在 peaks + 播放/跟随时启用 |
| `projectWaveformWaveSurferEvents.ts` | peaks：**不**将 `scroll` 接到 `onWaveformScroll`（或 no-op） |
| `useTranscriptionViewportFit.ts` | peaks：删除 `wfApiRef.current.setScrollLeft` |

### S1.2 拆除 tier ↔ WS 双向 sync（仅 peaks）

| 文件 | 改动 |
|------|------|
| `useTierScrollSync.ts` | peaks：`applyScrollLeftPx` **不**调用 `w.setScrollLeft`；`syncWaveformScrollPx` no-op 或不下沉 |
| `useTranscriptionLayer.ts` | peaks：`onWaveformScroll` 不接 `syncWaveformScrollPx` |
| **新增** `useWaveformDecodeScrollBridge.ts`（可选） | fallback：保留现 epsilon + 双向 sync |
| `waveformScrollSync.ts` | reverse epsilon **仅** fallback 使用 |

### S1.3 缩放不再驱动 WS（仅 peaks）

| 文件 | 改动 |
|------|------|
| `useWaveformZoomSync.ts` | peaks：删除 `ws.load` / `finishZoom` 内 `restoreScrollPx`；改为 generation bump + `onZoomApplied` |
| fallback | 保留 `ws.zoom` / load |

### S1 验证

- 单测：peaks 路径 `setScrollLeft` 不被 tier 滚动调用  
- 手测：R.01、H.02、H.05、H.07、**R.03**（fallback 未破坏）

---

## S2 — scroll 订阅抽离 + timeline controller

> **注意**：Pane/Tile 已用 `tierScrollLayout`；本阶段不是「合并第三套 hook」，而是拆清职责并删死代码。

### S2.1 `useTierScrollLayout`

**从 `useTierScrollSync` 拆出** `apps/desktop/src/hooks/useTierScrollLayout.ts`：

- 输入：`tierScrollRef`  
- 输出：`{ scrollLeftPx, clientWidthPx }`（React state）  
- 采样：`scroll` passive + **120ms burst rAF**（吸收自原 `useTierScrollLeftPx`，弥补仅 scroll 事件可能掉帧）  
- `ResizeObserver` → `clientWidth`  
- **播放 follow**：由 S1 `useWaveformPlaybackScrollFollow` 写 DOM，本 hook **只读**同一 `tierScrollRef`（不在此 hook 内 60fps poll；若 follow 需高于 scroll 事件频率，在 follow 模块 rAF 写 DOM 即可触发 layout 更新）

**删除**（无生产引用后）：

- `useTierScrollLeftPx.ts`（测试迁至 `useTierScrollLayout.test.ts`）  
- `useWaveformViewportMetrics.ts`（同上）

`useTierScrollSync` 保留：programmatic scroll API、fallback bridge、向 controller 暴露 `setTierScrollPx`。

### S2.2 `useWaveformTimelineController`

**新增** `apps/desktop/src/hooks/useWaveformTimelineController.ts`（或 `pages/`）

迁入：`useWaveformZoom`、`timelineWidthPx`、`tierScrollLayout`、`tier scroll API`、`viewport fit` 入口、`WaveformTimelineMode` 判定。

`useTranscriptionLayer` 目标：**≤ 300 行 / ≤ 12 hooks**。

### S2.3 接线

- `EditorWaveformPane` / `WaveformPeaksTileLayer`：继续 props 传入 `scrollLeftPx` / `viewportWidthPx`（来自 controller，不层内 subscribe）

### S2 验证

- `useTierScrollLayout.test.ts`：burst、resize、与 DOM 一致  
- guard：`useTranscriptionLayer` 热点解除  

**估时：2–2.5d**（含 controller 迁移与测试）

---

## S4 — px/s 三轨 + viewport-fit FSM

### S4.0 禁止 naive「方案 A」

**错误做法**：单一 `pxPerSec` 同时用于 layout、`contentKey`、`draw` → 拖动时每帧 generation bump + `getInterleavedPeaks` cache miss → 卡顿。

**现网已有风险**：`timelineWidthPx` 在 preview 拖动时每帧变 → `waveformTileDrawSignature` 含 `timelineWidthPx` → 可见 tile 每帧重画（generation 可不 bump）。S4 须显式处理。

### S4.1 px/s 三轨（推荐，替代原「方案 A/B」表述）

| 轨道 | 符号 | 拖动滑块时 | pointerup / debounce |
|------|------|------------|----------------------|
| 布局 | `layoutPxPerSec` | 每帧更新（现 `pxPerSec`） | 同左 |
| 交互 hit-test | `interactionPxPerSec` | = `layoutPxPerSec`（已接线） | 同左 |
| peaks 绘制 | `drawPxPerSec` | **冻结**（现 `committedPxPerSec`） | 一次更新 + generation bump |

**Tile / draw 规则：**

- `contentKey` / `useWaveformTileLifecycle` generation：**仅**随 `drawPxPerSec` 或 `peakCache` 变，**不**随 `layoutPxPerSec`  
- `drawWaveformPeaksTile` 的 `timelineWidthPx` 参数：拖动期用 **上一 commit 的 timeline 宽** 或从 `drawPxPerSec` 推导，**避免**每帧用 preview 宽触发全量重画  
- 可选：拖动期 CSS `transform: scaleX` 在 tile 容器做 layout 预览（audit P1-2），pointerup 后去掉 transform 并 bump draw  

**对外 API 收敛**：删除 prop 名 `committedPxPerSec` / `peaksPxPerSec`，改为 `layoutPxPerSec` + `drawPxPerSec`（语义不变，避免误以为要删掉双轨）。

**性能 spike（S4 前 0.5d）**：滑块拖动 2s，Performance 看 `drawWaveformPeaksTile` / `getInterleavedPeaks` 调用次数 → 验收 **H.04′**。

### S4.2 Viewport-fit FSM

**新增** `viewportFitStateMachine.ts`：

```text
zoomToFitSegment → pending-scroll → setTierScrollPx
  → (若 drawPx 变) pending-peaks → await generation
  → done（禁止 restore 旧 scroll）
```

| 文件 | 改动 |
|------|------|
| `useTranscriptionViewportFit.ts` | FSM；peaks 不写 WS scroll |
| `useWaveformZoomSync.ts` | peaks：`onZoomApplied` → FSM |

### S4.3 文档与守卫

- `desktop-waveform-engine.md`、audit 报告注脚  
- 删除 peaks 路径无用的 reverse epsilon  
- tile 参数真源：cap **24**，overscan **5**

### S4 验证

- H.01–H.14、R.01–R.04、**H.04′**、H.13

**估时：~2d**（含 FSM 单测与 H.04′）

---

## S3′ — Imperative tile renderer（可选）

### 触发条件（须文档记录）

S1 + S2 + S4 已合并，且手测 **H.02 或 H.03 仍失败**（大面积空白 / 肉眼跨 tile 闪白），再启动 S3′。

### 不做 S3′ 的理由（默认）

- React tile 经 P0/P1 修复后：`key={tile.index}` 复用、`lastDrawnSignatureRef` 跳过重画  
- 跨边界 1 帧空白通常 <16ms，S1 后闪动主因若已消，边际收益不足以支撑 4–5d  

### 若启动 S3′

| 工作项 | 估时 |
|--------|------|
| `WaveformPeaksTileRenderer`（LRU 24、overscan 5、DPR、resize） | 1.5d |
| `WaveformPeaksTileHost.tsx` + Strict Mode 幂等 | 0.5d |
| 替换 Layer / lifecycle + 迁移 `WaveformPeaksTileLayer.test.ts` | 1d |
| 长音频手测 H.01–H.03 | 1d |

**合计：4–5d**；可拆 S3a（接口 + spike）/ S3b（替换）。

---

## 文件落位总表

| 操作 | 路径 | 阶段 |
|------|------|------|
| 新增 | `waveformTimelineTypes.ts` | S0 |
| 新增 | `useWaveformPlaybackScrollFollow.ts` | S1 |
| 新增 | `useWaveformDecodeScrollBridge.ts` | S1（可选） |
| 新增 | `useTierScrollLayout.ts` | S2 |
| 新增 | `useWaveformTimelineController.ts` | S2 |
| 新增 | `viewportFitStateMachine.ts` | S4 |
| 新增 | `WaveformPeaksTileRenderer.ts` | S3′ |
| 重构 | `useTierScrollSync.ts` | S1–S2 |
| 重构 | `useWaveformZoomSync.ts` | S1 |
| 重构 | `useTranscriptionLayer.ts` | S2 |
| 重构 | `useTranscriptionViewportFit.ts` | S1、S4 |
| 删除 | `useTierScrollLeftPx.ts`, `useWaveformViewportMetrics.ts` | S2 |

---

## 风险与缓解

| 风险 | 缓解 |
|------|------|
| peaks 关 autoScroll 后 playhead 出屏 | `useWaveformPlaybackScrollFollow` |
| fallback 被 S1 误伤 | 分模式；R.03 门禁 |
| S4 拖动卡顿 | 三轨 + H.04′；禁止 naive 单 pxPerSec |
| S3′ 工期膨胀 | 默认不做；触发条件书面化 |

---

## 回滚

每阶段独立 PR revert；不恢复 ADR-0004 已删除的 feature flag。
