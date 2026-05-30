# Rushi 波形引擎深度审计与优化方案（2026-05）

> **范围**：前后端波形全链路（Rust peaks 生成 → 前端 PeakCache → WaveSurfer 渲染 → DOM Overlay → Minimap）  
> **目标**：梳理真源、对齐业内成熟方案、识别优化空间、输出可执行的改进路线图  
> **基准**：`docs/architecture/desktop-waveform-engine.md`（2026-05-29 现行版）

---

## 1. 当前架构全景图

### 1.1 数据流总览

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                              后端（Rust / Tauri）                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  音频文件 → Symphonia 解码 → LevelWriter (3 LOD: 2/20/200 pps)            │
│     ↓                                                                 │
│  ffmpeg remux 回退（RIFF/探测失败时）                                    │
│     ↓                                                                 │
│  .dat (audiowaveform v1) + .meta.json (fingerprint + duration)          │
│     ↓                                                                 │
│  projects/{id}/peaks/{fileId}_L{0,1,2}.dat                              │
│     ↓                                                                 │
│  GC: 孤儿 file_set / project_dir 清理（DB 真源比对）                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↑
                                    │ Tauri command
                                    ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                              前端（React）                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  useWaveformPeaks                                                       │
│    ├── ensureWaveformPeaks (Rust) → status + generating lock            │
│    ├── polling (400ms) → 等待 L0/L1/L2 就绪                              │
│    └── PeakCache.fromLevelUrls → 先 bootstrap L0/L1, 再 deferred L2      │
│             ↓                                                            │
│  PeakCache (内存缓存)                                                    │
│    ├── levels: Map<level, WaveformData>                                  │
│    ├── resampleCache: LRU 16 (key = `${lodLevel}:${targetWidthPx}`)      │
│    ├── getWaveSurferPeaks(pxPerSec) → resample → Float32Array            │
│    └── getMinimapPeaks(widthPx) → L0 resample                            │
│             ↓                                                            │
│  useProjectWaveform (编排中心)                                            │
│    ├── useProjectWaveformMount → WaveSurfer.create({ url, peaks })       │
│    ├── useWaveformZoomSync → ws.zoom() + ws.load(peaks) 热切换           │
│    ├── useWaveformViewportController → RO + stretch-hold + shell layout  │
│    ├── useWaveformPlayback → seek / togglePlay / clientXToTimeSec        │
│    └── ...（15+ hooks）                                                  │
│             ↓                                                            │
│  EditorWaveformPane (DOM 舞台)                                           │
│    ├── tierScrollRef (scroll 真源)                                       │
│    ├── waveformStickyShellRef (sticky, viewport 宽)                      │
│    ├── waveformStretchShellRef (resize 期 scaleX)                        │
│    ├── containerRef (WaveSurfer mount)                                   │
│    ├── WaveformSegmentOverlay (DOM 语段层)                                │
│    ├── WaveformLiveTimeRuler (时间尺 + playhead)                          │
│    └── WaveformMinimapStrip (Canvas 总览条)                               │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 核心真源链

| 真源 | 当前载体 | 说明 |
|------|---------|------|
| 音频数据 | `.dat` LOD 文件 | 3 级：2/20/200 pps，audiowaveform v1 格式 |
| 时长 | `waveformTimelineMetrics.ts` | WS duration + peaks manifest 合并 |
| 横向缩放 | `useWaveformZoom.pxPerSec` | 用户意图；实际应用经 `appliedZoomStateRef` |
| 滚动位置 | `tierScrollRef.scrollLeft` | 唯一真源；WS `autoScroll: false` |
| 视口宽 | `resolveTierViewportWidthPx` | live ref / DOM / committed layout 取 max |
| 时间↔像素 | `waveformProjection.ts` | 统一经 `timelineWidthPx / duration` |
| 语段可见性 | `selectPackableSegmentIndices` | 显式 `kind` 优先，回退 dominant-span 启发式 |

---

## 2. 后端（Rust）逐行梳理

### 2.1 文件职责矩阵

| 文件 | 行数 | 核心职责 | 测试 |
|------|------|---------|------|
| `waveform_peaks.rs` | 460 | 路径、锁、meta、stale 检测、duration 校验 | ✅ 9 tests |
| `waveform_peaks_generate.rs` | 298 | Symphonia 解码 + 3 LOD 并行生成 | ✅ fixture test |
| `waveform_peaks_cmd.rs` | 309 | `ensure_waveform_peaks` 命令 + 状态聚合 | 间接 |
| `waveform_peaks_gc.rs` | 340 | 孤儿缓存清理（DB 真源比对） | ✅ |
| `waveform_peaks_ffmpeg.rs` | 100 | ffmpeg remux 回退 | — |
| `waveform_peaks_cache_cmd.rs` | 小 | clear cache 命令 | — |

### 2.2 生成流程详解（`waveform_peaks_generate.rs`）

```rust
// 1. Symphonia probe → track + codec_params → sample_rate, n_frames
// 2. 3 个 LevelWriter 并行（同一解码流，每帧推入所有 writer）
//    LevelWriter::new(level, pps, sample_rate)
//    → samples_per_pixel = sample_rate / pps  (整数除法！)
//    → 实际 pps 可能偏离目标（如 44100/200=220.5 → 220 pps）
// 3. 每 packet decode → SampleBuffer<f32> → 多 channel arithmetic mean 混音
// 4. finish() → flush 剩余样本 → write_dat() (v1 header + i16 min/max pairs)
// 5. duration 校验：total_samples/sample_rate vs expected frames / codec duration
```

**关键实现细节**：
- **混音策略**：`arithmetic mean`（`frame.iter().sum::<f32>() / channels`）。文档注明 out-of-phase stereo 会 cancel，但为与多数 DAW 行为一致而保留。
- **采样精度**：`float_to_i16` 用 `clamp(-1,1) * 32767.0` 后 `round()`。注意：`round()` 在四舍五入到偶数时可能与 audiowaveform 原生行为有 1 LSB 差异。
- **整数除法偏差**：`samples_per_pixel = sample_rate / pps`。44100 Hz 音频 @ 200 pps → 220.5 → 220 spp → 实际 200.45 pps（偏差 +0.23%）。文档称在 `PEAKS_DURATION_TOLERANCE_SEC` (1.5s) 内可接受。
- **文件格式**：audiowaveform v1，header 24 bytes（version/flags/sample_rate/spp/length/format），后续 i16 min/max 交错。

### 2.3 缓存失效策略（`waveform_peaks.rs`）

```rust
peaks_cache_is_stale() 检查链：
1. 所有 LOD 存在？
2. 所有 LOD duration 一致（tolerance 1.5s 或 coverage 98%）？
3. audio fingerprint（size + mtime）匹配？
4. 参考 duration 覆盖（peaks ≥ 98% media duration）？
```

**优点**：
- 文件级 fingerprint（size+mtime）可靠检测文件替换
- 支持 legacy meta（无 fingerprint）自动触发一次 regenerate
- 锁文件机制防止并发生成冲突

**潜在问题**：
- `mtime` 在版本控制/复制场景下可能不可靠（但 size 作为二次校验）
- `duration_covers_reference` 用 `min/max >= 0.98` 或 `abs(diff) <= 1.5s`，对 10h+ 播客 1.5s 过于严格（0.04%），但 98% ratio 已兜底
- 无 checksum（SHA256），仅 size+mtime；恶意碰撞理论上可能但工程可接受

### 2.4 ffmpeg 回退（`waveform_peaks_ffmpeg.rs`）

```rust
symphonia_error_eligible_for_ffmpeg_remux(err) →
  "探测音频格式失败" | "riff" | "创建解码器失败" | "无法读取采样率" | "音频无可用轨道"
→ remux_audio_to_pcm_wav(source, dest)
  ffmpeg -y -nostdin -loglevel error -i {source} -ac 1 -c:a pcm_s16le {dest}
```

**问题**：
- ffmpeg 路径硬编码搜索 `resources/bundled-asr/rushi-asr-sidecar/_internal/ffmpeg`，与 ASR sidecar 捆绑。如果 sidecar 未安装，回退到 PATH `ffmpeg`。
- `-ac 1` 强制 mono，与 Symphonia 路径的 mean-mixing 不一致（后者保留原始 channel 数到混音前）。
- 无采样率标准化（如统一到 48kHz），可能导致不同输入产生不同 sample_rate 的 peaks。

---

## 3. 前端数据层逐行梳理

### 3.1 PeakCache（`services/waveform/PeakCache.ts`）

```typescript
class PeakCache {
  levels: Map<number, WaveformData>        // 3 LOD raw data
  resampleCache: Map<string, WaveSurferPeaksBundle>  // LRU 16
  resampleCacheOrder: string[]             // LRU order

  getWaveSurferPeaks(pxPerSec, layoutDurationSec?) → WaveSurferPeaksBundle
    base = pickBaseLevel(pxPerSec)        // 选 ≥ target pps 的最精细 LOD
    targetWidthPx = capWaveformPeakColumns(ceil(layoutDuration * pxPerSec))
    key = `${base.level}:${targetWidthPx}`
    if cache hit → return
    resampled = resampleWaveformForPxPerSec(base.data, pxPerSec, layoutDuration)
    bundle = { peaks: [Float32Array], duration }
    storeResample(key, bundle)
```

**resample 路径**（`audiowaveformDat.ts`）：
```typescript
resampleWaveformForPxPerSec(data, pxPerSec, layoutDurationSec):
  targetWidth = capWaveformPeakColumns(computeTimelineWidthPx(layoutDuration, pxPerSec))
  if targetWidth > baseWidth: return data  // 上采样禁止，由 Canvas 拉伸
  return data.resample({ width: targetWidth })  // waveform-data 下采样
```

**优点**：
- LRU resample cache 避免重复计算
- 同步 + 异步双路径（大数组用 rAF chunking）
- `waveform-data` 的 `resample()` 用 max-abs 算法，视觉上比简单 mean 更保真

**问题**：
- **上采样路径缺失**：当用户 zoom 到超过 LOD 原生 pps 时（如 L2=200 pps，用户 zoom 到 400 pps），`targetWidth > baseWidth` → 返回原数据，由 WaveSurfer Canvas 做视觉拉伸。这意味着高 zoom 下波形是「模糊放大」而非真实重采样。
- **LRU 容量 16 是否足够？**：长音频频繁切换 zoom（如 fit-all → fit-selection → manual），16 个条目可能快速淘汰，导致频繁 resample。
- **resample 在主线程**：大音频（1h @ 200 pps = 720,000 samples）resample 虽快，但在低端设备上仍可能掉帧。

### 3.2 数据转换（`audiowaveformDat.ts`）

```typescript
waveformDataToWaveSurferPeaks(data):
  channel = data.channel(0)
  len = data.length
  peaks = new Float32Array(len * 2)
  for i in 0..len:
    peaks[i*2]   = channel.min_sample(i) / 32767   // i16 → float
    peaks[i*2+1] = channel.max_sample(i) / 32767
  return [peaks]
```

**问题**：
- 单 channel 输出（mono）。即使原始音频是 stereo，也只保留混音后的 channel 0。
- `min_sample/max_sample` 来自 `waveform-data` 库，其内部实现是 pre-computed 的，O(1) 访问。
- 大数组转换（>200k samples）有异步分片路径，但阈值是否科学？200k samples ≈ 100k pixels @ 200 pps = 500s 音频。对于 2h 播客，L2 有 1.44M pixels，会触发 chunking。

---

## 4. 前端渲染层逐行梳理

### 4.1 WaveSurfer 集成（`useProjectWaveformMount.ts`）

```typescript
WaveSurfer.create({
  container: el,
  url: mediaUrl,
  peaks,              // pre-decoded peaks（有则注入，无则 decode）
  duration,
  height: initialH,
  normalize: true,    // 客户端归一化
  maxPeak: 1,
  sampleRate: peaks ? undefined : 8000,  // decode fallback 用 8kHz
  waveColor: COLORS.waveformWave,
  progressColor: COLORS.waveformProgress,
  cursorColor: COLORS.waveformCursor,
  cursorWidth: 1,
  barWidth: 2,
  barGap: 1,
  barRadius: 2,
  minPxPerSec: initialMps,
  dragToSeek: !wantDragCreate,
  interact: !disabled,
  autoScroll: false,   // ← 关键：禁用 WS 自带滚动，由 tier 接管
  autoCenter: false,
  hideScrollbar: true,
  fillParent: false,   // ← 关键：不填满父容器，由 shell 控制宽度
})
```

**渲染模式**：WaveSurfer v7 内部采用 **content-tile** 范式：
- 多个 `<canvas>` 元素作为 timeline 内容的一部分，按可见区域懒加载
- `MAX_NODES` 上限（默认 ~10），超长音频会复用/替换 canvas
- 每个 canvas 宽度受 `MAX_CANVAS_WIDTH` 限制（约 4000px），DPR 缩放

**Rushi 与 WS 的协作边界**：
- Rushi 负责：scroll、zoom 意图、shell 宽度、segment overlay、ruler、minimap
- WS 负责：波形绘制、progress 变色、播放后端、seek、timeupdate
- 交接面：`ws.zoom(pxPerSec)` + `ws.load(url, peaks, duration)`

### 4.2 Viewport Resize 编排（`useWaveformViewportController.ts`）

```typescript
// 核心流程（runViewportTransaction）：
1. viewportResizeHoldRef = true          // 禁止 zoom sync 做 ws.load
2. 计算 stretchRatio = newWidth / oldWidth
3. applyWaveformViewportStretch(stretchShell, stretchRatio)  // scaleX
4. writeTierViewportWidth(tierW)         // CSS var
5. writeWaveformShellLayout({ timelineWidthPx, viewportWidthPx })
6. if fit-all: ws.zoom(refitPx) + markAppliedZoomWs
7. else: ws.getRenderer().reRender()
8. syncScrollAfterRender()
9. viewportResizeHoldRef = false
10. onAfterViewportResizeRef()           // flushDeferredPeaksLoad
```

**优点**：
- microtask coalesce 避免 RO 风暴
- stretch-hold 在 resize 期保持视觉连续
- 单一 RO 入口（tier + container）

**问题**：
- `reRender()` 在 resize 时强制 WS 重绘所有 canvas，对长音频可能有卡顿
- `flushViewportLayout(tier, container, sticky)` 用 `void el.offsetWidth` 强制 reflow，虽必要但属于 layout thrashing 技巧
- fit-all refit 在 window resize 连续触发时可能产生多次 `ws.zoom()` 调用

### 4.3 Zoom Sync 编排（`useWaveformZoomSync.ts` + `waveformZoomSyncEngine.ts`）

```typescript
planWaveformZoomApply(intentPxPerSec) → action:
  "noop"              → peaks 已加载且 zoom 已应用
  "finish-zoom"       → 无 peaks / decode-only / sub-min fit-all
  "defer-hot-switch"  → 播放中 + hotSwitchWhilePlaying=false
  "defer-resize-load" → viewportResizeHold=true
  "load-peaks"        → 跨 quantum 档，需要 ws.load(url, peaks, duration)

loadPeaksIntoWaveSurfer:
  1. resumeTimeSec = ws.getCurrentTime()
  2. resumePlaying = ws.isPlaying()
  3. cache.getWaveSurferPeaksAsync(loadPeaksPx, layoutDur)
  4. ws.load(url, peaks, duration)
  5. ws.setTime(resumeTimeSec)  // 恢复 playhead
  6. if resumePlaying: ws.play()
```

**优点**：
- 8 px/s quantum 减少不必要的 `ws.load`
- 播放中热切换可配置（默认开启）
- resize 期 defer load，transaction 后 flush

**问题**：
- `ws.load()` 会完全重建 WS 内部 renderer（销毁所有 canvas，重新创建），这是一个 **heavy operation**。
- 频繁跨档切换（如拖动滑块时）可能触发多次 `ws.load()`，即使有 quantum 也只是减缓而非消除。
- `getWaveSurferPeaksAsync()` 在 load 前执行，如果 resample 耗时较长，`ws.load()` 被阻塞。
- 业内更优方案：**预生成更多 LOD 档**（如 8 档）或 **运行时动态抽稀**（不需要 `ws.load`，只需替换 peaks 数组并 `reRender()`）。WS v7 理论上支持 `setOptions({ peaks })` 但当前代码路径用 `ws.load()`。

### 4.4 Segment Overlay（`WaveformSegmentOverlay.tsx` + `useWaveformSegmentDrag.ts`）

```text
渲染策略：
- 每个语段一个 absolute positioned <div>
- left/width = timeToTimelinePx(start/end)
- top/height = lane-based 垂直分布（贪心重叠车道）
- 虚拟化：selectOverlayRenderedSegmentIndices 只渲染视口内 + pinned
- 拖拽：useWaveformSegmentDrag 管理 pointer capture + draft state
```

**优点**：
- DOM-based overlay 天然支持 CSS 交互（hover、cursor、aria）
- 虚拟化减少 DOM 节点数
- 拖拽语义完整（move / resize-start / resize-end / create-range）

**问题**：
- 语段数量极大时（>1000），即使虚拟化，React reconciliation 仍可能成为瓶颈
- 拖拽期间 `segmentDraft` 状态更新导致 re-render，虽只影响单个语段但父级 `WaveformSegmentOverlay` 仍会 re-render
- `laneByIndex` 计算是 O(n log n) 贪心，每次 segments 变化都重算。对于大量语段，应考虑 memoization 或增量更新

### 4.5 Minimap（`WaveformMinimapStrip.tsx`）

```typescript
// 独立 canvas，固定高度 40px
// 数据源优先级：
//   1. PeakCache.getMinimapPeaks(overviewWidthPx) → L0 resample
//   2. exportMinimapPeaksFromWaveSurfer(ws, width) → WS exportPeaks()
// 绘制：drawWaveformMinimap(ctx, peaks, width, height)
//   - colCount ≤ width: 每列一个 bar
//   - colCount > width: bucket aggregation（min/max）
```

**问题**：
- ResizeObserver + rAF paint，每次 resize 重绘
- `exportMinimapPeaksFromWaveSurfer` 在 peaks 未就绪时从 WS decode 路径导出，可能不准确
- 无 WebGL 加速，长音频 minimap 数据量大时主线程绘制有压力

### 4.6 时间尺与 Playhead（`WaveformLiveTimeRuler.tsx`）

```text
策略：
- 嵌入在 sticky bottom 容器中（viewport 坐标空间）
- playhead 位置 = (currentTime / duration) * timelineWidthPx - scrollLeftPx
- 刻度密度由 pxPerSec 决定
- 播放中通过 timeupdate 事件驱动（节流 250ms 或 rAF）
```

**问题**：
- timeupdate 节流 250ms 在播放跟随滚动时可能有可见的「跳跃」感
- 业内方案（如 Ableton、Descript）通常用 **rAF-based playhead**，与 display refresh 同步

---

## 5. 状态管理与编排层梳理

### 5.1 Hook 依赖图（简化）

```text
useTranscriptionLayer
  ├── useWaveformPeaks
  ├── useProjectWaveform
  │     ├── useProjectWaveformMount
  │     ├── useWaveformViewportController
  │     ├── useWaveformZoomSync
  │     ├── useWaveformPlayback
  │     ├── useWaveformGlobalPlayback
  │     ├── useWaveformSegmentPlaybackControls
  │     └── useWaveformHeightSync
  ├── useWaveformZoom
  ├── useWaveformDisplay
  ├── useTierScrollSync
  ├── useWaveformPlaybackScrollFollow
  └── useTranscriptionViewportFit

EditorWaveformPane
  ├── WaveformSegmentOverlay
  │     └── useWaveformSegmentOverlay
  │           └── useWaveformSegmentDrag
  ├── WaveformSegmentPlaybackControls
  ├── WaveformLiveTimeRuler
  └── WaveformMinimapStrip
```

### 5.2 Ref 与 State 的混杂模式

当前代码大量使用 **ref + state 双轨**来管理同一语义：
- `layoutDurationSecRef`（ref）+ `duration`（state）
- `appliedZoomStateRef`（ref）+ `pxPerSec`（state）
- `tierScrollLive.scrollLeftRef`（ref）+ `tierScrollLayout.scrollLeftPx`（state）

**设计意图**：ref 用于 imperative 同步（layout effect、event handler），state 用于 React render。

**问题**：
- 双轨增加了心智负担，需要严格保证「ref 领先/等于 state」的不变量
- `useWaveformViewportController` 的 `argsRef.current = args` 模式导致闭包陷阱，需极其谨慎
- `useLayoutEffect` 密集使用（zoom sync、viewport controller、shell layout），任何依赖变化都可能触发连锁重布局

---

## 6. 与业内成熟方案对比

### 6.1 方案对照表

| 维度 | Rushi 当前 | WaveSurfer.js v7 | BBC Peaks.js | Descript / Ableton |
|------|-----------|------------------|--------------|-------------------|
| **渲染后端** | WS v7 (Canvas2D tile) | Canvas2D tile | Canvas2D (Konva) | WebGL / Custom |
| **Peaks 预计算** | ✅ Rust + audiowaveform .dat | 推荐 audiowaveform | 推荐 audiowaveform | 自有服务 |
| **LOD 级别** | 3 档（2/20/200 pps）| 无内置 LOD | 无内置 LOD | 多档动态 |
| **上采样策略** | Canvas 视觉拉伸 | Canvas 视觉拉伸 | Canvas 视觉拉伸 | 真实重采样 |
| **Zoom 机制** | `ws.zoom()` + `ws.load()` | `zoom()` + 内部 tile 重排 | 双视图独立缩放 | 无缝连续缩放 |
| **Scroll 真源** | DOM tier scroll | 内部 autoScroll | 内部滚动 | 自定义 |
| **Segment 层** | DOM overlay (absolute) | Regions plugin (Canvas) | Canvas segments | WebGL overlay |
| **Minimap** | 独立 Canvas | 无内置 | 内置 overview | 内置 |
| **播放跟随** | tier scroll 写回 | autoScroll | 自动 | 平滑插值 |
| **多线程** | ❌ 全部主线程 | ❌ 全部主线程 | ❌ 全部主线程 | ✅ 可能用 Worker |
| **WebGL** | ❌ | ❌ | ❌ | ✅ |

### 6.2 关键差距分析

#### A. 上采样质量（High Zoom）

**现状**：当 zoom 超过最高 LOD（200 pps）时，WS Canvas 做视觉拉伸（`drawImage` 缩放）。这导致：
- 波形边缘模糊
- bar 宽度和间距变形
- 峰值细节丢失（无法看到单个采样点的波形）

**业内做法**：
- **Ableton / Pro Tools**：原生采样级渲染，无 LOD 概念
- **Web 方案（如 Rewind.ai 早期）**：生成更高 pps 的 peaks（如 800/1600 pps）或动态解码局部音频
- **WaveSurfer.js 讨论**：社区有提议用 `OfflineAudioContext` 对可见窗口局部解码，但未官方实现

#### B. 缩放平滑度

**现状**：拖动 zoom 滑块时，8 px/s quantum 导致「阶梯式」跳变。跨 quantum 时 `ws.load()` 重建 renderer，有可见闪烁。

**业内做法**：
- **Descript**：连续平滑缩放，无感知 LOD 切换。可能做法：WebGL 顶点 shader 中根据 zoom 动态采样 peaks 数据。
- **Peaks.js**：zoomview 和 overview 分离，zoom 只在 zoomview 内调整，overview 固定。
- **WaveSurfer.js**：`ws.zoom()` 只调整 `minPxPerSec`，不重建数据，相对平滑；但 Rushi 额外加了 `ws.load()` 来换 peaks 档。

#### C. 播放跟随平滑度

**现状**：`useWaveformPlaybackScrollFollow` 写 `tierScrollRef.scrollLeft`，节流或条件触发。timeupdate 节流 250ms。

**业内做法**：
- **Ableton**：播放头始终 viewport 居中，平滑滚动（与音频采样时钟锁定）
- **Web 最优**：`requestAnimationFrame` + `audioContext.currentTime` 计算精确播放位置，每帧更新 scroll

#### D. 大数据量性能

**现状**：
- 3h 音频 @ 200 pps = 2,160,000 pixels。WS v7 `MAX_CANVAS_WIDTH` ~4000px，DPR=2 → 约 270 个 canvas nodes。
- GitHub issue #3696 已报：>3h 音频 peaks 导致 DOM nodes 过多崩溃。

**业内做法**：
- **WaveSurfer.js 自身**：`getLazyRenderRange()` 只创建可见区域 canvas，但峰值数据仍全部持有
- **更优方案**：WebGL 单 canvas，所有 peaks 数据作为 texture 上传，GPU 负责采样和绘制。可处理百万级 peaks 无压力。

#### E. 多线程 / Worker

**现状**：全部在主线程：
- Rust 生成 peaks 是 spawn_blocking（Tokio），但这只是后台任务
- 前端：fetch `.dat`、resample、转换 Float32Array、WS 渲染，全在主线程

**业内做法**：
- **Peaks.js**：支持 Web Worker 解码（`webAudio` 模式）
- **WaveSurfer.js**：社区有 worker 加载 peaks 的 PR，未合并
- **Descript / Figma**：WebGL + Worker 处理音频数据是标配

---

## 7. 问题清单（按优先级）

### 🔴 P0 — 功能/稳定性风险

| # | 问题 | 影响 | 证据 |
|---|------|------|------|
| P0-1 | **超长音频 DOM 节点爆炸** | >3h 音频 WS v7 canvas 过多致页面崩溃 | wavesurfer.js#3696 |
| P0-2 | **上采样质量劣化** | zoom >200 pps 时波形模糊，影响精细编辑 | 代码分析 |
| P0-3 | **`ws.load()` 闪烁** | 跨 quantum 切换时 renderer 重建，UI 闪白 | 手测可复现 |
| P0-4 | **timeupdate 节流 250ms** | 播放中状态更新不跟耳，快进/快退感知滞后 | 代码分析 |

### 🟡 P1 — 性能/体验劣化

| # | 问题 | 影响 | 证据 |
|---|------|------|------|
| P1-1 | **resample 主线程阻塞** | 大音频 zoom 切换时有帧掉落 | 代码分析 |
| P1-2 | **PeakCache LRU 16 可能不足** | 频繁 zoom 操作导致 cache thrashing | 假设，需 profile |
| P1-3 | **Segment overlay React re-render** | 拖拽期间父级 re-render，大量语段时掉帧 | 代码分析 |
| P1-4 | **Minimap 频繁重绘** | ResizeObserver + rAF，窗口 resize 时连续重绘 | 代码分析 |
| P1-5 | **Viewport stretch-hold 复杂度高** | `scaleX` transform + 多 shell 嵌套，维护成本高 | 架构文档自述 |
| P1-6 | **双轨 ref/state 心智负担** | 同一语义两份存储，易引入同步 bug | 代码分析 |

### 🟢 P2 — 工程/可维护性

| # | 问题 | 影响 | 证据 |
|---|------|------|------|
| P2-1 | **Hook 数量过多（15+）** | `useTranscriptionLayer` 装配复杂，testability 差 | inventory.md |
| P2-2 | **缺乏 E2E 波形测试** | 无自动化回归手段，手测矩阵未填 | inventory.md |
| P2-3 | **ffmpeg 与 Symphonia 混音不一致** | remux 路径 `-ac 1` 可能产生不同波形形状 | 代码分析 |
| P2-4 | **LOD 仅 3 档，跨度大** | 2→20→200 是 10x 跳变，中间无平滑过渡 | 代码分析 |
| P2-5 | **无 WebGL 渲染路径** | 未来性能天花板明显，无法对标 Descript | 业内对比 |

---

## 8. 优化方案

### 8.1 短期（1-2 周）— 低风险、高回报

#### S1: 播放跟随平滑化（解决 P0-4）

**方案**：将播放头更新从 `timeupdate` 事件（250ms 节流）改为 **rAF + `ws.getCurrentTime()`**。

```typescript
// 在 useWaveformPlayback 或独立 hook 中
useEffect(() => {
  if (!isPlaying) return;
  let rafId = 0;
  const tick = () => {
    const t = wsRef.current?.getCurrentTime() ?? 0;
    setCurrentTime(t); // 或写 ref，由 rAF 驱动 ruler
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(rafId);
}, [isPlaying]);
```

**收益**：播放头与 display refresh 同步，消除 250ms 跳跃感。  
**风险**：低。`getCurrentTime()` 是轻量 getter。  
**验证**：手测播放中 playhead 是否平滑；对比 60Hz/120Hz 屏幕。

#### S2: Minimap 绘制优化（解决 P1-4）

**方案**：ResizeObserver debounce + 离屏 canvas cache。

```typescript
// WaveformMinimapStrip
// 1. RO 触发后 debounce 100ms 再 paint
// 2. peaks 数据不变时缓存离屏 canvas，resize 只做 `drawImage` 缩放
// 3. 仅在 peakCacheGeneration 变化或首次 mount 时重采样
```

**收益**：窗口 resize 时 minimap 不重算 peaks、不重绘。  
**风险**：低。  
**验证**：快速拖拽窗口大小，观察 minimap 是否仍流畅。

#### S3: Segment Overlay 渲染优化（解决 P1-3）

**方案**：
1. `laneByIndex` 用 `useMemo` + `segments` signature 缓存（已部分实现，检查是否完整）
2. `WaveformSegmentOverlay` 拆分：`SegmentItem` 单独 memo，拖拽 draft 只更新对应 item
3. 虚拟化窗口扩展：当前只渲染视口内，扩展为视口 + 1 屏 overscan，减少快速滚动空白

**收益**：大量语段（>500）时拖拽和滚动更流畅。  
**风险**：中。需确保 overscan 不引入可见性判定错误。  
**验证**：性能面板录制 500+ 语段文件的滚动和拖拽。

### 8.2 中期（2-4 周）— 架构改进

#### M1: 增加 LOD 档位 + 动态上采样（解决 P0-2, P2-4）

**方案**：
1. **后端**：增加 L3=800 pps 档（或 L3=400）。4 档：2/20/200/800。
   - 生成耗时增加约 25%（L3 数据量大但写入快）
   - 文件总大小增加约 25%（L2 已最密，L3 是 4x）
2. **前端**：`pickPeakLodLevel` 支持 4 档；上采样阈值从 200 pps 提升到 800 pps
3. **备选**：若文件大小敏感，L3 只生成前 10 分钟（热点区域），或按需生成

**收益**：精细 zoom 到 400-800 pps 时仍有真实 peaks 数据，不再模糊拉伸。  
**风险**：中。需验证文件大小增长是否可接受；ASR 场景音频通常 <30min，L3 压力小。  
**验证**：对比 10min 音频 L2-only vs L3 在 400pps zoom 下的视觉差异。

#### M2: Zoom 拖动期去 `ws.load()`（解决 P0-3, P1-1）

**方案**：引入 **drawPxPerSec / layoutPxPerSec 双轨**（ADR-0005 已提出但未完全实施）。

```typescript
// 拖动滑块期间：
// - layoutPxPerSec 每帧更新（影响 timelineWidthPx、overlay 位置）
// - drawPxPerSec 在 pointerup / debounce 500ms 后更新（触发 ws.load）
// 同 quantum 档内：只 ws.zoom()，不 ws.load()
```

**收益**：拖动 zoom 滑块时无闪烁、无卡顿；只有停止后才可能换档。  
**风险**：中。需确保双轨期间的 overlay 与 WS 波形对齐。  
**验证**：手测拖动 zoom 滑块，观察是否还有闪白；profile 主线程占用。

#### M3: 引入 Web Worker 处理 Peaks（解决 P1-1）

**方案**：将 `PeakCache` 的 resample + `waveformDataToWaveSurferPeaks` 移入 Web Worker。

```typescript
// peaks.worker.ts
// 接收：{ baseLevelData: ArrayBuffer, targetWidthPx, layoutDurationSec }
// 处理：WaveformData.create → resample → Float32Array
// 返回：{ peaks: Float32Array, duration }

// PeakCache 中：
getWaveSurferPeaksAsync(pxPerSec, layoutDurationSec) {
  if (isSmallArray) return syncPath(); // 小数据免 worker 开销
  return worker.postMessage({ ... }).then(...);
}
```

**收益**：大音频 resample 不再阻塞主线程，UI 保持响应。  
**风险**：中。Worker 与主线程 transfer ArrayBuffer 需注意 ownership；Tauri 环境下 Worker 路径需测试。  
**验证**：10min+ 音频拖动 zoom，观察是否有 long task (>50ms)。

### 8.3 长期（1-2 月）— 技术储备

#### L1: WebGL 波形渲染器原型（解决 P0-1, P2-5）

**方案**：评估自研 WebGL renderer 替换 WaveSurfer 的可行性。

```text
设计草图：
- 单 <canvas> WebGL context
- Peaks 数据上传为 float texture（或 uniform array）
- Vertex shader：每个 bar 一个 quad，x 位置由 peaks 索引计算
- Fragment shader：bar 颜色（waveColor / progressColor）
- Zoom：uniform scaleX，无需重建 geometry
- Scroll：uniform offsetX，自然跟随
- Progress：uniform playheadX，shader 内变色
- Segment overlay：保持 DOM 层（WebGL + DOM 混合是可行且常见的）
```

**参考实现**：
- [waveform-playlist](https://github.com/naomiaro/waveform-playlist)（Canvas2D，可学习其 peaks 管理）
- [audio-waveform](https://github.com/shader-doodle/audio-waveform)（WebGL 实验）

**收益**：
- 单 canvas，无 DOM nodes 爆炸问题
- GPU 并行绘制，百万级 peaks 60fps
- 连续平滑 zoom，无 LOD 切换概念
- 播放头精确到像素

**风险**：高。需完整替换 WS 的播放后端（MediaElement 仍可复用），工程量大。  
**验证**：先做 spike（2-3 天），验证 1h 音频 200pps peaks WebGL 渲染性能。

#### L2: 统一播放时钟 + 平滑滚动（解决 P0-4 终极版）

**方案**：用 `HTMLMediaElement` + `requestVideoFrameCallback`（或 rAF + `currentTime`）作为唯一时钟源，播放跟随滚动用 **requestAnimationFrame** 逐帧插值。

```typescript
// 理想模式（类似 Ableton）
useEffect(() => {
  if (!isPlaying) return;
  let rafId = 0;
  let lastTime = mediaElement.currentTime;
  let lastTs = performance.now();
  
  const tick = (now: number) => {
    const dt = (now - lastTs) / 1000;
    const expected = lastTime + dt * playbackRate;
    const actual = mediaElement.currentTime;
    // 用 actual 校正，但 expected 保证连续性
    const displayTime = actual; 
    
    const scrollPx = timeToTimelinePx(displayTime, ...) - viewportWidthPx / 2;
    tierScrollRef.current!.scrollLeft = scrollPx;
    
    lastTime = displayTime;
    lastTs = now;
    rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(rafId);
}, [isPlaying]);
```

**收益**：播放跟随与音频采样时钟锁定，无跳跃。  
**风险**：高。需重构 `useWaveformPlaybackScrollFollow` 的现有逻辑。  
**验证**：手测 120Hz 屏幕播放跟随平滑度。

#### L3: 后端 peaks 服务化 + 流式生成

**方案**：当前 Rust 生成是同步阻塞（`spawn_blocking` + 单线程 decode）。未来可：
1. 流式生成：边解码边写入 `.dat`，前端可边下载边显示（progressive peaks）
2. 内存映射：大音频用 `mmap` 读取，减少内存拷贝
3. 并行生成：多 channel 音频可并行计算混音（当前是单线程 sequential）

**收益**：大音频导入体验提升（peaks 更快可用）。  
**风险**：中。流式生成需要前端支持 partial `.dat` 渲染。  
**验证**：profile 1h 音频 peaks 生成耗时，识别瓶颈。

---

## 9. 真源与架构规范建议

### 9.1 应写入 `desktop-waveform-engine.md` 的补充

1. **LOD 档位定义**：明确当前 3 档（2/20/200），若实施 M1 则更新为 4 档
2. **上采样边界**：明确 zoom >200 pps 时的视觉拉伸行为是已知限制
3. **Web Worker 策略**：若实施 M3，定义 Worker 接口契约
4. **WebGL 路线图**：若启动 L1 spike，记录决策过程

### 9.2 代码规范建议

1. **禁止新增 mega-hook**：`useProjectWaveform` 已达 240 行，任何新增功能应先拆到子 hook
2. **ref/state 双轨文档化**：每个双轨变量必须注释「ref 用途」和「state 用途」
3. **peaks 操作性能标注**：任何涉及 resample / `ws.load()` / `reRender()` 的函数必须标注时间复杂度

---

## 10. 路线图建议

```text
Week 1-2 (短期):
  ├── S1: rAF 播放跟随
  ├── S2: Minimap debounce + cache
  └── S3: Segment overlay memo 优化

Week 3-4 (中期):
  ├── M1: L3 LOD (800 pps) 后端 + 前端
  ├── M2: Zoom 双轨（drawPxPerSec / layoutPxPerSec）
  └── M3: Peaks Web Worker

Month 2-3 (长期):
  ├── L1: WebGL renderer spike（go/no-go 决策）
  ├── L2: 统一播放时钟（若 L1 go）
  └── L3: 后端流式生成（若前端支持）
```

---

## 附录 A：术语表

| 术语 | 含义 |
|------|------|
| LOD | Level of Detail，peaks 数据的多级精度 |
| pps | pixels-per-second，横向时间轴缩放单位 |
| quantum | 量化步长，此处指 8 px/s 的 peaks 加载分档 |
| tier | 最外层滚动容器（`overflow-x: auto`） |
| shell | 内部嵌套的宽度控制容器（timeline / sticky / stretch） |
| content-tile | 画布作为 timeline 内容的一部分自然滚动（vs viewport-fixed） |
| WS | WaveSurfer.js |
| fit-all | 时间轴宽度等于视口宽度的布局模式 |

## 附录 B：参考资源

- [WaveSurfer.js v7 renderer.ts](https://github.com/katspaugh/wavesurfer.js/blob/main/src/renderer.ts)
- [BBC Peaks.js](https://github.com/bbc/peaks.js/)
- [audiowaveform](https://github.com/bbc/audiowaveform)
- [waveform-data.js](https://github.com/bbc/waveform-data.js)
- [WaveSurfer #3696 — Canvas nodes crash](https://github.com/katspaugh/wavesurfer.js/issues/3696)
- [Virtualizing The Canvas (gedge.ca)](https://gedge.ca/blog/2024-11-03-virtualizing-the-canvas/)
