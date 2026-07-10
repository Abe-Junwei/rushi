# 调研：波形播放头单时间源（移除 visual extrapolation）

> **状态**：已采纳  
> **Intent**：[waveform-playhead-single-clock-intent.md](./waveform-playhead-single-clock-intent.md)  
> **Plan**：[waveform-playhead-single-clock-plan.md](./waveform-playhead-single-clock-plan.md)  
> **Acceptance**：[waveform-playhead-single-clock-acceptance.md](./waveform-playhead-single-clock-acceptance.md)

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | 播放中按空格播放当前语段，起播位置应与视觉播放头位置一致；pause 后 seek 不应出现视觉倒退 |
| **本仓现状** | `useWaveformVisualPlayheadClock` 对 `audioprocess` 报告的 `media.currentTime` 做 extrapolation（`readVisualPlayheadTimeSec`），导致 visual ≈ rawMedia + 0–300ms。决策路径（`resolvePlayheadSec`）读 `ws.getCurrentTime()`，与 visual 不同源。后果：visual 在段内、决策判定在段外 → 起播跳段头。文件：`visualPlayheadClock.ts`、`useWaveformVisualPlayheadClock.ts`、`useWaveformPlayback.ts`、`waveformImperativePlayheadSync.ts`、`waveformSelectionSeekChrome.ts` |
| **成功标准** | 手测：播放中按空格，起播位置与播放头视觉位置差 < 16ms（一帧）；pause 后 `getDisplayPlayheadTimeSec()` 不回退；决策路径和视觉路径读同一 ref |

---

## 2. 业内成熟路线（4 条，源码级）

| # | 路线 | 代表实现 | 核心机制 | 链接 |
|---|------|----------|----------|------|
| **A** | rAF 读 `media.currentTime`，不做外推 | WaveSurfer v7 | 内部 rAF timer 每帧读 `media.currentTime` → `updateProgress` + emit `audioprocess`。`setTime()` 同步 `updateProgress` + emit `timeupdate`——无 suppress 窗口、无外推、无双时钟 | [`src/timer.ts`](https://github.com/katspaugh/wavesurfer.js/blob/main/src/timer.ts) |
| **B** | seek 先刷 UI 再 seek 媒体，单时间源 | Peaks.js | `_seek()`: `view.updatePlayheadTime(time)` → `player.seek(time)`。Konva Animation 每帧读 `player.getCurrentTime()`——不做外推 | [`src/seek-mouse-drag-handler.js`](https://github.com/bbc/peaks.js/blob/master/src/seek-mouse-drag-handler.js) |
| **C** | 音频回调推时间，单 ViewInfo | Audacity | 原生音频回调 → `ViewInfo` → UI 重绘；seek 写 `ViewInfo`，同栈生效 | [`ViewInfo.h`](https://github.com/audacity/audacity/blob/master/src/ViewInfo.h) |
| **D** | 单 `CurrentVideoPositionSeconds` | Subtitle Edit | mpv 单变量驱动波形竖线和预览；click 直接写该变量 | [`AudioVisualizer.cs`](https://github.com/SubtitleEdit/subtitleedit/blob/main/src/ui/Controls/AudioVisualizerControl/AudioVisualizer.cs) |

**共识**：无产品对播放头做 extrapolation。rAF 60fps 读 `media.currentTime` 本身足够平滑。

**关键验证（2026-07 修正）**：WaveSurfer v7 源码意图是内部 rAF ~16ms emit `audioprocess`；但 Rushi 在 Tauri/WKWebView 手测中 `audioprocess` 仅 **13–17Hz**（见 [`waveform-visual-raf-playhead-research.md`](./waveform-visual-raf-playhead-research.md)）。因此「消费 WS `audioprocess` = 与 WS 同帧率」前提不成立。外推仍非必需；平滑应改为 **本仓 rAF 每帧读 `media.currentTime`**（与 Peaks / WS 内部 Timer 同构），而非等稀疏事件。

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用 | 与 Rushi 约束冲突 |
|------|--------|----------|-------------------|
| **A WS v7** | **高** | `setTime` 同步 `updateProgress` 的模式 = Rushi 的 `syncDisplayPlayheadAfterSeek` + `ws.setTime`；不做外推 = 直接采纳 | 无冲突 |
| **B Peaks** | **高** | seek 先刷 UI 再 seek 媒体的调用顺序——Rushi 已对齐 | Peaks 单 canvas；Rushi DOM+canvas 混合，但调用顺序照搬 |
| **C Audacity** | 中 | 单真源模式 | 原生 C++，仅模式参照 |
| **D Subtitle Edit** | 中 | 单变量驱动 | WinForms/Avalonia，仅模式参照 |

**本仓已有可复用模块**：

- `useWaveformVisualPlayheadClock` — 单 tick 发布/订阅（`subscribePlayheadFrame`），保留框架，去掉 extrapolation
- `syncDisplayPlayheadAfterSeek` — seek 后同栈刷新播放头（对标 WS `updateProgress` / Peaks `updatePlayheadTime`），保留
- `tierScrollFrameCoordinator` — 单 rAF 合并播放头+scroll chrome，保留
- `lastTimeUiCommitRef` — pause 后修正 `media.currentTime` 回退，保留

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| **选定方案** | **移除 extrapolation，回归单时间源**：`visualTimeSecRef` 直接锚定 `audioprocess` 报告的 `timeSec`（不做 `readVisualPlayheadTimeSec` 外推）。所有路径（display + decision）统一读 `visualTimeSecRef`。seek 后 `syncDisplayPlayheadAfterSeek` 同栈写入 + 通知订阅者（与 WS v7 `updateProgress` / Peaks `updatePlayheadTime` 同构）。pause 后用 `lastTimeUiCommitRef` 修正回退。 |
| **不做什么** | ❌ 不保留任何形式的 extrapolation；❌ 不保留 `imperativePlayheadSyncSuppressUntil`（50ms suppress 窗口）——无外推则无竞争；❌ 不保留 `selectionSeekChromeSuppressUntil`（1200ms suppress 窗口）——同因；❌ 不引入第三套时钟；❌ 不改 scroll 真源（tier）与 center/edge 产品语义 |
| **与 ADR / architecture 关系** | 对齐 `desktop-waveform-engine.md` §播放时钟：单真源 `audioprocess` → `visualTimeSecRef` → 所有消费者；seek 同栈刷新（对标 WS v7 / Peaks）。暂停态 seeking 仍 sync（WS-only seek）。`waveform-playhead-seek-industry-research.md` §4 **G2 已对齐**。 |
| **风险** | RISK-01：移除外推后，如果浏览器/WS 偶发跳过一帧 `audioprocess`，播放头可能在一帧内"粘"住（肉眼极难察觉，16ms）；RISK-02：`pause()` 后 Chromium `media.currentTime` 回退——已由 `lastTimeUiCommitRef` + `syncPausedTime` 处理，需验证覆盖所有 pause 路径 |

---

## 5. 落位预告

| 层 | 文件 / 模块 | 变更类型 |
|----|-------------|----------|
| 时钟 | `utils/visualPlayheadClock.ts` | **删除 extrapolation 逻辑**：`readVisualPlayheadTimeSec` 直接返回 `rawTimeSec`（或删函数，inline 赋值） |
| 时钟 hook | `hooks/useWaveformVisualPlayheadClock.ts` | `onWsAudioprocess` 直接 `visualTimeSecRef = timeSec`（不再 extrapolate）；移除 `clockStateRef`；`syncDisplayPlayheadAfterSeek` 保留（seek 同栈写入） |
| display | `utils/waveformDisplayPlayhead.ts` | 简化：ready 时直接 `getVisualPlayheadTimeSec()`，已接近 |
| playback | `hooks/useWaveformPlayback.ts` | `resolvePlayheadSec` 改为调用方传入的 `getDisplayPlayheadTimeSec()`（不再直接 `ws.getCurrentTime()`）；移除 `_getAuthoritativePlayheadSecRef` 参数 |
| suppress | `utils/waveformImperativePlayheadSync.ts` | **删除**——无 extrapolation 则无竞争 |
| suppress | `utils/waveformSelectionSeekChrome.ts` | **删除**——同因 |
| suppress 消费 | `hooks/useWaveformTimelineController.ts` | 移除 `imperativePlayheadSyncSuppressUntilRef`、`selectionSeekChromeSuppressUntilRef`、`getAuthoritativePlayheadSecRef` |
| WS 事件 | `hooks/projectWaveformWaveSurferEvents.ts` | **播放态** seeking **不**调 `syncDisplayPlayheadAfterSeek`（对标 WS v7 / Peaks：用户 seek 同栈已设好，下一帧 `audioprocess` 覆盖）。**暂停态** seeking **仍**调 sync——Rushi 有 peaks 热重载等 **WS-only `setTime`**（不经 Peaks 序），须刷新 `visualTimeSecRef` + band `subscribePlayheadFrame`；不可假设「所有 seek 都已同栈 sync」 |
| suppress 消费 | `hooks/useProjectWaveform.ts` | 移除 `imperativePlayheadSyncSuppressUntilRef` 参数传递 |
| suppress 消费 | `hooks/useWaveformSegmentPlaybackControls.ts` | 移除 `imperativePlayheadSyncSuppressUntilRef` 参数；`atomicMediaSeek` 简化 |
| 测试 | 上述文件对应 `.test.ts` | 更新断言；删除 suppress 窗口相关测试用例 |
| 测试 | `utils/visualPlayheadClock.test.ts` | 更新/简化：直接返回 raw，不再测 extrapolation |

---

## 6. 签收

- [x] 调研 brief 完成
- [x] intent / plan / acceptance 已链接本文
- [x] 用户或路线图确认可进入编码

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-07-08 | 初版：四产品对照 → 移除 extrapolation 回归单时间源决策 + 落位预告 |
| 2026-07-08 | 补充：seeking 事件不再重同步（对标 WS v7 / Peaks），seeking handler 移除 `syncDisplayPlayheadAfterSeek` 调用 |
| 2026-07-09 | **修正**：暂停态 seeking **恢复** `syncDisplayPlayheadAfterSeek`（peaks 重载等 WS-only seek → band `playheadSecRef` 滞后）；播放态仍不重同步。Plan / acceptance / `desktop-waveform-engine.md` 同步 |
