# Intent: waveform_content_tile_renderer

> 决策依据：[ADR-0004](../../../../adr/0004-waveform-peaks-content-tile-renderer.md)
> 完整阶段方案：[`waveform-content-tile-renderer-plan.md`](./waveform-content-tile-renderer-plan.md)
> 验收：[`waveform-content-tile-renderer-acceptance.md`](./waveform-content-tile-renderer-acceptance.md)

## 目标

把桌面端主波形 peaks 渲染从「viewport-fixed canvas + 手动 sticky」切换到
**「content-tile canvas」**（WaveSurfer v7 / Peaks.js / Audacity Web 同款），
彻底消除 sticky 同步、scroll listener 时序、`peaksRepaintKey` 强刷这条补丁链。

## 为什么现在做

1. **现行补丁链已不可持续**。2026-05 的 peaks 渲染问题（滚后部空白、切语段空白、
   sticky 闪一下消失）经过 5 轮修复，结构已堆叠 5 条相互依赖的时序补丁
   （手动 sticky、`peaksRepaintKey`、`onTierScrollAdjusted`、`ws.load` rAF 包装、
   `useLayoutEffect` 依赖陷阱）。任意一处 layout 调整都可能再次破坏。
2. **架构守卫已亮红灯**。`useTranscriptionLayer` 343 行 / 15 hooks，
   `EditorWaveformPane` 304 行，均超阈值；继续在该路径加补丁会触发硬上限。
3. **业内方案早已收敛**。WaveSurfer v7（同样选 audiowaveform `.dat` 数据层）
   官方 renderer 就是 content-tile；Peaks.js (BBC)、Audacity Web 仿品一致。
   我们前期已经走对了数据层（PeakCache + .dat），但渲染层选了脆弱的范式 B。
4. **本轮不做，下次架构动一动就会重新爆炸**。propagation cost 已经到了
   「修一个 bug 需要协调 3 个 hook + 1 个 component」的程度。

## 用户任务（不变）

1. 打开含音频项目 → 主波形 peaks 在 peaks 就绪后**尽快可见**，且**任意位置**
   滚动 / 缩放 / 切换语段后都保持可见。
2. 缩放滑块、fit 全段 / 选中语段、播放头、segments 拖拽、播放/seek 行为
   **与现版完全一致**。
3. 性能不退化（实测目标见 acceptance）。

## 目标内范围（分阶段，详见 plan）

### P0 — Spike 验证（0.5 天，**feature 分支直接跑，不开 worktree**）

- 在 feature flag `RUSHI_WAVEFORM_TILE_RENDERER` 后挂 `WaveformPeaksTileLayer` 雏形
- 单 channel、tile 宽 = `min(8000, max(viewport * 2, 4096))`、cap = 16、无 progress overlay
- 走通 load / zoom / scroll / 切语段四条路径
- 产出：spike 报告 + 是否进入 P1 的 Go/No-Go
- **flag 默认 true**（激进推进；regression 时 localStorage 切回 false）

### P1 — 主体替换（2 天）

- 新增：`tileGeometry.ts` / `useWaveformTileLifecycle.ts` / `WaveformPeaksTileLayer.tsx`
- 改造：`waveformPeaksCanvasDraw.ts` 增加 `drawWaveformPeaksTile` 入口（不依赖 scrollLeftPx）
- 改造：`EditorWaveformPane.tsx` 把 peaks 层挂到 inline-block 内容容器内
- 旧 `WaveformPeaksViewportLayer` **保留**，由 flag 切换

### P2 — Progress overlay 独立（0.5 天）

- 新增：`WaveformProgressOverlay.tsx`（absolute div + width 表示进度，不重画 peaks）
- 删除：`drawWaveformPeaksTile` 的 progress 参数

### P3 — 时序补丁清理（0.5 天）

- 删除：`useTranscriptionLayer` 的 `peaksRepaintKey` state
- 删除：`useTranscriptionViewportFit` 的 `onTierScrollAdjusted` 回调
- 删除：`useWaveformZoomSync` 内 `requestAnimationFrame` 包装 `ws.load`
- 验证 4 闸全绿

### P4 — 删旧路径 + 文档（0.5 天）

- 删除：`WaveformPeaksViewportLayer.tsx` / `WaveformPeaksCanvas.tsx`（如无外部引用）
- 移除 feature flag
- 更新 `docs/architecture/desktop-waveform-engine.md`、`docs/adr/0004` 状态 → accepted
- 跑全套 4 闸 + 手测 checklist

## 明确不做（本轮）

- **不改 segments overlay / playhead / ruler**（它们已是 DOM/absolute，与 tile 范式兼容）
- **不改 WaveSurfer 播放后端**（仍负责 MediaElement + seek + decode 回退）
- **不改 PeakCache / `.dat` 数据层**（数据接口稳定）
- **不改 `WaveformOverviewStrip` 全局缩略条**（独立渲染路径，不在本轮范围）
- **不改 ASR / 环境 Setup 能力矩阵**
- **不引入 WebGL / WebGPU / Shadow DOM**
- **不做多 channel split** （未来若加 stereo split，tile 模型天然支持，本轮不实现）

## 边界决策

```text
现状
  WaveformPeaksViewportLayer (absolute + 手动 sticky)
    └─ WaveformPeaksCanvas (viewport-sized, rAF/帧)
        └─ drawWaveformPeaksViewport(ctx, peaks, { scrollLeftPx, viewportWidthPx, progressTimeSec, ... })

目标
  WaveformPeaksTileLayer (inside inline-block content container)
    ├─ useWaveformTileLifecycle (lazy create/evict, LRU cap=10)
    └─ N × WaveformPeaksTile (absolute, left=tileLeftPx, width=tileWidthPx)
        └─ drawWaveformPeaksTile(ctx, peaks, { tileLeftPx, tileWidthPx, pxPerSec, height, color })

  WaveformProgressOverlay (absolute div, width=progressPx, 颜色 mix)
```

## 成功标准（详见 acceptance）

- **行为零回归**：4 闸全绿 + 手测 checklist 全通过
- **复杂度净降**：架构 guard hotspot warning **减少** ≥ 2 条
- **代码净降**：peaks 渲染相关行数 ≤ 现状 -50 行（含新增 tile 生命周期）
- **性能不退化**：1 小时 mp3 在 4 / 16 / 56 / 200 px/s 下首屏 peaks ≤ 200ms 可见；
  播放时 peaks 层 CPU < 5%（spot check via Chrome perf）
- **彻底消除以下问题**（手测脚本归零）：
  - 滚到长音频后部 peaks 空白
  - 切语段后 peaks 空白
  - 拖 zoom 时 peaks 闪烁
  - sticky 在异常 layout 下失效

## 依赖与前置

- 现有 `PeakCache` / `audiowaveform_dat.ts` / `useWaveformPeaks` 不动
- 现有 `useTierScrollSync` 不动
- 现有 `useWaveformZoom` / `useWaveformZoomSync` 仅在 P3 清理时序补丁
- ADR-0004 状态由 `proposed` → `accepted` 在 P4 完成后落

## 复杂度账（plan 会展开核算）

| 项 | 现状 | 目标 | 净变化 |
|---|---|---|---|
| `useTranscriptionLayer.ts` | 343 行 / 15 hooks | 320 行 / 14 hooks | -23 行 / -1 hook |
| `EditorWaveformPane.tsx` | 304 行 | ~280 行 | -24 行 |
| `useWaveformZoomSync.ts` | 207 行 | ~180 行 | -27 行 |
| `useTranscriptionViewportFit.ts` | 268 行 | ~250 行 | -18 行 |
| `WaveformPeaksViewportLayer.tsx` | 105 行 | **删除** | -105 行 |
| `WaveformPeaksCanvas.tsx` | 157 行 | **删除** | -157 行 |
| `waveformPeaksCanvasDraw.ts` | 71 行 | ~80 行（tile 入口） | +9 行 |
| **新增** `tileGeometry.ts` | — | ~80 行 | +80 行 |
| **新增** `useWaveformTileLifecycle.ts` | — | ~120 行 | +120 行 |
| **新增** `WaveformPeaksTileLayer.tsx` | — | ~80 行 | +80 行 |
| **新增** `WaveformProgressOverlay.tsx` | — | ~50 行 | +50 行 |
| **净变化** | | | **-15 行 / -1 hook / -2 hotspot** |

不仅复杂度净降，**而且每一个新文件都符合现仓「按职责切刀」纪律**：纯函数（geometry）/ controller hook（lifecycle）/ pure UI（layer + overlay），不会出现「mega-hook 平移」。
