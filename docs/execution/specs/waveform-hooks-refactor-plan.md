# Waveform Hooks 重构规划

## 背景

Architecture Guard 对 `apps/desktop/src/hooks/useWaveform*.ts` 报出多项警告：

| 文件 | 行数 | hooks | 主要超标项 |
|------|------|-------|-----------|
| `useWaveformSegmentDrag.ts` | 396 | — | 行数 > 300 |
| `useWaveformPeaks.ts` | 351 | — | 行数 > 300 |
| `useWaveformViewportController.ts` | 327 | — | 行数 > 300 |
| `useWaveformZoom.ts` | 178 | 13 | hooks > 12 |
| `useWaveformZoomSync.ts` | 299 | — | 接近 300 |
| `useWaveformTimelineController.ts` | 279 | — | 接近 300 |

## 诊断：为什么大

### 1. `useWaveformSegmentDrag.ts` (396L) — 拖拽交互
**职责**：Pointer down/move/up 全生命周期、段边界编辑、创建范围、Snap 吸附、重叠策略。

**膨胀原因**：
- 内联了 4 种操作模式：拖拽移动、边界拉伸、创建范围、空点击选择
- 每种模式有独立的状态机和手势解析
- Snap 目标收集和吸附计算内联在 hook 中
- 几何计算（`boundsForOverlayDrag`）结果的消费逻辑复杂

**拆分策略**：
```
useWaveformSegmentDrag.ts          →  orchestrator（~120L）
  ├── useSegmentDragPointer.ts     →  pointer 事件捕获 + 模式分发（~100L）
  ├── useSegmentDragSnap.ts        →  snap 目标收集 + 吸附应用（~80L）
  └── useSegmentDragCommit.ts      →  边界提交 + 范围创建（~80L）
```

### 2. `useWaveformPeaks.ts` (351L) — 峰值数据
**职责**：PeakCache 生命周期、峰值生成轮询、媒体时长对齐、清理。

**膨胀原因**：
- 轮询逻辑（`pollWaveformPeaksUntilReady`）的调用和状态转换内联
- PeakCache 的 bootstrap + deferred load 逻辑
- 文件切换时的清理和重新加载
- `shouldForcePeaksRegenerate` 的时长变化检测

**拆分策略**：
```
useWaveformPeaks.ts              →  公共 API 门面（~100L）
  ├── usePeakCacheLoader.ts      →  PeakCache 加载 + 层级管理（~120L）
  └── usePeakGenerationPoller.ts →  生成状态轮询 + 进度跟踪（~120L）
```

### 3. `useWaveformViewportController.ts` (327L) — 视口控制
**职责**：ResizeObserver、窗口 resize、视口 stretch/hold、fit-all refit。

**膨胀原因**：
- ResizeObserver + window resize 两条路径统一在 microtask coalesce
- Stretch 计算（`computeViewportStretchRatio`）和 CSS 变量写入
- Fit-all refit 与 WS reRender 的协调
- `deferDecodeMount` 的复杂条件判断

**拆分策略**：
```
useWaveformViewportController.ts     →  协调器（~100L）
  ├── useWaveformResizeObserver.ts   →  RO + resize coalesce（~120L）
  └── useWaveformViewportStretch.ts  →  stretch 计算 + CSS 写入（~100L）
```

### 4. `useWaveformZoom.ts` (178L, 13 hooks) — 缩放状态
**职责**：layoutPxPerSec / drawPxPerSec / layoutIntent 三元状态 + persistence。

**膨胀原因**：
- 8 个 `useCallback`：每个 action（setPxPerSec, resetZoom, fitAll, fitSelection…）独立缓存
- 2 个 `useEffect`：debounce cleanup + pref persistence

**拆分策略**：
```
useWaveformZoom.ts              →  精简门面（~80L，~6 hooks）
  └── useWaveformZoomState.ts   →  state + persistence（~100L）
      └── 提取 `useDebouncedState` 通用模式（drawPxPerSec debounce）
```

把 `flushDrawPxPerSec` / `scheduleDrawPxPerSec` 的 debounce 逻辑提取为通用 hook `useDebouncedValue`，可减少 3 个 useCallback + 1 个 useEffect。

### 5. `useWaveformZoomSync.ts` (299L) — 缩放同步
**职责**：layout px/s → WaveSurfer zoom 同步；ws.load(peaks) 量子管理。

**膨胀原因**：
- `useLayoutEffect` 主导的三阶段同步：peaks ready check → ws.load → commit zoom
- In-flight 状态机（`WaveformZoomSyncInFlight`）的复杂生命周期
- `PeakCache` 与 `WaveSurfer` 的双向 reconcile

**拆分策略**：
```
useWaveformZoomSync.ts                →  协调器（~120L）
  ├── useWaveformZoomSyncLoad.ts      →  ws.load(peaks) 决策（~100L）
  └── useWaveformZoomSyncCommit.ts    →  zoom commit + in-flight 跟踪（~80L）
```

### 6. `useWaveformTimelineController.ts` (279L) — 时间轴控制
**职责**：时间轴挂载门控、WaveSurfer decode 进度跟踪、挂载/卸载协调。

当前接近阈值，暂不做主动拆分；如果后续膨胀再处理。

## 依赖关系（简化）

```
WaveformContainer
├── useWaveformViewportController
│   └── useWaveformZoom (fit-all refit)
├── useWaveformZoom
│   └── useWaveformZoomSync
│       ├── useWaveformPeaks
│       │   └── PeakCache
│       └── WaveSurfer ref
├── useWaveformSegmentDrag
│   ├── useWaveformZoom (pxPerSec 转换)
│   └── segment bounds utils
└── useWaveformPlayback / useWaveformRulerScrollTrack...
```

## 实施顺序（建议）

1. **P0 — `useWaveformZoom.ts` 提取 `useDebouncedValue`**
   - 最小改动，通用收益
   - 把 hook 数从 13 降到 ~9

2. **P1 — `useWaveformPeaks.ts` 拆分为 loader + poller**
   - 峰值逻辑与 UI 耦合度最低，拆分最安全
   - 测试已有 `waveformPeaksPoll.test.ts`，可作为验证基准

3. **P2 — `useWaveformViewportController.ts` 拆分为 resize + stretch**
   - 视口逻辑相对独立

4. **P3 — `useWaveformSegmentDrag.ts` 拆分为 pointer + snap + commit**
   - 风险最高：拖拽是核心交互，需逐模式验证
   - 建议保留原有测试并通过后再合并

5. **P4 — `useWaveformZoomSync.ts` 拆分**
   - 与 WS 内部状态耦合紧密，拆分需谨慎

## 验证方式

每步拆分后必须：
1. `npm run typecheck && npm run test`
2. `node scripts/check-architecture-guard.mjs`
3. 手动验证一条主路径：导入音频 → 查看波形 → 缩放 → 拖拽段边界 → 播放
