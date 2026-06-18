# 调研：波形统一原生 Scroll 舞台（去 sticky + mirror 包袱）

> **状态**：自动验证完成；剩余最终桌面手测矩阵（2026-06-18）  
> **触发**：现有波形滚动在 S1/S2 优化后仍保留 `tier scroll + sticky viewport + translate3d(-scrollLeft)` 镜像结构；用户要求抛弃历史遗留包袱，提前详细调研并规划彻底重构。  
> **Plan / Acceptance**：[`waveform-unified-scroll-stage-plan.md`](./waveform-unified-scroll-stage-plan.md)、[`waveform-unified-scroll-stage-acceptance.md`](./waveform-unified-scroll-stage-acceptance.md)  
> **关联**：[`desktop-waveform-engine.md`](../../architecture/desktop-waveform-engine.md)、[`waveform-scroll-smoothness-research.md`](./waveform-scroll-smoothness-research.md)、[`segment-overlay-virtualization.md`](./segment-overlay-virtualization.md)、[ADR-0005](../../adr/0005-waveform-single-scroll-authority.md)（superseded，但 tier 真源约束仍是现行背景）
> **门禁**：未完成本文与 plan 前，不进入生产重构编码。

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 长音频编辑中，需要自然、跟手、无层间漂移的横向滚动；包括触控板惯性、鼠标滚轮、minimap/seek 程序化滚动、播放跟随 center/edge、缩放和全屏 resize。 |
| 本仓现状 | `tierScrollRef` 是唯一 scroll 真源，但可见波形与 overlay 位于 sticky 视口中，再由 `positionWaveformScrollLayersByTierScroll` 对 `waveformScrollLayerRef` / `overlayScrollLayerRef` 施加 `translate3d(-scrollLeft)` 镜像。WaveSurfer host 被写成 `WAVEFORM_WS_HOST_WIDTH_PX` 巨宽以 eager 渲染，避免 WS lazy 尾部空白。 |
| 核心矛盾 | 现架构同时要求：tier 真源、WS 不驱动 UI、视口 chrome 固定、WS eager 宽 host。结果形成「外层 browser scroll + 内层 sticky + JS 反向平移」三层组合，业内主流实现很少这样做。 |
| 成功标准 | 生产结构中不再有波形/overlay 的 `translate3d(-scrollLeft)` mirror；scroll 热路径只更新 live ref + chrome repaint；波形、overlay、ruler、playhead、band 在手测矩阵中无可见漂移；长音频 / 多语段 / resize / zoom 全绿。 |

### 1.1 当前链路

```text
tierScrollRef (overflow-x:auto, scrollLeft 真源)
  └─ waveformPeaksStageShell width=max(timeline, viewport)
      └─ waveformTimelineShell width=timelineWidthPx
          └─ waveformStickyShell sticky left=0 width=viewport
              ├─ waveformScrollLayer translate3d(-scrollLeft)
              │   └─ waveformStretchShell
              │       └─ containerRef (WaveSurfer)
              ├─ WaveformSegmentBandCanvas (viewport canvas)
              ├─ overlayScrollLayer translate3d(-scrollLeft)
              │   └─ WaveformSegmentOverlay
              ├─ WaveformViewportPlayhead
              └─ WaveformLiveTimeRuler
```

关键文件：

- `apps/desktop/src/components/editor/EditorWaveformPeaksStage.tsx`
- `apps/desktop/src/hooks/useProjectWaveform.ts`
- `apps/desktop/src/hooks/useProjectWaveformMount.ts`
- `apps/desktop/src/hooks/useTierScrollSync.ts`
- `apps/desktop/src/hooks/useWaveformViewportController.ts`
- `apps/desktop/src/hooks/waveformViewportResizeTransaction.ts`
- `apps/desktop/src/utils/waveformViewportStretch.ts`
- `apps/desktop/src/services/waveform/waveformSurferProgressCoverage.ts`

### 1.2 已知包袱

| 包袱 | 当前价值 | 代价 |
|------|----------|------|
| sticky viewport | 固定可见宽，方便 clip、ruler/playhead、viewport canvas | 让 WS/overlay 脱离原生 scroll，需要 JS mirror |
| `translate3d(-scrollLeft)` mirror | 补偿 sticky，保持 waveform/overlay 与 timeline 对齐 | 同步顺序敏感，惯性滚动可能 jitter，CSP style 写入复杂 |
| `WAVEFORM_WS_HOST_WIDTH_PX` 巨宽 host | WaveSurfer eager 渲染，规避 lazy 空白尾部 | 内存/DOM 取决于超宽 canvas；与 WS 官方 scrollContainer 虚拟化路径相反 |
| `waveformScrollLayerRef` / `overlayScrollLayerRef` | mirror 的承载层 | DOM 层级与 resize 写宽度复杂 |
| `syncWaveSurferScrollPx` | scroll 时推 mirror + band repaint | 名称像 WS scroll，实际是 CSS transform mirror，语义混乱 |

---

## 2. 业内成熟路线

| # | 路线 | 代表实现 | 核心机制 | 可迁移点 |
|---|------|----------|----------|----------|
| A | 单容器原生 scroll + renderer 虚拟化 | WaveSurfer.js v7 | `minPxPerSec` 决定 `scrollWidth = ceil(duration * minPxPerSec)`；一个 `scrollContainer`；`autoScroll` 可保持进度在视口；renderer 分 canvas 并清理离屏节点 | 让内容物理跟随 scroll；少做 JS mirror；progress 不重绘波形 |
| B | 逻辑 frameOffset + canvas 重绘 | BBC Peaks.js | `getFrameOffset()` 是视口起点；`scrollWaveform({ pixels })` 改 offset；Konva/canvas 按 offset 重绘；`zoomview.update` 统一通知 | 单一 offset 真源；scroll burst 内不触发 React |
| C | 时间坐标 viewport + 原生重绘 | Audacity / DAW | `hpos` 表示可见区左缘时间；playhead 可固定，track 相对 hpos 重绘；summary/mipmap 保证长音频性能 | 固定 viewport chrome + 单一时间偏移；播放跟随模式清晰 |
| D | 预计算 peaks + 宿主 timeline | Adobe Audition | `.pkf` peaks 缓存，宿主 timeline 原生滚动/绘制，scroll 与绘制同属一套引擎 | peaks 数据层理念已对齐；不支持 Web sticky mirror |

### 2.1 WaveSurfer 文档要点

Context7 / 官方 docs 确认：

- `autoScroll`：自动滚动容器以保持当前位置在视口。
- `autoCenter`：`autoScroll` 开启时播放中保持 cursor 居中。
- `minPxPerSec`：最小每秒像素数，即 zoom level。
- `fillParent`：默认填充容器；当 `duration * minPxPerSec` 大于父宽时进入可滚模式。
- 源码 `calculateWaveformLayout`：`scrollWidth = Math.ceil(duration * minPxPerSec)`，`isScrollable = scrollWidth > parentWidth`。

这说明 WaveSurfer 的成熟路径是 **让 renderer 拥有一个真实 scrollContainer**，而不是外部 sticky + 反向 transform。Rushi 可以保留 tier 真源，但 DOM 舞台应更接近「timeline 内容在真实 scroll 树里」。

---

## 3. 目标路线评估

### 路线 A：统一原生 Scroll 舞台（推荐）

```text
tierScrollRef (唯一 overflow-x:auto)
  ├─ timelineTrack width=timelineWidthPx
  │   ├─ WaveSurfer container width=timelineWidthPx
  │   ├─ WaveformSegmentOverlay (timeline coords)
  │   └─ WaveformSegmentPlaybackControls (timeline coords or anchored chrome)
  └─ viewportChrome sticky/absolute width=viewport
      ├─ WaveformSegmentBandCanvas (viewport draw)
      ├─ WaveformViewportPlayhead
      └─ WaveformLiveTimeRuler
```

| 维度 | 评估 |
|------|------|
| 复用度 | 中高。保留 tier 真源、projection、band canvas、overlay hit-test、playback follow；主要重排 DOM 与 WS host 宽度。 |
| 优点 | 消除 mirror；浏览器 compositor 接管内容滚动；WS/overlay 同处 timeline 坐标；可减少 CSP transform 写入。 |
| 风险 | WaveSurfer lazy 是否出现空白尾部；overlay pointer 坐标是否需调整；resize/zoom shell 写入需要简化但不能破 fit-all。 |
| 推荐 | 作为彻底重构主线。先 spike，再正式分 PR。 |

### 路线 B：逻辑 FrameOffset 舞台（不推荐作为第一刀）

```text
viewportStartPx (state/ref 真源)
  ├─ 自定义 scrollbar / wheel / minimap
  ├─ WaveSurfer / canvas 按 offset 重绘或移动
  └─ 所有 hit-test 用 offset 映射
```

| 维度 | 评估 |
|------|------|
| 复用度 | 低。需要替换原生 scroll、惯性、scrollbar、可访问性、programmatic scroll。 |
| 优点 | 理论上最纯：一个 offset，没有 browser scroll 与 sticky 交互。 |
| 风险 | 需要自建浏览器已免费提供的 scroll 行为，尤其触控板惯性和可访问性。 |
| 推荐 | 仅当路线 A 在 WKWebView / WS lazy 上不可接受时再考虑。 |

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| 选定方案 | 路线 A：统一原生 Scroll 舞台。保留 `tierScrollRef.scrollLeft` 作为唯一 writer，但让 waveform / overlay 进入真实 timeline scroll 树，不再 sticky 内 mirror。 |
| 不做什么 | 不恢复 WS `autoScroll` 作为 UI 真源；不整体迁 Peaks；不引入第二 scroll 容器；不恢复 React overlay viewport cull；不一次性重写所有 waveform hooks。 |
| 与架构关系 | 继承 `desktop-waveform-engine.md` 的 tier 真源、projection 真源、B15 display/interaction 分离；推翻的是 sticky + mirror 舞台实现，而不是领域坐标或播放模型。 |
| 必须先 spike | `WaveSurfer container width=timelineWidthPx` 后的 lazy 渲染、resize、zoom、seek、progress 是否稳定。 |

---

## 5. 预判风险

| 风险 | 触发点 | 预防 / 验证 |
|------|--------|-------------|
| WS 右侧空白 / lazy 尾部不绘制 | 去掉巨宽 host，改 timeline width；长音频高 zoom | A/B spike：30min+、高 px/s、快速惯性滚动；观察 canvas 数量和右侧尾部 |
| progress / cursor 错位 | WS 内部 progress 按自身 scrollContainer / wrapper 算 | 检查播放 progress、seek 后 progress、暂停/播放切换 |
| overlay pointer 坐标错位 | overlay 从 sticky mirror 层移入 timeline scroll 层 | 覆盖选中、拖边界、框选新建、context menu、双击播放 |
| viewport chrome 错位 | ruler/playhead/band 仍在 viewport 坐标 | 保留 `resolveTierViewportMetrics`；对比 timeline px - scrollLeft |
| resize / full screen 回归 | `writeWaveformShellLayout` 删除 sticky/scrollLayer 写宽后 | 测 viewport expand/shrink、fit-all intent、全屏 |
| zoom scroll 保持失败 | timelineWidth 改变后 scrollLeft remap | 覆盖 `useTierScrollResizeEffect`、fit-selection、manual zoom |
| 播放跟随抖动 | center/edge 写 tier scroll，WS 不再 mirror | 播放 1x/2x，center 与 edge，用户滚动 suppress |
| WKWebView scroll event 缺失 | programmatic `scrollLeft` 或 wheel-forward | 保留 `onTierScroll` 兜底；Tauri 真机手测 |
| CSP style registry 残留 | 删除 mirror 后仍有旧 style owner | tests 读 `readCspLayoutRulesForElement`；架构守卫禁止 mirror import |
| hook 超阈值 | 继续堆 `useTierScrollSync` / controller | 同步拆到 `useWaveformTierScroll` 或 service；避免 mega-hook 平移 |

---

## 6. 可复用模块与保留边界

| 模块 | 去留 |
|------|------|
| `waveformProjection.ts` | 保留。坐标真源继续是 `time / duration * timelineWidthPx`。 |
| `useWaveformPlaybackScrollFollow.ts` | 保留。它只写 tier scroll，与目标架构一致。 |
| `WaveformSegmentBandCanvas` | 保留 viewport canvas，但文档改为可见窗/索引窗绘制，而非「全部 packable」。 |
| `WaveformSegmentOverlay` | 保留交互层和 hook；迁移承载层到 timelineTrack。 |
| `useTierScrollLayout` | 保留或并入新 `useWaveformTierScroll`；React commit 仍只走 idle。 |
| `tierScrollFrameCoordinator` | 保留 chrome repaint 协调；mirror 删除后职责更清晰。 |
| `positionWaveformScrollLayersByTierScroll` | 目标态删除生产引用。 |
| `WAVEFORM_WS_HOST_WIDTH_PX` | 目标态删除或仅留 legacy/spike fallback。 |

---

## 7. 验收基线

### 自动化

- `useTierScrollSync.test.ts` 或新 `useWaveformTierScroll.test.ts`
- `WaveformViewportPlayhead.test.tsx`
- `useWaveformRulerScrollTrack.test.ts`
- `WaveformSegmentOverlay` / pointer geometry 相关测试
- `drawWaveformSegmentBands.test.ts`
- `useWaveformZoomSync*.test.ts`
- `waveformViewportStretch.test.ts` / 新 unified layout tests

### 手测

| 场景 | 验证点 |
|------|--------|
| 触控板惯性横滚 | 无 jitter、无层间漂移、无空白尾部 |
| 鼠标滚轮 vertical-to-horizontal | 增益后幅度自然，无过冲 |
| 播放跟随 center | playhead 固定，内容平滑移动 |
| 播放跟随 edge | 接近边缘才滚，用户滚后 suppress 生效 |
| zoom in/out | scroll 保持中心时间；overlay 不漂 |
| fit selection / fit all | intent 高亮、scroll、WS 宽度一致 |
| resize / 全屏 | 无首帧 0 宽、无拉伸残留 |
| 5000+ 语段 | band 顺滑，DOM overlay 仅 interactive |
| Tauri release | WKWebView 下 scroll / wheel / programmatic scroll 都同步 |

---

## 8. 签收

- [x] 调研 brief 完成
- [x] plan / acceptance 已链接本文
- [x] 用户确认进入 spike；S1 spike 手测正常，标记 Go（2026-06-18）
- [x] S2 DOM 迁移完成自动验证（2026-06-18）
- [x] S3 WS 宽度 / resize / zoom 收敛完成自动验证（2026-06-18）
- [x] S4 scroll hook 瘦身完成自动验证（2026-06-18）
- [x] S5 legacy 删除与架构守卫完成自动验证（2026-06-18）
- [x] 项目级自动闸门全绿（2026-06-18）

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-06-18 | 初版：明确选择统一原生 scroll 舞台，列出风险与保留边界 |
| 2026-06-18 | S1 spike Go，可进入 S2 DOM 迁移 |
| 2026-06-18 | S2 DOM 迁移完成自动验证，可进入 S3 |
| 2026-06-18 | S3 自动验证完成，可进入 S4 |
| 2026-06-18 | S4 自动验证完成，可进入 S5 |
| 2026-06-18 | S5 自动验证完成，剩余最终手测矩阵 |
| 2026-06-18 | 项目级自动闸门全绿，剩余最终桌面手测矩阵 |
