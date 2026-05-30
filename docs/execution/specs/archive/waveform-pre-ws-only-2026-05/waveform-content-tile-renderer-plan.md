# Plan: waveform_content_tile_renderer

> Intent：[`waveform-content-tile-renderer-intent.md`](./waveform-content-tile-renderer-intent.md)
> ADR：[ADR-0004](../../../adr/0004-waveform-peaks-content-tile-renderer.md)
> Acceptance：[`waveform-content-tile-renderer-acceptance.md`](./waveform-content-tile-renderer-acceptance.md)

## 目标 DOM 结构

```text
<div ref=tierScrollRef overflow-x:auto>                          ← tier 滚动容器（不变）
  <div className="inline-block align-top" width={timelineWidthPx}>  ← 宽内容容器（不变）
    ╔═══════════════════════════════════════════════════════════╗
    ║ <WaveformPeaksTileLayer>                                  ║  ← 新：peaks 层移到这里
    ║   <canvas absolute left=0       width=tileW height=H/>    ║      作为 inline-block 子元素
    ║   <canvas absolute left=tileW   width=tileW height=H/>    ║      自然跟内容滚动
    ║   <canvas absolute left=tileW*2 width=tileW height=H/>    ║      最多 10 张 LRU
    ║   ...                                                     ║
    ║ </WaveformPeaksTileLayer>                                 ║
    ║                                                           ║
    ║ <WaveformProgressOverlay absolute left=0 width=progressPx/║  ← 新：进度色覆盖层
    ╚═══════════════════════════════════════════════════════════╝
    <WaveformSegmentOverlay>     ← 不变（已 absolute, z=3）
    <WaveformLiveTimeRuler>      ← 不变（absolute, z=10）
    <WaveSurfer container>       ← 不变（z=0，仅 fallback decode）
  </div>
</div>
```

**关键变化**：peaks 层不再脱离内容流。无 sticky、无 transform、无 scroll listener。
canvas 跟内容自然滚是浏览器原生行为。

## 受影响代码地图

### 新增

| 路径 | 行数预估 | 职责 |
|---|---|---|
| `apps/desktop/src/services/waveform/tileGeometry.ts` | ~80 | 纯函数：tile 布局计算（layout / visibility / boundary） |
| `apps/desktop/src/hooks/useWaveformTileLifecycle.ts` | ~120 | controller hook：tile LRU 池、create/evict、dirty 重绘 |
| `apps/desktop/src/components/WaveformPeaksTileLayer.tsx` | ~80 | 薄 UI：渲染 active tiles，订阅 scroll |
| `apps/desktop/src/components/WaveformProgressOverlay.tsx` | ~50 | 薄 UI：absolute div + width=progressPx |
| `apps/desktop/src/utils/waveformTileFlag.ts` | ~30 | feature flag 读写（localStorage） |

### 改造

| 路径 | 现状 | 改动 |
|---|---|---|
| `apps/desktop/src/services/waveform/waveformPeaksCanvasDraw.ts` | 71 行，签名依赖 `scrollLeftPx` | 增加 `drawWaveformPeaksTile(ctx, peaks, { tileLeftPx, tileWidthPx, pxPerSec, height, color })` 入口；旧 `drawWaveformPeaksViewport` 保留到 P3 |
| `apps/desktop/src/components/editor/EditorWaveformPane.tsx` | 304 行，peaks layer 挂 tier 内 | 改挂到 inline-block 容器内（flag = true 时）；删除 `peaksRepaintKey` / `readScrollLeftPx` 透传 |
| `apps/desktop/src/pages/useTranscriptionLayer.ts` | 343 行 / 15 hooks | P3 删除 `peaksRepaintKey` state + `onTierScrollAdjusted` 回调 |
| `apps/desktop/src/pages/useTranscriptionViewportFit.ts` | 268 行 | P3 删除 `onTierScrollAdjusted` 参数 |
| `apps/desktop/src/hooks/useWaveformZoomSync.ts` | 207 行 | P3 删除 `ws.load` 的 `requestAnimationFrame` 包装 |

### 删除（P4）

| 路径 | 现状 | 理由 |
|---|---|---|
| `apps/desktop/src/components/WaveformPeaksViewportLayer.tsx` | 105 行 | 旧 viewport-fixed 路径 |
| `apps/desktop/src/components/WaveformPeaksCanvas.tsx` | 157 行 | 旧 canvas 渲染（rAF/帧） |

### 测试

| 路径 | 类型 | 覆盖 |
|---|---|---|
| `apps/desktop/src/services/waveform/tileGeometry.test.ts` | 新增 | layout 计算 / visibility 边界 / DPR / barWidth 对齐 |
| `apps/desktop/src/hooks/useWaveformTileLifecycle.test.ts` | 新增 | LRU evict / dirty 标记 / cap=10 行为 |
| `apps/desktop/src/services/waveform/waveformPeaksCanvasDraw.test.ts` | 改造 | 增加 `drawWaveformPeaksTile` 测试；旧测试转向 tile 入口 |
| `apps/desktop/src/components/WaveformPeaksTileLayer.test.tsx`（可选） | 新增 | render N tiles / scroll 触发 evict |

## 阶段执行

每个阶段独立可回退（feature flag 切换 + 双路径并存）。

### P0 — Spike（0.5 天，**feature 分支直接跑**）

**目的**：在 feature 分支验证范式 A 在 Rushi 体系下真的能消除 sticky 问题。

落位：
- 起分支 `feature/waveform-tile-renderer`（不开 worktree，直接在 main 上拉）
- 新建 `WaveformPeaksTileLayer.tsx` 最小版（无 lifecycle hook，直接在组件内 useState + useEffect）
- 单 channel、tile 宽 = `min(8000, max(viewport * 2, 4096))`、cap = 16
- 无 progress overlay（peaks 全部用 waveColor）
- **flag 默认 true**：上 main 后立即走新路径；regression 时浏览器 console 切回 false

走通脚本：
1. 打开 10min mp3 → peaks 可见
2. zoom 滑块拖到最大 → peaks 重生成，可见
3. 横滚到末尾 → peaks 永远在
4. 点击 segments list 切换语段 → peaks 永远在

**Go/No-Go**：
- ✅ 4 路径全可见 → 进入 P1
- ❌ 任一路径有 regression → 写 spike 报告，分析根因，决定是否调整方案或放弃

### P1 — 主体替换（2 天）

**1.1 落 `tileGeometry.ts`**（纯函数，先写）

```ts
export type TileLayout = {
  tileWidthPx: number;
  totalTiles: number;
  visibleRange: { startIndex: number; endIndex: number };
  tilesOf: (index: number) => { leftPx: number; widthPx: number };
};

export function computeTileLayout(input: {
  timelineWidthPx: number;
  viewportWidthPx: number;
  scrollLeftPx: number;
  barWidth: number;
  barGap: number;
  maxTilePx?: number;  // default 8000
  minTilePx?: number;  // default 4096
}): TileLayout;
```

- `tileWidthPx = clamp(viewport * 2, minTilePx, maxTilePx)`，并按 `barWidth + barGap` 向下取整对齐
- visibleRange = `[floor(scrollLeft / tileWidth) - 1, ceil((scrollLeft + viewport) / tileWidth) + 1]`，clamp 到 `[0, totalTiles)`
- 配套 tests：边界、对齐、空 timeline

**1.2 落 `useWaveformTileLifecycle.ts`**（controller hook）

```ts
export type TileState = {
  index: number;
  leftPx: number;
  widthPx: number;
  canvasRef: RefObject<HTMLCanvasElement>;
  dirty: boolean;
};

export function useWaveformTileLifecycle(args: {
  layout: TileLayout;
  pxPerSec: number;
  peakCache: PeakCache | null;
  cap?: number;  // default 16
}): {
  activeTiles: TileState[];   // 当前应渲染的 tile（按 index 排序）
  markDirty: (index: number) => void;
  invalidateAll: () => void;  // pxPerSec / peakCache 变化时调用
};
```

- 内部用 `useRef<Map<index, TileState>>` 维护 LRU
- `layout.visibleRange` 变化 → 新 index 入池，超 cap 的 LRU evict
- `pxPerSec` 或 `peakCache` 变化 → `invalidateAll`（清空 map）
- 每个 tile 内部 `useEffect` 监 `dirty`，dirty=true 时绘制并改为 false

**1.3 落 `WaveformPeaksTileLayer.tsx`**（薄 UI）

```tsx
export const WaveformPeaksTileLayer = memo(function WaveformPeaksTileLayer({
  peakCache, pxPerSec, timelineWidthPx, heightPx,
  scrollLeftPx, viewportWidthPx,
}: Props) {
  const layout = useMemo(() => computeTileLayout({ ... }), [...]);
  const { activeTiles } = useWaveformTileLifecycle({ layout, pxPerSec, peakCache });

  if (!peakCache || heightPx <= 0) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[1]"
      style={{ width: timelineWidthPx, height: heightPx }}
      aria-hidden
    >
      {activeTiles.map((tile) => (
        <WaveformPeaksTile
          key={tile.index}
          tile={tile}
          peakCache={peakCache}
          pxPerSec={pxPerSec}
          heightPx={heightPx}
        />
      ))}
    </div>
  );
});
```

每个 `<WaveformPeaksTile>` 内部就是一个 `<canvas>` + 一个 `useLayoutEffect`，
调用 `drawWaveformPeaksTile(ctx, peaks, { tileLeftPx, tileWidthPx, pxPerSec, height, color })`，
**完全不依赖 `scrollLeftPx`**。

**1.4 改造 `waveformPeaksCanvasDraw.ts`**

新增入口：

```ts
export function drawWaveformPeaksTile(
  ctx: CanvasRenderingContext2D,
  interleavedPeaks: number[],
  opts: { tileLeftPx: number; tileWidthPx: number; pxPerSec: number;
          heightPx: number; durationSec: number; color: string;
          barWidth?: number; barGap?: number; },
): void;
```

实现：把 `tileLeftPx` 当作 timeline 上的起点，只画 `[tileLeftPx, tileLeftPx + tileWidthPx]`
区间的 peak 列。无 scroll、无 progress（progress 由 overlay 承担）。

`drawWaveformPeaksViewport` 保留到 P3，仅供旧 `WaveformPeaksCanvas` 使用。

**1.5 接到 `EditorWaveformPane.tsx`**

```tsx
{isTileFlagEnabled() ? (
  <WaveformPeaksTileLayer
    peakCache={tx.peakCache}
    pxPerSec={tx.pxPerSec}
    timelineWidthPx={tx.timelineWidthPx}
    heightPx={innerWaveformHeightPx}
    scrollLeftPx={scrollLeftPx}
    viewportWidthPx={clientWidthPx}
  />
) : (
  <WaveformPeaksViewportLayer ... />  // 旧路径
)}
```

注意：tile layer 挂在 **inline-block 内容容器内部**（与 segments overlay 同级），
不是 tier 滚动容器内。

**P1 验收**：
- `npm run typecheck && npm run test && npm run lint && node scripts/check-architecture-guard.mjs` 全绿
- flag = true 下手测 4 路径无 regression
- flag = false 下旧路径行为不变

### P2 — Progress overlay 独立（0.5 天）

**2.1 落 `WaveformProgressOverlay.tsx`**

```tsx
export const WaveformProgressOverlay = memo(function WaveformProgressOverlay({
  pxPerSec, progressTimeSec, heightPx, timelineWidthPx,
}: Props) {
  const progressPx = Math.min(timelineWidthPx, Math.max(0, progressTimeSec * pxPerSec));
  if (progressPx <= 0) return null;
  return (
    <div
      className="pointer-events-none absolute left-0 top-0 z-[2]"
      style={{
        width: progressPx,
        height: heightPx,
        backgroundColor: COLORS.waveformProgress,
        mixBlendMode: "multiply",  // 或 "color"，按设计 token 决定
      }}
      aria-hidden
    />
  );
});
```

注意：用 `mix-blend-mode` 让 progress 色与下层 peaks 自然叠色，避免遮挡。

**2.2 改 `drawWaveformPeaksTile`**

删除 `color` 参数的 progress 分支，固定用 `waveColor`。`tile` 一次画好后只在
pxPerSec / peakCache 变化时重画，progressTimeSec 完全脱钩。

**2.3 挂载**

在 `EditorWaveformPane.tsx` 把 `<WaveformProgressOverlay>` 加在
`<WaveformPeaksTileLayer>` 旁边（同 inline-block 容器内）。

**P2 验收**：
- 播放时 peaks tile canvas 内容稳定不变（Chrome DevTools Performance 验证）
- progress 进度色覆盖正确
- 4 闸全绿

### P3 — 时序补丁清理（0.5 天）

按依赖顺序删除：

**3.1 `useTranscriptionViewportFit.ts`**
- 删除 `onTierScrollAdjusted` 参数 + 三处调用
- 删除 `useTranscriptionLayer` 内对应传入

**3.2 `useTranscriptionLayer.ts`**
- 删除 `const [peaksRepaintKey, setPeaksRepaintKey] = useState(0);`
- 删除 `useEffect(() => { if (peaks.peakCache) setPeaksRepaintKey(...) }, [peaks.peakCache]);`
- 删除返回值 `peaksRepaintKey`
- 删除 `applyPendingViewportFitRef.current` 里 `setPeaksRepaintKey` 调用
- **hook 数从 15 降到 14**

**3.3 `useWaveformZoomSync.ts`**
- 删除 `requestAnimationFrame(() => { ... ws.load ... })` 包装，改为直接调用
- 删除 `peaksLoadSeqRef` 在 rAF 内的 stale check（仍保留 zoomSyncInFlightRef）
- 评估：load 失败时的 fallback 路径是否依旧成立

**3.4 `EditorWaveformPane.tsx`**
- 删除 `repaintKey={tx.peaksRepaintKey}` 透传
- 删除 `readTierScrollLeftPx` / `readTierViewportWidthPx` 透传（tile 自包含）

**P3 验收**：
- 4 闸全绿
- guard hotspot warning 至少消除 2 条（`useTranscriptionLayer` 行数 + hooks 数）

### P4 — 删旧路径 + 文档（0.5 天）

- 删除 `WaveformPeaksViewportLayer.tsx` 和 `WaveformPeaksCanvas.tsx`（grep 确认无外部引用）
- 删除 `waveformPeaksCanvasDraw.ts` 内 `drawWaveformPeaksViewport`（旧入口）
- 删除 `waveformTileFlag.ts`（feature flag）
- 删除 `EditorWaveformPane.tsx` 内 flag 分支
- 更新 `docs/architecture/desktop-waveform-engine.md`：
  - 替换「Peaks layer 挂载契约」整段
  - 新增「Peaks tile lifecycle」段
- 更新 ADR-0004：`status: proposed` → `status: accepted`
- 跑全套 4 闸 + acceptance 手测 checklist
- commit msg 附验证证据

## 约束

- **不引入** `bg-[#...]` 等 Tailwind arbitrary hex；颜色仍走 `tokens.ts`
- **不引入** 第三方 tile 库（自写 ~280 行，依赖现有 PeakCache）
- **不引入** Web Worker / OffscreenCanvas（本轮不需要；如未来 16 tile cap 不够再评估）
- **不改** SQLite schema / Rust peaks 生成 / `.dat` 格式 / `PeakCache` API
- **不改** segments overlay / playhead / ruler 渲染路径
- 每个新文件 ≤ 200 行；任何 hook ≤ 12 useXxx 调用
- 每阶段独立可在 main 上回退（flag = false 走旧路径）

## 净复杂度账

| 文件 | 阶段前 | 阶段后 | 差 |
|---|---:|---:|---:|
| `useTranscriptionLayer.ts` | 343 行 / 15 hooks | ~320 行 / 14 hooks | **-23 / -1** |
| `EditorWaveformPane.tsx` | 304 行 | ~280 行 | **-24** |
| `useWaveformZoomSync.ts` | 207 行 | ~180 行 | **-27** |
| `useTranscriptionViewportFit.ts` | 268 行 | ~250 行 | **-18** |
| `WaveformPeaksViewportLayer.tsx` | 105 行 | 0（删） | **-105** |
| `WaveformPeaksCanvas.tsx` | 157 行 | 0（删） | **-157** |
| `waveformPeaksCanvasDraw.ts` | 71 行 | ~80 行 | +9 |
| **新增** `tileGeometry.ts` | — | ~80 行 | +80 |
| **新增** `useWaveformTileLifecycle.ts` | — | ~120 行 | +120 |
| **新增** `WaveformPeaksTileLayer.tsx` | — | ~80 行 | +80 |
| **新增** `WaveformProgressOverlay.tsx` | — | ~50 行 | +50 |
| **合计** | | | **-15 行 / -1 hook / -2 hotspot warning** |

新增代码全部符合现仓「按职责切刀」纪律：纯函数 / controller hook / 薄 UI。
不是 mega-hook 平移。

## 验证（每个 P 阶段都跑）

```bash
npm run typecheck && npm run test && npm run lint && node scripts/check-architecture-guard.mjs
```

P1+ 额外：

```bash
# tile geometry / lifecycle 专项
npx vitest run apps/desktop/src/services/waveform/tileGeometry.test.ts
npx vitest run apps/desktop/src/hooks/useWaveformTileLifecycle.test.ts
```

## 能力—UI 状态矩阵

本任务为编辑器波形渲染重构，**不涉及** ASR/环境 Setup 能力矩阵；无 D1–D5 控件变更。
