# Plan：波形渲染热路径修复

> **调研**（编码前必读）：[`waveform-render-hotpath-research.md`](./waveform-render-hotpath-research.md)
> **acceptance**：[`waveform-render-hotpath-acceptance.md`](./waveform-render-hotpath-acceptance.md)
> **架构真源**：[`desktop-waveform-engine.md`](../../architecture/desktop-waveform-engine.md)
> **状态**：WR-1/WR-2/WR-3 **完成并签收**（2026-07-10）；WR-4 默认不做

---

## 0. 目标数据流（修复后）

```
播放 tick (audioprocess, ~16ms)
  └→ 只移动 playhead 叠加层（DOM, setDirectLayoutStyle）           ← 已有
  └→ segment band canvas 需要时重绘                                ← 已有
  └→ ruler canvas：不订阅、不重绘（静态刻度层）                     ← WR-1 新
        · 高亮 major tick 仅在 interactionActive（拖标尺）时按 currentTimeSec 重绘

scroll / zoom / resize / appearance
  └→ ruler / band / minimap 按需重绘（保持现状）

zoom 落地
  └→ planWaveformZoomApply 决策（已有 defer / LOD 拉伸兜底）        ← WR-2 收紧覆盖
        · 中间态：用已加载 peaks 视觉拉伸，不 resample
        · 稳定态：resample 一次
  └→ resample + peaks 转换                                         ← WR-3 移出主线程（条件性）
```

---

## 1. 分片

### WR-1　ruler 不随播放重绘（P0，低风险，先做）

**问题**：`WaveformTimeRulerCanvas` 逐帧 `subscribePlayheadFrame` → 全画布重绘，播放态零像素变化（见 research §1-A）。

**改动**：
1. `WaveformTimeRulerCanvas.tsx`：删除 `subscribePlayheadFrame` 触发的 `forceRepaint + paint`（第 253-256 行的订阅）。ruler 仅在 scroll（`subscribeTierScrollFrame`）/ resize / appearance / props(zoom,duration,timeline) 变化时重绘。
2. highlight 需求保留但降频：高亮 major tick 仅在 `interactionActive`（拖动标尺）时才有视觉效果，因此让 `interactionActive` 或 `currentTimeSec`（React 态，节流后的 seek/pause 值）进入既有的第二个 `useLayoutEffect` 依赖即可触发一次重绘——**该 effect 已依赖 `currentTimeSec` 与 `interactionActive`**（第 289 行），故播放态不订阅逐帧后，高亮仍能在拖动/seek 时更新。
3. 清理：`getPlayheadTimeSec` 若仅被逐帧路径使用则移除；`paintTimeSec = getPlayheadTimeSec?.() ?? currentTimeSec` 改为直接用 `currentTimeSec`（第 218 行）。
4. 调用方（`useProjectWaveform.ts` / `useWaveformTimelineController.ts`）：停止把逐帧 playhead 订阅传给 ruler；确认 minimap 仍保留其订阅（minimap playhead 确实需要逐帧移动，且已是 `setDirectLayoutStyle` 单元素写，开销可接受）。

**验证**：`WaveformTimeRulerCanvas.test.tsx` 断言「播放帧回调不触发 drawWaveformTimeRuler」；probe `rulerRepaint` 计数在稳态播放为 0。

**落位文件**：`WaveformTimeRulerCanvas.tsx`、`useProjectWaveform.ts`、`useWaveformTimelineController.ts`、`WaveformTimeRulerCanvas.test.tsx`

---

### WR-3　minimap canvas sizing 收尾（P2，随手，与 WR-1 同 PR）

**改动**：`WaveformMinimapStrip.tsx` 第 148 行 `setCspLayoutRules(canvas,{width,height})` → `setDirectLayoutStyle`；若 `setCspLayoutRules` 不再被本文件使用则移除 import。canvas 位图 `canvas.width/height`（devicePixelRatio）保持不变。

**验证**：minimap 渲染快照/尺寸测试不回归；架构守卫通过。

**落位文件**：`WaveformMinimapStrip.tsx`

> 注：WR-3 编号在 WR-2 之前落地，因它零风险且与 WR-1 同属「退出 registry 写路径」主题。命名保留原优先级顺序（P0 → P0 → P2）。

---

### WR-2　zoom resample 覆盖收紧（P0，中风险，第二步）

**目标**：连续 zoom 时中间态**不 resample**，只用已加载 peaks 视觉拉伸；仅在缩放稳定后 resample 一次。

**改动**：
1. 核对 `planWaveformZoomApply`（`waveformZoomSyncEngine.ts:54-123`）与 `shouldZoomOnlyWithLoadedPeaksStretch`（`waveformPeaksZoomFallback.ts`）当前覆盖：确认 zoom-only 拉伸分支在「已有 peaks 且缩放差在阈值内」时命中，避免每个中间步 load。
2. 若缺去抖：在 zoom 调用入口（`useWaveformZoomSync` / controller）对 `load-peaks` 动作加**尾沿去抖**（如 120-160ms 停稳后才 `loadPeaksIntoWaveSurfer`），中间步走 `finish-zoom`（拉伸）。**复用**既有 `zoomSyncInFlightRef` / `peaksLoadSeqRef` 序号机制取消陈旧 load，不新造。
3. 不改 `PeakCache` resample 算法本身（WR-4 才动）。

**验证**：新增/更新 zoom 决策单测：连续 N 步 zoom 只触发 1 次 `load-peaks`；wfProfile `resample` 计数下降。

**落位文件**：`useWaveformZoomSync.ts`（或对应 controller）、`waveformZoomSyncEngine.ts`（仅决策，不改算法）、相关 `*.test.ts`

---

### WR-4　resample 移出主线程（P0，需 spike，条件性第三步）

**前置 spike（research §4）**：
- **spike-1（CSP/Vite worker）**：在 dev(localhost:1421) + prod(tauri://) 各起一个最小 module worker，确认 `default-src 'self'` 是否放行；若 Vite 产出 `blob:` worker，则在 `tauri.conf.json` 的 `csp`/`devCsp` 增补 `worker-src 'self' blob:`。**spike 不通过 → WR-4 暂缓**，仅靠 WR-2 降频兜底并记为已知限制。
- **spike-2（数据传输）**：worker 接口设计为 `{ datBuffer: ArrayBuffer, targetWidth, pxPerSec, layoutDur } → Float32Array peaks`（transferable 回传），worker 内 `WaveformData.create` + `resample`，避免结构化克隆大对象。

**改动（spike 通过后）**：
1. 新增 `apps/desktop/src/services/waveform/peaksResampleWorker.ts`（worker 入口，import `waveform-data` + 复用 `resampleWaveformForPxPerSec` / `waveformDataToWaveSurferPeaks` 纯函数）。
2. 新增 `peaksResampleClient.ts`（主线程侧：单例 worker + 请求序号 + Promise 封装 + 失败回退到同步路径）。
3. `PeakCache.getWaveSurferPeaksAsync`：resample 步骤改为 `await client.resample(...)`；缓存键/LRU 不变；**保留同步 `getWaveSurferPeaks` 作为回退**。
4. 内存：主线程持有 .dat buffer 一份，worker 处理时 transfer，处理后不回传 buffer（只回 peaks），避免双份常驻。

**验证**：worker client 单测（mock worker）；手测 zoom 无长任务（Performance 面板无 >50ms 长任务落在 resample）；峰值内存不显著上升。

**落位文件**：`peaksResampleWorker.ts`（新）、`peaksResampleClient.ts`（新）、`PeakCache.ts`、`tauri.conf.json`（如需 worker-src）、`desktop-waveform-engine.md`、相关测试

---

## 2. 执行时序与闸门

| 步 | 分片 | 风险 | 闸门 |
|----|------|------|------|
| 1 | WR-1 + WR-3（同 PR） | 低 | typecheck + test + architecture-guard；手测：播放 playhead 顺滑、ruler probe 重绘=0 |
| 2 | WR-2 | 中 | 同上 + zoom 决策单测（连续 zoom 只 load 1 次） |
| 3 | spike-1/2 → WR-4 | 高 | spike 报告先行；通过后再编码，附 Performance 长任务对比截图 |

每步结束跑：`npm run typecheck && npm run test && npm run lint && node scripts/check-architecture-guard.mjs`，并手测一条主路径。

---

## 3. 明确不做

- 不重写单时钟 playhead 架构（上一薄片已定稿）。
- 不引入 OffscreenCanvas / 第二套 peaks LOD 栈。
- 不改 `data.resample` 算法本身，只改「在哪个线程 + 何时」调它。
- WR-4 spike 不通过时不硬上 worker。
