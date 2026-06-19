# 调研：波形播放时钟与单 rAF tick 统一

> **状态**：规划门禁（2026-06-19）
> **触发**：手测播放头抖动/跳动；排查发现存在 **两套重复平滑时钟** 与 **4+ 条并发 rAF**，播放头与播放跟随/色带/ruler 时间不同源。
> **关联**：[`waveform-scroll-smoothness-research.md`](./waveform-scroll-smoothness-research.md)（scroll 热路径 / center=Audacity pinned / edge=WaveSurfer autoScroll）、[`desktop-waveform-engine.md`](../../architecture/desktop-waveform-engine.md)、[ADR-0005](../../adr/0005-waveform-single-scroll-authority.md)（superseded，scroll 真源结论仍有效）
> **门禁**：本文为「波形交互全面排查」方案 Phase 2 的前置调研；Plan 顶部已链接，编码前完成。

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | 播放长音频时，播放头（playhead）应平滑前进、跟随滚动顺滑、与 ruler 时间标签一致。当前主观抖动 / 偶发跳动。 |
| **本仓现状** | WaveSurfer `getCurrentTime()` 被 **HTMLMediaElement timeupdate 量化（4–250ms）**。为平滑，引入了 [`visualPlayheadClock.ts`](../../apps/desktop/src/utils/visualPlayheadClock.ts)（anchor + 预测 + 12% 软校正 + 0.25s 硬跳）。但：① [`useWaveformLiveClock.ts`](../../apps/desktop/src/hooks/useWaveformLiveClock.ts) L64–92 **逐行重复**了同一平滑算法（ruler 用）；② 播放头、播放跟随、ruler、band visited 各跑独立 rAF；③ band「visited」着色用 **原始 WS 时间**（`getPlayheadTime`），与播放头的平滑时钟 **不同源**；④ 播放头存在 **双 rAF 延迟**：visual clock rAF 写 `visualTimeSecRef`，播放头组件再排一帧读它。 |
| **成功标准** | 单一时钟真源；播放头/跟随/ruler/band visited 共用 **同一帧时间**；播放头无双 rAF 延迟；center/edge 手测平滑无跳；现有 `visualPlayheadClock.test.ts` / `WaveformViewportPlayhead.test.tsx` / `useWaveformLiveClock.test.ts` 仍绿。 |

### 1.1 当前时钟/ rAF 拓扑

```text
ws.getCurrentTime()  (timeupdate 量化)
 ├─ useWaveformVisualPlayheadClock rAF#1 → visualTimeSecRef (平滑真源)
 │    ├─ WaveformViewportPlayhead rAF#2 → 读 ref → transform   [双 rAF 延迟]
 │    └─ useWaveformPlaybackScrollFollow rAF#3 → 读 ref → tier scroll
 ├─ useWaveformLiveClock rAF#4 → 重复平滑算法 → ruler label (250ms 节流)
 └─ band visited 用原始 WS 时间（timeupdate 触发重绘）            [不同源]
```

---

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表实现 | 核心机制 | 链接 |
|---|------|----------|----------|------|
| **A** | **渲染器内单 rAF timer 驱动所有播放 UI** | [WaveSurfer.js v7](https://github.com/katspaugh/wavesurfer.js) | 不信任 HTMLMediaElement `timeupdate`（量化粗），内部用 **单个 `requestAnimationFrame` timer**（`src/wavesurfer.ts` 的 `emit('timeupdate')` 由 rAF 循环驱动）统一更新 progress / cursor / 事件 | [wavesurfer.ts timer](https://github.com/katspaugh/wavesurfer.js/blob/main/src/wavesurfer.ts) |
| **B** | **单 animationFrame loop + 预测插值** | [Peaks.js](https://github.com/bbc/peaks.js) Player | `Player` 以 `mediaElement.currentTime` 为真，rAF 循环内 **统一驱动 zoomview / overview / playhead**；一个 loop 多视图同步 | [player API](https://github.com/bbc/peaks.js/blob/master/doc/API.md) |
| **C** | **DAW pinned playhead + 单刷新** | Audacity | 播放推进由音频回调推时间，UI 单次 `TrackPanel` 重绘统一画 playhead + 时间；不为每个 UI 元素开独立循环 | [Viewport.cpp](https://doxy.audacityteam.org/_viewport_8cpp_source.html) |

**共识**：① 用单一 rAF 时钟而非 `timeupdate`；② 所有播放 UI（播放头、滚动、时间标签、状态着色）**共用同一帧的时间值**，不各自插值。

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用 | 与 Rushi 约束冲突 |
|------|--------|----------|-------------------|
| **A WS 单 rAF timer** | **高（模式）** | 「单 rAF + 一处发布、多处订阅」正是 Rushi 缺的；本仓已有 `tierScrollFrameCoordinator` 同构（scroll chrome 单 rAF + Set 订阅）可作范式 | WS 内部 timer 不直接暴露；Rushi 须自管 rAF（因 `autoScroll:false` 已自管播放头/跟随） |
| **B Peaks single loop** | **中** | 单 loop 多视图同步思想 | Peaks 单 canvas 命令式；Rushi DOM/canvas 混合，仅借「单 loop」 |
| **C Audacity** | **中（模式）** | pinned + 单刷新已对齐（center 模式 + `tierScrollFrameCoordinator`） | 原生无 React |

**本仓已有、必须先复用：**
- `visualPlayheadClock.ts`（纯平滑函数，**已是单一算法真源**）——`useWaveformLiveClock` 须改为消费它，删重复实现。
- `tierScrollFrameCoordinator.ts`（单 rAF + Set 订阅 + flush）——播放 tick 直接采用同构「发布/订阅」模式。
- `useWaveformVisualPlayheadClock`（已是 visualTimeSecRef 单一真源 + 唯一推进 rAF）——扩展为「推进后同帧通知订阅者」，消除下游各自 rAF。

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| **选定方案** | **单 tick 发布/订阅**：`useWaveformVisualPlayheadClock` 的 rAF 成为播放期 **唯一** 时钟循环；每帧先推进 `visualTimeSecRef`，再 **同帧** 通知订阅者（播放头 writePosition、播放跟随 applyTarget、ruler label 节流）。播放头 / 跟随 / ruler **不再各开 rAF**。band「visited」`getPlayheadSec` 改用 `getVisualPlayheadTimeSec`（与播放头同源）。`useWaveformLiveClock` 删除重复平滑算法，改为读共享时钟 + 250ms 节流 React label。 |
| **不做什么** | ❌ 不引入第三套时钟；❌ 不改回 `timeupdate` 驱 UI；❌ 不把 band 每帧全量重绘塞进播放 tick（visited 是粗粒度二态，沿用 timeupdate + scroll frame 触发即可，仅换时间源）；❌ 不动 scroll 真源（tier）与 center/edge 产品语义。 |
| **与架构关系** | 对齐 `desktop-waveform-engine.md` tier 真源与 chroming 表；与 `tierScrollFrameCoordinator` 同构（两个单 rAF：scroll chrome 一个、播放 tick 一个；播放 tick 写 scroll 后照常 `scheduleTierScrollFrame` 让 chrome 跟随）。 |
| **风险** | RAF-01 订阅顺序（先推进时间，再播放头/跟随/ruler）；RAF-02 暂停/seek 时 tick 停与 anchor 重置；RAF-03 播放跟随写 scroll 与播放头 transform 同帧顺序（先 scroll 后 playhead，确保播放头读到的是本帧 scrollLeft）。 |

### 4.1 落位预告（非最终实现）

| 层 | 文件 | 变更 |
|----|------|------|
| 时钟 | `useWaveformVisualPlayheadClock.ts` | 增加 `subscribePlayheadFrame`；单 rAF 推进后同帧广播 |
| 组件 | `WaveformViewportPlayhead.tsx` | 删自有 rAF，改订阅播放 tick（消双 rAF 延迟） |
| Hook | `useWaveformPlaybackScrollFollow.ts` | 删自有 rAF，改订阅播放 tick |
| 时钟 | `useWaveformLiveClock.ts` | 删重复平滑，读共享时钟 + 250ms label 节流 |
| 组件 | `WaveformLiveTimeRuler.tsx` | 传 `getVisualPlayheadTimeSec` + 订阅 |
| 组件 | `EditorWaveformPeaksStage.tsx` | band `getPlayheadSec` 改 `getVisualPlayheadTimeSec`；透传订阅 |
| 控制器 | `useWaveformTimelineController.ts` | 暴露 `subscribePlayheadFrame`；scroll-follow 改订阅式 |
| 测试 | 上述 `*.test.ts(x)` | 订阅式 tick + 单时钟断言 |

---

## 5. 签收

- [x] 调研 brief 完成
- [x] Phase 2 编码（单 tick + 单时钟）——typecheck / 全量 test / 架构守卫绿
- [ ] center/edge 手测无抖无跳（需在桌面运行时复验）

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-06-19 | 初版：对照 WaveSurfer 单 rAF timer / Peaks single loop / Audacity；定「单 tick 发布订阅 + 单时钟」决策 |
