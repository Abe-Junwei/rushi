# Acceptance: waveform_content_tile_renderer

> Intent：[`waveform-content-tile-renderer-intent.md`](./waveform-content-tile-renderer-intent.md)
> Plan：[`waveform-content-tile-renderer-plan.md`](./waveform-content-tile-renderer-plan.md)
> ADR：[ADR-0004](../../../adr/0004-waveform-peaks-content-tile-renderer.md)

## 总体闸门

### 机器闸门（每个 P 阶段必跑）

```bash
npm run typecheck \
  && npm run test \
  && npm run lint \
  && node scripts/check-architecture-guard.mjs
```

四闸全绿才允许进下一阶段。

### 复杂度闸门（P4 完成后）

```bash
node scripts/check-architecture-guard.mjs
```

- `useTranscriptionLayer.ts` 行数 / hooks 数：**至少消除一条 hotspot warning**
- `EditorWaveformPane.tsx` 行数：**至少消除一条 hotspot warning**
- 不引入任何新的 hotspot warning

### 行数闸门（P4 完成后）

```bash
# 受影响文件净行数变化
git diff --stat main -- \
  apps/desktop/src/components/WaveformPeaks*.tsx \
  apps/desktop/src/components/WaveformProgress*.tsx \
  apps/desktop/src/components/editor/EditorWaveformPane.tsx \
  apps/desktop/src/hooks/useWaveformTileLifecycle.ts \
  apps/desktop/src/hooks/useWaveformZoomSync.ts \
  apps/desktop/src/pages/useTranscriptionLayer.ts \
  apps/desktop/src/pages/useTranscriptionViewportFit.ts \
  apps/desktop/src/services/waveform/tileGeometry.ts \
  apps/desktop/src/services/waveform/waveformPeaksCanvasDraw.ts
```

**目标**：净减少 ≥ 15 行（含新增 tile 生命周期）。

## 阶段闸门

### P0 — Spike Go/No-Go

worktree 内手测四路径，每路径独立判定：

| # | 路径 | 通过标准 |
|---|---|---|
| P0.1 | 打开 10min mp3 → peaks 可见 | flag = true 下首屏 peaks 出现，flag = false 下行为不变 |
| P0.2 | zoom 滑块从最小拖到最大 | 全程 peaks 可见，可有抖动但不允许长时间空白（> 500ms） |
| P0.3 | 横滚到末尾 | 末尾 30 秒区间 peaks 完整可见，无空白 |
| P0.4 | 点击 segments list 第 5/10/末段切换 | 切换后所选段 peaks 立即可见 |

**Go 条件**：4 路径全过 → 写 spike 报告，记录 tile 数 / FPS / 内存增量，进入 P1。
**No-Go 条件**：任一路径 regression → 写 spike 报告分析根因，决定回到方案 B 优化或调整 tile 策略再 spike。

### P1 — 主体替换签收

机器闸门必须全绿，加上：

| # | 项 | 通过标准 |
|---|---|---|
| P1.M1 | `tileGeometry.test.ts` | 覆盖：空 timeline / 单 tile / 多 tile / 边界对齐 / DPR=2 |
| P1.M2 | `useWaveformTileLifecycle.test.ts` | 覆盖：LRU evict / cap=16 / pxPerSec 变化 invalidate / peakCache null |
| P1.M3 | 旧 `waveformPeaksCanvasDraw.test.ts` | `drawWaveformPeaksViewport` 测试保留不变（仍在用） |
| P1.H1 | flag = true（默认）下手测 P0 四路径 | 全通过 |
| P1.H2 | localStorage 强切 flag = false 后刷新 | 行为与 main 完全一致（验证回滚路径） |
| P1.H3 | flag = true + 1 小时长音频 | 横滚全程 peaks 可见，cap=16 触发后无视觉抖动（< 16ms） |

### P2 — Progress overlay 独立签收

| # | 项 | 通过标准 |
|---|---|---|
| P2.M1 | `WaveformProgressOverlay.test.tsx`（可选） | width = `progressTime * pxPerSec`，clamp 到 `timelineWidthPx` |
| P2.H1 | 播放 1 分钟期间 Chrome DevTools Performance | peaks tile canvas 内容稳定不变（仅 progress overlay width 在变） |
| P2.H2 | seek 到任意位置 | progress overlay width 立即更新，peaks tile 不重画 |
| P2.H3 | playback rate 0.5x / 2x | 行为正常，CPU 不上涨 |

### P3 — 时序补丁清理签收

| # | 项 | 通过标准 |
|---|---|---|
| P3.M1 | `useWaveformZoomSync.test.ts` | 去掉 `flushZoomFrames()` 后所有测试仍通过（因为 rAF 包装已删） |
| P3.M2 | grep `peaksRepaintKey` | 仓库内 0 匹配 |
| P3.M3 | grep `onTierScrollAdjusted` | 仓库内 0 匹配 |
| P3.H1 | 拖 zoom 滑块连续滑动 | peaks 全程可见，无闪烁 |
| P3.H2 | `viewport-fit` 触发场景（fit selection / 缩放） | 完成后 peaks 立即可见，无补丁回调路径 |
| P3.H3 | 在 follow 模式下连续切语段 | peaks 全程可见 |

### P4 — 删旧路径签收

| # | 项 | 通过标准 |
|---|---|---|
| P4.M1 | grep `WaveformPeaksViewportLayer` | 仓库内 0 匹配（含 import / test） |
| P4.M2 | grep `WaveformPeaksCanvas` | 仓库内 0 匹配 |
| P4.M3 | grep `drawWaveformPeaksViewport` | 仓库内 0 匹配 |
| P4.M4 | grep `RUSHI_WAVEFORM_TILE_RENDERER` | 仓库内 0 匹配（flag 删除） |
| P4.M5 | guard 报告 | hotspot warning 数 ≤ 当前 -2 条 |
| P4.D1 | `docs/architecture/desktop-waveform-engine.md` | 已替换「Peaks layer 挂载契约」段为 tile 范式 |
| P4.D2 | ADR-0004 | `status: proposed` → `status: accepted` |
| P4.H1 | 完整手测脚本（下文 §手测路径） | 全通过 |
| P4.H2 | commit msg | 附 4 闸输出 + 手测签收记录 |

## 手测路径（每个 P 阶段必跑相关条目）

### 基础打开

| # | 操作 | 期望 |
|---|---|---|
| H.B1 | 打开新项目导入 1min wav | peaks 出现 < 1s |
| H.B2 | 打开含 10min mp3 项目 | peaks 出现 < 1s（不必等全 decode） |
| H.B3 | 打开含 1h mp3 项目 | peaks 首屏可见 < 2s |
| H.B4 | 打开无音频文件项目 | 不崩溃，提示"无音频" |

### 缩放

| # | 操作 | 期望 |
|---|---|---|
| H.Z1 | 滑块从 min 拖到 max | 全程 peaks 可见，无长时间空白 |
| H.Z2 | 双击 zoom 重置 | peaks fit 到全长可见 |
| H.Z3 | 选中语段 + fit 按钮 | 选中段被 fit，peaks 可见 |
| H.Z4 | 选中段 + follow 模式自动 fit | peaks 可见 |
| H.Z5 | 缩放到 200 px/s 后横滚 | 全程 peaks 可见，包括末尾 |

### 横向滚动

| # | 操作 | 期望 |
|---|---|---|
| H.S1 | 滚到 timeline 开头 | peaks 可见 |
| H.S2 | 滚到 timeline 中段 | peaks 可见 |
| H.S3 | 滚到 timeline 末尾 | peaks 可见 |
| H.S4 | 连续滚动来回 5 次 | 无空白帧、无闪烁、tile 切换不可见 |
| H.S5 | 按 Tab 切下一段（manual 模式） | peaks 可见 |

### 播放

| # | 操作 | 期望 |
|---|---|---|
| H.P1 | 从 0 播放 30s | progress overlay 平滑前进，peaks 不重画 |
| H.P2 | 播放中 seek 到中段 | progress 立即更新到目标位置 |
| H.P3 | 播放中切换 speed 0.5x / 2x | 行为正常 |
| H.P4 | 选中语段循环播放 | 行为正常，循环边界 progress 重置 |
| H.P5 | 切换语段播放（segment play） | 进度条对应切换后的语段 |

### 切语段（最高风险路径）

| # | 操作 | 期望 |
|---|---|---|
| H.C1 | 在 follow 模式下点击 segments list 第 5 段 | peaks 立即可见，且 fit 到该段 |
| H.C2 | 在 manual 模式下点击 segments list 第 5 段 | peaks 立即可见，可能不 fit |
| H.C3 | 在 follow 模式下连续点 1→末→1 | 全程 peaks 可见，无空白闪烁 |
| H.C4 | 跨大跨度切换（第 1 → 第 100 段） | peaks 立即可见 |

### 边界与回归

| # | 操作 | 期望 |
|---|---|---|
| H.E1 | 拖语段边界改变 start_sec | 行为不变，peaks 不闪 |
| H.E2 | split / merge 语段 | 行为不变 |
| H.E3 | DPR 切换（拖窗口到外接屏） | peaks 清晰，不模糊 |
| H.E4 | 拖动 waveform 高度 | peaks 重生成，可见 |
| H.E5 | 折叠/展开全局缩略条 | 主区 peaks 不受影响 |
| H.E6 | 关闭再打开同一项目 | 行为一致 |
| H.E7 | 关闭项目打开另一项目 | peaks 重新加载，可见 |

## 性能预期（spot check）

非硬指标，但显著退化必须复审：

| 场景 | 现状（范式 B） | 目标（范式 A） |
|---|---|---|
| 静止 idle（无播放） | rAF 持续触发，CPU ~ 1-3% | rAF 不触发，CPU ~ 0% |
| 播放中（peaks 区域） | rAF 60Hz 重画 viewport，CPU ~ 3-5% | progress overlay 仅 width 更新，CPU ~ 1% |
| 拖 zoom 滑块 | 每帧重画 viewport + 强刷 | tile invalidate 一次，重画 visible tiles |
| 横滚 1h 长音频末尾 | 多次 repaintKey 强刷 | visible tile 自然 swap-in |

工具：Chrome DevTools Performance → Record 10s → 检查 `WaveformPeaksTileLayer` 占比。

## 回滚条件

任意阶段出现以下情况，**立即停止该阶段、保留 flag = false 行为、写回滚报告**：

1. P0 spike 四路径任一未过 → 不进入 P1
2. P1 H1 / H2 / H3 任一未过 → 留 flag，flag = false 走旧路径，分析后再决定
3. P2 H1（播放时 peaks tile 仍重画）未过 → 检查是否漏拆 progress 参数
4. P3 H1 / H2 / H3 任一未过 → **不删旧路径**，先修
5. P4 之后任一手测路径出现 main 之前没有的 regression → revert P4 的删除 commit，保留双路径再排查

## 能力—UI 状态矩阵

本任务为编辑器波形渲染重构，**不涉及** ASR/环境 Setup 能力矩阵；无 D1–D5 控件变更。

理由：peaks 渲染层 100% 来自前端本地 `PeakCache` + `pxPerSec`，无外部能力依赖；
所有 UI 状态（loading / error / hint）均不改动。
