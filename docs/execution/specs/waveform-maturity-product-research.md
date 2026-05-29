# 波形渲染同类产品架构调研：修复价值与可选项分析

> 调研日期：2026-05-29
> 调研范围：Peaks.js（BBC）、WaveSurfer.js v7、Audacity、Adobe Audition、Descript
> 目标：根据 Rushi 当前代码现状与反复出现的问题，判断「哪些对齐能修复当前问题」vs「哪些是可选项」

---

## 一、Rushi 当前反复出现的核心问题（简要回顾）

| 问题 | 根因 | 影响 |
|------|------|------|
| 全局 overview 下方整体不渲染 | O-01 修了但 O-06 resample 宽错位 + O-02 width 首帧 0 + O-04 draw 失败静默 | P0 |
| 主波形右侧空白 / 全屏不重绘 | T-01 时长多真源 + P-03 不完整 peaks 策略分叉 + M-02 draw false 时 canvas 被 clear | P0 |
| 快速 zoom 拖动卡顿 | M-06 React 管 tile lifecycle + 无 Worker resample | P1 |
| 播放进度只在 ruler，波形无 played tint | S-07 未实现 progress overlay | P2 |
| 手测 H-01~H-09 全未签收 | 上述问题叠加 + 缺乏系统性验收 | P0 |

---

## 二、各产品架构关键发现

### 2.1 Peaks.js（BBC）— 同路线：audiowaveform .dat + content-tile

**核心架构**：
- **数据层**：`waveform-data.js` 库统一解析 `.dat`（binary）或 JSON，生成 `WaveformData` 对象。仅支持 8-bit、单/双声道。
- **共享策略**：Overview + ZoomView **共享原始 `WaveformData`**，但各自独立 resample：
  - Overview：`waveformData.resample({ width: containerWidth })` — **按容器像素宽重采样**
  - ZoomView：`waveformData.resample({ scale })` — 按 samples-per-pixel 重采样，带 `Map` 缓存
- **绘制引擎**：Konva.js（Canvas 2D 封装），单个大 Canvas 逐像素描线（`lineTo` + `fillPath`），**无 tile 机制**
- **滚动**：`frameOffset` 像素偏移控制，非浏览器 scroll
- **Progress 着色**：**两个重叠的 `WaveformShape`** — `_playedWaveformShape`（playedWaveformColor）+ `_waveformShape`（unplayed，waveformColor），通过 segment 裁剪范围
- **时长对齐**：**代码中没有显式时长对齐逻辑**。`timeToPixels(time) = Math.floor(time * sample_rate / scale)` 完全依赖 waveformData 元数据。若 waveform 时长 < 媒体时长，播放头会走出绘制范围外。

**关键代码证据**：
```js
// Overview resample — 直接按容器宽度
this._data = waveformData.resample({ width: this._width });

// ZoomView resample — 带缓存
if (!this._waveformData.has(scale)) {
  this._waveformData.set(scale, sourceWaveform.resample(options));
}

// Progress 着色 — 两个 shape
this._playedWaveformShape = new WaveformShape({
  color: this._playedWaveformColor,
  view: this,
  segment: this._playedSegment  // { startTime: 0, endTime: time }
});
this._waveformShape.setSegment(this._unplayedSegment);  // { startTime: time, endTime: duration }
```

### 2.2 WaveSurfer.js v7 — ADR-0004 直接参照的 renderer

**核心架构**：
- **Renderer 是纯命令式 class**（`class Renderer extends EventEmitter`），**非 React**
- **Tile/多 Canvas 机制**：
  - `MAX_CANVAS_WIDTH = 8000`，`MAX_NODES = 10`
  - `calculateSingleCanvasWidth({ clientWidth, totalWidth })` 计算每块 canvas 宽
  - `getLazyRenderRange()` 只渲染可见的 3 块 canvas（startCanvas-1, startCanvas, startCanvas+1）
  - Scroll 时 `clearCanvases()` 清空超出的 DOM 节点，重新 `draw()`
  - **Zoom 时整个 reRender()**，但因为 peaks 在内存中（AudioBuffer），所以快
- **Progress 着色**：
  - 每个波形 canvas 对应一个 **progressCanvas**（`canvas.cloneNode()`）
  - progressCanvas 用 `globalCompositeOperation = 'source-in'` + `fillRect` 做 mask
  - 全局控制：`canvasWrapper.style.clipPath` + `progressWrapper.style.width`
  - **播放时只更新 progressWrapper 的 width，不动波形 canvas**
- **时长**：`getDuration()` 优先 media element duration，fallback 到 decodedData duration
- **布局宽**：`calculateWaveformLayout()` → `scrollWidth = Math.ceil(duration * minPxPerSec)` — **无 320px floor**
- **reRender 时保持光标位置**：通过比较 progressWrapper bounding rect 前后差异调整 scrollLeft

**关键代码证据**：
```js
// MAX_NODES / MAX_CANVAS_WIDTH
export const MAX_CANVAS_WIDTH = 8000;
export const shouldClearCanvases = (n) => n > MAX_NODES;  // MAX_NODES = 10

// Lazy render range
export const getLazyRenderRange = ({ scrollLeft, totalWidth, numCanvases }) => {
  const viewPosition = scrollLeft / totalWidth;
  const startCanvas = Math.floor(viewPosition * numCanvases);
  return [startCanvas - 1, startCanvas, startCanvas + 1];
};

// Progress — source-in mask
const progressCtx = progressCanvas.getContext('2d');
progressCtx.drawImage(canvas, 0, 0);
progressCtx.globalCompositeOperation = 'source-in';
progressCtx.fillStyle = this.convertColorValues(options.progressColor, progressCtx);
progressCtx.fillRect(0, 0, canvas.width, canvas.height);

// 全局 progress 控制（renderProgress）
this.canvasWrapper.style.clipPath = `polygon(${percents}% 0%, 100% 0%, 100% 100%, ${percents}% 100%)`;
this.progressWrapper.style.width = `${percents}%`;
```

### 2.3 Audacity — 桌面 DAW 波形标杆（原生 + 多级 LOD）

**核心架构**：
- **数据层**：BlockFile 系统（`.au` 片段），每个 block 存储原始音频数据
- **Summary / Peaks 缓存**：多级 summary 数据（Mazzoni & Dannenberg 2002 论文）
  - 256 样本块 → max/min（初级 summary）
  - 64K 样本块 → max/min（高级 summary）
  - 按需计算并缓存，类似 mip-map
- **绘制**：wxWidgets 原生绘制，逐像素画垂直线（peak→RMS 双 shade）
- **时长**：完全信任原始音频文件元数据，无「peaks 时长 ≠ 媒体时长」问题（因为 peaks 从音频直接计算）
- **性能**：Summary 缓存使长音频滚动极快，resize 重绘也极快

**关键发现**：
> Audacity 没有「peaks 预计算文件」的概念，它的 summary 数据是**打开项目时/需要时从原始音频实时计算并内存+磁盘缓存**。这与 Rushi 的「预计算 .dat + 独立 peaks 文件」模式不同。

### 2.4 Adobe Audition — 专业 peaks 缓存

**核心架构**：
- **Peaks 文件格式**：`.pkf`（Peak File），导入音频时**自动生成**，与原始文件同目录
- **文件内容**：浮动点 peak 数据，包含 waveform 可视化所需的峰值信息
- **生成时机**：导入/打开时，后台生成，后续打开直接读 `.pkf` 无需重新分析
- **删除策略**：可安全删除，下次需要时自动重建
- **多声道**：支持 split L/R 显示
- **绘制**：原生 GPU/CPU 混合（新版趋势）

**关键发现**：
> Audition 的 `.pkf` 与 Rushi 的 `.dat` 理念完全一致：预计算 peaks 文件 + 与原始音频同目录/同名。但 Audition 的 peaks 文件**只服务可视化**，不承载时长信息；时长信任原始音频容器元数据。

### 2.5 Descript — 转写编辑器同类产品

**核心架构**（基于产品观察与合理推断）：
- **产品定位**：「文本为主、波形为辅」的 Google Doc 式编辑器
- **对齐粒度**：**词级（word-level）**，wordbar 上每个词可拖动边界
- **波形角色**：底部时间线的辅助参考视图，**无独立 minimap/overview**
- **播放进度**：文本高亮当前词 + 时间线 playhead **双通道指示**
- **未转写音频**：**灰色波形段**标识（视觉提示「有声音但无文字」）
- **Peaks 推断**：云端预计算后随转写结果下发（AI-first, cloud-centric）
- **技术栈推断**：Electron + React + Canvas 2D

---

## 三、对照分析：哪些对齐能修复 Rushi 当前问题

### 3.1 问题 → 产品方案 → 修复价值对照表

| Rushi 问题 | 产品参照 | 具体方案 | 修复价值 | 工作量 |
|-----------|---------|---------|---------|--------|
| **Overview resample 宽错位（O-06）** | Peaks.js | Overview resample 目标 = `overviewWidthPx`（`resample({ width })`），而非 `computeTimelineWidthPx` | **🔴 必须对齐** | 0.5d |
| **Overview 用 computeTimelineWidthPx（含 320 floor）（T-05）** | WaveSurfer v7 | `scrollWidth = Math.ceil(duration * minPxPerSec)`，**无 320 floor** | **🔴 必须对齐** | 0.5d |
| **时长/宽度多真源（T-01~T-06）** | Peaks.js + WS v7 | 单一 `duration` 来源（waveformData.duration 或 media duration），所有坐标转换统一函数 | **🔴 必须对齐** | 1-2d |
| **不完整 peaks 策略分叉（P-03）** | Peaks.js | Peaks.js 没有显式处理，默认信任 waveformData。Rushi 应统一为：不完整 = error 态，禁止主/overview 分叉 | **🔴 必须对齐** | 0.5d |
| **draw false 时 canvas 被 clear（M-02）** | WaveSurfer v7 | WS v7 的 lazy render 不保留旧帧，但因为它重绘极快（AudioBuffer 在内存）所以无感。Rushi 应：draw false 时保留上一帧 或显式占位色 | **🟡 建议对齐** | 0.5d |
| **Overview width 首帧 0（O-02）** | Peaks.js | Peaks.js 的 Konva Stage 在 containerWidth=0 时不初始化 waveform。Rushi 应：ResizeObserver 同步读 + mount 后强制 layout | **🔴 必须对齐** | 0.5d |
| **React 管 tile lifecycle（M-06）** | WaveSurfer v7 | WS v7 的 imperative pool（`MAX_NODES=10`）直接操作 DOM，无 React reconciliation。Rushi 当前 React tile 在 H.02/H.03 未达标时才需启动 S3′ | **🟢 可选项**（H.02/H.03 不达标时） | 3-5d |
| **无 Worker resample（E-01）** | Peaks.js | Peaks.js 的 resample 在 waveform-data.js 中，数据量小（8-bit），主线程足够。Rushi 的 21min 文件 resample 也未触及瓶颈。**当前非阻塞问题** | **🟢 可选项** | 2-3d |
| **波形无 played/unplayed 分色（S-07）** | Peaks.js + WS v7 | Peaks.js：两个重叠 WaveformShape；WS v7：clipPath + progressWrapper + per-canvas mask | **🟡 建议对齐**（产品体验） | 1-2d |
| **无 progress overlay（ADR-0004 P2）** | WaveSurfer v7 | `renderProgress()` 用 clipPath + progressWrapper width，**peaks tile 自身不重绘** | **🟡 建议对齐** | 1d |
| **Peaks 生成无进度 UX（S-04）** | Adobe Audition | Audition 导入时后台生成 `.pkf` + 进度指示。Rushi 已有 loading boolean，缺百分比 | **🟢 可选项** | 1-2d |
| **词级对齐（转写场景）** | Descript | Descript 词级 wordbar 是产品核心，非渲染层问题。Rushi 当前语段级足够 | **🟢 可选项**（产品规划） | 需 ASR 后端支持 |
| **实时录音波形（E-05）** | Descript | Descript 录音波形是装饰性/反馈性的。Rushi 未规划此功能 | **🟢 可选项** | 需全新功能 |
| **多声道显示（E-03）** | Audacity / Audition | Audacity split L/R；Audition 可选。转写场景 mono mixdown 足够 | **🟢 可选项** | 1-2d |
| **GPU 绘制（E-04）** | Audition 新版 | 专业 DAW 才需要。Rushi 2D Canvas 在 tile 模式下已足够 | **🟢 可选项** | 大规模重构 |
| **Imperative tile renderer（S3′）** | WaveSurfer v7 | WS v7 的 Renderer 是纯命令式 class。Rushi ADR-0005 已预留 S3′，但明确「仅当 S1+S2+S4 后 H.02/H.03 仍不达标」 | **🟢 可选项**（H.02/H.03 不达标时） | 3-5d |

### 3.2 必须对齐（🔴）：直接修复当前问题

#### ① Overview resample 目标宽 = overviewWidthPx（Peaks.js 方案）

**Peaks.js 做法**：
```js
// waveform-overview.js
this._data = waveformData.resample({ width: this._width });
```

**Rushi 当前问题**：
```js
// PeakCache.ts:87
const targetWidthPx = Math.max(1, computeTimelineWidthPx(layoutDur, pxPerSec));
// computeTimelineWidthPx 含 320 floor → overview resample 目标宽 ≠ overviewWidthPx
```

**修复方式**：
- Overview 单独走 `getInterleavedPeaksForOverview(overviewWidthPx)`，目标宽 = `overviewWidthPx`
- 或 `computeTimelineWidthPx` 增加 `noFloor` 选项

#### ② 去掉 timeline width 的 320px floor（WaveSurfer v7 方案）

**WS v7 做法**：
```js
// renderer-utils.ts
calculateWaveformLayout({ duration, minPxPerSec, parentWidth }) {
  const scrollWidth = Math.ceil(duration * minPxPerSec);  // 无 floor
  // ...
}
```

**Rushi 当前问题**：
```js
// pxPerSec.ts:19-23
export function computeTimelineWidthPx(durationSec, pxPerSec) {
  const floor = 320;  // ← 这里
  return Math.max(Math.ceil(sec * pxPerSec), floor);
}
```

**为什么这是问题**：
- fit-all 时 `duration * pxPerSec` 可能 < 320（例如 21min @ 0.05px/s = 63px），floor 到 320 后 timeline 宽 ≠ 实际像素密度
- Overview resample 也因此被 floor 干扰

**修复方式**：
- 主 tier 保留 320 floor（保证可点击区域），但 **overview 单独计算，不加 floor**
- 或：主 tier 也去掉 floor，用 `Math.max(1, ...)` 替代

#### ③ 统一时长/宽度真源（Peaks.js + WS v7 方案）

**Peaks.js 做法**：
- `timeToPixels(time) = Math.floor(time * sample_rate / scale)` — 单一转换函数
- Overview 和 ZoomView 共用 `_originalWaveformData.duration`

**WS v7 做法**：
- `getDuration()` 优先 media element，fallback decodedData
- `scrollWidth = duration * minPxPerSec` — 单一计算

**Rushi 当前问题**：
- `wf.duration`、`peaks.status?.durationSec`、`peakCache.durationSec`、`computeTimelineWidthPx` 四处来源
- 应收敛为：`timelineDurationSec = resolveTimelineDuration(mediaDuration, peakDuration)`，所有 width 计算都用它

#### ④ 统一不完整 peaks 策略（Rushi 自研，参照成熟产品「不信任」哲学）

**成熟产品做法**：
- Peaks.js：没有显式处理，默认信任 waveformData，但播放头和波形数据同源
- Audition：`.pkf` 只服务可视化，时长信任原始音频
- WS v7：`getDuration()` 优先 media element

**Rushi 应统一为**：
- peaks < 98% 媒体时长 = **error 态**（禁止绘制不完整波形）
- 主 tier 和 overview **必须同时进入同一状态**（不可一个 clip 一个 stretch）

### 3.3 建议对齐（🟡）：提升体验，降低复杂度

#### ⑤ Progress 着色（Peaks.js / WS v7 方案）

**Peaks.js**：两个重叠 WaveformShape（played + unplayed），通过 segment 裁剪
**WS v7**：clipPath + progressWrapper width + per-canvas source-in mask

**Rushi 当前**：仅 ruler playhead

**推荐方案**：参照 WS v7 的 `progressWrapper` — 一个 absolute div 覆盖在 tile layer 上，通过 width 控制已播放区域颜色，**不动 canvas tile**。

#### ⑥ draw false 时保留上一帧

**Rushi 当前**：`drawWaveformPeaksTile` 开头 `ctx.clearRect`，返回 false 时 canvas 已空
**建议**：将 `clearRect` 移到 `drew === true` 分支内，false 时保留旧内容 + 重试队列

### 3.4 可选项（🟢）：当前不阻塞，后排

| 项 | 触发条件 | 估计工作量 |
|----|---------|-----------|
| Imperative tile renderer（S3′） | H.02/H.03 手测不达标 | 3-5d |
| Worker resample | 高 zoom 快速拖动明显卡顿 | 2-3d |
| Peaks 生成进度 UX | 长文件用户抱怨无反馈 | 1-2d |
| 词级对齐 | 产品规划决定 | 需后端支持 |
| 实时录音波形 | 产品规划决定 | 全新功能 |
| 多声道显示 | 产品规划决定 | 1-2d |
| GPU 绘制 | 小时级素材性能不足 | 大规模重构 |

---

## 四、关键架构决策对照表

| 维度 | Rushi（当前） | Peaks.js | WaveSurfer v7 | Audacity | Adobe Audition | Descript |
|------|--------------|----------|---------------|----------|----------------|----------|
| **绘制范式** | content-tile（React） | content-viewport（Konva） | content-tile（imperative） | 原生 viewport | 原生/GPU | Canvas 2D（推断） |
| **Peaks 来源** | 预计算 `.dat`（Rust） | 预计算 `.dat` / JSON / WebAudio | 解码 AudioBuffer 或传入 peaks | 实时 summary | 预计算 `.pkf` | 云端预计算（推断） |
| **Overview 与主视图数据** | 共享 PeakCache，但 resample 目标宽不同 | 共享原始 WaveformData，独立 resample | 无 overview（单视图） | 单视图 | 单视图 | 无独立 overview |
| **Overview resample** | `computeTimelineWidthPx(mediaDur, pxPerSec)` 含 320 floor | `resample({ width })` | 无 | 无 | 无 | 无 |
| **Progress 着色** | 仅 ruler playhead | 两个重叠 WaveformShape | clipPath + progressWrapper + mask | 无（仅 playhead） | 有 | 文本高亮 + playhead |
| **Scroll 真源** | tier scrollLeft | frameOffset 像素偏移 | scrollContainer.scrollLeft | 视口偏移 | 视口偏移 | 时间线滚动 |
| **Zoom 模型** | layoutPxPerSec / drawPxPerSec 双轨 | scale（samples/pixel） | minPxPerSec | samples/pixel | samples/pixel | 时间线缩放 |
| **Tile/分段** | React LRU 24 + overscan 5 | 无（单 canvas 全绘） | MAX_NODES=10，lazy render 3 块 | Summary LOD | 无 | 无 |
| **时长信任** | wf.duration / peaks.status / peakCache 混用 | waveformData.duration | media element > decodedData | 原始音频 | 原始音频 | 转写对齐时间码 |
| **时长不一致处理** | 主 tier clip / overview stretch（分叉） | 播放头走出范围 | 信任 media element | 无此问题 | 无此问题 | 词边界手动修正 |

---

## 五、结论：推荐实施顺序

### 薄片 1：修复 overview 空白 + 时长真源（ unblock P0 ）

| # | 项 | 参照产品 | 验收 |
|---|----|---------|------|
| 1 | Overview resample 目标宽 = `overviewWidthPx`，去掉 320 floor 干扰 | Peaks.js `resample({ width })` | 21min overview 600px 宽 drew===true |
| 2 | 统一 `timelineDurationSec` 真源函数 | Peaks.js `waveformData.duration` + WS v7 `getDuration()` | 任意文件打开后，各处时长差 < 1.5s |
| 3 | `computeTimelineWidthPx` 增加 `noFloor` 选项，overview 使用 | WS v7 `scrollWidth = duration * pxPerSec` | overview timelineWidthPx = duration * pxPerSec |
| 4 | Overview width bootstrap + 三态提示 | Peaks.js containerWidth=0 时不初始化 | 展开全局条首帧有波形 |
| 5 | 统一不完整 peaks 策略 = error 态 | Audition「peaks 只服务可视化，时长信任音频」哲学 | 80% peaks 时上下同时报错 |
| 6 | 手测 H-09（全局条有波形）+ H-03（全屏重绘） | — | 签收 |

### 薄片 2：Progress 着色 + draw 稳定性（产品 polish ）

| # | 项 | 参照产品 | 验收 |
|---|----|---------|------|
| 1 | Progress overlay：absolute div + width 更新，不动 canvas tile | WS v7 `progressWrapper` | 播放时 tile canvas 内容稳定 |
| 2 | draw false 保留上一帧 | WS v7 重绘速度兜底 | 快速 zoom 无永久白 tile |
| 3 | 手测 H-01~H-08 | — | 全签收 |

### 薄片 3：架构债（H.02/H.03 不达标时启动）

| # | 项 | 参照产品 | 验收 |
|---|----|---------|------|
| 1 | Imperative tile renderer（S3′）| WS v7 Renderer class | H.02/H.03 通过 |
| 2 | Worker resample | Peaks.js（数据量小，可选）| 高 zoom 拖动不卡 |

### 薄片 4：产品层能力（后排）

| # | 项 | 参照产品 | 触发条件 |
|---|----|---------|---------|
| 1 | Peaks 生成进度 UI | Adobe Audition | 用户反馈长文件无反馈 |
| 2 | 词级对齐 | Descript | 产品规划 |
| 3 | 实时录音波形 | Descript | 产品规划 |
| 4 | 多声道 / GPU | Audacity / Audition | 转写场景不需要 |

---

## 六、一句话总结

> **Rushi 的波形架构选型（content-tile + .dat LOD）与 Peaks.js / WaveSurfer v7 已收敛，不需要重选路。当前问题不是「画波形」能力不足，而是「时长/宽度真源未收口」+「Overview resample 宽错位」+「不完整 peaks 策略分叉」这三条执行链断裂。对标同类产品的首要价值是：① Peaks.js 的 `resample({ width })` 直接修复 O-06；② WaveSurfer v7 的「无 320 floor」直接修复 T-05；③ 两者共同的「单一 duration 真源」直接修复 T-01。其余（imperative pool、Worker、GPU、词级对齐）均为可选项，当前不阻塞。**
