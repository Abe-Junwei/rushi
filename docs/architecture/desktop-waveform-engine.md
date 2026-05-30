# 桌面端波形引擎（WaveSurfer-only，2026-05）

## 数据流

```text
导入/打开 (Tauri)
  ensure_waveform_peaks → projects/{id}/peaks/{fileId}_L{0,1,2}.dat

编辑器 (React)
  useWaveformPeaks → PeakCache.fromLevelUrls
  useProjectWaveform + WaveSurfer v7     ← 唯一主波形渲染器（可见波形 + 内置 progress）
  useWaveformZoomSync                    ← decode 首帧 + peaks 热切换 + zoom
  WaveformSegmentOverlay                 ← 语段 DOM（非 WS Regions）
  WaveformLiveTimeRuler                  ← 时间尺 + playhead
```

**已移除（2026-05）**：`WaveformPeaksTileLayer`、`WaveformProgressOverlay`、全局 overview 条（`WaveformOverviewStrip` / `WaveformGlobalStripShell`）、canvas draw 路径（`drawWaveformPeaksTile` / `tileGeometry` / `useWaveformTileLifecycle`）。

## 滚动真源

- **tier** `tierScrollRef.scrollLeft` 为 UI 真源（overlay、ruler、segment 控件、minimap）。
- WaveSurfer `autoScroll: false`；tier 承担水平滚动，并通过 `syncWaveSurferScrollPx` **镜像** `ws.setScroll(scrollLeftPx)`，使 WS lazy tile 视口与 tier 对齐（每帧 resize transaction 内单次写入，无重复 rAF）。
- 播放跟随：`useWaveformPlaybackScrollFollow` 在波形 ready 后只写 tier scroll；tier → WS 镜像由 `useTierScrollSync` 触发。

## Viewport resize 编排（P0 阶段 1）

[`useWaveformViewportController`](../../apps/desktop/src/hooks/useWaveformViewportController.ts) 为**单一 resize 入口**：

- 一个 `ResizeObserver`（tier + WS container）+ `window.resize`，**microtask** coalesce（同帧合并，避免 rAF 晚一帧）。
- **视口宽真源**为 tier `clientWidth`（非 WS canvas 宽；默认 56 px/s 时 canvas 宽 >> 视口，全屏须仍能检测 tier 变宽）。
- **fit-all refit**（视口变宽、整段可见 stale）：stretch-hold **先于** sticky/timeline 宽度写入，再 `ws.zoom` + imperative shell 宽度；React `pxPerSec` 同步更新；`refreshTierScrollLayout` 在 transaction 末尾。
- **非 refit resize**：stretch → 写宽度 → `reRender()`；`redrawcomplete` 清除 stretch。
- resize 后调用 `onAfterViewportResizeRef` → `useTierScrollSync.refreshTierScrollLayout`（tier metrics 由 scroll/window + refresh 驱动，**无** tier RO）。
- **时长变化** overflow refit：`useWaveformTimelineController` layout effect 调 `wf.refitFitAllIfNeeded()` + renderCap clamp。

### Shell 宽度真源（P0 阶段 2）

- [`writeWaveformShellLayout`](../../apps/desktop/src/utils/waveformViewportStretch.ts) 为**唯一写函数**；两路触发：
  - **视口 resize** → `useWaveformViewportController.runViewportTransaction`
  - **zoom / timelineWidthPx 变化** → `syncShellLayoutForZoom()`（timeline controller layout effect）
- [`EditorWaveformPane`](../../apps/desktop/src/components/editor/EditorWaveformPane.tsx) 不再用 React `timelineWidthPx` 写 shell `width`。
- overlay / ruler 读 React `timelineWidthPx`；shell DOM 宽以 imperative 为准。

### 视口宽 / 时长读取

- **视口宽**：[`resolveTierViewportWidthPx`](../../apps/desktop/src/utils/waveformViewport.ts)（live ref / tier DOM / committed layout 取 max）；`EditorWaveformPane`、timeline controller、embedded ruler 统一调用。
- **布局时长**：[`resolveLayoutDurationSec`](../../apps/desktop/src/utils/waveformTimelineMetrics.ts)（synced ref → prop → merged WS/peaks）；seek / peaks load / mount 禁止自建 `getDuration()` fallback 链。
- **layout refs**（`durationRef` / `timelineWidthPxRef` / `pxPerSecRef`）在 timeline controller **`useLayoutEffect`** 写入，不在 render body。

### Zoom sync（P1）

- `useWaveformZoomSync` 在 `useLayoutEffect` 内**同步** `ws.zoom`（不再 rAF defer）。
- `viewportResizeHoldRef` 为 true 时跳过 `ws.load`，transaction 结束后 `flushDeferredPeaksLoad` 换档。

## 整段可见（fit-all）布局意图

- `useWaveformZoom` 维护 `layoutIntent: 'fit-all' | 'fit-selection' | 'default' | 'manual'`（非持久）。
- 「整段可见」按钮 / 长音频打开默认 → `fit-all`；滑块 / ± / 手动 zoom → `manual`。
- **贴满不变量**：`isFitAllTimelineFilledInViewport`（`timelineWidthPx ≈ tier 视口宽`），不再用「timeline ≤ viewport」误判高亮。
- `layoutIntent === 'fit-all'` 时，`resolveFitAllPxPerSecAdjustment` **与 resize 无关**地在 fill gap 时 refit；viewport controller 的 `applyFitAllRefitPxPerSec` 保留 intent 不写 `manual`。

## 坐标真源：单一水平投影

[`waveformProjection.ts`](../../apps/desktop/src/utils/waveformProjection.ts) 提供 `effectiveTimelinePxPerSec = timelineWidthPx / duration`。

- 语段 overlay、框选、播放控件、点击寻位一律经 `timeToTimelinePx`（`waveformSegmentBounds` / `waveformSegmentOverlayGeometry`）。
- `clientXToTimeSec` 按容器实际渲染宽（= `timelineWidthPx`）比例换算。
- ruler 用 `t/duration` 比例定位；`pxPerSec` 用于刻度密度与离散缩放命令（适配语段 / 整段可见 / ±）。

## 舞台 DOM

```text
<div ref=tierScrollRef overflow-x:auto>                    ← tier 滚动容器（scroll 真源）
  <div ref=waveformPeaksStageShellRef width=max(timeline, vw)>  ← stage 宽壳（imperative 可写）
    <div ref=waveformTimelineShellRef width=timelineWidthPx>  ← timeline 宽壳
      <div ref=waveformStickyShellRef sticky left=0 width=vw> ← 视口宽 sticky 壳
        <div ref=waveformStretchShellRef>                     ← resize stretch-hold（scaleX）
          <div ref=containerRef>                              ← WaveSurfer mount（fillParent: false）
      <WaveformSegmentOverlay z=3 />
      <WaveformSegmentPlaybackControls z=8 />
  <WaveformLiveTimeRuler sticky bottom z=20 />               ← 嵌入时间尺（viewport 坐标空间）
</div>
```

- `timelineWidthPx = pxPerSec × duration`；`peaksStageWidthPx = max(timelineWidthPx, tier.clientWidth)`。
- sticky 壳宽 = tier 视口宽（CSS var `--waveform-tier-viewport-width` + imperative `width`）。

## Zoom 单轨（路线 A + C：decode 首帧，peaks 热切换）

- 单一 `pxPerSec` 驱动 `timelineWidthPx` 与 WS 横向比例。
- **挂载（C0）**：后台 peaks 开启时推迟挂载直至 bootstrap；**90s 超时**降级 decode；bootstrap 后 `create({ url, peaks, duration })`。
- **PeakCache 就绪（C1）**：`useWaveformZoomSync` 执行 `ws.load(url, peaks, layoutDuration)` 热切换；切换前保存 `currentTime`，完成后 `setTime` 恢复；播放中推迟至暂停。
- **有 PeakCache 后**：
  - `quantizePxPerSecForPeaksLoad(px/s)`（8 px/s 档）决定 `ws.load(peaks)` 时机；
  - **同档内**仅 `ws.zoom(pxPerSec)`，不重复 `ws.load`；
  - **跨档**时 `ws.load(url, peaks, layoutDuration)`，完成后 `ws.zoom` 对齐当前 px/s；
  - **viewport resize 期间**（`viewportResizeHoldRef`）：仅同步 `ws.zoom` + shell layout；**推迟** `ws.load` 至 transaction 结束（`flushDeferredPeaksLoad`）；
- **整段可见 sub-min**（px/s &lt; 16）：视口 refit / 全屏在 **peaks 已注入后** 仅 `ws.zoom`；decode 阶段首次 fit-all **必须** `ws.load` 一次（不可因 px/s 变化而永久跳过）。
- **视口宽读取**：生产代码统一经 [`resolveTierViewportWidthPx`](../../apps/desktop/src/utils/waveformViewport.ts)（live ref / tier DOM / committed layout 取 max）；fit-all refit 仅认 `layoutIntent === 'fit-all'` 或 `staleFitAllOnViewportGrow + wasFitAll…`，**不**因手动 zoom 落在 fit-all 55% 带而静默 snap。
- **无 PeakCache**：持续 decode 路径，仅 `ws.zoom(pxPerSec)`；`peaksUnavailable` 时不再后台重试（需手动清缓存）。
- `PeakCache.getWaveSurferPeaks` 返回的 `duration` 与 layout `mediaDurationSec` 一致。
- **阶段状态**（`resolveWaveformPeaksPhase`）：`peaksApplied` **先于** `peaksUnavailable` 判定（避免 peaks 已注入仍显示不可用）；`idle` → `generating`/`decode` → `peaks_pending`（播放中待切换）→ `peaks`；失败为 `unavailable`。
- UI 角标：顶栏 `waveform-header-bar` 左播放时间、右渲染状态（`resolveWaveformHeaderStatusLabel`）；生成中居中（`resolveWaveformCenterStatusLabel`）。

## Peaks 数据层

- Rust 生成 `.dat` LOD；前端 `PeakCache.getWaveSurferPeaks(px/s, layoutDuration)` 供 WS 注入。
- peaks 生成失败不阻断 UI（无波形区错误条）；WS decode 仍可播放与显示波形。
- Symphonia 探测/解码失败时，peaks 路径尝试 **ffmpeg remux → 临时 WAV → 再生成**（`waveform_peaks_ffmpeg.rs`）。
- `peaksMediaDurationMismatch` 仍用于 `useWaveformPeaks` 触发一次 best-effort regenerate（仅当已有 `.dat` 级别）。

## 时长真源

[`waveformTimelineMetrics.ts`](../../apps/desktop/src/utils/waveformTimelineMetrics.ts) 的 `resolveWaveformTimelineMetrics()` 导出：

- `mediaDurationSec` — WS 与 peaks manifest 合并
- `timelineWidthPx` — `pxPerSec × duration`（无 320 floor）
- `effectiveLayoutPxPerSec` — 与比例族一致的有效 px/s

`useWaveformTimelineController` 为唯一装配点。

## 偏好（localStorage）

| Key | 含义 |
|-----|------|
| `rushi.p1.waveformPxPerSec` | 横向缩放 |
| `rushi.p1.waveformHeightPx` | 主波形高度 |
| `rushi.p1.autoFitSelectionToViewport` | 跟随语段模式 |
| `rushi.p1.waveformGlobalPlaybackRate` | 全局播放速度 |
| `rushi.p1.tabAdvanceLoopsSegment` | Tab 切段并播放时自动语段循环 |

## Viewport fit

- 语段 fit / reveal：`useTranscriptionViewportFit` 写 tier scroll；需 peaks 换档时保留 `pendingViewportFitRef`，在 `onZoomApplied → applyPendingViewportFit` **单次**滚 tier（`queueViewportFit` 不在换档前预滚）。
- 程序化滚动通过 `playbackFollowSuppressUntilRef` 短暂暂停播放跟随（与用户手动滚 tier 相同机制）。

## Route C2（导入预热 / 偏好 / minimap / 播放中热切换）

- **导入预热**：`scheduleWaveformPeaksPrewarm` 仍可用于显式预热；打开文件时由 `useWaveformPeaks` 统一 `ensure`（避免重复 invoke）。
- **偏好**（`waveformPrefs.ts`，工具栏「波形」菜单）：
  - `rushi.p1.waveformBackgroundPeaks` — 后台生成 peaks（默认开）
  - `rushi.p1.waveformMinimap` — L0 总览条（默认开）
  - `rushi.p1.peaksHotSwitchWhilePlaying` — 播放中立即热切换（默认开）
- **Minimap**：`WaveformMinimapStrip` + `PeakCache.getMinimapPeaks`（L0 resample 至条宽）；点击跳转并滚 tier。
- **播放中热切换**：`hotSwitchWhilePlaying` 为真时不推迟；仍 `setTime` 恢复 playhead，必要时 `play()` 续播。

## 相关 ADR / spec（历史）

- ADR-0004 / ADR-0005 描述的 canvas tile 路径已废弃；现行以本文为准。
- 历史 spec 已归档：[`docs/execution/specs/archive/waveform-pre-ws-only-2026-05/`](../execution/specs/archive/waveform-pre-ws-only-2026-05/README.md)（content-tile / convergence / 全局条等，**superseded**）。
