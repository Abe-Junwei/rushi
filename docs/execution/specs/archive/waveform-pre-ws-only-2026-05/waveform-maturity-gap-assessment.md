# Waveform 成熟度差距评估（基于 2026-05-29 代码）

> 评估范围：当前工作区 `apps/desktop/src` 波形渲染相关代码 + ADR-0004/0005 + 已落地 spec  acceptance 记录。
> 验证命令：`npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs` —— 当前全绿（guard 仅 1 警告：waveformPeaksCanvasDraw.test.ts 305 行）。

---

## 符号说明

| 符号 | 含义 |
|------|------|
| ✅ | 已对齐：代码已实现且与目标一致 |
| ⚠️ | 部分：有机制但不够完整，或实现与目标有偏差 |
| ❌ | 未对齐：尚未实现或机制缺失 |

---

## 一、P0 — 可见性 / 正确性

### 1. 时长与坐标「单一真源」（T-01 ~ T-06）

| # | 项 | 状态 | 代码证据 |
|---|----|------|----------|
| T-01 | 媒体时长单一真源 | ⚠️ | `useWaveformTimelineController.ts:76-83`：`timelineWidthPx` / `drawTimelineWidthPx` 使用 `wf.duration \|\| peaks.status?.durationSec \|\| 0`。`useWaveformPeaks` 接收 `mediaDurationSec`（来自 `wf.duration`），`WaveformOverviewStrip` 接收 `durationSec={tx.duration \|\| 0}`，`WaveformPeaksTileLayer` 接收 `mediaDurationSec={tx.duration \|\| tx.peakCache?.durationSec \|\| 0}`。**至少 3 处来源**，无单一 `timelineMediaDurationSec` 函数收口。 |
| T-02 | Peaks 时长与 .dat meta 一致 | ⚠️ | `PeakCache.durationSec` 来自 `waveformDurationSec(finest.data)`（`PeakCache.ts:55`）。`useWaveformPeaks.ts:42-55` 有 `peaksStatusMismatch` + force regenerate 机制（98% 阈值）。但 `peaksEnsureMediaDurationSec` 只是简单透传（`peakMediaDuration.ts:15-17`），**首次加载 mediaDurationSec=0 时传给 Rust 的是 undefined**，与后续真实值不一致。 |
| T-03 | 主 tier layout 宽 | ✅ | 统一使用 `computeTimelineWidthPx`（`pxPerSec.ts:19-23`），320px floor 规则一致。但输入时长来源受 T-01 影响。 |
| T-04 | 主 tier draw 宽 | ⚠️ | `drawTimelineWidthPx` 参与 `waveformTileDrawSignature`（`waveformTileDrawSignature.ts:26`），但 `WaveformPeaksTileLayer.tsx:188` 实际 draw 时 `timelineWidthPx: layoutTimelineWidthPx`，**draw 宽仅用于 signature，不用于列→像素映射**。 |
| T-05 | Overview layout 宽 | ❌ | `WaveformOverviewStrip.tsx:71-77`：`overviewTimelineWidthPx = computeTimelineWidthPx(durationSec, overviewPxPerSec)`，**仍含 320px floor**。但 `WaveformOverviewPeaksCanvas.tsx:45` draw 时 `timelineWidthPx: cssW`（即 viewportWidthPx）。**resample 目标宽与绘制目标宽来自两条路径**。 |
| T-06 | Overview 时间→像素 | ⚠️ | `playheadLeftPx` 用 `(time/duration) * overviewWidthPx`（`WaveformOverviewStrip.tsx:92-95`，ratio 映射）。但 `overviewSegmentBarPx` 用 `time * overviewPxPerSec`（`waveformOverviewGeometry.ts:64-74`，px/s 映射）。`computeOverviewPxPerSec` 有 quantize（`Math.round(raw*100)/100`），**ratio 与 px/s 在 quantize 后可能产生 1-2px 偏差**。 |

**结论**：时长/宽度「四处真源」问题**未收口**。`wf.duration`、`peaks.status.durationSec`、`peakCache.durationSec`、`computeTimelineWidthPx` 的 floor 规则各自为政，是主 tier 截断、overview 空白、resize 不重绘的共同根因。

---

### 2. Peaks 生命周期（P-01 ~ P-06）

| # | 项 | 状态 | 代码证据 |
|---|----|------|----------|
| P-01 | 首次加载顺序 | ❌ | `useWaveformTimelineController.ts:59-68`：换文件时先 `setMediaDurationSec(0)`，等 `wf.duration > 0` 后再设真实值。`useWaveformPeaks.ts:117` deps 含 `mediaDurationSec`，**0→真实值会导致整 effect 重跑**。虽 `identityChanged` 为 false 时不清空 `peakCache`，但 `setLoading(true)` 会 flicker。 |
| P-02 | duration 变化 reconcile | ⚠️ | `useWaveformPeaks.ts:85-112`：`identityChanged` 为 false 时保留旧 cache，但 effect 内仍 `setLoading(true)`（第 89 行）。**duration 变化会触发 loading flicker**，未实现「保留旧 peakCache，后台 force regenerate，完成后 swap」。 |
| P-03 | 不完整 peaks 策略 | ❌ | `drawWaveformPeaksTile.ts:92-102`：主 tier `fillLayoutWidth=false`，coverage < 98% 时 `peakLayoutSpanPx = (peakDurationSec/mapDurationSec)*layoutWidthPx` → **右侧空白**；overview `fillLayoutWidth=true` → **拉伸铺满**。**同一文件主 tier 与 overview 表现不一致**。 |
| P-04 | Rust stale 检测 | ⚠️ | `useWaveformPeaks.ts:25-55`：`peaksStatusMismatch` 检测 + force regenerate 有代码。但「probe 取 max(symphonia, media, file)」的逻辑在前端不可见，**前端传的 mediaDurationSec 与 T-01 同源**（ws.duration），VBR 场景下可能仍不一致。 |
| P-05 | 生成失败 UX | ⚠️ | `EditorWaveformPane.tsx:96-100`：主 tier 显示 `peaksError`（红条）。但 `WaveformOverviewStrip.tsx:111` 的 `showPeaks` 只是 `Boolean(peakCache && width && duration)`，**overview 无独立错误态**，失败时显示米色占位而非错误提示。 |
| P-06 | Resample 输入 | ❌ | `WaveformOverviewPeaksCanvas.tsx:40`：`peakCache.getInterleavedPeaks(pxPerSec, mediaDur)`。`PeakCache.ts:87`：`targetWidthPx = computeTimelineWidthPx(layoutDur, pxPerSec)`。对于 overview，这 = `computeTimelineWidthPx(mediaDur, overviewPxPerSec)`，**含 320 floor，≠ overviewWidthPx**。见 O-06 详细分析。 |

---

### 3. 主 tier content-tile 绘制（M-01 ~ M-06）

| # | 项 | 状态 | 代码证据 |
|---|----|------|----------|
| M-01 | Tile 重绘触发 | ✅ | `WaveformPeaksTileLayer.tsx:72-84`：`contentKey = ${drawPxPerSec}\|${peakCacheIdentity}`，`layoutGeometryKey = ${viewportWidthPx}\|${tileWidthPx}\|${totalTiles}\|${layoutTimelineWidthPx}`。`useWaveformTileLifecycle.ts:76-78`：invalidationKey 变化时 bump generation。 |
| M-02 | draw 返回 false | ❌ | `drawWaveformPeaksTile.ts:109`：**函数开头即 `ctx.clearRect(0, 0, ...)`**，返回 false 时 canvas 已被清空。`WaveformPeaksTile.tsx:198-206` 仅在 `drew===true` 时更新 signature 和 opacity，false 时无保留上一帧逻辑。**快速 zoom 可能出现白 tile**。 |
| M-03 | 尾部截断 | ❌ | 同 P-03：主 tier 不完整 peaks 时右侧空白，且无明确错误提示叠加。 |
| M-04 | Scroll 采样 | ✅ | `useTierScrollLayout.ts:21-75`：burst rAF 120ms + ResizeObserver + window.resize。`tierScrollLayout` 供 Pane / Tile / Ruler 共用（`EditorWaveformPane.tsx:36-37`）。 |
| M-05 | Fit-all 下限 | ✅ | `pxPerSec.ts:7`：`PX_PER_SEC_FIT_MIN = 0.05`。`computeTimelineWidthPx` 有 320px floor（`pxPerSec.ts:20`）。但**缺 21min @ fit-all 的集成测试覆盖**。 |
| M-06 | Tile 池实现 | ❌ | 当前为 React `useWaveformTileLifecycle` + `WaveformPeaksTileLayer.tsx:101-113` map 动态 canvas 列表。每个 tile 独立 `useLayoutEffect` draw（`WaveformPeaksTile.tsx:156-218`）。**非 imperative pool**；ADR-0005 S3′ 明确「仅当 S1+S2+S4 后 H.02/H.03 仍不达标才启动」，目前尚未启动。 |

---

### 4. Overview 专项（O-01 ~ O-09）

| # | 项 | 状态 | 代码证据 |
|---|----|------|----------|
| O-01 | overviewPxPerSec 为 0 | ✅ | `waveformOverviewGeometry.ts:19-25`：`computeOverviewPxPerSec` 有 `Math.max(0.01, Math.round(raw * 100) / 100)`。`WaveformOverviewStrip.tsx:63-68` 无外层 `Math.round`。`waveformOverviewGeometry.test.ts` 应覆盖 600px × 21:03 → 0.48。 |
| O-02 | overviewWidthPx = 0 | ⚠️ | `WaveformOverviewStrip.tsx:50-61`：`useState(0)` + ResizeObserver + 初始 `setOverviewWidthPx(el.clientWidth)`。但 `WaveformGlobalStripShell` 展开时才 mount，`clientWidth` 首帧可能为 0（若父容器动画中）。**无 mount 后立即同步读的保底**。 |
| O-03 | showPeaks 条件 | ❌ | `WaveformOverviewStrip.tsx:111`：`showPeaks = Boolean(peakCache && overviewWidthPx > 0 && durationSec > 0)`。空白时仅显示 `bg-notion-sidebar-active/40` 占位色（第 140 行）。**无「等待时长…」「生成中…」等具体原因提示**。 |
| O-04 | draw 失败 | ❌ | `WaveformOverviewPeaksCanvas.tsx:55-58`：`catch (err) { console.error(...); ctx.clearRect(...); }`。**无可见错误态、无重试队列**。 |
| O-05 | fillLayoutWidth | ✅ | Overview `fillLayoutWidth: true`（`WaveformOverviewPeaksCanvas.tsx:53`），主 tier 无。但**与 P-03 策略不一致**（overview stretch / 主 tier clip）。 |
| O-06 | Resample 宽错位 | ❌ | `WaveformOverviewPeaksCanvas.tsx:40`：`getInterleavedPeaks(pxPerSec, mediaDur)` → `PeakCache.ts:87`：`targetWidthPx = computeTimelineWidthPx(layoutDur, pxPerSec)`。**overview resample 目标宽 ≠ overviewWidthPx**，而是含 320 floor 的 timeline 宽。例如：overviewWidthPx=300，duration=1263s，px/s=0.24，则 `computeTimelineWidthPx(1263, 0.24) = max(303, 320) = 320`。resample 出 320 列，draw 在 300px 上 stretch。**这是「修了 round→0 仍空白」的剩余根因之一**。 |
| O-07 | 语段条坐标 | ❌ | `overviewSegmentBarPx` 用 `lo * overviewPxPerSec`（`waveformOverviewGeometry.ts:71`）。`playheadLeftPx` 用 `(time/duration) * overviewWidthPx`（`WaveformOverviewStrip.tsx:94`）。**未统一为 `time/duration * overviewWidthPx`**。 |
| O-08 | peakCache 更新 | ✅ | `WaveformOverviewPeaksCanvas.tsx:59` effect deps 含 `peakCache` 引用。identity（duration/sampleRate）变化或新对象引用均会触发重画。 |
| O-09 | z-index / 遮挡 | ⚠️ | Canvas 无显式 z-index（`WaveformOverviewPeaksCanvas.tsx:62-67`：`block` 非 `absolute`）。语段条 `z-[2]`，viewport rect `z-[3]`，playhead `z-[4]`。canvas 在 normal flow 中，segments 在其后渲染且 absolute。**理论上不会遮挡 canvas，但需手测确认**。 |

**结论**：Overview 「下方整体不渲染」的根因链：**O-02（首帧 width=0）→ O-03（无原因提示）→ O-04（draw 失败静默）→ O-06（resample 宽错位）**。仅修 O-01（round→0）不够，必须收口整条链。

---

### 5. WaveSurfer 混合编排（W-01 ~ W-04）

| # | 项 | 状态 | 代码证据 |
|---|----|------|----------|
| W-01 | peaks 模式 scroll | ✅ | `useTierScrollSync.ts:46-49`：`shouldSyncWaveform = !peaksCanvasActive && ...`。`syncWaveformScrollPx`（第 98-101 行）在 peaksCanvasActive 时直接 return。**无 WS→tier 回写**。 |
| W-02 | zoom 与 WS | ⚠️ | `useWaveformZoomSync.ts:134-149`：`applyPeaksCanvasZoom` 仍调用 `cache.getWaveSurferPeaks(minPxPerSec)`、`disableWaveSurferAutoScroll(currentWs)`、`applyWaveSurferPeaksDrawMode(currentWs, true)`。**仍部分触达 WS**，虽非 `ws.load`/`ws.zoom`。 |
| W-03 | WS 实例职责 | ⚠️ | ADR-0005 规划 WS 仅 play/seek/timeuserUpdate，但 `useWaveformZoomSync.ts` 仍用 WS 做 peaks draw mode 切换。代码与文档**未完全一致**。 |
| W-04 | decode-fallback | ✅ | `waveformTimelineTypes.ts:6-8`：`resolveWaveformTimelineMode(peakCache)` — peakCache != null ? "peaks" : "decode-fallback"。降级路径清晰。 |

---

### 6. 手测闸门（H-01 ~ H-09）

| ID | 场景 | 状态 | 证据 |
|----|------|------|------|
| H-01 | ~1min 打开 3s 内 peaks 可见 | ❌ | `waveform-single-scroll-consolidation-acceptance.md:114-116` 签收记录表**全空**，无日期/签收人。 |
| H-02 | ~10min fling 停滚无闪 | ❌ | 同上。 |
| H-03 | ~21min 高 zoom 无白块；全屏重绘 | ❌ | 同上。用户反馈「正在踩」。 |
| H-04 | 滑块 min→max→min 释放正确 | ❌ | 同上。 |
| H-04′ | 拖动 2s 无主线程风暴 | ❌ | 同上。 |
| H-05 | 横滚末尾↔开头无闪动 | ❌ | 同上。 |
| H-06 | 快速切语段 10 次 peaks 可见 | ❌ | 同上。 |
| H-07 | 跟随播放视口跟随 | ❌ | 同上。 |
| H-08 | fit 全段可见 | ❌ | 同上。 |
| H-09 | 全局条与主区 scroll 一致 | ❌ | 同上。用户反馈「正在踩」。 |
| H-13 | 换文件 / 折叠展开全局条 | ❌ | 同上。 |

**规则**：acceptance 文件明确规定「H-01–H-09 未全绿前，不算波形引擎对齐完成」。

---

### 7. 自动化测试缺口（A-01 ~ A-06）

| # | 项 | 状态 | 证据 |
|---|----|------|------|
| A-01 | 21min + overview getInterleavedPeaks(0.48) 列数 > 0 | ❌ | 无此集成测试。`PeakCache.test.ts` 仅 3 个测试，覆盖基本加载。 |
| A-02 | overview draw fillLayoutWidth + 600px 宽 drew===true | ⚠️ | `waveformPeaksCanvasDraw.test.ts` 有 draw 测试，但未明确覆盖 overview 场景（fillLayoutWidth + 低 px/s）。 |
| A-03 | overviewWidthPx=0 → mount 后 > 0 | ❌ | 无组件测试。 |
| A-04 | peaks 80% 覆盖：主 tier 与 overview 同一错误态 | ❌ | 无行为测试覆盖不完整 peaks 的 UI 表现。 |
| A-05 | layoutGeometryKey 变化 → generation bump | ✅ | `useWaveformTileLifecycle.test.ts` 覆盖 LRU / generation / contentKey。 |
| A-06 | fullscreen：clientWidthPx 增大 → activeTiles 覆盖新区域 | ❌ | `useWaveformTileLifecycle.test.ts` 覆盖 visible range，但未覆盖 ResizeObserver → layoutGeometryKey → generation 链路。 |

---

## 二、P1 — 架构对齐

| # | 项 | 状态 | 代码证据 |
|---|----|------|----------|
| S-01 | Imperative tile renderer（S3′） | ❌ | 未启动。ADR-0005：「可选 S3′：仅当 S1+S2+S4 后 H.02/H.03 仍不达标」。当前 S4 签收未完成。 |
| S-02 | WaveformTimelineController 出口收敛 | ❌ | `useWaveformTimelineController.ts` 返回 18+ 字段，页面层仍直接访问 `timeline.peaks`、`timeline.zoom`、`timeline.wf` 等子 hook。 |
| S-03 | Overview 与主 tier 共用 draw 入口 | ⚠️ | 共用 `drawWaveformPeaksTile` + `prepareCanvasDprDraw`，但参数组装分散在 `WaveformPeaksTile.tsx`（主 tier）和 `WaveformOverviewPeaksCanvas.tsx`（overview），未共用统一 metrics 计算。 |
| S-04 | Peaks 生成进度 UI | ❌ | `useWaveformPeaks.ts` 仅有 `loading: boolean`，无进度百分比。 |
| S-05 | Viewport-fit 状态机收口 | ⚠️ | 有 `viewportFitStateMachine.ts`（7 个测试通过），但 `useTranscriptionViewportFit.ts` 中仍有大量外部 ref 和 rAF 包装（`pendingSegmentFitRafRef`），**竞态未完全收敛**。 |
| S-06 | Zoom 入口统一 clamp | ⚠️ | `pxPerSec.ts` 中 `clampPxPerSec`、`clampPxPerSecForSlider`、`clampPxPerSecForFitSelection`、`quantizePxPerSecForPeaksLoad` 共存。**未统一为单一入口**。 |
| S-07 | Played/unplayed 分色 | ❌ | ADR-0004 P2 规划 `WaveformProgressOverlay`，代码中未实现。`WaveformPeaksTile` 无 progress 着色参数。 |
| S-08 | 文档真源更新 | ✅ | `desktop-waveform-engine.md` 已更新：LRU cap = 24、overscan = 5、content-tile 范式、ADR-0005 S1 已落地。 |

---

## 三、P2 — 体验与规模

| # | 项 | 状态 | 备注 |
|---|----|------|------|
| E-01 | Resample 放 Worker | ❌ | 主线程 `resampleWaveformForPxPerSec`（`audiowaveformDat.ts`）。 |
| E-02 | 首屏低清 preview → 高清替换 | ❌ | 无渐进式 LOD。 |
| E-03 | 立体声分轨显示 | ❌ | PeakCache 为 mono mixdown。 |
| E-04 | GPU 绘制 | ❌ | Canvas 2D。 |
| E-05 | 实时录音波形 | ❌ | 未实现。 |
| E-06 | Scrub 低延迟 | ❌ | 未评估。 |

---

## 四、关键问题根因映射

| 用户现象 | 直接根因项 | 说明 |
|----------|-----------|------|
| 主波形右侧空白 / 全屏不重绘 | T-01, P-03, M-02, M-03 | 时长不单一 + 不完整 peaks 策略不一致 + draw false 时 canvas 被 clear |
| 全局条整体不渲染 | O-02, O-03, O-04, O-06, P-01, T-05 | width 首帧 0 + 无错误态 + draw 失败静默 + resample 宽错位 + peaks effect 重跑 |
| 0.48→0 overview 空白 | O-01（已修） | 单独已修，但**必须叠加 O-06** 才能解决「有壳无峰」 |
| 快速 zoom 拖动卡顿 | M-06, E-01 | React reconciliation + 主线程 resample |
| 播放跟随不稳定 | W-01（已修），H-07（未测） | S1 已落地 tier-only scroll，但手测未签收 |

---

## 五、当前机器闸门状态

```bash
npm run typecheck   # ✅ 通过
npm run test        # ✅ 390 测试通过
npm run lint        # （未单独跑，typecheck+guard 通过通常意味着无新增 lint error）
node scripts/check-architecture-guard.mjs  # ⚠️ 1 警告：waveformPeaksCanvasDraw.test.ts 305 行
```

**注意**：机器闸门全绿**不等于**波形引擎对齐完成。acceptance 文件明确要求 H-01–H-09 全绿 + 签收记录填写才算完成。

---

## 六、结论与建议

### 已对齐（不必重选架构）

- content-tile + audiowaveform .dat LOD — 与 Peaks.js / WaveSurfer v7 同路 ✅
- tier scroll 为 peaks 模式真源（ADR-0005 S1）✅
- zoom 三轨（layout 即时 / draw 冻结）✅
- tile generation / LRU / overscan 机制 ✅
- overview round→0 修复 ✅

### 未对齐（按优先级排序）

| 优先级 | 项 | 估计工作量 | 阻塞性 |
|--------|----|-----------|--------|
| P0 | **时长/宽度单一真源**（T-01 ~ T-06） | 1-2d | 🔴 高：所有边界 bug 的根因 |
| P0 | **Overview resample 宽 = overviewWidthPx**（O-06） | 0.5d | 🔴 高：修了 round→0 仍空白的主因 |
| P0 | **不完整 peaks 策略统一**（P-03, O-05） | 0.5d | 🔴 高：主 tier vs overview 表现分裂 |
| P0 | **手测 H-01~H-09 签收** | 1d | 🔴 高：acceptance 硬门槛 |
| P1 | **draw false 保留上一帧**（M-02） | 0.5d | 🟡 中：快速 zoom 闪白 |
| P1 | **Overview 错误态 + 原因提示**（O-03, O-04） | 0.5d | 🟡 中：UX 差距 |
| P1 | **WS 职责完全收敛**（W-02, W-03） | 1d | 🟡 中：ADR-0005 未完全落地 |
| P1 | **Viewport-fit FSM 竞态收口**（S-05） | 1d | 🟡 中：切语段偶发 blank |
| P2 | **Imperative tile renderer（S3′）** | 3-5d | 🟢 低：H.02/H.03 不达标才启动 |
| P2 | **Resample Worker**（E-01） | 2-3d | 🟢 低：性能上限 |
| P2 | **Progress overlay 分色**（S-07） | 1d | 🟢 低：产品 polish |

### 推荐下一步

若目标是「先让 overview 稳定可见」，建议按以下顺序：

1. **T-01**：实现 `resolveWaveformTimelineMetrics.ts`，统一输出 `mediaDurationSec`、`peakDurationSec`、`timelineWidthPx`、`overviewWidthPx`（无 320 floor）等。
2. **O-06**：Overview resample 目标宽改为 `overviewWidthPx`，而非 `computeTimelineWidthPx`。
3. **O-02 + O-03**：overview mount 后强制同步读 width + showPeaks 条件拆分「无 peaks / 无时长 / width=0」三态。
4. **P-03**：统一不完整 peaks 策略（error 态或 stretch，不可主 tier / overview 分叉）。
5. **手测**：21min 文件 H-09（全局条有波形）→ H-03（全屏重绘）→ H-01（快速打开）。
