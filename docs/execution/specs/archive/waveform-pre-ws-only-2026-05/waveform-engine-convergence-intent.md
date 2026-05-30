# Intent: waveform_engine_convergence（架构精简 + 4h 性能）

> 架构真源（实施后更新）：[`desktop-waveform-engine.md`](../../../architecture/desktop-waveform-engine.md)  
> 前置：ADR-0004 content-tile、ADR-0005 tier scroll + **layout/draw px/s 分轨**  
> **约束**：无历史 peaks 数据、无向后兼容  
> **定稿**：2026-05-29 实证审计修订（waveform-data 真库 benchmark + L0 可见性证伪）

## 目标层级

| 层级 | 内容 | 第一轮 |
|------|------|--------|
| **L1 架构收敛** | WS/peaks 边界、tier scroll、整轨 resample + zoom cache（Peaks.js 式）、Layer hoist、测试/文档 | **必达** |
| **L2 性能承诺** | 4h **cached** 冷开、scroll/zoom 手感、Worker（spike 后） | **有前提**（见验收 + benchmark 闸门） |

**不换栈**：`wavesurfer.js` ^7.12.6 播放；`waveform-data` ^4.5.2 读 `.dat`；不引入 Peaks.js 库 / WebGL。

## 实证结论（写入规划真源）

### resample（`waveform-data@4.5.2` 真库，4h L2 = 2.88M 列）

- 成本 ≈ **O(base LOD 列数)**，与 `targetWidth` 弱相关（同一次 scan 扫完 input buffer）。
- 本机 median（Node/V8，供量级参考，**实施前须在目标 WebView 复测并写入 acceptance**）：

| 路径 | median |
|------|--------|
| L2 → 4,096 | ~23–50 ms |
| L2 → 70,000 | ~25–53 ms |
| L1 → 70,000 | ~7 ms |
| L0 → 4,096 | <1 ms |

- `pickBaseLevel` 已选最优 base（58px/s → L2）。**不做 tile 级 `resample({ width: tileW })`** — 对全 buffer 扫描，与整轨 resample 同量级。
- Peaks.js 路线：**整轨 resample + zoom level 缓存**；Rushi 对齐为 **PeakCache LRU + TileLayer 统一调用一次**。

### 渐进 LOD（L0=2px/s）— **不做**

4h 音频部分 decode 后 L0 在 timeline 上占比极低（例：decode 5min → ~2% 宽度）。  
「边 decode 边 L0 粗波形可见」在**当前 LOD 设计下不成立**。

- **cold ensure 完整 .dat** 仍依赖 symphonia **全文件 decode**（分钟级，需 Rust benchmark，与 L0 UX 证伪不矛盾）。
- 若要做 preview：另立项（import 预生成 / Web Audio 预览 / 提高初始 pps），**不在本 Intent**。

## 已锁定决策

| # | 决策 | 选择 |
|---|------|------|
| 1 | 320px floor | **去掉** — `ceil(duration × layoutPxPerSec)`；极短音频靠 `computeFitAllPxPerSec` |
| 2 | px/s | **ADR-0005 双轨** — `layoutPxPerSec` + `drawPxPerSec`（pointerup/debounce）；删 peaks quantize |
| 3 | 渐进 LOD | **不做** |
| 4 | tile 级 resample API | **不做** — C0 Layer hoist + 现有 LRU |
| 5 | WS 边界 | **`peaksCanvasActive`**：canvas 绘制时 WS transparent、**不注入 `peaks:`**；无 cache → loading/error；WS decode 波形仅 **compat/debug**，不进主路径 |
| 6 | Worker | **spike 后定** — 主线程 `fetch` → `ArrayBuffer` Transfer；不依赖 Worker 内 `fetch(asset.localhost)` |
| 7 | 4h 验收 | **cached / uncached 拆分**；无 cache 不承诺 ≤3s 完整波形 |

## 现状根因（代码真源）

```text
已落地：content-tile、waveformProjection、bar 网格聚合、PeakCache LOD + LRU、overview 独立 resample

待收敛：
  WaveformPeaksTile 每 tile 调用 getInterleavedPeaks（LRU 使后续 tile 命中，但首帧仍同步 resample）
  useWaveformZoomSync 仍 getWaveSurferPeaks + ws.load
  useProjectWaveformMount 仍向 WS 注入 peaks
  computeTimelineWidthPx 默认 320 floor
  单一 pxPerSec 进 tile contentKey（未 draw/layout 分轨）
  ensure_waveform_peaks_sync → generate_all_levels 阻塞至全 level 写完

技术债（PR0）：
  测试/mock 引用 PeakCache.revision（生产 PeakCache 无此字段）→ typecheck 失败
  注：生产 waveformTileDrawSignature 用 peakCacheIdentity，不含 revision
  waveformPeaksCanvasDraw columnSpace 类型未使用 → 删除
```

## 目标架构

```text
Rust ensure（保持一次 pass L0+L1+L2，.tmp + rename）
  → projects/{id}/peaks/{fileId}_L{n}.dat

JS
  AudioBackend (WS)                   → play / seek；peaksCanvasActive 时 transparent
  WaveformTimeline                    → layoutPxPerSec, drawPxPerSec, timelineWidthPx
  PeakCache                           → LOD WaveformData + 整轨 resample LRU（Peaks.js 式 zoom cache）
  WaveformPeaksTileLayer              → 每 drawPxPerSec **统一** getInterleavedPeaks 一次 → 分发给 tile
  WaveformPeaksTile                   → drawWaveformPeaksTile 切片绘制（已有）
  ResampleWorkerClient（可选）        → 主线程 Transfer .dat buffer；Worker 返回 interleaved 或 WaveformData
  WaveformSegmentOverlay              → 只读 timelineWidthPx（waveformProjection）
```

**删除 / 停止**：向 WS 注入 `peaks:`、`useWaveformZoomSync` 的 peaks 路径、`getWaveSurferPeaks` 的 WS 用途、peaks 路径 `PX_PER_SEC_PEAKS_QUANTUM`。

**保留**：`getInterleavedPeaks`（**Layer 级**整轨 resample + LRU）、`getInterleavedPeaksForOverview`。

## 实施阶段

### PR0 — 类型与测试债

| 项 | 动作 |
|----|------|
| `PeakCache.revision` | **二选一**：实现（reload bump）或删测试/mock 引用 |
| `columnSpace` | 删未使用类型，或实现（本 Intent **倾向删除**） |
| 闸门 | `npm run typecheck` 绿 |

---

### 阶段 A — WS / peaks 边界（必做）

**术语（与现网 `peaksTimelineActive` 区分）**

```typescript
// Canvas 绘制 + WS 透明：仅当已有 peakCache
const peaksCanvasActive = Boolean(peaks.peakCache && !peaks.error);

// 播放 scroll follow：可宽于 canvas（loading 时也跟 tier，现网 peaksTimelineActive）
const peaksTimelineActive = Boolean(mediaUrl && (peaks.peakCache || peaks.loading));
```

| 变量 | 用途 |
|------|------|
| `peaksCanvasActive` | WS 无 `peaks:`、transparent、heightSync |
| `peaksTimelineActive` | `useWaveformPlaybackScrollFollow.enabled`（可保留现语义） |

无 cache 的 loading：**不** `peaksCanvasActive`；主路径 WS **不** opaque 画波形，UI 用 loading 文案。compat/debug 开关可启 WS decode 波形（不进主路径）。

| 文件 | 动作 |
|------|------|
| `useProjectWaveformMount.ts` | `peaksCanvasActive` 时无 `peaks:`；transparent wave/progress |
| `useWaveformZoomSync.ts` | 删 `getWaveSurferPeaks` / opaque 切换 peaks 路径；保留 `autoScroll: false`、`appliedZoomPxPerSecRef`、`onZoomApplied`（可选重命名） |
| `useWaveformHeightSync.ts` | 随 `peaksCanvasActive` 切换 transparent |
| `projectWaveformWaveSurferEvents.ts` | 主路径 error 不切 opaque；compat 开关可选 |
| `useProjectWaveform.ts` | `appliedPeaksRef` → `peaksCanvasActive` |
| `PeakCache.ts` | 阶段 A 后可删 **对外** `getWaveSurferPeaks`（无 WS 消费者） |

**PR4 清理（decode compat 不在主路径时）**：`waveformScrollSync.ts` 中 `waveSurferNativeTimelineWidthPx`、`resolveWaveformDecodeStretch`、scroll 映射等 decode-bridge 函数；保留 `shouldSuppressWaveformScrollSync`、`computeProgrammaticScrollSuppressMs`、`clampTimelineScrollLeftPx` 等 tier 仍用的符号。

---

### 阶段 B — 时长 / floor / px/s 分轨（必做）

| 文件 | 动作 |
|------|------|
| `pxPerSec.ts` | 去默认 320 floor |
| `useWaveformZoom.ts` + controller | **落地** `layoutPxPerSec`（slider 即时）+ `drawPxPerSec`（pointerup/debounce 提交）— **现网尚未分轨**，仅单一 `pxPerSec` |
| `WaveformPeaksTileLayer.tsx` | `contentKey` + resample 绑定 `drawPxPerSec`；layout 宽度用 `layoutPxPerSec` |
| `useWaveformPeaks.ts` | mismatch **保留一次** force ensure；第二 effect 依赖 **去掉 `status`**，key=`project|file|duration` |
| `peakMediaDuration.ts` | layout duration 为 draw 真源 |
| 测试 | floor + zoom 拖动不 bump draw 的用例 |

**已完成的 B 子项**：`waveformProjection.ts`、`waveformTimelineMetrics.ts` — 勿重复发明。

**uncached UI**：不新增 `generating` 状态机枚举；复用 `loading`，文案区分「正在生成波形…」vs「正在加载波形…」（由 `peakCache` 有无 / ensure 阶段决定）。

---

### 阶段 C0 — Layer 统一 resample（必做，非 tile-local）

| 文件 | 动作 |
|------|------|
| `WaveformPeaksTileLayer.tsx` | `useMemo`/ref：每 `drawPxPerSec` + peakCache  identity 调 **一次** `getInterleavedPeaks` |
| `WaveformPeaksTile` | 经 prop 接收 `interleavedPeaks`，**不再**在 tile 内调用 PeakCache |
| `PeakCache.ts` | 保持 LRU；可选 `reloadGeneration` 替代 revision（若 PR0 选择实现 bump） |

**可选 C1（profiling 后）**：draw 直读 `WaveformData` channel，跳过整轨 `number[]` 物化 — 非第一轮闸门。

**明确不做**：`interleavedPeaksForTileRange`、`getInterleavedPeaksForTile`、`columnSpace: 'tile'` 整轨重构。

---

### 阶段 W — Worker（spike 后，增强层）

**前置**：C0 落地 + 目标 WebView 上记录 `getInterleavedPeaks` median。

**路径**

1. 主线程 `fetch(convertFileSrc)` → `ArrayBuffer`
2. `postMessage(buf, [buf])` → Worker
3. Worker 内 `waveform-data` resample → 回传 interleaved `Float32Array` / 可转移 buffer
4. 主线程 `drawWaveformPeaksTile`（**不在 Worker 内 OffscreenCanvas**，除非 spike 证明 WebView 支持）

**不做第一轮闸门**：long task 阈值以 spike median 为准（若 <16ms 可推迟 Worker）。

---

### 阶段 E — import 预生成（backlog）

- 转写/导入完成 → 后台 `ensure_waveform_peaks`
- 使 4h **cached** 路径成为常态
- 不挤占 PR0–PR4

## 推荐 PR 切分

| PR | 内容 | 闸门 |
|----|------|------|
| **PR0** | revision/columnSpace 债、typecheck 绿 | typecheck |
| **PR1** | A + B | 19min；WS 无 peaks 注入 |
| **PR2** | C0 + benchmark 记录 | 4h cached scroll/zoom；Layer 单点 resample |
| **PR3** | W spike + 可选接线 | median 超预算则 Worker |
| **PR4** | `desktop-waveform-engine.md` + 删 WS peaks 旧测试 | arch-guard |

## 验收标准

### 19min（每 PR）

语段/标尺/点击对齐；有 cache 无 loading 遮罩；清 peaks 可重算。

### 4h cached

| ID | 标准 |
|----|------|
| H4-C01 | 冷打开 ≤3s：总览 + 主区可见（**.dat 已存在**） |
| H4-C02 | scroll 5s：无连续 >50ms long task |
| H4-C03 | zoom → ~58px/s：可见区稳定 ≤300ms（含首次 resample） |
| H4-C04 | 拖拽建段：无 >100ms 卡顿 |

### 4h uncached

| ID | 标准 |
|----|------|
| H4-U01 | ≤500ms 进入 generating UI |
| H4-U02 | **不**承诺完整全轨时间；**不**验收「部分 L0 可见」 |
| H4-U03 | Rust `generate_all_levels` 耗时写入手测日志（一次 4h 样本） |
| H4-U04 | 生成完成后二次打开满足 H4-C* |

### Benchmark 闸门（PR2 前）

在 **真** `waveform-data.resample` 上记录 4h L2 → layout `targetWidth` 的 **median / p95**：

- **CI Node**：回归检测（性能退化），阈值可相对化
- **目标 WebView（WKWebView）**：手测一次写入 acceptance；**H4-C03 以 WebView p95 为准**（Node 与 WebView 可能差 2×+）
- H4-C03「300ms」须 **≥ WebView p95 resample + 一帧 draw**

### 性能不变量（机器测试）

- `WaveformPeaksTile` **不**调用 `peakCache.getInterleavedPeaks`（spy）
- 同一 `drawPxPerSec` 下 Layer resample **≤1 次**（LRU 命中另计）
- peaks 模式 WS create options **无** `peaks`
- scroll 不改变 `drawPxPerSec` 时不触发 resample（spy）

## 风险

| 风险 | 缓解 |
|------|------|
| 去 floor 极短音频极窄 | fit-all |
| zoom 首帧 ~25–50ms resample | draw/layout 分轨 + LRU + 可选 Worker |
| 无 cache 4h decode 分钟级 | Phase E + H4-U honest UX |
| Worker asset URL | 仅主线程 fetch + Transfer |

## 不做（本 Intent 有效期）

- 渐进 LOD / manifest 驱动 partial level
- tile 级 resample API
- Peaks.js / audiowaveform CLI 替换 symphonia（另立项）
- WebGL 波形层
