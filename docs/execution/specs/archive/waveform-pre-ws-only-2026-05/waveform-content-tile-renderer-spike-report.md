# Spike Report: waveform_content_tile_renderer (P0)

> Intent：[`waveform-content-tile-renderer-intent.md`](./waveform-content-tile-renderer-intent.md)
> Plan：[`waveform-content-tile-renderer-plan.md`](./waveform-content-tile-renderer-plan.md)
> Acceptance：[`waveform-content-tile-renderer-acceptance.md`](./waveform-content-tile-renderer-acceptance.md)
> ADR：[ADR-0004](../../../adr/0004-waveform-peaks-content-tile-renderer.md)

## 结论：**Go**（进入 P1）

P0 范式在 Rushi 体系下可行：
- 消除了 `position: sticky` 与 `transform: translateX()` 这条手动 sticky 路径
- canvas 跟随内容流自然横滚，无需 scroll listener / repaint key
- 可在 zoom / scroll / cross-segment 四路径下正确显示 peaks（缩放有卡顿，登记为 P1 已知项）

## 实施摘要

### 新增（落地于本 spike）

| 路径 | 行数 | 角色 |
|---|---|---|
| `apps/desktop/src/services/waveform/tileGeometry.ts` | 115 | 纯函数：tile 布局（width 解析 / visibility / overscan） |
| `apps/desktop/src/services/waveform/tileGeometry.test.ts` | ~150 | 11 个 case：空 timeline / 单 tile / 多 tile / DPR / 对齐 / overscan |
| `apps/desktop/src/utils/waveformTileFlag.ts` | ~30 | `RUSHI_WAVEFORM_TILE_RENDERER` 读写（默认 true） |
| `apps/desktop/src/components/WaveformPeaksTileLayer.tsx` | 196 | 薄 UI：rAF 轮询 scrollLeft → 计算 visible → 渲染 N 个 `<canvas>` |

### 改造

| 路径 | 变化 |
|---|---|
| `apps/desktop/src/services/waveform/waveformPeaksCanvasDraw.ts` | 新增 `drawWaveformPeaksTile(ctx, peaks, opts)` 入口，返回 `boolean`（空 peaks 时不 clearRect，保留上一帧） |
| `apps/desktop/src/components/editor/EditorWaveformPane.tsx` | 在 `inline-block` 内容容器内挂 tile layer（flag=true 时），与 segment overlay 同级 |
| `apps/desktop/src/pages/useTranscriptionLayer.ts` | `handleTierScrollAdjusted` 用 `useCallback([])` 稳定化（修死循环，见下文「关键发现 2」） |

P1 才会触碰：`useWaveformTileLifecycle.ts`、`WaveformProgressOverlay.tsx`、删 `peaksRepaintKey` / 删 sticky-layer 等。

## 验证证据

### 4 闸结果

| 闸 | 结果 | 备注 |
|---|---|---|
| `npm run typecheck` | ✓ | 0 错 |
| `npm run test` | ✓ | 339 / 339 通过（含新增 11 个 tile geometry + 4 个 tile draw 测试） |
| `npm run lint` | ⚠️ 41 errors / 6 warnings | **baseline 51 / 6**，本 spike 净减 10 errors（未引入新告警） |
| `node scripts/check-architecture-guard.mjs` | ✓ | 0 错；5 warning 均 pre-existing hotspot（`WaveformZoomBar`、`EditorWaveformPane`、`useTranscriptionLayer`、`useWaveformZoomSync.test`），新增文件均未触发告警 |

### 手测 P0 四路径

| # | 路径 | 结果 | 备注 |
|---|---|---|---|
| P0.1 | 打开 10min mp3 → peaks 可见 | ✓ | flag=true 下首屏 peaks 正常出现 |
| P0.2 | zoom 滑块从 min 拖到 max | ⚠️ | peaks 始终可见，但**滑块拖动期间有卡顿** → 见「已知问题 1」 |
| P0.3 | 横滚到末尾 | ✓ | 增加 `overscan=3` 后无空白；末尾 30s peaks 完整可见 |
| P0.4 | 点击 segments list 切段 | ✓ | 修复死循环后切段不再白屏（见「关键发现 2」） |

Go/No-Go 判定：**Go**。P0.2 的卡顿不是范式问题（lifecycle hook + LRU 是 P1 计划内职责），不应阻塞范式验证。

## 已知问题（移交 P1）

### 1. 滑块缩放卡顿（P1 必须处理）

**现象**：拖动 zoom 滑块连续滑动时主线程卡顿明显。

**根因（推断）**：每次 `pxPerSec` 变化都会让 visible 列表里**所有 tile 的 `useLayoutEffect` 同步重跑**：
- 每个 tile 同步调用 `peakCache.getInterleavedPeaks(pxPerSec)`（可能触发 resample）
- 同时 `useWaveformZoomSync` 触发 `ws.load(url, peaks, duration)` 整套 reload
- P0 当前没有节流、无 LRU、无 dirty diff，所有重活同步堆在一帧

**P1 设计建议**：
- `useWaveformTileLifecycle`：cap=16 的 LRU 池，pxPerSec 不变时复用 canvas（仅 leftPx/widthPx 变化不应触发重 draw）
- pxPerSec 变化时，新的 pxPerSec 进 invalidate 队列，rAF 合并节流（≤1 次/帧），visible tiles 优先重画
- 与 `useWaveformZoomSync` 协同：拖动期间 `appliedPeaksRef.current = true` 之前 ws.load 不重发，依赖 tile layer 自己 draw

### 2. 当前 spike 保留的临时实现（P1/P3 应清理）

| 项 | 说明 | 处理阶段 |
|---|---|---|
| `WaveformPeaksTileLayer` 内部 rAF 永久轮询 `tierScrollRef.current.scrollLeft` | 绕开 `useWaveformViewportMetrics` 的 React 状态滞后；解决了"白屏"和"快滚白屏"，但持续 rAF（即使无滚动）有微小 CPU 开销 | P1 评估是否改用 `useSyncExternalStore` + scroll listener，或保留 rAF + idle 检测自动停 |
| `overscanTiles = 3` | 经验值，缓解快速滚动 pop-in；P1 上 LRU 后可降到 1–2 | P1 |
| `drawWaveformPeaksTile` 返回 `boolean` + 空 peaks 不 clearRect | 防御白屏（zoom 中途短暂空 peaks 时保留上帧） | P1 仍保留这条防御 |
| `tileRendererEnabled` 通过 `useMemo([], () => isWaveformTileRendererEnabled())` 读一次 | 手动 toggle 需要 localStorage 改后刷新；可接受 | 长期保留，P4 删 flag |

## 关键发现（影响后续阶段设计）

### 发现 1：旧的 sticky / repaintKey / `onTierScrollAdjusted` 是范式 B 的连锁补丁

P0 实施时确认：只要 peaks layer 在内容流内（不脱离），白屏的根本原因消失。原本为 viewport-fixed canvas 加的：
- `peaksRepaintKey` state 强刷
- `onTierScrollAdjusted` 回调
- `useWaveformZoomSync.ts` 内 `ws.load` 的 `requestAnimationFrame` 包装
- `WaveformPeaksViewportLayer` 手动 sticky `transform: translateX()`

——**全部是范式 B 的补丁链**，在范式 A 下零必要。P3 的清理是正向的。

### 发现 2：`onTierScrollAdjusted` 内联箭头触发 React 19 同步 setState 死循环（spike 期间发现并修）

**症状**：用户点语段直接白屏，React 报 `Maximum update depth exceeded`。

**根因链**：
1. `useTranscriptionLayer` 给 `useTranscriptionViewportFit` 传内联箭头 `onTierScrollAdjusted: () => setPeaksRepaintKey((k) => k + 1)`，每次 render 引用都不同
2. 此引用进入内部 `applyPendingViewportFit` 的 `useCallback` deps → applyPendingViewportFit 每帧重建
3. 该 hook 内的 `useLayoutEffect(..., [applyPendingViewportFit, ...])` 每次 render 重跑
4. 若 pending fit 存在（zoom 路径残留），layout effect 调用 `applyPendingViewportFit` → 触发 `onTierScrollAdjusted()` → `setPeaksRepaintKey(+1)`
5. React 19 在 layout effect 内的 setState 同步 flush（`flushSyncWorkAcrossRoots`）→ 立即新 render → 新 layout effect → 又 setState → 25 次后抛错 → 整树崩溃 → 白屏

**修复**（已落地）：稳定 `handleTierScrollAdjusted = useCallback([], ...)`。

**对 P3 的启示**：删除 `onTierScrollAdjusted` 整条管线时，要同步检查所有"为旧 layer 加的内联回调 → 进 useCallback deps → 进 useLayoutEffect deps"链。当前这条链已被范式 A 解构得不再需要，P3 删除是治本。

### 发现 3：tile 渲染对 scroll 状态的延迟极敏感

Spike 早期用 `useWaveformViewportMetrics`（rAF 节流的 React state）做 visible 计算，结果在快速滚动时出现：
- 主波形区左右极速闪动（visible 范围跟不上 DOM scroll）
- 滚到末尾出现白屏（state 滞后 1-2 帧导致 visible 落在错位）

**修复路径**：
- `WaveformPeaksTileLayer` 自己开 rAF 永久轮询 `tierScrollRef.current.scrollLeft`，跟 DOM 同步到 < 1 帧
- `overscanTiles` 从 1 增加到 3，吸收 1 帧内的位置漂移

**对 P1 的启示**：lifecycle hook 必须直接订阅 DOM scroll（rAF poll 或 `useSyncExternalStore` + scroll listener），不能依赖父组件透传的 state；否则即使 LRU 命中，visible 范围算错就是白屏。

## 性能 spot check（非硬指标）

| 场景 | 观察 | 备注 |
|---|---|---|
| 静止 idle | rAF 永久 loop 在跑（tile layer 内），CPU < 1% | P1 评估按需暂停 |
| 横滚 | tile mount/unmount 不可见（React reconciler 复用 key=index），无白屏 | 跟内容流自然滚，符合预期 |
| 拖 zoom 滑块 | **明显卡顿** | P1 必修，根因在「已知问题 1」 |
| 切段（autoFit=false） | 流畅，peaks 即时可见 | 修死循环后通畅 |

未做完整 Chrome DevTools Performance 录制（P0 范围内非要求）。P1 完成后再做对比录制。

## 下一步

进入 P1。优先级（按 P1 H1/H2/H3 验收覆盖度）：

1. `useWaveformTileLifecycle.ts`：LRU pool（cap=16），暴露 `getOrCreateTile(index, dirtyKey)`，`dirtyKey = pxPerSec | peakCacheGeneration`
2. `WaveformPeaksTileLayer` 改用 lifecycle hook，去除当前的 useState/useLayoutEffect 内联实现
3. zoom 拖动期间节流策略：连续 pxPerSec 变化合并到 rAF / requestIdleCallback，触发一次 invalidate
4. 跑 P1 验收（H1/H2/H3 + machine gates）
5. 缩放卡顿复测 → 期望基本消除

注意 P1 不动 `peaksRepaintKey` / `onTierScrollAdjusted` / `WaveformPeaksViewportLayer`（flag=false 路径仍需可用，P3 才清，P4 才删）。
