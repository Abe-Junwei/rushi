---
adr: "0004"
title: 桌面端波形 peaks 渲染 — 切换到 content-tile 范式（WaveSurfer v7 同款）
status: superseded
superseded_by: docs/architecture/desktop-waveform-engine.md
superseded_date: 2026-05-29
---

# ADR-0004：桌面端波形 peaks 渲染 — 改用 content-tile 范式

> **Superseded（2026-05-29）**：content-tile canvas 路径已移除；现行见 [`desktop-waveform-engine.md`](../architecture/desktop-waveform-engine.md)。本 ADR 与 [`archive/waveform-pre-ws-only-2026-05/`](../execution/specs/archive/waveform-pre-ws-only-2026-05/README.md) 仅作决策史。

## 上下文

桌面端转写编辑器的主波形 peaks 当前由 `WaveformPeaksViewportLayer` + `WaveformPeaksCanvas` 渲染，采用**「viewport-fixed canvas」范式**：

- 一个与 viewport 等宽的 `<canvas>` 通过手动 sticky（`position:absolute` + `transform:translateX(scrollLeft)`）钉在 tier 滚动容器左边
- 每帧 rAF 重画当前可见时间窗
- 通过 `peaksRepaintKey` 强刷以应对 `viewport-fit`、`ws.load`、`programmatic scroll` 时序

2026-05 多轮排查（详见 [`desktop-waveform-engine.md`](../architecture/desktop-waveform-engine.md) §Peaks layer 挂载契约）暴露出该范式的**固有难点**：

| 现象 | 现行补丁 | 根因 |
|---|---|---|
| `position:absolute` 在 `overflow-x:auto` 内随内容滚出视口 | 手动 `transform:translateX` | absolute 元素必须脱离内容流又要呈现内容 |
| CSS sticky 在 `inline-block + width:0` 退化形式下闪一下失效 | 改为手动 sticky | sticky 在 inline 上下文行为不稳定 |
| `useLayoutEffect` 漏 `active / peakCache` 依赖导致 scroll listener 不绑 | 补全依赖 | 任何 sticky 同步逻辑都依赖 listener 时机 |
| 切语段后 canvas 空白 | `onTierScrollAdjusted` 回调 → `setPeaksRepaintKey` | viewport-fit 完成 / scroll layout / canvas 重绘三方时序 |
| `ws.load` 与 `viewport-fit` 竞态 | `requestAnimationFrame` 包装 `ws.load` | 同一帧内多个动作都依赖 scroll layout 落定 |

这五条补丁形成相互依赖链路，**每加一条都让排错面更大**，下一次 layout 重构（容器嵌套、Tailwind class 调整）极可能再次破坏。

业内成熟方案（详见 docs/architecture/desktop-waveform-engine.md 末尾的「业内方案对照」）只有两条路：

| 范式 | 代表 | DOM 模型 |
|---|---|---|
| **A. content-tile** | WaveSurfer.js v7（核心）、Peaks.js（BBC）、Audacity Web 仿品 | Canvas 是 timeline 内容的一部分，切成多块固定区间 tile，跟内容自然滚动 |
| **B. viewport-fixed** | Konva 大舞台、Rushi 当前 | Canvas 永远 viewport 大小，靠 transform 跟视口走 |

范式 B 的所有难点（sticky / scroll listener 时序 / repaint key）在范式 A **均不存在**：canvas 在内容坐标里，scroll 是浏览器自然行为，无需 JS 同步。

## 决策

**采纳范式 A（content-tile）作为桌面端波形 peaks 的渲染架构**。

具体形态（参见 [`waveform-content-tile-renderer-plan.md`](../execution/specs/archive/waveform-pre-ws-only-2026-05/waveform-content-tile-renderer-plan.md)）：

1. peaks 层挂在 tier 滚动容器**内部**，作为 inline-block 内容容器的子元素（与 segments overlay 同级），不再脱离内容流
2. 单 tile 宽度 `min(8000, max(viewport * 2, 4096))`，DPR 缩放在 canvas backing store
3. 同时存活的 tile 数上限 16（LRU 淘汰，比 WaveSurfer `MAX_NODES=10` 略宽，应对长音频高 zoom 滚动）
4. tile 内容只画自己时间区间，**不再依赖 `scrollLeftPx`**
5. progress（已播放/未播放变色）由独立 `WaveformProgressOverlay` 用 absolute div + 单次 width 更新承担，peaks tile 自身不重画
6. zoom / peakCache 变化 → 清空所有 tile，下一批 visible tile 重新生成

## 明确不做（本 ADR 有效期内）

- **不替换 segments overlay / playhead / ruler 渲染路径**（它们已是 DOM/absolute，跟 tile 范式天然兼容）
- **不替换 WaveSurfer 播放后端**（仍负责 MediaElement + seek）
- **不替换 PeakCache / audiowaveform `.dat` 数据层**（只换"画"的方式）
- **不引入 WebGL/WebGPU**（2D Canvas 在 tile 模式下已足够；上限是 GPU spike 的事情）
- **不引入 Shadow DOM 隔离**（不抵 React + Tailwind 体系的迁移成本）
- **不动 `WaveformOverviewStrip`**（全局缩略条独立路径，本轮不评估）

## 后果

### 正面

- 删除整条「手动 sticky 同步」链路（约 -80 行：`WaveformPeaksViewportLayer` 的 useLayoutEffect、`peaksRepaintKey` state、`onTierScrollAdjusted` 回调、`useWaveformZoomSync` 内 rAF 包装）
- `useTranscriptionLayer` hook 数从 15 → 14（脱离 hotspot warning）
- `EditorWaveformPane` 从 304 行降到接近 280 行（脱离 hotspot）
- 闲时 CPU 占用接近 0（不再每帧 rAF 重画）
- 播放/拖动时 CPU 下降（只重画 progress overlay 的 width，不动 canvas）
- 下次任何容器结构调整（flex / grid / Tailwind 重命名）**不再可能**破坏 peaks 可见性

### 负面 / 风险

- 引入 tile 生命周期管理（新增约 +150 行 + tests），但**净行数仍下降**
- 长音频 + 高 zoom 下 tile 切换可能出现 < 16ms 抖动（cap 不够时）
  - 缓解：cap 已设 16；tile 宽度按 viewport × 2 自适应
- 相邻 tile 在 1 px 边界处可能错位（peak 列对齐问题）
  - 缓解：tile 宽度强制按 `barWidth + barGap` 倍数对齐
- 改动面较大（peaks layer 全替换 + 时序补丁清理 + 测试重写）
  - 缓解：分 5 个 P 阶段，每阶段独立可回退（详见 plan）

### 回滚

P4（2026-05）已删除旧 viewport-fixed 路径与 `RUSHI_WAVEFORM_TILE_RENDERER` flag。回滚需 git revert 对应 commit，不再支持 runtime 切换。

## 验证标准

详见 [`waveform-content-tile-renderer-acceptance.md`](../execution/specs/archive/waveform-pre-ws-only-2026-05/waveform-content-tile-renderer-acceptance.md)。关键闸门：

| 阶段 | 完成标准 |
|---|---|
| P0 Spike | 单 channel tile 渲染跑通 load/zoom/scroll/切语段四条路径，无 sticky |
| P1 主体 | 旧 layer 与新 layer 并存，feature flag 可切；新路径下 4 闸全绿 |
| P2 Progress 独立 | peaks tile 不再依赖 progressTimeSec；播放时 CPU < 5%（spot check） |
| P3 时序清理 | `peaksRepaintKey` / `onTierScrollAdjusted` / `ws.load` rAF 包装均移除，4 闸全绿 |
| P4 删除旧路径 | `WaveformPeaksViewportLayer` 删除，文档更新，guard hotspot 解除 |

## 参考

- [WaveSurfer.js v7 renderer.ts](https://github.com/katspaugh/wavesurfer.js/blob/main/src/renderer.ts) — `MAX_NODES`/`MAX_CANVAS_WIDTH`/`getLazyRenderRange` 实现
- [Peaks.js（BBC）](https://github.com/bbc/peaks.js/) — 同样的 content-tile 思路
- [Konva 大画布滚动 demo](https://konvajs.org/docs/sandbox/Canvas_Scrolling.html) — 范式 B 的另一种实现（对照）
- [Virtualizing The Canvas (gedge.ca)](https://gedge.ca/blog/2024-11-03-virtualizing-the-canvas/) — virtual canvas 通用方法学
- 历史实现（已删除）：`WaveformPeaksTileLayer`；现行见 [`desktop-waveform-engine.md`](../architecture/desktop-waveform-engine.md)
