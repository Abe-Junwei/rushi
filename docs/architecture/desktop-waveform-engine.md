# 桌面端波形引擎（WaveSurfer media + Rushi viewport canvas，2026-07 WS-2b）

## 数据流

```text
导入/打开 (Tauri)
  ensure_waveform_peaks → projects/{id}/peaks/{fileId}_L{0,1,2}.dat

编辑器 (React)
  useWaveformPeaks → PeakCache.fromLevelUrls
  useProjectWaveform + WaveSurfer v7     ← 媒体宿主（play/seek/currentTime）；可见波形不再依赖 WS 全长 canvas
  WaveformViewportPeaksCanvas            ← 可见主波形（PeakCache @ drawPxPerSec，视口 + overscan）
  useWaveformZoomSync                    ← layout/draw px/s 驱动 Rushi canvas；WS 不再 load 全长 peaks（WS-2b）
  WaveformSegmentBandCanvas              ← packable 语段色带（timeline-native virtual Canvas window）
  WaveformSegmentOverlay                 ← 语段 DOM（仅选中 + drag draft；非 WS Regions）
  WaveformLiveTimeRuler                  ← 时间尺 + playhead
  EditorSegmentList                      ← 语段列表（CM6 TranscriptEditorCore；一行一段）
```

> **WS-2b（spike v4 PASS · Plan 定稿）**：可见主波形 = PeakCache 驱动的视口窗口 canvas（Peaks **模型**，非迁移 Peaks.js）；WS = media transport（stub peaks、silence 内部 timer/progress、host 1×1）。生产化见 [`waveform-ws2b-viewport-render-plan.md`](../execution/specs/waveform-ws2b-viewport-render-plan.md)。调研：[`waveform-ws2b-viewport-render-research.md`](../execution/specs/waveform-ws2b-viewport-render-research.md)。

**已移除（2026-05）**：`WaveformPeaksTileLayer`、`WaveformProgressOverlay`、全局 overview 条（`WaveformOverviewStrip` / `WaveformGlobalStripShell`）、canvas draw 路径（`drawWaveformPeaksTile` / `tileGeometry` / `useWaveformTileLifecycle`）。

## 滚动真源

- **tier** `tierScrollRef.scrollLeft` 为 UI 真源（overlay、ruler、segment 控件、minimap），但生产代码只允许 [`useTierScrollSync`](../../apps/desktop/src/hooks/useTierScrollSync.ts) 写入普通滚动目标。
- **读取（统一 DOM-first）**：overlay / minimap / ruler / playback chrome 一律经 [`resolveTierViewportMetrics`](../../apps/desktop/src/utils/waveformViewport.ts)（DOM `scrollLeft` / `clientWidth` → live ref → committed layout 顺序）；embedded 时间尺 [`WaveformTimeRulerCanvas`](../../apps/desktop/src/components/WaveformTimeRulerCanvas.tsx) 经 [`subscribeTierScrollFrame`](../../apps/desktop/src/utils/tierScrollFrameCoordinator.ts) 与 band / playhead 同帧读同值。**写入**经 `useTierScrollSync` 的语义入口：`revealSelectionScroll`、`playbackFollowScroll`、`minimapScrubScroll`、`userScrubScroll`、`applyWheelScrollDelta`、`setTierScrollPx`（低层/迁移保留）。clamp 经 [`clampTimelineScrollLeftPx`](../../apps/desktop/src/utils/waveformScrollSync.ts)。
- WaveSurfer `autoScroll: false`；tier 承担水平滚动，WaveSurfer / overlay 位于同一 timeline 内容层，随浏览器原生 scroll 物理移动。
- **Scroll 热路径（2026-06）**：`useTierScrollSync` 在 tier scroll / wheel-forward 时更新 live scroll refs，并调用 [`scheduleTierScrollFrame`](../../apps/desktop/src/utils/tierScrollFrameCoordinator.ts) 合并 band / playhead / ruler 的 viewport chrome imperative 更新为**单 rAF**；React `tierScrollLayout` 在 scroll burst 结束后 commit。
  - `useTierScrollSync` 是唯一 scroll motion owner：wheel inertia 的 rAF、selection reveal、minimap scrub、ruler/user scrub、playback follow 与 transient motion cancel 均在此集中处理。`useWaveformTierWheelForward` 只解析 wheel delta / pointer intent，不直接写 DOM。
  - 原生 scroll、**离散程序化跳转**（reveal / pick / resize，`commitScrollLeftPx` 非 `deferLayoutCommit` 分支）与 **播放跟随**均 `flushTierScrollFrame` 同帧落 chrome；播放跟随默认 `WAVEFORM_PLAYBACK_FOLLOW_DEFER_LAYOUT_COMMIT`（[`waveformPrefs.ts`](../../apps/desktop/src/utils/waveformPrefs.ts)），只推迟 React layout commit，不推迟 band / ruler / playhead viewport chrome；暂停 snap 仍立即 commit。设为 `false` 可回滚到每帧 `refreshLayout`。
  - minimap viewport 矩形经 `subscribeTierScrollFrame` 命令式跟随 live scroll（不再只读 burst-committed `tierScrollLayout`，消拖影）。
- 播放跟随：`useWaveformPlaybackScrollFollow` 在波形 ready 后只写 tier scroll；播放帧走 prefs 默认 defer，暂停/模式切换 snap 传 `deferLayoutCommit: false`。
  - **center 模式（P1 + P0）**：播放中**冻结**整数 `scrollLeft`，把 `offset = T − S` 广播为共享浮点残差；内容层 `translate3d(-offset)` 承担连续运动；仅当 `|offset| ≥ CENTER_FOLLOW_RECONCILE_PX`（200）时才 `round(T)` 沉回 scroll（同帧清残差，视觉连续）。播放头 **硬钉** `vw/2`（禁止再叠 offset，防 double-count）。停播 / 用户滚 suppress 时先把 offset 沉进 scroll 再清零。
  - **edge 模式（翻页段 P1 + P0）**：中间区带不跟滚、`offset=0`，针自由扫过。越过 trigger 后进入 page-drive：同 center 冻结 `scrollLeft` + 浮点 offset；reconcile 阈值 `max(200, 0.85×vw)`（单次翻页 ≈0.73×vw，整段走 GPU 浮点，避免整数 scroll 把针撕成 ±0.5px）。驱动中播放头 **硬钉** `anchorFrac×vw`；回到中间区带后清 driving 并沉残差。高 zoom 翻页时「只有针在抖」的根因即此前每帧写整数 `scrollLeft` 时 `playheadPx − round(playheadPx − anchor)` 的量化振荡。
  - 契约见 [`waveform-center-follow-subpixel-research.md`](../execution/specs/waveform-center-follow-subpixel-research.md) / plan。

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
- **WR-2 双轨**：[`useWaveformZoom`](../../apps/desktop/src/hooks/useWaveformZoom.ts) 的 `layoutPxPerSec` 即时驱动 `ws.zoom` 拉伸；连续滑块/步进经 `scheduleDrawPxPerSec`（`DRAW_PX_PER_SEC_DEBOUNCE_MS=140`）尾沿更新 `drawPxPerSec` → peaks load。离散 fit/reset 仍 `flushDrawPxPerSec` 双轨同刷。

## 整段可见（fit-all）布局意图

- `useWaveformZoom` 维护 `layoutIntent: 'fit-all' | 'fit-selection' | 'default' | 'manual'`（非持久）。
- 「整段可见」按钮 → `fit-all`；长音频（≥30min）打开默认 → 无语段时约 **45s** 入视口；**有 packable 语段**时按中位跨度使典型句约 **80px** 宽（`LONG_MEDIA_TARGET_SEGMENT_WIDTH_PX`），语段首次就绪且 `layoutIntent==='default'` 时可自动 refit；滑块 / ± / 手动 zoom → `manual`。
- **贴满不变量**：`isFitAllTimelineFilledInViewport`（`timelineWidthPx ≈ tier 视口宽`），不再用「timeline ≤ viewport」误判高亮。
- `layoutIntent === 'fit-all'` 时，`resolveFitAllPxPerSecAdjustment` **与 resize 无关**地在 fill gap 时 refit；viewport controller 的 `applyFitAllRefitPxPerSec` 保留 intent 不写 `manual`。
- **缩放栏 UI：** `computeWaveformZoomBarUiState` 驱动 `Focus`（适配语段）/ `Maximize2`（整段可见）/ 重置 互斥高亮；手动 ± 或滑块 → `manual`（三者均不亮）。fit-selection 模式下波形点选其他语段保持 intent 并 `forceFullFit` re-fit。
- **Layout vs draw cap（WS-2b）**：`clampPxPerSecForLayout` / `MAX_LAYOUT_TIMELINE_WIDTH_PX` 约束编辑时间轴与 fit-selection；`clampPxPerSecForWaveSurferRender` / `MAX_WAVESURFER_PEAK_COLUMNS` 仅约束 **整轨 inject / decode** 路径，**不得**把长音频 layout zoom 压回 `40960/duration`。
- **视口主波形细节**：[`WaveformViewportPeaksCanvas`](../../apps/desktop/src/components/WaveformViewportPeaksCanvas.tsx) 经 `PeakCache.getViewportWindowPeaks` / [`extractViewportWindowPeaks`](../../apps/desktop/src/services/waveform/extractViewportWindowPeaks.ts) 按**滚动窗口**从 LOD 取峰（约 1 CSS px ≈ 1 列），禁止再用整轨 40960 列拉伸当细节源。

## 坐标真源：单一水平投影

[`waveformProjection.ts`](../../apps/desktop/src/utils/waveformProjection.ts) 提供 `effectiveTimelinePxPerSec = timelineWidthPx / duration`。

- 语段 overlay、框选、播放控件、点击寻位一律经 `timeToTimelinePx`（`waveformSegmentBounds` / `waveformSegmentOverlayGeometry`）。
- **语段 tap（两段式 seek）：** [`resolveSegmentOverlayTap`](../../apps/desktop/src/utils/waveformSegmentOverlayActions.ts) — 未选中语段 → `selectSegmentAt`（viewport fit + seek 语段头）；已选中语段内再点 → `seekToTime`（钳在语段边界）。pointerup 为主路径（`applyOverlayPointerUpIntent`），click 为兜底。
- **语段播放起点：** [`resolveSegmentPlayFrom`](../../apps/desktop/src/services/waveform/transport/resolveTransportTargetTime.ts) / [`resolveSegmentPlaybackStartSec`](../../apps/desktop/src/utils/formatMediaTime.ts) — 段内从 playhead；**已过段尾从 playhead 续播**（不回段头）；段前仍跳到段头。
- **语段自然结束 → Space 重播：** 段尾 auto-stop 设 `autoStoppedSegmentIdxRef`；Space sticky → `resumeSegment` → Transport `playSegment` 必须经 `resolveSegmentResumeFromSec` / `consumeSegmentResumeFromSec` 注入段头 `fromSec`。若只走 `resolveSegmentPlayFrom(display@end)` 会从段尾 **无 bound 续播**（与设计「重播该句」不符）。浮层 toggle 仍走 controls 内 `playSegmentAtIndex`（同源 helper）。
- **段尾显示钳位：** sparse playback frame 常在 `currentSec > endSec` 才命中 bound；pause **不** media-seek（WebKit nest 风险）。`enforceSegmentPlaybackBound` 在 pause settle 后对 display 做 `syncDisplayPlayheadAfterSeek(endSec)` + `commitSeekUi`；视觉钟在 media 已停、React `isPlaying` 未提交时仍装 400ms imperative guard，挡住晚到的 rAF freeze 用媒体超时时覆盖针头。
- **语段中段暂停续播：** 视觉钟跟 native `getDisplayTime`（插值常领先 TimeUpdate）。暂停 freeze / resume anchor 取 `max(display, authority)`；`resolveSegmentPlayFrom` 在双钟落差 ≤ lag cap 时 `resumeSkipSeek`，禁止 seek 回滞后锚点（高 zoom 下回退会很明显）。命名见 [`playback-clock-api-naming-research.md`](../execution/specs/playback-clock-api-naming-research.md)。
- **工具条「全局播放」：** [`toggleGlobalPlay`](../../apps/desktop/src/hooks/useProjectWaveform.ts) — 始终全局；段播中撕 bound 变通读（出口）。语段 scoped / loop：波形浮层 / 旁侧 [`handleToggleSelectedWaveformPlay`](../../apps/desktop/src/hooks/useWaveformSegmentPlaybackControls.ts)；段尾停由 Rushi **playback frame** 执行（WS-2b 后 `audioprocess` 稀疏，不可再当唯一尾停时钟）。
- **文稿 Playback Focus：** [`useTranscriptPlaybackFollow`](../../apps/desktop/src/hooks/useTranscriptPlaybackFollow.ts) — 播放中按 `resolveVisitedSegmentIndexAtPlayhead` 更新 CM6 行装饰（**≠ selection**）；条件 reveal 使用 [`revealSegmentInScrollDOM`](../../apps/desktop/src/components/editor/core/revealSegment.ts)，只写 CM6 `scrollDOM.scrollTop`，禁止 playback follow 走 `EditorView.scrollIntoView`。播放启动第一帧（focus 从 `-1` 初始化到当前句）只上色、不居中滚动；后续跨句才跟随 reveal。偏好 `rushi.p1.transcriptPlaybackFollow`。见 [`transcript-playback-follow-research.md`](../execution/specs/transcript-playback-follow-research.md)。
- **WS-2a sticky 层：** `waveform-timeline-wave-layer` 与 playhead sticky 壳用 **`h-0` + 子层 absolute 铺满**，避免 in-flow `h-full` 把后续 sticky 壳挤出 `peaksPaneHeightPx` 后被 tier `overflow-y-hidden` 裁掉（播放头不可见回归）。
- `clientXToTimeSec` 按容器实际渲染宽（= `timelineWidthPx`）比例换算。
- ruler 用 `t/duration` 比例定位；`pxPerSec` 用于刻度密度与离散缩放命令（适配语段 / 整段可见 / ±）。

## 点选 / 选择交互契约（统一矩阵）

> **P9a（2026-07-10）**：列表编辑真源已迁至 **CodeMirror 6**（[`TranscriptEditorCore`](../../apps/desktop/src/components/editor/core/TranscriptEditorCore.tsx)）。会话内选区/文本以 CM6 transaction 为准；[`transcriptProjection`](../../apps/desktop/src/components/editor/core/transcriptProjection.ts) **单向**投影到波形。  
> **P9b2（2026-07-11）**：已删 SC1 React 选区真源与 SC2 `selectionChromeStore` / publish。ctx 上的 `selectedIdx` / multi-select 字段为 **投影镜像**（[`useTranscriptSelectionFromProjection`](../../apps/desktop/src/pages/useTranscriptSelectionFromProjection.ts)）。选区运输层：[`selectSegmentTransport`](../../apps/desktop/src/pages/selectSegmentTransport.ts)。旧 Selection Chrome Bus 决策见 [`selection-chrome-bus-research.md`](../execution/specs/selection-chrome-bus-research.md)（已被 [`transcript-editor-core-remediation-research.md`](../execution/specs/transcript-editor-core-remediation-research.md) 取代）。

**真源分层（P9b2）**

| 层 | 含义 | 真源 |
|----|------|------|
| **CM6** | 会话内选区 + 正文 + filter 可见行 | CM6 `EditorState`（`selectionCommands` / `filterLineVisibility`） |
| **投影** | 波形 band/overlay 高亮 / Transport Authority / ctx 镜像 | `transcriptProjection`（只读） |

**硬规则**：CM6 **不得**被 React reconcile 反向覆盖选区；波形/列表点击经 `dispatchTranscriptEditorSelection` / CM6 用户手势写入；`revealSegmentInView` 负责列表滚入视口。结构突变经 CM6 `structureCommands` + persist 桥。Spec：[`transcript-editor-core-remediation-plan.md`](../execution/specs/transcript-editor-core-remediation-plan.md)。

**Waveform selection repair（2026-06）**：调研见 [`waveform-selection-chain-repair-research.md`](../execution/specs/waveform-selection-chain-repair-research.md)。波形语段链路采用三层边界：

| 层 | 责任 | 禁止 |
|----|------|------|
| Input state machine | 只处理 pointer session 生命周期（pending tap / edit drag / lasso / cancel / commit）与 session id | 不直接写选区 store，不 seek/reveal |
| Selection command | 将产品矩阵解析为 `selectAndSeekStart` / `seekWithinSegment` / `selectOnly` / `blankSeek` / `lassoSelect` / `commitBounds` | 不操作 DOM，不推导 canvas/overlay skip |
| Render projection | 统一决定 canvas band、DOM overlay、fallback 的绘制归属 | 各渲染层不得重复自建 selected/skip/fallback 策略 |

命令矩阵：

| 命令 | 触发 | CM6 | seek | reveal | 备注 |
|------|------|-----|------|--------|------|
| `selectAndSeekStart` | 波形首点未选中语段 | ✓ | 语段头 | ✓ | pointerup 用同一 session 消费 preview；**播放中** pointerdown 可 defer seek，但 pointerup 仍须 seek |
| `seekWithinSegment` | 已选中语段内再点 | — | 点击点钳在语段内 | — | 只移动 playhead，不重选 |
| `selectOnly` | shift/meta、右键菜单或非 waveform 源 | ✓ | — | 按来源策略 | 不触发 waveform preview seek |
| `blankSeek` | 空白短点 | — | anchor 时间 | — | suppress 播放跟随 |
| `lassoSelect` | 空白拖拽命中语段集合 | 多选 | — | — | 不 reveal/seek |
| `commitBounds` | move/resize 拖拽结束且 bounds 变化 | — | — | — | `update` 与 `update-end` 语义分离 |

选中编排入口：[`useTranscriptionLayerSelection.selectSegmentAt`](../../apps/desktop/src/pages/useTranscriptionLayerSelection.ts) → [`selectSegmentTransport`](../../apps/desktop/src/pages/selectSegmentTransport.ts)——顺序为 **CM6 dispatch + `revealSegmentInView` → 波形 reveal/seek（按源）→ focus**。策略真源：[`selectionRevealSeekPolicy.ts`](../../apps/desktop/src/utils/selectionRevealSeekPolicy.ts) + [`editorFocusGate.ts`](../../apps/desktop/src/utils/editorFocusGate.ts)。

| 入口 | 选中 | reveal/居中 | seek | suppress 跟随 | 焦点 | 走 `selectSegmentAt`? |
|------|------|------------|------|---------------|------|----------------------|
| CM6 行点击（未选中） | ✓ | ✓ CM6 scrollIntoView | **语段头**（听跳；含暂停） | ✓ | CM6 | ✓（`list`） |
| CM6 行再点击（已选中） | — | ✗ | ✗ | — | CM6 caret | 否（仅 focus） |
| 波形语段首点 | ✓ | ✓ immediate | 语段头 | ✓ | waveform shell | ✓（`waveform`） |
| 波形语段再点（已选中） | — | — | 钳在语段内点击点 | ✓ | waveform shell | 否（`seek-within`） |
| 键盘 ↑↓ / Tab advance K1 | ✓ | F3 gate（CM6/shell focused） | ✗ | — | CM6 | ✓（`listKeyboard`） |
| Tab confirmAdvance | ✓ | F3 gate | ✗（loop 偏好另走 wf） | — | CM6 | ✓（`listKeyboard`） |
| 右键菜单（列表/波形/文本） | ✓（lifecycle setState；多选命中保留） | **不 reveal** | **不 seek** | — | — | 否（band/overlay 经 React 同 commit 同帧） |
| 框选 lasso 多选 | ✓（多选） | **不 reveal** | — | — | shell | 否（`selectSegmentIndices`） |
| 空白点击（无拖动）B1 | — | — | anchor 时间 | ✓（seek-blank） | shell | 否 |
| minimap 点击 M1 | — | `minimapScrubScroll` 直接居中 | ✓ | ✓ | — | 否 |
| 时间尺 click R2 | — | `centerTierAtClientX` 滚动居中 | ✗ | ✓ | — | 否 |
| 时间尺拖拽 | — | `userScrubScroll` 直接滚动 | — | ✓ | — | 否 |

约定要点：

- **右键菜单 / lasso 故意不 reveal/seek**（避免右键或批量选择时画面跳动）；其 band canvas（`useLayoutEffect` keyed on `selectedIdx` 同步重绘）与 DOM overlay 在同一 React commit 落帧，无需经选中内核也不会闪。
- **minimap 是 scrub 控件**：经 `minimapScrubScroll` 直接跳转居中；seek 前 `suppressPlaybackFollowForSelectionSeek`，避免播放中被自动跟随回拽。
- **时间尺 click（R2）只滚动不 seek**：经 `centerTierAtClientX` 将点击时间居中到 tier 视口。
- **`listKeyboard` 源**：↑↓ / Tab confirmAdvance 使用；reveal 受 F3 editor focus gate 约束；**keyup finalize / 非 burst 时 seek 段首**（与点文听跳一致；burst 中途不 scrub）。
- **文稿旁侧段播**：stage gutter play/stop — **任意行 hover 显**（移开消失）；scoped 播中常驻 stop；复用 `playSegmentAtIndex` / toggle；loop 仍在波形浮层。
- **focus=selected（S2′）**：快捷键锚点读 CM6 primary（过渡期仍桥 `selectedIdx`）；焦点在非选中行时先 `selectSegmentAt(i)`。

## 语段语义真源：可见 / 可打包语段

「哪些语段参与波形 UI」是与坐标分离的另一条真源。整轨占位语段（如分句前的 ASR 整段）在波形上**不渲染**，因此 render / lane / 命中测试 / 框选新建必须对它有一致判定。

> **决策（2026-06 波形交互排查）**：dominant-span（整轨占位）语段 **维持不画 band / 不画 overlay**——它会铺满整条波形、无可操作语义，且单一可见集（下）已保证 render/编辑/命中一致。**不**为其引入第二套渲染或工作集。选中态同理：占位语段不进入选中链。

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
| **Canvas bands** | [`WaveformSegmentBandCanvas`](../../apps/desktop/src/components/WaveformSegmentBandCanvas.tsx) 位于 timeline 内容层，绘制带缓冲的可见窗 packable 色带；浏览器原生 scroll 会物理移动旧 canvas，JS 只负责滚出缓冲窗后的重绘，避免主线程卡顿时 sticky viewport canvas 延迟跟随。绘制仍由 [`drawWaveformSegmentBands`](../../apps/desktop/src/services/waveform/drawWaveformSegmentBands.ts) 纯函数完成 |
| **DOM overlay** | [`WaveformSegmentOverlay`](../../apps/desktop/src/components/WaveformSegmentOverlay.tsx) 仅 [`selectOverlayInteractiveSegmentIndices`](../../apps/desktop/src/utils/waveformSegmentOverlayVisibility.ts)（选中 + drag draft） |
| **语段列表** | [`EditorSegmentList`](../../apps/desktop/src/components/editor/EditorSegmentList.tsx) → [`TranscriptEditorCore`](../../apps/desktop/src/components/editor/core/TranscriptEditorCore.tsx)（CM6；filter 隐藏非匹配行） |

交互 hit-test（tap seek、框选新建、context menu）仍经 packable selector + 投影坐标，与 band 绘制共用真源。

## 语段 / 进度 chroming（accent 语义化，2026-06）

| 层 | 配色真源 | 说明 |
|----|----------|------|
| **WaveSurfer peaks** | `tokens.css` `--zen-wf-wave` / `--zen-wf-progress-played` / `--zen-wf-played-wash` | [`readWaveformSurferPalette`](../../apps/desktop/src/utils/waveformThemeColors.ts) 在 mount / 主题切换时注入；视口已播放区由 [`WaveformViewportPeaksCanvas`](../../apps/desktop/src/components/WaveformViewportPeaksCanvas.tsx) 的 `.waveform-viewport-played-tint`（wash 淡化）跟随 visual playhead；[`installWaveSurferPlayedRegionDisplayFix`](../../apps/desktop/src/services/waveform/waveformSurferProgressCoverage.ts) 保留 progress 层且主 canvas 不 clip，`progressWrapper.width` 走 `setDirectLayoutStyle` + 百分比去重 |
| **Band canvas** | `--segment-fill-*` → resolve rgb | [`segmentBandFillStyle`](../../apps/desktop/src/utils/waveformSegmentBandCanvasColors.ts)；idle / **visited（中性 text 10%）** / 选中 / 多选 / 低置信；visited 边界变化时重绘（[`resolveVisitedSegmentIndexAtPlayhead`](../../apps/desktop/src/utils/segmentChrome.ts)） |
| **DOM overlay** | `var(--segment-fill-*)` | [`waveformRegionFillColor`](../../apps/desktop/src/utils/segmentChrome.ts)；主题色切换即时跟色（禁止 bake rgba）；多选时 `multiSelectActive` 统一 in-selection |
| **Playhead / minimap** | `--waveform-playhead` / `--waveform-minimap-*` | `accent-action` 链；WS 内置 cursor 隐藏 |

组件禁止直引 `zen-saffron*`（守卫 R8）；语段选中色随 `--accent-action*`（Office 主题色）；**时间轴已播放**由 viewport peaks wash（`--zen-wf-played-wash`）+ playhead 表示；**语段 visited** 为中性 band 填充（弱于 selected，不锁 accent）。见 [`desktop-visual-style-governance.md`](./desktop-visual-style-governance.md) 与根 [`DESIGN.md`](../../DESIGN.md) Waveform tokens 表。

## 舞台 DOM

```text
<div ref=tierScrollRef overflow-x:auto>                    ← tier 滚动容器（scroll 真源）
  <div ref=waveformPeaksStageShellRef width=max(timeline, vw)>  ← stage 宽壳（imperative 可写）
    <div ref=waveformTimelineShellRef width=timelineWidthPx>  ← timeline 内容层（原生随 tier scroll 移动）
      <div ref=waveformStretchShellRef>                       ← resize stretch-hold（scaleX）
        <div ref=containerRef>                                ← WaveSurfer mount（fillParent: false）
      <WaveformSegmentOverlay z=3 />                          ← 仅选中 / drag draft DOM，timeline 坐标
      <WaveformSegmentPlaybackControls z=8 />
      <WaveformSegmentBandCanvas z=2 />                       ← packable 语段色带（timeline-native virtual canvas window）
      <div ref=waveformStickyShellRef absolute+scrollPin width=vw> ← viewport chrome
        <WaveformViewportPlayhead z=10 />
        <WaveformLiveTimeRuler z=20 />                        ← 嵌入时间尺 Canvas（viewport + subscribeTierScrollFrame）
</div>
```

- `timelineWidthPx = pxPerSec × duration`；`peaksStageWidthPx = max(timelineWidthPx, tier.clientWidth)`。
- viewport chrome 宽 = tier 视口宽（CSS var `--waveform-tier-viewport-width` + imperative `width`）。
- viewport chrome **不用 `position: sticky`**：改为 `absolute left-0 top-0` + `translate3d(scrollLeft,0,0)`（[`waveformScrollPinnedLayers.ts`](../../apps/desktop/src/utils/waveformScrollPinnedLayers.ts)）。
- **header「被撑掉」根因与修复**：播放中 transcript follow 若直接 `EditorView.scrollIntoView(..., { y: "center" })`，可能在 WKWebView 中带动外层 flex 视口重算或滚动，视觉上把 `EditorToolbar` 推离可见区、footer 看似变宽。修复分三层：编辑页主容器与 `EditorViewLayout` 根容器必须使用 `h-0 min-h-0 flex-1 overflow-hidden`；`shouldRevealTranscriptPlaybackFocus` 对 `prevFocusIdx < 0` 返回 false，启动第一帧只上色、不滚动；后续跨句 reveal 必须走 `revealSegmentInScrollDOM`，只移动 CM6 内部 scroller。`.toolbar-popover-root { transform: translateZ(0) }` 仅用于稳定 WKWebView compositor repaint，不能替代外层高度锁 / playback follow 内部滚动。

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
- Symphonia 探测/解码失败时，peaks 路径尝试 **ffmpeg remux → 临时 WAV → 再生成**（`waveform_peaks_ffmpeg.rs`；超时按时长/体积推导）。
- **导入 / 打开播放**：[`audio_container_normalize.rs`](../../apps/desktop/src-tauri/src/project/audio_container_normalize.rs) 先 Symphonia 探测，失败则廉价修 PCM WAV 头，再失败则 ffmpeg remux（**保留声道**；peaks 路径仍强制 mono）写回项目音频真源（见 [`audio-import-container-normalize-research.md`](../execution/specs/audio-import-container-normalize-research.md)）。`native_audio_load` 在 `spawn_blocking` 中跑 normalize，避免堵 UI。
- `peaksMediaDurationMismatch` 仍用于 `useWaveformPeaks` 触发一次 best-effort regenerate（仅当已有 `.dat` 级别）。

## 时长真源

[`waveformTimelineMetrics.ts`](../../apps/desktop/src/utils/waveformTimelineMetrics.ts) 的 `resolveWaveformTimelineMetrics()` 导出：

- `mediaDurationSec` — WS 与 peaks manifest 合并
- `timelineWidthPx` — `pxPerSec × duration`，受 **layout soft-cap**（`MAX_LAYOUT_TIMELINE_WIDTH_PX`）约束；不等于 peaks 列硬顶
- 有效布局 px/s 见 [`effectiveTimelinePxPerSec`](../../apps/desktop/src/utils/waveformProjection.ts)（`timelineWidthPx / duration`），不在 metrics 对象重复导出

`useWaveformTimelineController` 为唯一装配点。

## 播放时钟与单 tick（playhead / 滚动跟随同源）

调研：[`waveform-visual-raf-playhead-research.md`](../execution/specs/waveform-visual-raf-playhead-research.md)（播放驱动）、[`waveform-playhead-single-clock-research.md`](../execution/specs/waveform-playhead-single-clock-research.md)（无外推）、[`waveform-playhead-clock-unification-research.md`](../execution/specs/waveform-playhead-clock-unification-research.md)（rAF 分发，历史）、[`playback-clock-api-naming-research.md`](../execution/specs/playback-clock-api-naming-research.md)（权威/显示命名）。

- **单时间源（无外推）**：UI 真源 = `getDisplayPlayheadTimeSec()`（ready 时 = `visualTimeSecRef`）。播放中 rAF 轮询 **引擎显示钟** `getDisplayMediaPlayheadTimeSec` → `getEngineDisplayTimeSec`（native 可插值）。**权威 latch** = `getAuthorityPlayheadTimeSec`（TimeUpdate / Seeked），仅用于 seek 命令与 resume-skip 门闩。**不做** UI 侧 `playbackRate * dt` 外推。
- **显示钟平滑（native 侧）**：引擎显示钟 [`nativeAudioPlaybackTransport.computeDisplayTime`](../../apps/desktop/src/services/waveform/transport/nativeAudioPlaybackTransport.ts) 用 `computeSmoothDisplayStep` 对「权威投影」做**一阶低通临界阻尼跟踪 + 单调钳制**（τ≈0.1s，`α=1−e^(−Δt/τ)` 帧率解耦）。根因：`timeUpdate` 经 IPC 抖动重锚滞后权威时，旧「高水位硬冻结」会周期性多帧停顿 —— `center` 靠钉死的针稀释不可见，`edge` 静止背景上单根针把它放大成 0.5–2.5px 抖动。平滑后滞后权威 → 平滑减速/plateau 而非硬冻结、绝不回退；underrun/resume 落后前向瞬跳；真实 seek 由 `seeked` 事件重锚。此为 ADR-0008 授权的显示插值层，**不违反** UI no-extrapolation；消费端（playhead / follow / ruler / wash）零改动即受益。调研：[`waveform-visual-clock-smoothing-research.md`](../execution/specs/waveform-visual-clock-smoothing-research.md)。
- **播放视觉驱动（VRP）**：playing 时 [`useWaveformVisualPlayheadClock`](../../apps/desktop/src/hooks/useWaveformVisualPlayheadClock.ts) **本仓 rAF** 每帧轮询引擎显示钟 → 写 `visualTimeSecRef` → `schedulePlaybackViewportFrame`。不依赖 WS `audioprocess` 帧率（Tauri/WKWebView 实测常仅 13–17Hz）。`audioprocess` 仅在暂停态（或 `isPlaying` 尚未 commit）schedule；playing 时只锚 ref。
- **Seek（Peaks 序）**：`syncDisplayPlayheadAfterSeek(t)` → `ws.setTime(t)` → `commitSeekUi`。用户路径同栈已刷 UI。入口：[`applyPeaksOrderedSeek`](../../apps/desktop/src/services/waveform/transport/dispatchTransportIntent.ts) / [`useWaveformPlayback.seek`](../../apps/desktop/src/hooks/useWaveformPlayback.ts)。
- **WS `seeking` 事件**：播放态 **不**重同步 playhead（下一帧 rAF / media 轮询覆盖）；暂停态 **仍** `syncDisplayPlayheadAfterSeek` — 覆盖 peaks 热重载等 **WS-only `setTime`**（不经 Peaks 序），避免 band `playheadSecRef` 滞后。
- **Pause / Chromium 回退**：停播取消 rAF；`lastTimeUiCommitRef` → `setCurrentTime` → `syncPausedTime`；`pausedImperativeSeekUntil`（~400ms）防止 stale React `currentTime` 覆盖 imperative seek。
- **单 rAF 发布/订阅**：playing rAF / seek sync 经 [`schedulePlaybackViewportFrame`](../../apps/desktop/src/utils/tierScrollFrameCoordinator.ts) 同帧通知：滚动跟随（`PLAYHEAD_FRAME_PRIORITY_SCROLL=0`，已有 scroll epsilon 节流）→ playhead transform（`=1`）。[`useWaveformPlaybackScrollFollow`](../../apps/desktop/src/hooks/useWaveformPlaybackScrollFollow.ts)、[`WaveformViewportPlayhead`](../../apps/desktop/src/components/WaveformViewportPlayhead.tsx) 订阅同一帧时间；[`useWaveformLiveClock`](../../apps/desktop/src/hooks/useWaveformLiveClock.ts) 读 `getDisplayPlayheadTimeSec`。embedded ruler **不**订阅 playhead 重绘（WR-1）。
- **高频几何写入（direct style）**：playhead transform、band / ruler `left/width/height`、ruler/minimap scroll transform 一律经 [`setDirectLayoutStyle`](../../apps/desktop/src/utils/cspElementLayout.ts)（`element.style.setProperty`，**CSP 合法**，零全文档 style recalc，与 WaveSurfer v7 同构）。`lastTransformRef` / `lastCssLeftRef` 去重。调研与 CSP probe 实测见 [`waveform-csp-dynamic-style-performance-research.md`](../execution/specs/waveform-csp-dynamic-style-performance-research.md)。
  - **边界**：`setCspLayoutRules`（nonce `<style>` 注册表）仅保留给**需要选择器 / 伪类 / 媒体查询**的动态样式（这类真 `<style>` 元素会被 `style-src-elem` 拦，须 nonce）；**禁止**用于每帧路径。`element.style` 仅允许在 `cspElementLayout.ts` 单点封装（架构守卫 allowlist），组件不散落 `.style.`；`style={{}}` / `setAttribute('style')` / `cssText` 仍全仓禁（`style-src-attr` 拦截）。
- **已播放 / visited 显示边界**：时间轴已播放区由 [`WaveformViewportPeaksCanvas`](../../apps/desktop/src/components/WaveformViewportPeaksCanvas.tsx) wash + playhead 表示；未选中语段在 playhead 越过起点后用中性 `--segment-fill-visited`（弱于 selected）。选中 / 多选 / 低置信仍优先于 visited。
- **已删除**：`waveformImperativePlayheadSync`（50ms）、`waveformSelectionSeekChrome`（1200ms seeking coalesce）— 双钟竞争补丁；选中后防播放跟随回拽仍用 `playbackFollowSuppressUntilRef`（与 playhead 时钟无关）。

## Transport Authority（seek / play 命令真源）

调研：[`waveform-transport-authority-research.md`](../execution/specs/waveform-transport-authority-research.md)（承接 seek-industry + single-clock）。

- **问题**：display 时钟已单源，但「写什么时间 / 何时 play」曾分散在 playback、segment controls、selection、gesture、shortcut 等多处，SC2/raw/display 启发式互相覆盖 → 播放中选段不 seek、假 seek-within、raw 滞后起播。
- **真源模块**：[`services/waveform/transport/`](../../apps/desktop/src/services/waveform/transport/) — `resolveSegmentPlayFrom` / `resolveSelectTransportSeekTime` / `applyPeaksOrderedSeek` / `dispatchTransportIntent`。
- **生产接线**：[`useProjectWaveform`](../../apps/desktop/src/hooks/useProjectWaveform.ts) 组装 `TransportDispatchDeps`，导出 `dispatchTransportIntent`；`seek` / `seekByDelta` / `playSegmentAtIndex` / `handleToggleSelectedWaveformPlay` 均经 dispatcher。Timeline 透传：`useWaveformTimelineController.dispatchTransportIntent`。选中 seek：`syncWaveformSegmentSelectSeek(..., { segmentIdx })` → `selectSegmentTransport`。
- **Play-from 优先级**（写死）：`fromSec`（钳入段）→ authority≈display 且段内 resume skip → 段内 display → **已过段尾从 display 续播** → 段前跳段头（[`resolveSegmentPlayFrom`](../../apps/desktop/src/services/waveform/transport/resolveTransportTargetTime.ts)）。
- **选中 seek**：由 CM6 projection primary 变化或显式 `seekPolicy` / `viewportSyncedOnDown`（真实 preview seek token）决定；**禁止**用已删除的 SC2 chrome 匹配推断「已 seek」。
- **产品入口**：正文外 Space / 正文内 ⇧Space = `togglePlay`（会话粘性；**无 sticky session 且有选中语段时起播=段播**；**全局会话暂停后再 Space = 从停点续通读**）。工具条「全局播放」= `toggleGlobalPlay`。波形浮层 / 旁侧 play/loop = `handleToggleSelectedWaveformPlay` → `toggleSegmentPlay` intent。语段起播索引用 [`effectiveTranscriptPrimaryIdx`](../../apps/desktop/src/components/editor/core/projectionWaveformBridge.ts)。
- **保留在外**：DOM playhead 投影、tier scroll、WS canvas/peaks。Transport 只消费时间与 seekPolicy，不拥有选区 chrome。
- **禁止**：组件层直接 `ws.setTime`（架构守卫）；第二套时钟 / WS native cursor / 第二套 hit-test。

## 偏好（localStorage）

| Key | 含义 | 设置入口 |
|-----|------|----------|
| `rushi.p1.waveformPxPerSec` | 横向缩放 | 转写页 Zoom 条（换媒体时自动写入 fit） |
| `rushi.p1.waveformHeightPx` | 主波形高度 | **设置 → 偏好设置**；波形底缘拖拽 |
| `rushi.p1.transcriptFontPx` | 语段正文字号 | **设置 → 偏好设置**；行高拖拽 / 右键 |
| `rushi.p1.waveformGlobalPlaybackRate` | 全局播放速度 | **设置 → 偏好设置**；工具条 |
| `rushi.p1.tabAdvanceLoopsSegment` | Tab 切段并 loop 播放 | **设置 → 偏好设置**（默认关） |
| `rushi.p1.waveformMinimap` | L0 总览条 | **设置 → 偏好设置**；Zoom 条 |
| `rushi.p1.waveformPlaybackScrollFollow` | 播放滚屏 center/edge | **设置 → 偏好设置**；工具条 |
| `rushi.p1.transcriptPlaybackFollow` | 文稿跟播（Playback Focus；默认开） | **设置 → 偏好设置** |
| `rushi.editor.segmentListFilter.v1` | 语段列表筛选 | 工具条筛选（跨文件记忆） |
| `rushi.office-shell-theme.v1` / `rushi.office-accent-color.v2` | 界面主题 / 主题色（`#hex`；旧 `office-accent-theme.v1` 预设 id 启动时迁移） | **设置 → 偏好设置** |

编译期常量（非用户 pref）：`WAVEFORM_BACKGROUND_PEAKS_ENABLED`、`WAVEFORM_HOT_SWITCH_WHILE_PLAYING`（见 `waveformPrefs.ts`）。

## Viewport fit

- 语段 fit / reveal：`useTranscriptionViewportFit` 只调用 `revealSelectionScroll`；需 peaks 换档时保留 `pendingViewportFitRef`，在 `onZoomApplied → applyPendingViewportFit` **单次**滚 tier（`queueViewportFit` 不在换档前预滚）。
- 程序化滚动通过 `playbackFollowSuppressUntilRef` 短暂暂停播放跟随（与用户手动滚 tier 相同机制）。

## Route C2（导入预热 / 偏好 / minimap / 播放中热切换）

- **导入预热**：`scheduleWaveformPeaksPrewarm` 仍可用于显式预热；打开文件时由 `useWaveformPeaks` 统一 `ensure`（避免重复 invoke）。
- **偏好**（`waveformPrefs.ts`；**设置 → 偏好设置** + 工具条/拖拽）：
  - `rushi.p1.waveformMinimap` — L0 总览条（默认开）
- **Minimap**：`WaveformMinimapStrip`（56px，`zen-paper` 底，peaks 垂直居中）+ `PeakCache` / WaveSurfer export；点击 seek 并滚 tier；`WAVEFORM_MINIMAP_HEIGHT_PX = 56`。
- **播放中热切换**：`hotSwitchWhilePlaying` 为真时不推迟；仍 `setTime` 恢复 playhead，必要时 `play()` 续播。

## 相关 ADR / spec（历史）

- ADR-0004 / ADR-0005 描述的 canvas tile 路径已废弃；现行以本文为准。
- 历史 spec 已归档：[`docs/execution/specs/archive/waveform-pre-ws-only-2026-05/`](../execution/specs/archive/waveform-pre-ws-only-2026-05/README.md)（content-tile / convergence / 全局条等，**superseded**）。
