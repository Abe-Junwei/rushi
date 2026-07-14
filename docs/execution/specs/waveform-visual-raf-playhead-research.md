# 调研：视觉播放头改由独立 rAF 轮询 media（证伪 audioprocess≈60fps）

> **状态**：规划门禁（本轮）
> **关联 spec**：`waveform-visual-raf-playhead-plan.md` / `waveform-visual-raf-playhead-acceptance.md`
> **前序**：
> - [`waveform-playhead-single-clock-research.md`](./waveform-playhead-single-clock-research.md)（已采纳：无 extrapolation、单时间源）
> - [`waveform-render-hotpath-research.md`](./waveform-render-hotpath-research.md)（WR-1 ruler 已落地；本轮处理其未覆盖的播放帧率根因）
> **门禁**：未完成本文 **不得** 进入 Plan 定稿与业务编码

---

## 0. 为什么单时钟落地后仍卡

单时钟薄片正确移除了 extrapolation，并把 display/decision 统一到 `visualTimeSecRef`。但该方案有一个**被实测证伪的前提**：

> WaveSurfer `audioprocess` ≈ 内部 rAF ~16ms → Rushi 消费频率与 WS 原生一致 → 外推非必需。

2026-07-10 手测 + `__rushiScrollProfile` probe（落 `desktop.log`）证明：在本仓 Tauri/WKWebView 环境下，`audioprocess` **不是** 60Hz。

### 实测证据（稳态播放窗口）

| 指标 | 期望（WS 源码注释） | 实测 |
|------|---------------------|------|
| `audioTicks` / sec | ~60 | **13–17**（差时仅 5–7） |
| `audioDelta` avg | ~16ms | **70–100ms**（差时 180–280ms） |
| `audioHandler` | — | **0.00ms**（我们 handler 几乎免费） |
| `playbackSub` | — | **≈0–1ms**（subscriber 几乎免费） |
| `playbackFrames` / sec | ~60 | **10–12** |
| `rulerRepaint`（WR-1 后稳态） | 0 | **0** ✅ |

结论：卡顿不在 ruler/band/CSP，而在 **视觉驱动源只等 `audioprocess` 推送**。`audioprocess` 稀疏 → playhead 稀疏。

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 播放时 playhead 一卡一卡；空格起播位置仍须与视觉一致（单时钟正确性不可回退） |
| 本仓现状 | `onWsAudioprocess` → `visualTimeSecRef = t` → `schedulePlaybackViewportFrame(t)` → DOM playhead。帧率被 `audioprocess` 上限锁死。文件：`useWaveformVisualPlayheadClock.ts`、`tierScrollFrameCoordinator.ts`、`WaveformViewportPlayhead.tsx` |
| 成功标准 | 稳态播放 `playbackFrames` ≈ 50–60/sec；`getDisplayPlayheadTimeSec()` 与 raw media 差 < 1 帧（~16ms）；空格起播不跳段头；pause/seek 不回退 |

---

## 2. 业内成熟路线（≥2）— 重新读源码

| # | 路线 | 代表 | 核心机制 | 与「外推」关系 |
|---|------|------|----------|----------------|
| A | **rAF 每帧读 `media.currentTime`** | WaveSurfer v7 | 内部 `Timer` rAF → `updateProgress()` = 读 media → emit `audioprocess`。平滑来自 **rAF 轮询 media**，不是外推 | 无 extrapolation |
| B | **Animation 每帧读 player time** | Peaks.js | Konva Animation 每帧 `player.getCurrentTime()` 更新 playhead | 无 extrapolation |
| C | 音频回调推时间 | Audacity | 原生回调频率高；桌面端不依赖浏览器 media 事件稀疏性 | 无 extrapolation |

**关键纠正（相对 single-clock research §2）**：

- 业内共识仍是「无 extrapolation」。
- 但业内平滑手段是 **「自己的 rAF 去读 media」**，不是「等别人的 `audioprocess` 事件」。
- Rushi 当前把 WS 的 `audioprocess` 当唯一视觉 tick；当该事件在 WKWebView 被饿到 13–17Hz 时，视觉必然卡。WS 自己的进度条若也卡，是同一上游；但 Rushi 的 DOM playhead **可以** 另开 rAF 直接读 `ws.getCurrentTime()`，与 Peaks 同构，且不违反单时间源。

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用 | 冲突 |
|------|--------|----------|------|
| A WS 内部 Timer | 高（模式） | 「rAF → read media → paint」 | 不 fork WS Timer；在 Rushi clock hook 内自建 |
| B Peaks Animation | **高** | 每帧 `getCurrentTime()` 写 playhead | 无 |
| 本仓 `tierScrollFrameCoordinator` | 高 | 保留单 rAF 合并 playhead + scroll-follow | 驱动源从 audioprocess 改为 playing 态自驱 rAF |

**本仓已有模块（禁止第二套真源）**：

- `useWaveformVisualPlayheadClock` — 保留；改驱动源
- `getRawMediaPlayheadTimeSec` / `ws.getCurrentTime()` — 视觉轮询读这个
- `getDisplayPlayheadTimeSec` — 决策/显示仍统一读 display
- `syncDisplayPlayheadAfterSeek` — seek 同栈写入保留
- `schedulePlaybackViewportFrame` — 保留合并语义；playing 时由 rAF 循环调用

**明确区分两种「领先」**：

| 概念 | 定义 | 本轮 |
|------|------|------|
| **Extrapolation** | `visual = lastMedia + (now - lastWall) * rate`，可领先真实 media | **禁止**（single-clock 已否决，不回退） |
| **rAF poll media** | 每帧 `visual = clamp(ws.getCurrentTime())`，最多落后 1 帧 | **采纳**（与 WS/Peaks 同构） |

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| 选定方案 | **播放中**：独立 rAF（或复用 coordinator 的自驱 schedule）每帧读 `getRawMediaPlayheadTimeSec()` → 写入 `visualTimeSecRef` → `schedulePlaybackViewportFrame`。**`audioprocess` 降级为锚点/校验**（可选仍更新 ref，但不作为唯一帧源）。**暂停/seek**：仍只靠 `syncDisplayPlayheadAfterSeek` / React `currentTimeSec`，不开 rAF。 |
| 不做什么 | ❌ 不恢复 extrapolation；❌ 不引入第二套决策时钟；❌ 不让 ruler 重新订阅 60fps 重绘；❌ 本薄片不修 zoom resample / selection 总耗时（见 §5 后续分片） |
| 与 architecture 关系 | 修订 `desktop-waveform-engine.md` §播放时钟：单时间源 = **media.currentTime**；视觉分发 = **playing 态 rAF 轮询**；`audioprocess` 非帧率保证 |
| 风险 | RISK-01：rAF 与 `audioprocess` 双写 ref → 须同值（都读 media）或 playing 时仅 rAF 写；RISK-02：playback-follow 变 60fps 可能加重 scroll → 须确认 follow 节流仍在；RISK-03：WKWebView 若连独立 rAF 也被饿到 <30fps，则根因升为主线程长任务（需再 profile），但至少不再被 `audioprocess` 二次限速 |

---

## 5. 落位预告 + 后续分片（本仓完整修复地图）

### 本薄片（P0）：VRP — Visual rAF Playhead

| 层 | 文件 | 变更 |
|----|------|------|
| clock | `useWaveformVisualPlayheadClock.ts` | playing 时启动 rAF 循环读 raw media；停播取消 |
| coordinator | `tierScrollFrameCoordinator.ts` | 可选：暴露 `requestPlaybackRafLoop`；或 clock 内自管 rAF 再调 `schedulePlaybackViewportFrame` |
| arch doc | `desktop-waveform-engine.md` | 改写「audioprocess ≈ 16ms」表述 |
| probe | `waveformScrollProfile.ts` | 验收：`playbackFrames`≈50–60；可保留 `audioTicks` 对照 |
| 测试 | clock / playhead / coordinator tests | playing 启动/停止 rAF；seek 仍 sync；无 extrapolation |

### 后续薄片（不在本轮编码，但方案一并规划）

| ID | 问题 | 方案要点 | 证据 |
|----|------|----------|------|
| **WR-2** | 连续 zoom 中间态反复 resample | 尾沿去抖 + 已有 LOD 拉伸兜底 | 浅 zoom 已有 `finish-zoom`；深 zoom 首次仍卡 |
| **WR-4** | `data.resample()` 主线程 1–4s | Worker + transferable；CSP `worker-src` spike | `resample=3984ms @33px/s` |
| **SEL-1** | 点语段仍慢（脏区后 62 段 ~300–550ms） | 见 [`waveform-selection-click-latency-research.md`](./waveform-selection-click-latency-research.md) | `bandPaint≈0`；慢在 SC1 React commit |
| **WS-FPS** | VRP 后 fps 仍 10–30 | 见 [`waveform-ws-canvas-fps-research.md`](./waveform-ws-canvas-fps-research.md) | `scrollW` 可达 40960；先 spike 冻 progress |
| **CF-SUB** | VRP 后播放头顺、center 内容仍整数步进 | 见 [`waveform-center-follow-subpixel-research.md`](./waveform-center-follow-subpixel-research.md) | 根因 = 每帧写整数 `scrollLeft`；引入共享浮点残差 |

---

## 6. 签收

- [x] 调研 brief 完成（含实测证伪 + 业内纠正）
- [ ] plan / acceptance 已链接
- [ ] 用户确认可进入编码（建议先做 VRP）

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-07-10 | 初版：audioprocess 13–17Hz 实测；采纳 rAF poll media，禁止 extrapolation |
