# Plan：波形统一原生 Scroll 舞台重构

> **状态**：自动验证完成；剩余最终桌面手测矩阵（2026-06-18）  
> **Research**：[`waveform-unified-scroll-stage-research.md`](./waveform-unified-scroll-stage-research.md)  
> **关联**：[`waveform-scroll-smoothness-research.md`](./waveform-scroll-smoothness-research.md)、[`desktop-waveform-engine.md`](../../architecture/desktop-waveform-engine.md)、[`segment-overlay-virtualization.md`](./segment-overlay-virtualization.md)

---

## 0. 目标与非目标

### 目标

把波形舞台从：

```text
tier scroll + sticky viewport + waveform/overlay translate3d(-scrollLeft)
```

重构为：

```text
tier scroll + timelineTrack 原生滚动内容 + viewportChrome 只画视口 UI
```

完成后：

- `tierScrollRef.scrollLeft` 仍是唯一 scroll writer。
- waveform / overlay 不再通过 mirror transform 对齐。
- scroll 热路径不触发 React `setState`。
- WaveSurfer 与 overlay 位于同一 timeline 坐标空间。

### 非目标

- 不恢复 WaveSurfer `autoScroll: true` 作为 UI 真源。
- 不迁移到 Peaks.js / Konva。
- 不恢复 React overlay viewport cull。
- 不一次性改 ASR、文本列表、项目数据模型。
- 不把 spike 代码直接当终态合入。

---

## 1. 目标 DOM

### 1.1 目标结构

```text
<div ref=tierScrollRef overflow-x:auto>                         ← scroll 真源
  <div ref=timelineTrackRef width=timelineWidthPx>               ← 原生随 scroll 移动
    <div ref=waveformStretchShellRef>                            ← resize stretch-hold（必要时）
      <div ref=containerRef width=timelineWidthPx>               ← WaveSurfer mount
    <WaveformSegmentOverlay />                                   ← timeline 坐标，随 scroll 移动
    <WaveformSegmentPlaybackControls />                          ← 若需跟随 segment，可放 timeline 层

  <div ref=viewportChromeRef sticky left=0 width=viewport>        ← 视口 chrome，不承载 timeline 内容
    <WaveformSegmentBandCanvas />                                ← viewport canvas，读 scrollLeft
    <WaveformViewportPlayhead />                                 ← viewport 坐标
    <WaveformLiveTimeRuler />                                    ← viewport 坐标
</div>
```

### 1.2 删除/降级对象

| 对象 | 计划 |
|------|------|
| `waveformScrollLayerRef` | 删除生产职责。spike 期间可做 fallback。 |
| `overlayScrollLayerRef` | 删除生产职责。overlay 直接进 timelineTrack。 |
| `waveformStickyShellRef` | 改为 `viewportChromeRef` 或仅 chrome sticky，不包 WS/overlay。 |
| `positionWaveformScrollLayersByTierScroll` | 删除生产 import，保留测试/legacy 期间最后移除。 |
| `WAVEFORM_WS_HOST_WIDTH_PX` | 删除或 legacy fallback；目标用 `timelineWidthPx` / WS `width`。 |
| `writeWaveformScrollLayerWidth` | 删除；shell layout 不再写 mirror layer width。 |

---

## 2. 实施阶段

### S0：补齐契约与观测（0.5d）

**目的**：编码前让 spike 可判断，不靠主观「感觉顺」。

交付：

- 本 plan + research 已完成。
- 新增 profiling/diagnostic 开关（若已有 `wfProfile` 可复用）：
  - scroll 1s 内 frame count
  - band paint count
  - React commit / layout commit 近似计数（可先手动 DevTools）
  - WS canvas count / scrollWidth / clientWidth 日志（沿用 `[wf-geom]`）

验证：

- 不改生产行为。
- `node scripts/check-architecture-guard.mjs` 无新增红线。

### S1：Unified Stage Spike（1d，feature flag）

**目的**：验证「去 mirror + timeline 内容原生滚」是否可行。

建议 flag：

```ts
const WAVEFORM_UNIFIED_SCROLL_STAGE = false;
```

只在本地 spike 使用，默认 false；若 spike 成功，正式 PR 不长期保留双路径。

改动范围：

| 文件 | 改动 |
|------|------|
| `EditorWaveformPeaksStage.tsx` | 在 flag 下渲染新 DOM：timelineTrack + viewportChrome；WS container 与 overlay 移出 sticky。 |
| `useProjectWaveformMount.ts` | flag 下 container width = `timelineWidthPx` 或 `width: 100%`（由 timelineTrack 提供宽）；去掉巨宽 host 写入。 |
| `useProjectWaveform.ts` | flag 下 `syncWaveSurferScrollPx` 不再调用 mirror；只 request chrome frame，必要时试 `ws.setScroll(scrollLeft)`。 |
| `waveformViewportStretch.ts` | flag 下不写 `waveformScrollLayer` / `overlayScrollLayer` width。 |

Spike 手测矩阵：

- 5min / 30min 音频，各 zoom 档。
- 快速拖动 scroll / 触控板惯性 / 鼠标滚轮。
- 播放中 center / edge。
- fit selection / fit all / minimap 点击。
- resize / 全屏。
- 500+ 语段，最好含 5000+ synthetic 项目。

Go 条件：

- 无右侧空白、无波形闪断。
- overlay 与波形在滚动、zoom、resize 后对齐。
- playhead/ruler/band 与音频时间一致。
- DevTools scroll 热路径主线程工作明显少于 mirror 版，或至少无退化。

No-Go 条件：

- WS lazy 在高 zoom 下反复空白或 jank，且无法通过 `width/minPxPerSec/reRender` 收敛。
- pointer / overlay 坐标需要大范围重写且风险高于收益。

### S2：正式 DOM 舞台迁移（2–3d）

前置：S1 Go。

状态（2026-06-18）：

- [x] 移除 spike flag 与旧 JSX 双路径，unified stage 成为唯一渲染路径。
- [x] WaveSurfer / overlay / playback controls 位于 timeline content；band / playhead / ruler 留 viewport chrome。
- [x] 生产代码删除 `waveformScrollLayerRef` / `overlayScrollLayerRef` 透传与 resize 宽度写入。
- [x] `EditorWaveformPeaksStage.tsx` 回到 300 行 guard 阈值以内。
- [x] Focused waveform tests、desktop typecheck、architecture guard 通过。
- [ ] 浏览器/桌面手测矩阵需在 S3 后重新跑一轮。

改动：

1. 移除 spike flag 的旧分支，正式采用 unified stage。
2. `EditorWaveformPeaksStage.tsx`：
   - 建立 `timelineTrack`。
   - WS + overlay + playback controls 进入 timeline content。
   - band / playhead / ruler 留 viewport chrome。
3. `useTranscriptionLayer.ts` / `useProjectWaveform.ts`：
   - 重命名或删除不再需要的 refs。
   - 暴露 `timelineTrackRef` / `viewportChromeRef`（如必要）。
4. `WaveformSegmentOverlay`：
   - 确认其 `left/top/width` 仍按 timeline 坐标；不再依赖外层 mirror。
5. `WaveformSegmentBandCanvas`：
   - 保持 viewport draw + live scroll metrics；不参与 timeline content。

测试：

- 新增/更新 DOM contract test（不应出现 `waveformScrollLayerRef` mirror transform）。
- `WaveformViewportPlayhead.test.tsx`
- `useWaveformRulerScrollTrack.test.ts`
- `WaveformSegmentOverlay` geometry tests

### S3：WaveSurfer 宽度与 resize/zoom 收敛（2–3d）

状态（2026-06-18）：

- [x] 删除不再使用的 `WAVEFORM_WS_HOST_WIDTH_PX` 巨宽 host 常量和旧策略注释。
- [x] `writeWaveformShellLayout` 只写 timeline / stage / viewport chrome，不再接触 removed mirror layers。
- [x] `useWaveformViewportController.test.ts` 增加 `syncShellLayoutForZoom` 契约，验证 zoom 后 timeline content、stage、viewport chrome 宽度同步。
- [x] Focused waveform tests、desktop typecheck、architecture guard 通过。
- [ ] 长音频高 zoom / resize / fit-all 手测矩阵仍需在最终 S5 后整体验证。

改动：

| 当前 | 目标 |
|------|------|
| `WAVEFORM_WS_HOST_WIDTH_PX` 巨宽 host | `timelineWidthPx` / container CSS width |
| `writeWaveformShellLayout` 写 sticky + scrollLayer + overlayLayer | 只写 timelineTrack / stage / viewportChrome |
| resize 后 `syncScrollAfterRender` mirror | resize 后 schedule chrome frame / refresh layout |

重点检查：

- `useWaveformZoomSyncLayout.ts` 中 `ws.zoom` 后是否需要 `ws.getRenderer().reRender()`。
- `waveformViewportResizeTransaction.ts` 中 stretch-hold 是否仍有意义：如果 WS content 原生滚，stretch 可能只应用在 WS container，而不是 sticky shell。
- `onZoomApplied` 后 scroll remap 是否仍正确。

测试：

- `waveformViewportStretch.test.ts` 更新为 unified shell。
- `useProjectWaveform.test.ts` / zoom sync tests。
- 高 zoom scroll 空白 E2E（若已有浏览器路径则补）。

### S4：Scroll hook 瘦身（1–2d）

目标：删 mirror 后，`useTierScrollSync` 不应继续叫 sync WS scroll。

状态（2026-06-18）：

- [x] `useTierScrollSync` 不再调用 `wfApi.syncWaveSurferScrollPx`，programmatic / native scroll 直接调度 viewport chrome frame。
- [x] `useProjectWaveform` 删除旧 `syncWaveSurferScrollPx` 返回 API 与已废弃的 `getViewportScrollPx` option。
- [x] seek / pick absolute time 动作下沉到 `tierScrollSeekActions.ts`，`useTierScrollSync.ts` 回到 300 行 guard 阈值以内。
- [x] `useTierScrollSync.test.ts` 改为验证 coalesced viewport chrome frame，而非旧 WS scroll mirror。
- [x] Focused waveform tests 与 architecture guard 通过；desktop typecheck 当前被无关 STT unused import 阻塞。

改动：

- 提取/重命名为 `useWaveformTierScroll`：
  - programmatic write
  - live refs
  - idle layout commit
  - playback suppress
  - schedule chrome frame
- 删除 `mirrorWaveSurferScroll` 生产调用。
- `tierScrollFrameCoordinator` 只负责 viewport chrome。

测试：

- 更新 `useTierScrollSync.test.ts` 或迁移为 `useWaveformTierScroll.test.ts`。
- 保留 programmatic coalesce、deferLayoutCommit、smooth scroll tests。

### S5：删除 legacy 与架构守卫（1d）

状态（2026-06-18）：

- [x] 删除 `positionWaveformScrollLayersByTierScroll` / `positionWaveSurferHostByScroll` / `syncWaveSurferScrollWithProgressCoverage` legacy helper。
- [x] 删除依赖旧 helper 的 legacy tests。
- [x] `scripts/check-architecture-guard.mjs` 增加 unified scroll stage 禁止项；白名单保留合法 viewport ruler transform。
- [x] Focused waveform tests 与 architecture guard 通过。
- [x] 项目级自动闸门通过：`npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs`。
- [ ] 最终手测矩阵待跑。

删除/收敛：

- `positionWaveformScrollLayersByTierScroll`
- `positionWaveSurferHostByScroll`
- `waveformScrollLayerRef`
- `overlayScrollLayerRef`
- `WAVEFORM_WS_HOST_WIDTH_PX`
- `writeWaveformScrollLayerWidth`
- 旧文档中 sticky+mirror 舞台图

新增 guard：

- 禁止生产代码 import `positionWaveformScrollLayersByTierScroll`。
- 禁止新增 `translate3d(${-scrollLeft}` / `translate3d(-scrollLeft` 类 mirror 写法。
- `EditorWaveformPeaksStage.tsx` 不应出现 `waveformScrollLayerRef`。

---

## 3. 回滚策略

| 阶段 | 回滚方式 |
|------|----------|
| S1 spike | 丢弃 flag 分支，不影响生产。 |
| S2 DOM 迁移 | 单 PR 回滚；未做 S3 前保留 WS 宽度旧策略时风险较低。 |
| S3 WS 宽度/resize | 如果 lazy 失败，可临时保留 timeline content 原生 scroll，但 WS host 继续旧宽；不过不应恢复 mirror。 |
| S4/S5 清理 | 仅在 S2/S3 稳定后做；若失败回滚清理 PR。 |

原则：**不要保留长期双路径**。flag 只用于 spike 或短期验证。

---

## 4. 风险登记

| ID | 风险 | 严重度 | 早期发现方法 | 处理 |
|----|------|--------|--------------|------|
| UST-01 | WS lazy 右侧空白 | 高 | S1 30min 高 zoom 快速滚 | 尝试 `ws.setScroll` / `reRender`；不行则 No-Go |
| UST-02 | overlay pointer 坐标错位 | 高 | 拖边界、框选、context menu | 更新 `clientXToTimeSec` 和 overlay geometry tests |
| UST-03 | resize 后 WS 宽度为 0 | 高 | 全屏/窗口 resize | 保留 mount wait + ResizeObserver，避免 0 宽 create |
| UST-04 | fit-all intent 被手动 zoom 覆盖 | 中 | fit-all 高亮 + resize | 增加 fit intent regression tests |
| UST-05 | 播放跟随打架 | 中 | center/edge + 用户滚动 | 保留 suppress 机制 |
| UST-06 | 语段 band 与 overlay 分层错位 | 中 | 500+ 语段滚动 | band 继续读 live scroll，overlay 物理滚 |
| UST-07 | 架构守卫 hotspot | 中 | guard warning | S4 拆 hook，不堆 `useTierScrollSync` |
| UST-08 | 文档与实现分叉 | 中 | PR review / docs check | S5 更新 architecture + research |

---

## 5. 验证计划

### 每阶段必跑

```bash
npm run test -w @rushi/desktop -- --run <focused tests>
npm run typecheck -w @rushi/desktop
node scripts/check-architecture-guard.mjs
```

当前自动验证已全绿；最终验收仍需桌面手测矩阵覆盖真实滚动 / 指针交互。

### 最终建议全量

```bash
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
```

### 手测脚本

1. 打开短音频（1–5min），验证基础播放、seek、drag、scroll。
2. 打开长音频（30min+），zoom 到 100+ px/s，触控板惯性横滚。
3. 切换播放跟随：center / edge。
4. 使用 minimap 和 fit selection / fit all。
5. 拖动语段边界，框选新建，context menu。
6. 全屏、缩小窗口、恢复。
7. 500+ / 5000+ 语段项目滚动。

---

## 6. 退出标准

可以宣布完成时必须满足：

- [ ] 生产路径无 waveform/overlay mirror transform。
- [ ] `positionWaveformScrollLayersByTierScroll` 无生产 import。
- [ ] WS / overlay / ruler / playhead / band 在手测矩阵中对齐。
- [ ] 长音频高 zoom 无右侧空白或可接受的 lazy render 行为。
- [x] Focused tests + typecheck + architecture guard 通过。
- [ ] `desktop-waveform-engine.md` 舞台 DOM 与代码一致。

---

## 7. 建议下一步

**自动验证已完成**：旧 waveform/overlay mirror helper 与测试已删除，guard 已禁止旧符号回流；项目级 `typecheck → test → architecture guard` 已全绿。下一步是最终桌面手测矩阵，尤其长音频高 zoom、resize / fit-all、overlay pointer 坐标。  
已修复一条手测回归：timeline overlay 承载层在 unified stage 下缺少显式宽度，导致框选新建与语段拖动无法命中；现在 waveform / overlay timeline layers 均写入 `timelineWidthPx`。

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-06-18 | 初版：按 research 制定 S0–S5 计划、风险登记、验证矩阵 |
| 2026-06-18 | S1 spike Go，下一步调整为 S2 DOM 迁移 |
| 2026-06-18 | S2 DOM 迁移完成自动验证；下一步 S3 WS 宽度 / resize / zoom 收敛 |
| 2026-06-18 | S3 WS 宽度 / resize / zoom 收敛完成自动验证；下一步 S4 scroll hook 瘦身 |
| 2026-06-18 | S4 scroll hook 瘦身完成自动验证；下一步 S5 legacy 删除与架构守卫 |
| 2026-06-18 | S5 legacy 删除与架构守卫完成自动验证；剩余最终手测矩阵 |
| 2026-06-18 | 项目级自动闸门全绿；剩余最终桌面手测矩阵 |
| 2026-06-18 | 修复 overlay layer 宽度塌陷导致的框选/拖动回归 |
