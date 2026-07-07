# 调研：波形播放头 / 语段点击 seek 与业内开源对照

> **状态**：规划门禁（2026-07-07）  
> **触发**：手测「点当前语段却从前面的语段播放」、播放中点波形卡顿跳转；多轮补丁后仍复现。用户要求 **对照业内成熟开源实现**，不得仅引用产品手册或本仓旧 spec。  
> **关联**：[`waveform-playhead-clock-unification-research.md`](./waveform-playhead-clock-unification-research.md)（rAF 单 tick，已部分落地）、[`waveform-selection-chain-repair-research.md`](./waveform-selection-chain-repair-research.md)（SC1/SC2 选中链）、[`desktop-waveform-engine.md`](../../architecture/desktop-waveform-engine.md) §语段 tap / 播放起点  
> **门禁**：修复「点语段播错位置」与 seek 契约前，Plan / acceptance **须链接本文**；未完成不得标编码完成。

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | 转写页波形区：单击/双击语段、播放中点波形、列表与波形联动。期望 **选中语段、播放头、实际出声位置** 一致；点语段内某时刻应从该时刻（或明确契约下的语段头）播放。 |
| **本仓现状（链路）** | WaveSurfer v7（`autoScroll: false`）+ tier 滚动真源 + DOM 语段 overlay（非 WS Regions）。播放 UI 经 `useWaveformVisualPlayheadClock` 平滑；业务 seek 经 `useProjectWaveform.seek` → `ws.setTime` + `syncDisplayPlayheadAfterSeek`。语段 tap 经 `resolveSegmentOverlayTap`（未选中→选+语段头；已选中→seek-within）。语段播放 `useWaveformSegmentPlaybackControls.playSegmentAtIndex` 用 **`ws.getCurrentTime()`** 喂 `resolveSegmentPlaybackStartSec`。`projectWaveformWaveSurferEvents` 在 **`ws.isPlaying()` 时跳过 `setCurrentTime`**（仅写 `lastTimeUiCommitRef`）。选中 chrome 有 SC1（React `selectedIdx`）与 SC2（`selectionChromeStore`）双轨。 |
| **复现症状** | ① 视觉上已选中语段 N，双击或播放却从 **前一语段** 时间出声；② 播放中点波形 playhead 跳变/卡顿；③ 选中与播放头偶发不同步。 |
| **成功标准** | 手测：已选语段内单击 seek 后 `getDisplayPlayheadTimeSec()` 与 `ws.getCurrentTime()` 差 < 50ms；双击/空格语段播放在 **同一语段边界内** 起播；播放中点另一语段不跳回语段头（除非产品契约要求）。自动化：`waveformSegmentOverlayActions` / `playSegmentAtIndex` 定向测试覆盖「显式时间」契约。 |

### 1.1 本仓关键路径（便于对照）

```text
点击语段 overlay
  → waveformSelectionGesture / resolveSegmentOverlayTap
  → selectSegmentAt | seekToTime(timeSec)
  → wf.seek + syncDisplayPlayheadAfterSeek

双击 / 空格语段播
  → playSegmentAtIndex(idx)
  → resolveSegmentPlaybackStartSec(ws.getCurrentTime(), seg)  ← 未用 pointerTime / visual clock
  → ws.play(playFrom)

播放期 UI 时钟
  ws timeupdate (WS 内部 rAF 驱动)
  → projectWaveformWaveSurferEvents: playing 时 **不** setCurrentTime
  → useWaveformVisualPlayheadClock rAF 外推 visualTimeSecRef
  → WaveformViewportPlayhead / scroll-follow 读 visual
```

---

## 2. 业内成熟路线（源码级，≥4）

以下均从 **公开仓库 main/master 源文件** 摘录行为，附可验证路径。

### 路线 A — WaveSurfer.js v7：单 rAF timer + seek 同步刷 UI

| 项 | 内容 |
|----|------|
| 仓库 | [katspaugh/wavesurfer.js](https://github.com/katspaugh/wavesurfer.js) |
| 播放 UI 时钟 | `src/timer.ts`：`requestAnimationFrame` 循环 `emit('tick')`。`src/wavesurfer.ts` `initTimerEvents()`：每 tick 若未 seeking → `updateProgress()` → **同步** `emit('timeupdate')` + `emit('audioprocess')`。不依赖稀疏的 HTMLMediaElement `timeupdate` 驱 UI。 |
| Seek 契约 | `setTime(time)`：`super.setTime` + **`updateProgress(time)`** + **`emit('timeupdate', time)`** — seek 当帧刷新 progress/cursor，无独立「视觉 playhead」滞后一轮。 |
| 语段/Region 播放 | `src/plugins/regions.ts`：`region.on('play')` → **`wavesurfer.play(region.start, end)`**；`play(start?, end?)` 内 **`if (start != null) this.setTime(start)`** 再 `super.play()`。Region **click 只 emit `region-clicked`**，不自动 seek；播放起点由显式 `play(start,end)` 决定。 |
| 波形区点击 seek | `initRendererEvents()`：`renderer.on('click')` → **`seekTo(relativeX)`**（内部 `setTime`）。 |

**要点**：**一个时钟出口**（timer rAF）；seek/play 都经 `setTime` **同帧**更新渲染与事件。

### 路线 B — Peaks.js：seek 先更 UI playhead，再 seek 媒体；语段播固定 seek 段头

| 项 | 内容 |
|----|------|
| 仓库 | [bbc/peaks.js](https://github.com/bbc/peaks.js) |
| 点击/拖拽 seek | `src/seek-mouse-drag-handler.js` `_seek()`：像素→时间后 **`view.updatePlayheadTime(time)`**，再 **`player.seek(time)`**。注释写明：比仅靠 `timeupdate` 更顺滑。 |
| Playhead 绘制 | `src/playhead-layer.js`：zoom 足够时 Konva `Animation` 每帧读 `player.getCurrentTime()`；seek 路径用 `updatePlayheadTime` **立即** `_syncPlayhead`。 |
| 语段播放 | `src/player.js` `playSegment(segment)`：**`self.seek(segment.startTime)`** → `play()`；段尾用 **rAF** `_playSegmentTimerCallback` 检测（因 `timeupdate` 不够密）。**不从当前 playhead 推断起点**。 |
| 语段点击 | `src/segment-shape.js` 只 `emit('segments.mousedown|mouseup')`；**不**内置 seek，由宿主监听后调用 seek handler。 |

**要点**：**视觉 playhead 与 seek 同调用栈、同目标时间**；语段播放 **显式段头**，不用 `getCurrentTime()` 猜。

### 路线 C — Audacity：ViewInfo 单真源 + 播放中 seek 走音频流

| 项 | 内容 |
|----|------|
| 仓库 | [audacity/audacity](https://github.com/audacity/audacity) |
| 时间与选区真源 | `ViewInfo::selectedRegion`（`NotifyingSelectedRegion`）+ `playRegion`；波形/标尺/播放头 **读同一 ViewInfo**，变更发通知统一重绘。 |
| 播放中移动光标 | `SelectMenus.cpp` `DoCursorMove` / `SeekLeftOrRight`：若 `ProjectAudioIO::IsAudioActive()` → **`SeekWhenAudioActive` → `AudioIO::SeekStream`**（音频线程 seek），**不是**只改 UI。暂停时 `setT0` 等直接改 `selectedRegion`。 |
| 波形点击选区 | `SelectHandle.cpp`：`PositionToTime` + `selectedRegion.setTimes` — 指针时间 **一次写入** 项目选区真源。 |

**要点**：**项目级单一时间状态**；播放中 seek 必须 **驱动音频流**，避免 UI 与输出错位。

### 路线 D — Subtitle Edit：单击即改视频/播放位置（转写工具同类）

| 项 | 内容 |
|----|------|
| 仓库 | [SubtitleEdit/subtitleedit](https://github.com/SubtitleEdit/subtitleedit) |
| 波形单击 | `src/ui/Controls/AudioVisualizerControl/AudioVisualizer.cs` `OnPointerPressed`：无修饰键 → `position = RelativeXPositionToSeconds(x)` → **`OnPrimarySingleClicked` / `OnVideoPositionChanged`**（`CurrentVideoPositionSeconds` 绑定）。文档：[SubtitleEdit/docs — Mouse single click: Go to position](https://github.com/SubtitleEdit/docs)。 |
| 双击语段 | 双击已有字幕 → **选中该行**；双击空白 → toggle play。单击与选中/播放位置 **默认绑定**（issue #9943 曾讨论「只选列表不 seek」的反模式，属显式非默认需求）。 |
| 播放器 | 推荐 mpv，seek 精度依赖 **单一 `CurrentVideoPositionSeconds`** 驱动预览与波形竖线。 |

**要点**：字幕/转写类工具默认 **click = go to position**；列表选中与媒体位置脱节会被视为 bug。

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用的部分 | 与 Rushi 约束冲突 | 进度 / 内存 |
|------|--------|----------------|-------------------|-------------|
| **A WaveSurfer** | **高** | `setTime` 同步 `updateProgress`+`timeupdate`；`play(start,end)` 显式起点；内部 rAF timer 驱 UI | 本仓已 `autoScroll:false` 且自管 tier/overlay，不能完全交给 WS scroll；但 **seek 同步刷 progress** 应对齐 | 低；rAF 已在 WS 内 |
| **B Peaks** | **高** | seek：**先 imperative 更新 playhead，再 `player.seek`**；`playSegment` **先 `seek(startTime)`** | Peaks 单 canvas；Rushi DOM+canvas 混合，但 **调用顺序** 可照搬 | 中；已有 `syncDisplayPlayheadAfterSeek` 但未覆盖 play 路径 |
| **C Audacity** | **中（模式）** | 单 `ViewInfo` 真源；播放中 seek 必须作用于音频 | 原生 C++；Rushi 用 WS+React，但 **禁止 UI 时钟与 `ws.getCurrentTime()` 各说各话** | N/A |
| **D Subtitle Edit** | **中（产品契约）** | 单击=到位；双击=选行/播放；修饰键改边界 | WinForms/Avalonia；Rushi 语段 tap 矩阵更细（已选 seek-within） | N/A |

**本仓已有、必须先复用（禁止第二套）：**

- `resolveSegmentOverlayTap` / `waveformSelectionGesture` — 语段 tap 真源（勿 fork 第三套 hit-test）。
- `useWaveformVisualPlayheadClock` + `subscribePlayheadFrame` — 播放 UI 时钟（见 clock-unification research）。
- `syncDisplayPlayheadAfterSeek` — seek 后对齐 visual clock。
- `resolveSegmentPlaybackStartSec` — **算法可保留**，但输入必须是 **权威 playhead 时间**，不能是 stale `ws.getCurrentTime()`。
- `segmentPlaybackBound` — 语段末暂停；对齐 WS `stopAtPosition` / Peaks rAF 段尾检测。

---

## 4. 差距分析（Rushi vs 业内）

| 维度 | 业内共识（A–D） | Rushi 现状 | 风险 |
|------|-----------------|------------|------|
| **时钟真源** | 单出口：WS rAF timer / Peaks player time / ViewInfo / `CurrentVideoPositionSeconds` | **三轨**：`ws.getCurrentTime()`、`visualTimeSecRef`、`lastTimeUiCommitRef`；播放时 React `currentTime` **不跟** timeupdate | 播放头看起来在语段 N，媒体仍在 N−1 |
| **Seek 原子性** | `setTime` 或 `updatePlayheadTime`+`seek` **同栈、同秒** | `wf.seek` + `syncDisplayPlayheadAfterSeek` 分属 WS 与 visual clock；`viewportSyncedOnDown` 路径 **只 select 不 seek-within** | 点击已选语段只改选中不改时间 |
| **语段播放起点** | WS/Peaks：**显式 `start`**（region.start / segment.startTime） | `playSegmentAtIndex` 用 **`ws.getCurrentTime()`** 解析，且先 `pause()` | pause 后 `getCurrentTime()` 可能仍落后 visual；**从前语段起播** |
| **播放中点击** | Audacity：`SeekStream`；Peaks：仍 `updatePlayheadTime`+`seek` | 近期补丁：播放中 pointerdown **跳过** `syncWaveformSegmentSelectPreviewViewport` | 减少跳段头，但 **与 pointerup seek-within 组合** 时序更复杂 |
| **语段 click 语义** | WS region click **不播放**；Peaks 只 emit 事件 | 未选中→语段头；已选中→seek-within（[`desktop-waveform-engine.md`](../../architecture/desktop-waveform-engine.md)） | 契约合理，但 **play 路径未消费 pointerTime** |
| **段内 playhead 起播** | Peaks **从不**从 playhead 中间起播段；WS region play **从 region.start** | Rushi `resolveSegmentPlaybackStartSec` 允许段内起播（DAW 式） | 产品差异化 OK，但 **输入时间必须对** |

### 4.1 根因假设（按优先级，待 Plan 手测验证）

1. **P0 — `playSegmentAtIndex` 时间输入错误**：`ws.getCurrentTime()` 在 playing/pause 边界与 visual/点击时间不一致（`projectWaveformWaveSurferEvents` L108–110 加剧播放期 React 状态滞后）。
2. **P0 — seek 与 play 未共用权威时间**：点击 `seekToTime(pointerTimeSec)` 后若立即 play，未保证 `ws` 与 visual 已提交同一 `pointerTimeSec`。
3. **P1 — `viewportSyncedOnDown` 快路径**：pointerdown 已 sync 语段头时 pointerup 只 `select`，用户以为点了段内时刻。
4. **P1 — SC2 与 `selectedIdx` 滞后**：chrome 显示语段 N，`playSegmentAtIndex(selectedIdx)` 或 `getCurrentTime` 仍按旧索引边界钳制。

---

## 5. 决策摘要

| 问题 | 结论 |
|------|------|
| **选定方案（修复方向）** | **（1）权威播放时间单真源**：对外暴露 `getAuthoritativePlayheadSec()` = 优先 `getVisualPlayheadTimeSec()`，seek 后/暂停后与 `ws.getCurrentTime()` 取 max 一致性校验；**（2）Seek 契约**（Peaks 顺序）：任意 seek/play 前 **`syncDisplayPlayheadAfterSeek(t)` 与 `ws.setTime(t)` 同事务**（已有 `commitSeekUi` 扩展点）；**（3）语段播放**：`playSegmentAtIndex(idx, { fromSec?: number })` — 有 `fromSec`（点击/double-click）用之；否则 `resolveSegmentPlaybackStartSec(authoritative, seg)`；**禁止**裸 `ws.getCurrentTime()`；**（4）可选对齐 WS**：评估是否恢复播放期对 WS `timeupdate` 的 `lastTimeUiCommitRef` 同步（或 visual clock 每帧读 `ws.getCurrentTime()` 重锚），缩小双钟漂移。 |
| **不做什么** | ❌ 不引入第二套 VAD/语段 hit-test；❌ 不 fork Peaks/WS 为并行引擎；❌ 不把全局 `/health` 当播放状态；❌ 不在未手测前改语段 tap 产品矩阵（已选 seek-within 保留）。 |
| **与既有 research 关系** | 本文补 **seek/play 语义与权威时间**；[`waveform-playhead-clock-unification-research.md`](./waveform-playhead-clock-unification-research.md) 补 **rAF 分发** — 实施时 **合并为一条 Plan**，避免两次改同一 hook。 |
| **与 architecture** | 对齐 [`desktop-waveform-engine.md`](../../architecture/desktop-waveform-engine.md) §语段 tap、§播放时钟；能力—UI 矩阵：播放/seek 状态以 **权威 playhead + 选中 idx** 为准，非稀疏 timeupdate。 |
| **风险 / spike** | SPIKE-01：`pause()` 后 `ws.getCurrentTime()` vs `media.currentTime` 延迟（Chromium/Tauri）；SPIKE-02：播放中 seek-within 是否需 Audacity 式「先 seek 流再继续播」。 |

---

## 6. 落位预告（非最终实现）

| 层 | 文件 / 模块 | 变更类型 |
|----|-------------|----------|
| 播放控制 | `useWaveformSegmentPlaybackControls.ts` | `playSegmentAtIndex` 接受 `fromSec`；读权威 playhead |
| 波形 seek | `useProjectWaveform.ts` / `useTranscriptionLayer.ts` | `commitSeekUi` 统一 visual+ws；导出 `getAuthoritativePlayheadSec` |
| 事件 | `projectWaveformWaveSurferEvents.ts` | 评估 playing 期 anchor 策略（重锚 vs 跳过 setState） |
| 语段手势 | `waveformSelectionGesture.ts` / `waveformSegmentOverlayActions.ts` | double-click / play 传入 `pointerTimeSec`；审查 `viewportSyncedOnDown` |
| 时钟 | `useWaveformVisualPlayheadClock.ts` | seek 后强制 snap；与 WS setTime 对齐测试 |
| 测试 | `formatMediaTime.test.ts`、`useWaveformSegmentPlaybackControls` 新测、`waveformSelectionGesture.test.ts` | 权威时间 + 段内点击播放 |
| 文档 | `waveform-playhead-seek-plan.md`（待写） | 链接本文 + clock-unification |

---

## 7. 源码索引（可点击核对）

| 项目 | 文件 | 关键行为 |
|------|------|----------|
| WaveSurfer.js | [`src/wavesurfer.ts`](https://github.com/katspaugh/wavesurfer.js/blob/main/src/wavesurfer.ts) | `initTimerEvents`, `setTime`, `play(start,end)` |
| WaveSurfer.js | [`src/plugins/regions.ts`](https://github.com/katspaugh/wavesurfer.js/blob/main/src/plugins/regions.ts) | `region.on('play')` → `play(region.start,end)` |
| Peaks.js | [`src/seek-mouse-drag-handler.js`](https://github.com/bbc/peaks.js/blob/master/src/seek-mouse-drag-handler.js) | `updatePlayheadTime` then `seek` |
| Peaks.js | [`src/player.js`](https://github.com/bbc/peaks.js/blob/master/src/player.js) | `playSegment` → `seek(startTime)` |
| Audacity | [`src/select/SelectMenus.cpp`](https://github.com/audacity/audacity/blob/master/src/select/SelectMenus.cpp) | `SeekWhenAudioActive`, `DoCursorMove` |
| Subtitle Edit | [`AudioVisualizer.cs`](https://github.com/SubtitleEdit/subtitleedit/blob/main/src/ui/Controls/AudioVisualizerControl/AudioVisualizer.cs) | 单击 → `OnVideoPositionChanged` |

---

## 8. 签收

- [x] 调研 brief 完成（源码级 ≥4 路线）
- [ ] `waveform-playhead-seek-plan.md` / acceptance 已链接本文
- [ ] 用户或路线图确认可进入编码

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-07-07 | 初版：WaveSurfer / Peaks / Audacity / Subtitle Edit 源码对照 + Rushi 差距与决策 |
| 2026-07-07 | P0 落地：`waveformAtomicSeek`、权威 playhead 注入 `playSegmentAtIndex`、`fromSec` 双击播、Peaks 序 seek |
| 2026-07-07 | P1 落地：audioprocess 统一帧、合并 playback+scroll rAF、band visited 边界重绘 |
