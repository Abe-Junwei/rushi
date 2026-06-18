# 桌面端波形引擎（WaveSurfer-only，2026-05）

## 数据流

```text
导入/打开 (Tauri)
  ensure_waveform_peaks → projects/{id}/peaks/{fileId}_L{0,1,2}.dat

编辑器 (React)
  useWaveformPeaks → PeakCache.fromLevelUrls
  useProjectWaveform + WaveSurfer v7     ← 唯一主波形渲染器（可见波形 + 内置 progress）
  useWaveformZoomSync                    ← decode 首帧 + peaks 热切换 + zoom
  WaveformSegmentBandCanvas              ← packable 语段色带（Canvas display，全量绘制 + scroll 同步）
  WaveformSegmentOverlay                 ← 语段 DOM（仅选中 + drag draft；非 WS Regions）
  WaveformLiveTimeRuler                  ← 时间尺 + playhead
  EditorSegmentList                      ← 语段列表（虚拟窗口，长转写列表）
```

**已移除（2026-05）**：`WaveformPeaksTileLayer`、`WaveformProgressOverlay`、全局 overview 条（`WaveformOverviewStrip` / `WaveformGlobalStripShell`）、canvas draw 路径（`drawWaveformPeaksTile` / `tileGeometry` / `useWaveformTileLifecycle`）。

## 滚动真源

- **tier** `tierScrollRef.scrollLeft` 为 UI 真源（overlay、ruler、segment 控件、minimap）。
- **读取**：overlay / minimap / ruler / playback chrome 经 [`resolveTierViewportMetrics`](../../apps/desktop/src/utils/waveformViewport.ts)（live ref + committed layout）；**写入**仅 `setTierScrollPx` / 用户 scroll / viewport fit；clamp 经 [`clampTimelineScrollLeftPx`](../../apps/desktop/src/utils/waveformScrollSync.ts)。
- WaveSurfer `autoScroll: false`；tier 承担水平滚动，WaveSurfer / overlay 位于同一 timeline 内容层，随浏览器原生 scroll 物理移动。
- **Scroll 热路径（2026-06）**：`useTierScrollSync` 在 tier scroll / wheel-forward 时更新 live scroll refs，并调用 [`scheduleTierScrollFrame`](../../apps/desktop/src/utils/tierScrollFrameCoordinator.ts) 合并 band / playhead / ruler 的 viewport chrome imperative 更新为**单 rAF**；React `tierScrollLayout` 在 scroll burst 结束后 commit。
- 播放跟随：`useWaveformPlaybackScrollFollow` 在波形 ready 后只写 tier scroll；viewport chrome 由 frame coordinator 同步。

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
- **applied zoom state**（[`waveformAppliedZoom.ts`](../../apps/desktop/src/utils/waveformAppliedZoom.ts)）：`WaveformAppliedZoomState` 捆绑 WS 已应用 px/s、peaks 档位与是否已注入；React `pxPerSec` 为用户意图（TRUTH-010）。

### Zoom sync（P1）

- [`waveformZoomSyncEngine.ts`](../../apps/desktop/src/services/waveform/waveformZoomSyncEngine.ts)：`planWaveformZoomApply` / `commitWaveSurferZoom` / `loadPeaksIntoWaveSurfer` 纯逻辑；[`useWaveformZoomSync`](../../apps/desktop/src/hooks/useWaveformZoomSync.ts) 仅编排 layout effect。
- `useWaveformZoomSync` 在 `useLayoutEffect` 内**同步** `ws.zoom`（不再 rAF defer）。
- `viewportResizeHoldRef` 为 true 时跳过 `ws.load`，transaction 结束后 `flushDeferredPeaksLoad` 换档。

## 整段可见（fit-all）布局意图

- `useWaveformZoom` 维护 `layoutIntent: 'fit-all' | 'fit-selection' | 'default' | 'manual'`（非持久）。
- 「整段可见」按钮 / 长音频打开默认 → `fit-all`；滑块 / ± / 手动 zoom → `manual`。
- **贴满不变量**：`isFitAllTimelineFilledInViewport`（`timelineWidthPx ≈ tier 视口宽`），不再用「timeline ≤ viewport」误判高亮。
- `layoutIntent === 'fit-all'` 时，`resolveFitAllPxPerSecAdjustment` **与 resize 无关**地在 fill gap 时 refit；viewport controller 的 `applyFitAllRefitPxPerSec` 保留 intent 不写 `manual`。
- **缩放栏 UI：** `computeWaveformZoomBarUiState` 驱动 `Focus`（适配语段）/ `Maximize2`（整段可见）/ 重置 互斥高亮；手动 ± 或滑块 → `manual`（三者均不亮）。fit-selection 模式下波形点选其他语段保持 intent 并 `forceFullFit` re-fit。

## 坐标真源：单一水平投影

[`waveformProjection.ts`](../../apps/desktop/src/utils/waveformProjection.ts) 提供 `effectiveTimelinePxPerSec = timelineWidthPx / duration`。

- 语段 overlay、框选、播放控件、点击寻位一律经 `timeToTimelinePx`（`waveformSegmentBounds` / `waveformSegmentOverlayGeometry`）。
- **语段 tap（两段式 seek）：** [`resolveSegmentOverlayTap`](../../apps/desktop/src/utils/waveformSegmentOverlayActions.ts) — 未选中语段 → `selectSegmentAt`（viewport fit + seek 语段头）；已选中语段内再点 → `seekToTime`（钳在语段边界）。pointerup 为主路径（`applyOverlayPointerUpIntent`），click 为兜底。
- **语段播放起点：** [`resolveSegmentPlaybackStartSec`](../../apps/desktop/src/utils/formatMediaTime.ts) — playhead 在语段内则从 playhead 起播，否则从语段头。
- `clientXToTimeSec` 按容器实际渲染宽（= `timelineWidthPx`）比例换算。
- ruler 用 `t/duration` 比例定位；`pxPerSec` 用于刻度密度与离散缩放命令（适配语段 / 整段可见 / ±）。

## 语段语义真源：可见 / 可打包语段

「哪些语段参与波形 UI」是与坐标分离的另一条真源。整轨占位语段（如分句前的 ASR 整段）在波形上**不渲染**，因此 render / lane / 命中测试 / 框选新建必须对它有一致判定。

- **是否占位**：[`isPlaceholderSegment`](../../apps/desktop/src/utils/waveformSegmentBounds.ts)（Rust 对应 `is_placeholder_segment`）。**显式 `kind` 优先**：`SegmentDto.kind === "placeholder"` 即占位、`"speech"` 即非占位（即便跨度大也不隐藏，消除短片段长单段假阳性）；缺省（旧数据 / 未标记）时回退 `span/duration ≥ WAVEFORM_DOMINANT_SPAN_RATIO`（0.85）启发式。
- **产生点**：ASR 整轨兜底（`transcribe.rs`）显式标 `placeholder`，子句标 `speech`；`kind` 列随语段落库（DB 迁移 `migrate_segments_kind`，旧行 NULL → 缺省）。
- **唯一权威（选择）**：[`selectPackableSegmentIndices` / `selectPackableSegments`](../../apps/desktop/src/utils/waveformSegmentBounds.ts)，内部走 `isPlaceholderSegment`。
- **消费方一律经此 selector**：
  - render / lane：`assignSegmentOverlapLanes`（[`segmentLayout.ts`](../../apps/desktop/src/utils/segmentLayout.ts)）
  - 命中测试：`resolveSegmentIndexAtWaveformPointer`（含 `waveformSegmentContextMenu` 转发）
  - 框选新建重叠：`insertSegmentFromTimeRange`（[`useSegmentMutationController.ts`](../../apps/desktop/src/pages/useSegmentMutationController.ts)）→ `clampCreateRangeClearOfSegments` 只吃 packable 集
- **唯一例外**：持久化清洗 [`sanitizeSegmentsForMedia`](../../apps/desktop/src/utils/segmentMediaSanitize.ts) 直接用谓词（策略不同：占位为唯一语段时**保留**，不可套用 selector）。
- **三道防回归闸**（针对 dominant-span 重叠误报）：
  1. 单一 selector（上）——render 与编辑共用同一可见集；
  2. 跨路径不变量测试（[`waveformSegmentBounds.test.ts`](../../apps/desktop/src/utils/waveformSegmentBounds.test.ts)）——「overlay 看不见的语段不得阻止创建」，lane 隐藏集与创建丢弃集锁步；
  3. 架构守卫（`scripts/check-architecture-guard.mjs`）——除 selector 本体与 persist sanitize 外，禁止生产代码直接调用 `isDominantWaveformSpanSegment`。新增直调点须显式加入白名单。

## 密集语段显示（5000+ 语段，2026-05-30）

**禁止** scroll 驱动的 React overlay viewport 裁剪（历史回归：滚到新区域语段不出现，见 [`segment-overlay-virtualization.md`](../execution/specs/segment-overlay-virtualization.md)）。

| 层 | 职责 |
|----|------|
| **Canvas bands** | [`WaveformSegmentBandCanvas`](../../apps/desktop/src/components/WaveformSegmentBandCanvas.tsx) 在 viewport chrome 内绘制可见窗 packable 色带；[`drawWaveformSegmentBands`](../../apps/desktop/src/services/waveform/drawWaveformSegmentBands.ts) 纯函数；scroll/wheel 时读 live `resolveTierViewportMetrics` 重绘 |
| **DOM overlay** | [`WaveformSegmentOverlay`](../../apps/desktop/src/components/WaveformSegmentOverlay.tsx) 仅 [`selectOverlayInteractiveSegmentIndices`](../../apps/desktop/src/utils/waveformSegmentOverlayVisibility.ts)（选中 + drag draft） |
| **语段列表** | [`EditorSegmentList`](../../apps/desktop/src/components/editor/EditorSegmentList.tsx) + [`segmentListVirtualWindow`](../../apps/desktop/src/utils/segmentListVirtualWindow.ts) |

交互 hit-test（tap seek、框选新建、context menu）仍经 packable selector + 投影坐标，与 band 绘制共用真源。

## 语段 / 进度 chroming（accent 语义化，2026-06）

| 层 | 配色真源 | 说明 |
|----|----------|------|
| **WaveSurfer peaks** | `tokens.css` `--zen-wf-wave` / `--zen-wf-progress-played` | [`readWaveformSurferPalette`](../../apps/desktop/src/utils/waveformThemeColors.ts) 在 mount / 主题切换时注入；[`installWaveSurferPlayedRegionDisplayFix`](../../apps/desktop/src/services/waveform/waveformSurferProgressCoverage.ts) 保留 progress 层 tint 且主 canvas 不 clip |
| **Band canvas** | `--segment-fill-*` → resolve rgb | [`segmentBandFillStyle`](../../apps/desktop/src/utils/waveformSegmentBandCanvasColors.ts)；`timeupdate` / seek 经 [`requestWaveformSegmentBandPaint`](../../apps/desktop/src/utils/tierScrollFrameCoordinator.ts) 重绘 visited |
| **DOM overlay** | `var(--segment-fill-*)` | [`waveformRegionFillColor`](../../apps/desktop/src/utils/segmentChrome.ts)；多选时 `multiSelectActive` 统一 12% waveform in-selection |
| **Playhead / minimap** | `--waveform-playhead` / `--waveform-minimap-*` | `accent-action` 链；WS 内置 cursor 隐藏 |

组件禁止直引 `zen-saffron*`（守卫 R8）；语段选中 / visited 均随 `--accent-action*`（Office 主题色）。见 [`desktop-visual-style-governance.md`](./desktop-visual-style-governance.md) 与根 [`DESIGN.md`](../../DESIGN.md) Waveform tokens 表。

## 舞台 DOM

```text
<div ref=tierScrollRef overflow-x:auto>                    ← tier 滚动容器（scroll 真源）
  <div ref=waveformPeaksStageShellRef width=max(timeline, vw)>  ← stage 宽壳（imperative 可写）
    <div ref=waveformTimelineShellRef width=timelineWidthPx>  ← timeline 内容层（原生随 tier scroll 移动）
      <div ref=waveformStretchShellRef>                       ← resize stretch-hold（scaleX）
        <div ref=containerRef>                                ← WaveSurfer mount（fillParent: false）
      <WaveformSegmentOverlay z=3 />                          ← 仅选中 / drag draft DOM，timeline 坐标
      <WaveformSegmentPlaybackControls z=8 />
      <div ref=waveformStickyShellRef sticky left=0 width=vw> ← viewport chrome
        <WaveformSegmentBandCanvas z=2 />                     ← packable 语段色带（Canvas，viewport 坐标）
        <WaveformViewportPlayhead z=10 />
        <WaveformLiveTimeRuler z=20 />                        ← 嵌入时间尺（viewport 坐标空间）
</div>
```

- `timelineWidthPx = pxPerSec × duration`；`peaksStageWidthPx = max(timelineWidthPx, tier.clientWidth)`。
- viewport chrome 宽 = tier 视口宽（CSS var `--waveform-tier-viewport-width` + imperative `width`）。

## Zoom 单轨（路线 A + C：decode 首帧，peaks 热切换）

- 单一 `pxPerSec` 驱动 `timelineWidthPx` 与 WS 横向比例。
- **挂载（C0）**：后台 peaks 开启时推迟挂载直至 bootstrap；**90s 超时**降级 decode；bootstrap 后 `create({ url, peaks, duration })`。
- **PeakCache 就绪（C1）**：`useWaveformZoomSync` 执行 `ws.load(url, peaks, layoutDuration)` 热切换；切换前保存 `currentTime`，完成后 `setTime` 恢复；播放中推迟至暂停。
- **有 PeakCache 后**：
  - `quantizePxPerSecForPeaksLoad(px/s)`（8 px/s 档）决定 **ws.load 注入哪一档 resample**；
  - **是否 ws.load** 由 `shouldZoomOnlyWithLoadedPeaksStretch`（已加载 LOD ≥ 意图 LOD → 仅拉伸）决定；8 px/s 量子**不再**单独触发 reload；
  - **同 LOD 内**（含跨 8 px/s 量子）：仅 `ws.zoom(pxPerSec)`；
  - **跨 LOD**（需更细 .dat 档）时 `ws.load(url, peaks, layoutDuration)`，完成后 `ws.zoom` 对齐；
  - **viewport resize 期间**（`viewportResizeHoldRef`）：仅同步 `ws.zoom` + shell layout；**推迟** `ws.load` 至 transaction 结束（`flushDeferredPeaksLoad`）；
- **整段可见 sub-min**（px/s &lt; 16）：视口 refit / 全屏在 **peaks 已注入后** 仅 `ws.zoom`；decode 阶段首次 fit-all **必须** `ws.load` 一次（不可因 px/s 变化而永久跳过）。
- **视口宽读取**：生产代码统一经 [`resolveTierViewportWidthPx`](../../apps/desktop/src/utils/waveformViewport.ts)（live ref / tier DOM / committed layout 取 max）；fit-all refit 经 timeline `refitFitAllPxPerSecRef` → `resolveFitAllPxPerSecAdjustment`（`layoutIntent === 'fit-all'` 或 stale fit-all on viewport grow），**不**因手动 zoom 静默 snap。
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
- 有效布局 px/s 见 [`effectiveTimelinePxPerSec`](../../apps/desktop/src/utils/waveformProjection.ts)（`timelineWidthPx / duration`），不在 metrics 对象重复导出

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
- **Minimap**：`WaveformMinimapStrip`（56px，`zen-paper` 底，peaks 垂直居中）+ `PeakCache` / WaveSurfer export；点击 seek 并滚 tier；`WAVEFORM_MINIMAP_HEIGHT_PX = 56`。
- **播放中热切换**：`hotSwitchWhilePlaying` 为真时不推迟；仍 `setTime` 恢复 playhead，必要时 `play()` 续播。

## 相关 ADR / spec（历史）

- ADR-0004 / ADR-0005 描述的 canvas tile 路径已废弃；现行以本文为准。
- 历史 spec 已归档：[`docs/execution/specs/archive/waveform-pre-ws-only-2026-05/`](../execution/specs/archive/waveform-pre-ws-only-2026-05/README.md)（content-tile / convergence / 全局条等，**superseded**）。
