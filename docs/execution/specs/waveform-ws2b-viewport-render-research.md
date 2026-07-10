# 调研：WS-2b 视口窗口绘制（Peaks 式 · 合成瓶颈后备）

> **状态**：生产化编码完成 · 待手测 S1–S6  
> **Plan / acceptance**：[`waveform-ws2b-viewport-render-plan.md`](./waveform-ws2b-viewport-render-plan.md) · [`waveform-ws2b-viewport-render-acceptance.md`](./waveform-ws2b-viewport-render-acceptance.md)  
> **关联 architecture**：[`desktop-waveform-engine.md`](../../architecture/desktop-waveform-engine.md)  
> **Spike 结论（2026-07-10）**：media-only WS + Rushi viewport canvas + silence WS timer → 稳态 `playbackFrames≈47–52` **过闸**  
> **生产化（2026-07-10）**：已去 spike flag；默认 media-only + viewport canvas + DOM played tint

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 深 zoom 播放时 playhead / 已播放 tint 仍不够顺；目标稳态 ≥45 fps |
| 本仓现状 | **WS-2a 已落地**：DOM host 为 sticky + viewport 宽；tier→`ws.setScroll` 单向同步；progress tint 经 `setDirectLayoutStyle` + 去重；band/ruler 稳态 skip≈100%。但 WS **内部** `scrollW` 仍可达 `MAX_WAVESURFER_PEAK_COLUMNS=40960`（[`pxPerSecConstants.ts`](../../../apps/desktop/src/utils/pxPerSecConstants.ts)）。手测：`audioTicks≈playbackFrames` ~16–24 ≪ 45 → JS 调度边际已尽，主瓶颈在 **WKWebView 对超宽 scroll 内容 / 多层 canvas 的合成**。 |
| 成功标准 | 深 zoom ≥8s hands-off：`playbackFrames≥45`；`band/ruler` 稳态仍≈0；seek / Space / overlay / 已播放着色语义不回退；仍单一 PeakCache + tier scroll 真源 |

### 证伪链（已完成）

| 假设 | 结果 |
|------|------|
| H0 band/ruler 是 fps 瓶颈 | **否**（skip≈100%） |
| H1 冻 WS progress 可过 45 | **否**（峰值 ~23） |
| H2 viewport host + setScroll（WS-2a）可过 45 | **否**（合成瓶颈判据成立） |
| H3 再抠 1B/1C rAF 边际 | **跳过**（路线图：两者都低 → 直接 WS-2b research） |

关键路径：

- Mount / geom：`useProjectWaveformMount.ts` · `waveformSurferProgressCoverage.ts`（`readWaveSurferGeom` / `syncWaveSurferScrollFromTier`）
- Stage：`EditorWaveformPeaksStage.tsx`（WS-2a sticky viewport host）
- Peaks：`PeakCache.ts` · `audiowaveformDat.ts`
- 已有视口窗口范例（非主波形）：`WaveformSegmentBandCanvas.tsx` · `waveformSegmentBandCanvasScroll.ts` · `drawWaveformSegmentBands.ts`

---

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表 | 核心机制 | 链接 / 本仓对照 |
|---|------|------|----------|-----------------|
| A | **逻辑 frameOffset + 视口 canvas 重绘** | BBC Peaks.js | zoomview 宽≈容器；`frameOffset` 为视口起点；scroll 改 offset 后重绘可见窗；不持有全长 DOM scrollWidth | [Peaks.js](https://github.com/bbc/peaks.js/) · [BBC R&D](https://www.bbc.co.uk/rd/blog/2013-10-audio-waveforms) · 本仓 maturity research |
| B | **宿主原生 scroll + 分片 canvas 虚拟化** | WaveSurfer v7 | `scrollWidth=ceil(dur×minPxPerSec)`；renderer 懒建/回收离屏 canvas；progress 不重绘波形 | WS 源码；本仓 WS-2a 已对齐「viewport host + setScroll」 |
| C | **自管视口波形层 + 媒体宿主降级** | 桌面 DAW / 本仓 pre-WS-only tile 史 | 可见波形由应用侧 canvas 按视口画；媒体库只负责 decode/play；进度用独立 DOM | 本仓已删 `WaveformPeaksTileLayer`；band canvas 仍是 timeline-native virtual window |

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用 | 与 Rushi 约束冲突 | 峰值内存 / 进度 UX |
|------|--------|----------|-------------------|---------------------|
| A Peaks frameOffset **思想** | **高（模型）** | 「视口宽 canvas + offset 真源」；与 band canvas 同构 | ❌ **禁止迁移 Peaks.js / Konva**（[`v0.2-plus-non-webgl-slices-research.md`](./v0.2-plus-non-webgl-slices-research.md)）；须保持 tier `scrollLeft` 为 UI 真源，不能另造 Peaks scroll | 视口级 canvas → 合成成本低；需自管 played tint |
| B 继续深挖 WS 虚拟化 | **中（已做完主刀）** | WS-2a host + setScroll；`drawn≈3` 目标 | 内部 `scrollW` 仍 40k → **合成层仍吃全长坐标空间**；再降 `cols_cap` 会伤深 zoom 分辨率 | 边际收益低（阶段 0 已判合成瓶颈） |
| C Rushi 视口波形 canvas | **高（实现面）** | `PeakCache` peaks；band 的 window/buffer/dirty 模式；VRP DOM playhead；`setDirectLayoutStyle` | 与 architecture「WS-only 主波形渲染器」**冲突** → 须 **修订 architecture / ADR 附注**，把 WS 降为 media + 可选低成本层 | 内存≈视口×DPR×缓冲；played tint 用双 pass 或 clip（Peaks 双 WaveformShape / 本仓 progress 语义） |

**本仓已有模块（禁止第二套真源）**：

- `PeakCache` — 唯一 peaks/LOD
- `tierScrollRef.scrollLeft` + `useTierScrollSync` — 唯一滚动权威
- `useWaveformVisualPlayheadClock` + `WaveformViewportPlayhead` — 视觉时间 / playhead
- `WaveformSegmentBandCanvas` 窗口算法 — **可复用模式**，不可 fork 第二套 VAD/分段
- `waveformSurferProgressCoverage` — 现 progress 补丁（WS-2b 后可能退役或仅媒体态）

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| 选定方案 | **WS-2b-C（Peaks 模型 · Rushi 实现）**：主可见波形改为 **视口宽（+ overscan）canvas**，由 `PeakCache` 注入的 interleaved peaks 按 `tier.scrollLeft`→时间窗绘制；播放跟随只改 offset/重绘脏区，**不再依赖** WS 全长 `scrollW` 合成。WaveSurfer **降级为媒体宿主**（seek/play/`getCurrentTime`），可见波形层可隐藏或仅作 fallback。须先改 architecture「WS-only 可见波形」表述。 |
| 不做什么 | ❌ 不 npm 引入 / 迁移 Peaks.js 或 Konva；❌ 不 fork WaveSurfer；❌ 不恢复巨宽 host / mirror `translate3d`；❌ 不新建第二 PeakCache / 第二 scroll 真源；❌ 不把 playhead 画回 WS canvas；❌ 本轨不重开 SEL-1 / 默认不做 WR-4 |
| 与 architecture 关系 | **需修订** [`desktop-waveform-engine.md`](../../architecture/desktop-waveform-engine.md)：可见主波形 = Rushi viewport canvas；WS = media transport（+ 可选）。滚动/时钟/PeakCache 不变量保持。编码前 Plan 顶部链接本文 + architecture 补丁。 |
| 风险与 spike | **RISK-01** 深 zoom 分辨率：视口 canvas 每像素对应 samples 须与现 `pxPerSec` 投影一致。**RISK-02** 快速横滚空白：overscan + dirty 策略对齐 band（±1.5 viewport）。**RISK-03** 已播放着色：双色绘制或独立 progress canvas（禁止每帧改超宽 progressWrapper）。**Spike（≤1 天，标注 `spike/`）**：单文件深 zoom 播放对比 `playbackFrames`；未过 45 则停止扩写，回查合成层（截图/图层数），不进入全量 Plan。 |

### 明确否决的旁路

| 旁路 | 理由 |
|------|------|
| 仅再砍 `MAX_WAVESURFER_PEAK_COLUMNS` | 伤分辨率；不消除「全长 scroll 坐标系」合成成本 |
| 再统一嵌套 rAF（原 1C） | 阶段 0 已判合成瓶颈，边际优化跳过 |
| 恢复 pre-WS-only tile 全套 DOM | 已归档移除；WS-2b 复用 **算法思想**，落位应对齐现 band 的 timeline-native window，而非复活旧组件名 |

---

## 5. 落位预告（非最终实现）

| 层 | 文件 / 模块 | 变更类型 |
|----|-------------|----------|
| 调研 / arch | 本文；`desktop-waveform-engine.md` | 修订可见波形真源 |
| UI canvas（预告） | 新 `WaveformViewportPeaksCanvas`（名待定）或扩展现有 peaks stage | 视口窗口绘制 |
| service | `drawWaveformViewportPeaks.ts`（纯函数）；复用 `PeakCache.getInterleaved*` / resample 结果 | 新增绘制，不新 peaks 管线 |
| WS | `useProjectWaveformMount`：隐藏/弱化可见波形；保留 media API | 降级 |
| progress | 退役或替换 `installWaveSurferPlayedRegionDisplayFix` 热路径 | 删减 |
| 滚动 | 仍只写 tier；canvas `left/width` 经 `setDirectLayoutStyle` + scroll frame bus | 对齐 band |
| 测试 | 窗口计算 / dirty / 投影单测；fps 手测闸门 | 新增 |
| Plan / acceptance | `waveform-ws2b-*-plan.md` / `*-acceptance.md`（**spike 通过后再写**） | 后续 |

```text
tier.scrollLeft (权威)
  → resolve time window [t0,t1] + overscan
  → PeakCache peaks @ drawPxPerSec
  → viewport canvas draw (dirty)
  → DOM playhead (VRP) + optional played tint pass
WaveSurfer: media only (seek/play/currentTime)
```

### Spike 接线（2026-07-10）

| 项 | 落位 |
|----|------|
| 开关 | `WAVEFORM_WS2B_VIEWPORT_CANVAS_SPIKE=true`（`waveformPrefs.ts`，回滚改 false） |
| 可见 canvas | `WaveformViewportPeaksCanvas.tsx` |
| 纯绘制 | `drawWaveformViewportPeaks.ts` |
| 接入点 | `EditorWaveformPeaksStage.tsx`；WS 可见层 ready 后 **1×1 + opacity:0**；viewport canvas **不**订阅 playhead 帧；**v3** mount stub peaks + `minPxPerSec=0` + 禁用 zoom sync 回灌 |

### Spike v1 手测（2026-07-10 14:15）— **脏测量 FAIL**

| 观察 | 值 |
|------|-----|
| `playbackFrames` | max ~2.7/s |
| `audioTicks` | **0**（测量无效） |
| `playbackSub`/`tierSub` | ~17–24ms/帧（每帧整波形重绘） |
| `[wf-geom]` | ready 后 `scrollW=0 clientW=0`（`display:none`） |

### Spike v2 手测（2026-07-10 ~14:25）— **干净测量 FAIL**

| 观察 | 值 |
|------|-----|
| `audioTicks` | **19–28 /s**（测量有效） |
| `playbackFrames` | 稳态 **~18–24 /s**，峰值 **24** |
| `playbackSub` / `tierSub` | **~0–0.1ms** |
| 形态 | `audioTicks ≈ playbackFrames` → 上游 tick ~25Hz |

### Spike v3 手测（2026-07-10 ~14:34）— **干净测量 · 近闸 FAIL**

| 观察 | 值 |
|------|-----|
| `audioTicks` | 稳态常见 **44–46 /s**（峰值 46） |
| `playbackFrames` | 稳态常见 **40–42 /s**，峰值 **42**（闸 ≥45 → **FAIL**，但相对 v2 ~24 **显著提升**） |
| `playbackSub` / `tierSub` | **~0ms** |
| `frameLag` | 均值 ~25ms（与 ~40fps 一致） |
| geom | `scrollW=1 clientW=1`（media-only 收拢生效） |

### Spike v4 手测（2026-07-10 ~14:39）— **PASS**

| 观察 | 值 |
|------|-----|
| `playbackFrames` | 稳态常见 **47–52 /s**，峰值 **54**（闸 ≥45 → **PASS**） |
| `audioTicks` | ~**4 /s**（预期：WS timer 已掐，仅剩 media `timeupdate` 残量） |
| `playbackSub` / `tierSub` | **~0ms** |
| `frameLag` | 稳态均值 ~20ms |
| 标记 | `mount_media_only_spike` + `silenced internal timer/progress` |

结论：WS 全长 canvas + 内部 timer/progress 是 fps 主因；Rushi viewport canvas + media-only WS **可过闸**。可进入 **WS-2b Plan 定稿**（architecture 修订：可见主波形 = Rushi viewport canvas；WS = media transport）。

手测命令：

```js
__rushiScrollProfile.enable()
// 深 zoom 播放 8–10s；读 playbackFrames（audioTicks 偏低属预期）
__rushiScrollProfile.disable()
```

---

## 6. 签收

- [x] 调研 brief 完成（含手测证伪链 + ≥2 业内路线 + 可复用表 + 不做什么）
- [x] intent / plan / acceptance（Plan + acceptance 已定稿；无独立 intent）
- [x] 用户确认可进入 **≤1 天 spike**（非终态编码）
- [x] spike 手测 `playbackFrames≥45`（v4 PASS：稳态 ~47–52）
- [x] 生产化编码（见 Plan §2）

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-07-10 | 初版：WS-2a 后合成瓶颈成立；选定 Peaks 模型 + Rushi viewport canvas；禁止 Peaks.js 迁移 |
| 2026-07-10 | 接入 spike flag + viewport peaks canvas；待真实 FPS 手测 |
| 2026-07-10 | spike v1 脏 FAIL（display:none + 每帧重绘）；v2 修测量与绘制策略 |
| 2026-07-10 | spike v2 干净 FAIL：audioTicks≈24、playbackSub≈0；瓶颈回到 media tick 交付 |
| 2026-07-10 | spike v3：stub peaks + 禁用 zoom sync，收拢 WS 全长 canvas |
| 2026-07-10 | spike v3 手测：playbackFrames 稳态 ~40–42（近闸 FAIL） |
| 2026-07-10 | spike v4：silence WS timer/progress；跳过 progress/scroll 热路径补丁 |
| 2026-07-10 | spike v4 手测 PASS：playbackFrames 稳态 ~47–52 |
| 2026-07-10 | Plan / acceptance 定稿；architecture 数据流改为 media + viewport canvas |
| 2026-07-10 | 生产化：去 spike flag；默认 media-only + DOM played tint |
