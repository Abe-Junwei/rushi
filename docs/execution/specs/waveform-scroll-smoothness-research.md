# 调研：波形横向滚动顺滑度（tier scroll 同步链路）

> **状态**：规划门禁（2026-06-18）  
> **触发**：手测波形 tier 横向滚动（触控板 / 滚轮 / 播放跟随）不够顺滑；已做一轮 imperative 优化（见 §1.3），需对照业内成熟路线定下一薄片。  
> **关联**：[`desktop-waveform-engine.md`](../../architecture/desktop-waveform-engine.md)、[ADR-0005](../../adr/0005-waveform-single-scroll-authority.md)（已 superseded，scroll 真源结论仍有效）、[`segment-overlay-virtualization.md`](./segment-overlay-virtualization.md)、[`waveform-maturity-product-research.md`](./archive/waveform-pre-ws-only-2026-05/waveform-maturity-product-research.md)  
> **门禁**：后续 Plan / acceptance **须链接本文**后再编码（`.cursor/rules/feature-research-gate.mdc`）

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | 转写编辑器中横向浏览长音频波形：触控板惯性滚动、滚轮、minimap 跳转、播放时 center/edge 跟随；期望 DAW / 剪辑器级「跟手」、无明显 jitter 或层间错位。 |
| **本仓现状** | **Scroll 真源**：`tierScrollRef.scrollLeft`（[`EditorWaveformPane`](../../../apps/desktop/src/components/editor/EditorWaveformPane.tsx) `overflow-x-auto`）。**Sticky 视口 + transform 镜像**：波形 / overlay 在 sticky 壳内，经 `positionWaveformScrollLayersByTierScroll`（`translate3d`）与 tier 同步；WaveSurfer `autoScroll: false`（[`useProjectWaveformMount`](../../../apps/desktop/src/hooks/useProjectWaveformMount.ts)）。**编排**：`useTierScrollSync` + `useTierScrollLayout`（burst 后 commit React layout）+ 原生 scroll listener 同步 WS；`WaveformSegmentBandCanvas` 视口 Canvas 全 packable 语段重绘；ruler / playhead / minimap 经 `resolveTierViewportMetrics` 读 live ref。**近期补丁**（2026-06-18）：滚动 burst 内推迟 `setState`、原生 listener 优先 mirror、transform 去重。 |
| **成功标准** | 手测：30min+ 音频、100+ zoom，触控板惯性滚动 FPS 主观顺滑、波形/语段带/ruler 无 1px+ 漂移；DevTools Performance 滚动 1s 内 React commit 次数显著低于 scroll 事件数；现有 E2E + `useTierScrollSync.test.ts` / `useTierScrollLayout.test.ts` 仍绿。 |

### 1.1 架构示意（Rushi 现行）

```text
tierScrollRef (browser scroll, 真源 scrollLeft)
  └─ wide stage (timelineWidthPx)
       └─ sticky viewport (clientWidth)
            ├─ waveformScrollLayer  ← translate3d(-scrollLeft)  [imperative]
            ├─ WaveformSegmentBandCanvas  ← 每 scroll rAF 全量 band 重绘
            ├─ overlayScrollLayer     ← translate3d(-scrollLeft)
            └─ WaveformLiveTimeRuler  ← translate3d track + tick rebuild
WaveSurfer host (WAVEFORM_WS_HOST_WIDTH_PX 宽) — 不参与 browser scroll
```

### 1.2 与「单 scroll 真源」的关系

[`desktop-waveform-engine.md`](../../architecture/desktop-waveform-engine.md) 明确：**tier 为 UI scroll 真源**，WS 仅 mirror（`syncWaveSurferScrollPx`）。这与 WaveSurfer 默认「内部 scrollContainer 驱动一切」不同，是本仓有意偏离（避免 tier↔WS 反馈环，见 ADR-0005 归档说明）。

### 1.3 已做优化（非终态）

| 改动 | 文件 | 意图 |
|------|------|------|
| 滚动 burst 内只更新 live ref，停止 ~120ms 后再 commit layout | `useTierScrollLayout.ts` | 减少惯性滚动时 React 重渲染 |
| 原生 `scroll` listener 同步 transform（移除 React `onScroll`） | `useTierScrollSync.ts`, `EditorWaveformPane.tsx` | mirror 与 DOM scroll 同帧 |
| transform 字符串缓存，相同值跳过 CSP 写入 | `waveformSurferProgressCoverage.ts` | 降低 style registry 开销 |

---

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表实现 / 产品 | 核心机制 | 链接或路径 |
|---|------|-----------------|----------|------------|
| **A** | **单容器原生 scroll + 渲染器内虚拟化** | [WaveSurfer.js v7](https://github.com/katspaugh/wavesurfer.js) Renderer | 一个 `scrollContainer`（`overflow-x: auto`）；波形切成 ≤10 块 canvas（`MAX_NODES`），滚动时 lazy range 绘制 / 清除离屏节点；progress 用 `clipPath` + wrapper width **不重绘波形**；`autoScroll` / `autoCenter` 直接写 `scrollLeft` | [`renderer.ts`](https://github.com/katspaugh/wavesurfer.js/blob/main/src/renderer.ts)、[Performance 文档](https://wavesurfer.xyz/docs/performance/)、[#3696 虚拟化 cap](https://github.com/katspaugh/wavesurfer.js/issues/3696) |
| **B** | **逻辑 frameOffset（非 browser scroll 驱动画布）** | [BBC Peaks.js](https://github.com/bbc/peaks.js) ZoomView | `getFrameOffset()` 表视口起点像素；`scrollWaveform({ pixels })` 改 offset 后 **命令式重绘 canvas**（Konva）；overview 与 zoomview 共享 peaks 数据、独立 resample；`zoomview.update` 同步视口；播放 auto-scroll 到边缘触发 offset 变更 | [API: scrollWaveform / enableAutoScroll](https://github.com/bbc/peaks.js/blob/master/doc/API.md)、[#343 zoomview.update](https://github.com/bbc/peaks.js/issues/343)、[waveform-data.js](https://github.com/bbc/waveform-data.js) |
| **C** | **原生 DAW：时间坐标 scroll + 固定 playhead** | Audacity 3.x | `ViewInfo.hpos`（可见区左缘时间）；**Pinned / Continuous scrolling**：playhead 固定于视口中部，**波形数据相对 hpos 平移**；`Viewport::DoScroll` 触发 TrackPanel 重绘；多级 summary（类 mip-map）保证任意缩放下滚动廉价 | [Viewport.cpp](https://doxy.audacityteam.org/_viewport_8cpp_source.html)、[ViewInfo](https://doxy.audacityteam.org/class_view_info.html)、[Timeline 手册（Pinned playhead）](https://manual.audacityteam.org/man/timeline.html) |
| **D** | （对照）**预计算 peaks + 专业宿主** | Adobe Audition | 导入时生成 `.pkf` peaks；时长信 audio 容器；原生/GPU 混合绘制；scroll 与宿主 timeline 一体，**无 React 层** | 产品文档 / 行业惯例（与 Rushi `.dat` 同理念，见 [`waveform-maturity-product-research.md`](./archive/waveform-pre-ws-only-2026-05/waveform-maturity-product-research.md) §2.4） |
| **E** | （对照）**文本为主、波形为辅** | Descript | 词级时间线 + 底部辅助波形；滚动心智在 transcript，波形 scroll 非主路径 | 产品观察（技术栈推断 Electron + Canvas，细节闭源） |

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用的部分 | 与 Rushi 约束冲突 | 进度 / 内存 / 运维 |
|------|--------|----------------|-------------------|---------------------|
| **A WS 原生 scroll** | **中** | Lazy canvas cap、progress 不重绘、scroll 时 append/remove 节点策略；[Timeline 虚拟化 PR #3748](https://github.com/katspaugh/wavesurfer.js/pull/3748)「仅 visibility 变化时改 DOM」 | **tier 已是 UI 真源**；Rushi 把 WS host 拉宽到 `WAVEFORM_WS_HOST_WIDTH_PX` 且 `autoScroll: false`，**不能**简单改回 WS 内部 scroll 驱 UI（会复活 ADR-0005 反馈环） | WS lazy 降 DOM；但 bar 样式 + 虚拟化仍有 jitter 报告 ([#3844](https://github.com/katspaugh/wavesurfer.js/issues/3844)) |
| **B Peaks frameOffset** | **中** | **滚动 burst 内只改 offset、idle 再通知 UI**；单一 `zoomview.update` 事件；wheel `setWheelMode('scroll')` 与 Rushi `useWaveformTierWheelForward` 同类 | Peaks **不用** sticky + browser scroll + transform 三层；改为 **单 canvas 命令式** → 需大改 stage DOM，与现有 WS-only 引擎冲突 | 单 canvas 重绘成本随 zoom 宽度升；Peaks 用 resample 缓存缓解 |
| **C Audacity hpos + pinned** | **高（模式）** | **播放跟随 = 固定 playhead、移视口**（Rushi 已有 `center` / `edge`：`useWaveformPlaybackScrollFollow`）；scroll 时 **禁止 React 树 churn**，整帧 imperative repaint | 原生 C++ 无 React；Rushi 须用 live ref + rAF 模拟 | Audacity 靠 summary mip-map；Rushi 靠 `.dat` + WS peaks，长音频内存已预计算 |
| **D Audition .pkf** | **低（scroll 层）** | peaks 文件与时长分离（已对齐） | 不涉及 Web scroll 架构 | — |
| **E Descript** | **低** | 文本列表虚拟化（Rushi `EditorSegmentList` 已有） | 波形 scroll 非对标目标 | — |

**本仓已有、必须先复用再扩展的模块：**

- `useTierScrollSync` / `tierScrollProgrammaticWrites` — programmatic coalesce + `deferLayoutCommit`（播放跟随）
- `resolveTierViewportMetrics` — overlay / minimap / ruler 统一读路径
- `positionWaveformScrollLayersByTierScroll` — sticky 镜像
- `WaveformSegmentBandCanvas` + `drawWaveformSegmentBands` — Display 层（禁止 React viewport cull，见 B15 spec）
- `useWaveformRulerScrollTrack` — ruler imperative `translate3d`（已是 Peaks/WS 同类做法）
- `useWaveformPlaybackScrollFollow` — Audacity pinned / edge 的产品映射

**Rushi 特有问题（业内路线对照）：**

| 症状 | 业内典型解法 | Rushi 差距 |
|------|-------------|-----------|
| 惯性滚动掉帧 | 滚动时 **零 React commit**（A/B/C 均如此） | 已减但 `tierScrollLayout` 仍驱动部分 effect；segment band 仍每 scroll 重绘 **全部** packable 语段 |
| 层间 1px 漂移 | **单一 transform 真源**（B 的 frameOffset；A 的单 scrollContainer） | tier scroll + sticky + translate3d **双机制**，对 sync 顺序敏感 |
| 播放跟随 vs 用户滚 | autoScroll 写 scroll + suppress（A、B）；Audacity 可关 auto-scroll | 已有 `playbackFollowSuppressUntilRef` + `deferLayoutCommit` |
| 长项目多语段 | WS lazy canvas；Peaks 单 canvas；Audacity mip-map | Canvas band **viewport 宽**但 **全量 segment 循环**（`drawWaveformSegmentBands`） |

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| **选定方案（分阶段）** | **阶段 S1（延续，已部分落地）**：滚动 burst 内 **live ref + imperative mirror 为热路径**，React layout **idle commit**；**单一原生 scroll listener** 驱 WS/overlay transform。**阶段 S2（2026-06-18 ✅）**：**`tierScrollFrameCoordinator`** — 合并 tier scroll 触发的 band / playhead / ruler 更新为单 rAF；`drawWaveformSegmentBands` 对 ≥200 语段用二分索引窗。**阶段 S3（可选 spike）**：评估 **取消 translate3d 镜像**、改为 Peaks 式「仅 wide stage 随 tier 原生滚动、sticky 内不再二次 offset」是否更简单 — 需 1d spike + 手测矩阵，未 spike 前不切换。 |
| **不做什么** | ❌ 恢复 WaveSurfer `autoScroll: true` 作为 UI 真源；❌ 重新启用 scroll 驱动 React overlay viewport cull；❌ 引入第二套并行 scroll 容器（toolbar popover 等须仍 portal，见 editor-workbench research）；❌ 为顺滑度整体迁移到 Peaks.js / 重写 Konva 引擎；❌ 播放跟随改为每帧 `setState(currentTime)` 驱 scroll（保持 `deferLayoutCommit` + imperative）。 |
| **与 ADR / architecture 关系** | 对齐 [`desktop-waveform-engine.md`](../../architecture/desktop-waveform-engine.md) **tier 真源**不变；S2 是 **消费方式**优化（更像 A/C 的 imperative scroll loop），不推翻 WS-only。与 [`segment-overlay-virtualization.md`](./segment-overlay-virtualization.md) 一致：**draw 路径 cull OK，React unmount cull 禁止**。 |
| **风险与 spike 项** | **S3 spike**：sticky+transform vs 纯 scroll 谁更顺；**macOS WKWebView** 程序化 `scrollLeft` 是否丢 scroll 事件（已有 `notifyWaveSurferScrollContainer` 注释）。**回归**：wheel-forward 无 scroll 事件路径（`useWaveformTierWheelForward` + `onTierScroll`）。 |

### 4.1 与 Rushi 播放跟随模式的对照

| Rushi 模式 | 业内等价 |
|------------|----------|
| `center` | Audacity Pinned playhead / Logic scroll-in-play |
| `edge` | WaveSurfer `autoScroll` edge threshold / Peaks `autoScrollOffset` |

---

## 5. 落位预告（非最终实现）

| 层 | 文件 / 模块 | 变更类型 |
|----|-------------|----------|
| UI hook | `useTierScrollSync.ts` | S1 ✅ 原生 listener；S2 导出统一 `onTierScrollFrame` 协调 |
| UI hook | `useTierScrollLayout.ts` | S1 ✅ burst defer；S2 可调 `burstMs` / scroll-end `requestIdleCallback` 实验 |
| UI hook | 新 `useTierScrollFrameCoordinator.ts`（可选） | S2 合并 scroll listener，减少重复 rAF |
| Service | `drawWaveformSegmentBands.ts` | S2 可见窗 + overscan cull（纯函数） |
| Component | `WaveformSegmentBandCanvas.tsx` | S2 只注册协调器 paint；去掉对 `tierScrollLayout.scrollLeftPx` 的 layout effect 双触发 |
| Component | `WaveformViewportPlayhead.tsx`, `useWaveformRulerScrollTrack.ts` | S2 并入协调器或共享 rAF |
| Utils | `waveformSurferProgressCoverage.ts` | S1 ✅ transform cache |
| 测试 | `drawWaveformSegmentBands.test.ts`, `useTierScrollSync.test.ts` | S2 可见窗单测 + scroll coalesce |
| 文档 | `desktop-waveform-engine.md` §滚动 | S2 完成后补「scroll 热路径 / idle commit」段落 |

---

## 6. 签收

- [x] 调研 brief 完成
- [x] S2 编码落地（coordinator + band index window）
- [x] 后续彻底重构 research / plan / acceptance 已拆出：[`waveform-unified-scroll-stage-research.md`](./waveform-unified-scroll-stage-research.md)、[`waveform-unified-scroll-stage-plan.md`](./waveform-unified-scroll-stage-plan.md)、[`waveform-unified-scroll-stage-acceptance.md`](./waveform-unified-scroll-stage-acceptance.md)
- [ ] 用户确认是否进入 unified scroll stage spike

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-06-18 | 初版：对照 WS v7 / Peaks.js / Audacity / Audition / Descript；基于 tier+sticky 镜像现状给 S1–S3 分阶段决策 |
