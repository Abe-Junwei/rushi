# 调研：波形渲染热路径根因（ruler 每帧重绘 / peaks resample 主线程阻塞 / minimap sizing）

> **状态**：部分落地（WR-1/WR-3 ✅；播放帧率根因移交 VRP）
> **关联 spec**：`waveform-render-hotpath-plan.md` / `waveform-render-hotpath-acceptance.md`
> **后续（播放顺滑）**：[`waveform-visual-raf-playhead-research.md`](./waveform-visual-raf-playhead-research.md) — 实测 `audioprocess` 仅 13–17Hz，须独立 rAF 轮询 media
> **前序**：[`waveform-csp-dynamic-style-performance-research.md`](./waveform-csp-dynamic-style-performance-research.md)
> **门禁**：未完成本文 **不得** 进入 Plan 定稿与业务编码（见 [`AGENTS.md`](../../../AGENTS.md) · `.cursor/rules/feature-research-gate.mdc`）

---

## 0. 背景（为什么还有一轮）

上一轮把 playhead / segment band / ruler shell / minimap 视口的**高频几何写入**从 `setCspLayoutRules`（`<style>.textContent` 重写 → 全局 style recalc）切到 `setDirectLayoutStyle`（`element.style.setProperty`）。手测后用户反馈「比修之前更卡」。带着 desktop dev 日志 + 浏览器 probe 复查，定位到 direct-style 改动**没有触及**的三处剩余热点，且其中两处是每帧级 CPU 开销。本文只聚焦这三处，逐一给出代码证据与业内对照。

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 播放时 playhead 一卡一卡；点击语段后交互反应慢；缩放（zoom）时整条波形卡顿约 1s |
| 本仓现状 | 见下三个根因，均附文件:行 |
| 成功标准 | 播放稳态帧内**无** ruler 全画布重绘（probe 计数=0）；zoom 触发的 resample **不阻塞主线程长任务**（单次主线程占用 < 1 帧 ~16ms，或移出主线程）；`npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs` 全绿 |

### 根因 A — ruler canvas 每播放帧全量重绘，且产出像素零变化（P0）

`WaveformTimeRulerCanvas.tsx` 订阅了逐帧 playhead 回调，回调里强制整画布重绘：

```253:256:apps/desktop/src/components/WaveformTimeRulerCanvas.tsx
    const unsubPlayhead = subscribePlayheadFrame?.(() => {
      forceRepaintRef.current = true;
      paintRef.current?.();
    });
```

`paint()` → `drawWaveformTimeRuler()`：每帧 `clearRect` + 重建全部 tick + 逐 tick `stroke` + 逐 label `fillText`（`drawWaveformTimeRuler.ts:56、90-128`）。

**关键点**：ruler 上并没有画 playhead 竖线（playhead 是独立 DOM 元素 `WaveformViewportPlayhead`）。唯一与时间相关的产出是「高亮最近的 major tick」（`findHighlightedRulerMajorTickTime`），而该高亮**仅在 `interactionActive === true`（用户拖动标尺）时才有视觉效果**：

```105:106:apps/desktop/src/services/waveform/drawWaveformTimeRuler.ts
    ctx.strokeStyle =
      major && interactionActive && isHighlightedMajor ? labelActiveColor : major ? majorColor : minorColor;
```

```123:124:apps/desktop/src/services/waveform/drawWaveformTimeRuler.ts
    const active = interactionActive && isHighlightedMajor;
    ctx.fillStyle = active ? labelActiveColor : labelColor;
```

即：**播放态（`interactionActive=false`）下每帧重绘产出的像素与上一帧完全相同**，纯浪费。60fps 下这是持续的 canvas fill/stroke CPU + GPU 上传。

### 根因 B — peaks resample 在主线程同步执行，zoom 时长任务阻塞（P0）

zoom 落地会调 `getWaveSurferPeaksAsync`，其名为 async，但**重活 `data.resample()` 是同步主线程调用**：

```158:163:apps/desktop/src/services/waveform/PeakCache.ts
    const resampled = resampleWaveformForPxPerSec(base.data, pxPerSec, layoutDur);
    const bundle = {
      peaks: await waveformDataToWaveSurferPeaksAsync(resampled),
      duration: layoutDur,
    };
```

`resampleWaveformForPxPerSec` 最终是一次 `data.resample({ width })`（`audiowaveformDat.ts:99`），`waveform-data` 库内为同步 CPU。其后的 `waveformDataToWaveSurferPeaksAsync` 已按 rAF 分片（`audiowaveformDat.ts:48-67`），但**分片只覆盖「填 Float32 数组」这一步，resample 本身不分片**，长音频/高缩放下即是数百 ms ~ 1s 的单个长任务。随后 `ws.load()` 再整条重渲染。

### 根因 C — minimap canvas 尺寸仍走 `setCspLayoutRules`（P2）

minimap 的 playhead / 视口已迁到 `setDirectLayoutStyle`，但 canvas 本体的 width/height 仍用旧路径：

```148:148:apps/desktop/src/components/WaveformMinimapStrip.tsx
      setCspLayoutRules(canvas, { width: widthPx, height: heightPx });
```

它只在 ResizeObserver / resize / appearance 时触发，且有 100ms debounce（`MINIMAP_RESIZE_DEBOUNCE_MS`），**不是播放热路径**，故定级 P2；一并清理以彻底退出 registry 写路径、消除偶发 resize 卡顿。

---

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表实现 | 核心机制 | 链接 / 路径 |
|---|------|----------|----------|------------|
| A | 标尺与 playhead 分层，标尺不随播放重绘 | Audacity / Adobe Audition / Descript | 时间刻度层是静态层，只随 scroll/zoom 重绘；播放头是独立叠加层（DOM/单独 canvas），播放时只移动叠加层 | 通行桌面音频 UI 惯例 |
| B | peaks 重采样离主线程 | WaveSurfer v7（可选 worker decode）、Peaks.js（web-audio 预计算 + 分层 LOD）、audiowaveform（离线预生成 .dat） | 重采样/解码放 Web Worker 或离线预生成，主线程只接收结果 buffer；zoom 用已加载 LOD 做视觉拉伸，避免每步 resample | `node_modules/wavesurfer.js`、`node_modules/waveform-data`、Peaks.js README |
| C | zoom 去抖 + LOD 拉伸兜底 | Peaks.js、WaveSurfer | 连续 zoom 只在稳定后 load 一次；中间态用已加载 peaks 拉伸 | 本仓已部分具备（见 §3） |

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用的部分 | 与 Rushi 约束冲突 | 备注 |
|------|--------|----------------|-------------------|------|
| A 分层不重绘 | 高 | ruler 已是独立 canvas；playhead 已是独立 DOM。只需**断开** ruler 的逐帧 playhead 订阅 | 无。高亮仅拖动态需要，可保留在 `interactionActive` 分支 | 改动极小、零新增依赖、风险最低 |
| B resample 离主线程 | 中 | `resampleWaveformForPxPerSec` / `waveformDataToWaveSurferPeaks*` 是纯函数，天然可搬进 worker；`waveform-data` 可在 worker 内 import | **CSP**：当前无 `worker-src`，回退到 `default-src 'self'`；Vite 打包 worker 是否走 `blob:`/同源需实测（`script-src 'self'` 不含 `blob:`）。**内存**：worker 与主线程各持一份 buffer，需用 transferable(ArrayBuffer) 转移避免拷贝 | 见 §4 spike 项 |
| C zoom 去抖/LOD 拉伸 | 高（已有） | `shouldZoomOnlyWithLoadedPeaksStretch`、`planWaveformZoomApply` 的 defer 分支已实现「播放中热切延后」「resize hold」 | 无 | 本仓已有真源，勿另造第二套；只需确认覆盖度 |

**本仓已有可复用模块（先列再决定是否扩展）：**

- `apps/desktop/src/services/waveform/PeakCache.ts`（LOD + resample 缓存，**唯一 peaks 真源**，禁止 fork 第二套）
- `apps/desktop/src/services/waveform/audiowaveformDat.ts`（resample / 转换纯函数）
- `apps/desktop/src/services/waveform/waveformZoomSyncEngine.ts`（`planWaveformZoomApply` 决策 + `loadPeaksIntoWaveSurfer`）
- `apps/desktop/src/utils/waveformPeaksZoomFallback.ts`（LOD 拉伸兜底）
- `apps/desktop/src/utils/cspElementLayout.ts`（`setDirectLayoutStyle`，上一轮成果）

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| 选定方案 | **A 立即做**（断开 ruler 逐帧订阅，highlight 仅拖动态重绘）；**B 分两步**：先确认 §3-C 去抖/LOD 拉伸把中间态 resample 降到最少（低风险大收益），再评估把 resample+转换搬进 Web Worker（需 spike CSP/Vite）；**C 顺手清理**（minimap canvas sizing 改 `setDirectLayoutStyle`） |
| 不做什么 | 不重写 zoom 决策引擎、不新造第二套 peaks/LOD 栈、不改 playhead 单时钟架构（上一薄片已定稿）、不引入 OffscreenCanvas（超范围） |
| 与 ADR / architecture 关系 | 与 [`desktop-waveform-engine.md`](../../architecture/desktop-waveform-engine.md) 对齐：标尺=静态层、playhead=叠加层；worker 若落地需在该文档补「resample off-main-thread」小节 |
| 风险与 spike 项 | **spike-1**：Vite 5 `new Worker(new URL('./x.ts', import.meta.url), {type:'module'})` 在 Tauri dev（localhost:1421）与 prod（tauri://）下的 worker URL 是否被 `default-src 'self'` 放行；若走 `blob:` 需在 `tauri.conf.json` 加 `worker-src 'self' blob:`。**spike-2**：worker 收发 `WaveformData` 需序列化——实际应只传 ArrayBuffer（.dat 原始 buffer + 目标 width），worker 内 `WaveformData.create` + resample，回传 Float32 peaks（transferable） |

---

## 5. 落位预告（非最终实现）

| 层 | 文件 / 模块 | 变更类型 |
|----|-------------|----------|
| UI | `WaveformTimeRulerCanvas.tsx` | 断开 `subscribePlayheadFrame` 重绘；highlight 仅在 `interactionActive` 时按 `currentTimeSec` 重绘；移除不再需要的 `getPlayheadTimeSec` 逐帧读取 |
| UI | `WaveformMinimapStrip.tsx` | canvas width/height 改 `setDirectLayoutStyle`；移除 `setCspLayoutRules` import（若无其它用处） |
| 调用方 | `useProjectWaveform.ts` / `useWaveformTimelineController.ts` | 停止向 ruler 传逐帧 playhead 订阅（或保留 prop 但内部不订阅重绘）；确认无其它消费方 |
| service（B-2，条件性） | 新增 `waveform/peaksResampleWorker.ts` + `peaksResampleClient.ts`；`PeakCache.getWaveSurferPeaksAsync` 改为 await worker | 新增（spike 通过后） |
| 文档 | `desktop-waveform-engine.md` | 补「标尺静态层不随播放重绘」「resample off-main-thread（若落地）」 |
| 测试 | `WaveformTimeRulerCanvas.test.tsx`（播放态不重绘）、`drawWaveformTimeRuler.test.ts`（highlight 分支）、`PeakCache.test.ts` / worker client 测试（若落地） | 新增 / 更新 |

---

## 6. 签收

- [x] 调研 brief 完成（三根因附代码证据 + 业内对照 + 复用评估）
- [ ] plan / acceptance 已链接本文
- [ ] 用户确认可进入编码（A/C 可先行；B-2 需 spike 通过）

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-07-10 | 初版：ruler 每帧重绘 / resample 主线程阻塞 / minimap sizing 三根因 |
