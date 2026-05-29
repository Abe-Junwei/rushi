# 桌面端波形引擎（P1–P5′）

## 数据流

```text
导入/打开 (Tauri)
  ensure_waveform_peaks → projects/{id}/peaks/{fileId}_L{0,1,2}.dat

编辑器 (React)
  useWaveformPeaks → PeakCache.fromLevelUrls
  WaveformPeaksTileLayer + drawWaveformPeaksTile  ← 主 tier peaks（ADR-0004 content-tile）
  WaveformOverviewPeaksCanvas                     ← 全局条 minimap peaks（同 draw 入口）
  useProjectWaveform + WaveSurfer                 ← 播放 / seek / 无 peaks 回退 decode
  useWaveformZoomSync                             ← px/s 变更时 resample+load；peaks 路径 skip ws.zoom
  WaveformSegmentOverlay                          ← 语段 DOM（P4，非 WS Regions）
```

## 滚动真源

- **tier** `tierScrollRef.scrollLeft` 为 UI 真源（overlay、tile layout、ruler、全局条视口框）。
- WaveSurfer 内部 scroll 通过 `useTierScrollSync` 同步，不反向驱动语段位置。

## Peaks tile 挂载契约（ADR-0004，2026-05）

主 tier peaks 采用 **content-tile** 范式（与 WaveSurfer v7 同类）：canvas tile 是
timeline 宽内容的一部分，随 `tierScrollRef` **自然滚动**，无 sticky / transform /
每帧 viewport 重画。

舞台 DOM：

```text
<div ref=tierScrollRef overflow-x:auto>                    ← tier 滚动容器
  <div inline-block width=timelineWidthPx>                 ← 宽内容
    <div relative height=stage>                              ← 波形舞台
      <WaveformPeaksTileLayer absolute z=1>                ← peaks tiles（内容坐标）
        <canvas absolute left=tileLeft ... /> × N (LRU≤24)
      </WaveformPeaksTileLayer>
      <WaveformSegmentOverlay z=3 />
      <WaveSurfer container z=0 />                         ← 透明，仅播放后端
      <WaveformLiveTimeRuler z=10 />
    </div>
  </div>
</div>
```

**Tile 生命周期**（`useWaveformTileLifecycle` + `tileGeometry.ts`）：

- `tileWidthPx = clamp(viewport × 2, 4096, 8000)`，按 `barWidth + barGap` 对齐
- 可见区间 `[floor(scroll/tileW)−overscan, ceil((scroll+vw)/tileW)+overscan]`（`overscanTiles = 5`），LRU cap = **24**
- `drawPxPerSec`（现 `committedPxPerSec`）/ `peakCache` 变化 → generation bump；`layoutPxPerSec`（现 `pxPerSec`）拖动期冻结 draw px
- `EditorWaveformPane` / `WaveformPeaksTileLayer` 使用 `useTierScrollSync.tierScrollLayout`（`scrollLeftPx` + `clientWidth`），层内不二次订阅

**Scroll 真源（规划）**：见 [ADR-0005](../adr/0005-waveform-single-scroll-authority.md) — peaks 模式仅 `tierScrollRef`；实施 spec：[`waveform-single-scroll-consolidation-plan.md`](../execution/specs/waveform-single-scroll-consolidation-plan.md)。

**peaks 模式（已落地 ADR-0005 S1）**：`autoScroll: false`；无 tier↔WS scroll 回写；无 `ws.load` 缩放；播放跟随 `useWaveformPlaybackScrollFollow` 只写 tier。

**decode-fallback**：保留 `autoScroll` + 窄 tier↔WS bridge。

**Scroll 采样**：`useTierScrollLayout`（scroll burst rAF + ResizeObserver）→ `tierScrollLayout`；编排见 `useWaveformTimelineController`。

**Zoom 三轨**：`layoutPxPerSec`（布局/语段/hit-test）、`drawPxPerSec`（peaks resample + tile draw / generation）；tile draw signature 仅用 `drawTimelineWidthPx`，拖动 preview 不每帧 bump generation。

**全局条**：`WaveformOverviewPeaksCanvas` 在 overview 视口用单 tile（scroll=0）调用同一
draw 入口；播放进度由 minimap playhead 线表示。

**z-index**：peaks layer z=1，segments z=3，ruler z=10。

## 偏好（localStorage）

| Key | 含义 |
|-----|------|
| `rushi.p1.waveformPxPerSec` | 横向缩放 |
| `rushi.p1.waveformHeightPx` | 主波形高度 |
| `rushi.p1.autoFitSelectionToViewport` | 跟随语段模式 |
| `rushi.p1.waveformGlobalStripCollapsed` | 全局条折叠（持久化，换文件不强制展开） |
| `rushi.p1.waveformGlobalPlaybackRate` | 全局播放速度（主 transport） |
| `rushi.p1.tabAdvanceLoopsSegment` | Tab 切段并播放时自动语段循环（默认开） |

## 播放头与全局条

- **主波形** playhead 由 `WaveformTimeRuler` / `WaveformLiveTimeRuler` 绘制；`tierScrollLayout` 随 tier `scroll` 更新（S2 计划补 120ms burst rAF）；播放跟随拟由 tier 写 scroll（ADR-0005 S1）。
- **全局条展开**时另有 minimap playhead（`WaveformOverviewStrip`）；**折叠**后 minimap 隐藏，**主区 playhead 仍可见、仍随播放更新**。
- 选中语段后 seek 到 **语段起点**（非中点）。

## 已知限制

- 生产路径为 **PeakCache + content-tile peaks + hook 编排**（`useProjectWaveform`、`useWaveformZoomSync`、`useTranscriptionViewportFit`、`useWaveformTileLifecycle`）；曾规划的 `WaveformEngine` facade 已移除（2026-05-28，无接线）。
- 旧 viewport-fixed peaks 路径（`WaveformPeaksViewportLayer` / 手动 sticky）已于 P4 删除。
- WS 仍负责 MediaElement 播放与无 peaks 时的 decode 波形。
- peaks 为 mono mixdown。

## 相关 spec

- `docs/execution/specs/waveform-content-tile-renderer-acceptance.md`
- `docs/execution/specs/waveform-engine-refactor-acceptance.md`
- `docs/execution/specs/waveform-engine-refactor-p5-global-strip.md`
- `docs/execution/specs/waveform-engine-refactor-p6-overlay-split.md`
- ADR：[ADR-0004](../adr/0004-waveform-peaks-content-tile-renderer.md)、[ADR-0005](../adr/0005-waveform-single-scroll-authority.md)
- 收敛实施：[`waveform-single-scroll-consolidation-intent.md`](../execution/specs/waveform-single-scroll-consolidation-intent.md)
