# 调研：波形 Transport Authority（播放头正确性根治）

> **状态**：已采纳  
> **Intent**：[waveform-transport-authority-intent.md](./waveform-transport-authority-intent.md)  
> **Plan**：[waveform-transport-authority-plan.md](./waveform-transport-authority-plan.md)  
> **Acceptance**：[waveform-transport-authority-acceptance.md](./waveform-transport-authority-acceptance.md)  
> **承接**：[`waveform-playhead-seek-industry-research.md`](./waveform-playhead-seek-industry-research.md)、[`waveform-playhead-single-clock-research.md`](./waveform-playhead-single-clock-research.md)  
> **Architecture**：[`desktop-waveform-engine.md`](../../architecture/desktop-waveform-engine.md)  
> **门禁**：未完成本文 **不得** 进入 Plan 定稿与业务编码（见 `AGENTS.md` · feature-research-gate）

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| **用户场景** | 转写页：点语段 / 空白 / minimap / Space / 工具栏播放。期望 **选中语段、视觉播放头、实际出声位置** 一致；播放中换段后 Space 从新段起播；已选段内单击 seek-within。 |
| **本仓现状** | Single-clock 已对齐 display=`visualTimeSecRef`（无外推）。但 **谁决定写什么时间、何时 play** 仍分散在 `useWaveformPlayback`、`useWaveformSegmentPlaybackControls`、`useTranscriptionLayerSelection`、`waveformSelectionGesture`、`waveformSegmentOverlayActions`、快捷键/工具栏等 15+ 点。SC2 chrome、display、raw media、SC1 各自参与启发式 → 播放中选段不 seek、SC2 假 seek-within、raw 滞后起播等回归。 |
| **成功标准** | 所有 seek/play 经单一 Transport Intent 管道（Peaks 序）；play-from 优先级写死可单测；SC2 **不**决定时间；手测 H1–H7 通过。 |

### 1.1 关键路径

```text
UI / gesture / shortcut
  → TransportIntent
  → resolve targetTimeSec（纯函数）
  → syncDisplayPlayheadAfterSeek → ws.setTime / play / pause
  → commitSeekUi + segment bound

Display 仍只读 visualTimeSecRef（single-clock）；SC2 只做 chrome。
```

---

## 2. 业内成熟路线（≥2，源码级）

| # | 路线 | 代表 | 核心机制 | 链接 |
|---|------|------|----------|------|
| **A** | 单出口 seek+play | WaveSurfer v7 | `setTime` 同步 `updateProgress`；`play(start,end)` 显式起点 | [wavesurfer.ts](https://github.com/katspaugh/wavesurfer.js/blob/main/src/wavesurfer.ts) |
| **B** | UI 先、媒体后 | Peaks.js | `updatePlayheadTime` → `player.seek`；`playSegment` 先 `seek(start)` | [seek-mouse-drag-handler.js](https://github.com/bbc/peaks.js/blob/master/src/seek-mouse-drag-handler.js) |
| **C** | 项目级单 ViewInfo | Audacity | 时间/选区真源统一；播放中 seek 驱动音频流 | [ViewInfo.h](https://github.com/audacity/audacity/blob/master/src/ViewInfo.h) |
| **D** | 单击=到位 | Subtitle Edit | 单 `CurrentVideoPositionSeconds` | [AudioVisualizer.cs](https://github.com/SubtitleEdit/subtitleedit/blob/main/src/ui/Controls/AudioVisualizerControl/AudioVisualizer.cs) |

**共识**：一个 transport 出口写目标时间，再驱动媒体 + UI；不靠多源启发式猜「是否已到位」。

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用 | 与 Rushi 冲突 |
|------|--------|----------|---------------|
| A WS | 高 | Peaks 序 seek；显式 play start | 不交 scroll 给 WS（`autoScroll:false`） |
| B Peaks | 高 | 调用顺序与 playSegment 显式段头 | DOM+canvas 混合，仅模式 |
| C Audacity | 中 | 单真源模式 | 原生 C++ |
| D Subtitle Edit | 中 | click=go to position 产品契约 | 本仓 tap 矩阵更细（seek-within） |

**本仓已有、必须复用（禁止第二套）：**

- `useWaveformVisualPlayheadClock` + `getDisplayPlayheadTimeSec` — display 真源
- `syncDisplayPlayheadAfterSeek` — seek 同栈刷 UI
- `resolveSegmentPlaybackStartSec` — 段内起播算法（输入须为权威时间）
- `resolveSegmentOverlayTap` / selection command — tap 分类（勿 fork hit-test）
- `selectionRevealSeekPolicy` — 何时 seek/reveal
- `segmentPlaybackBound` — 语段末暂停/loop

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| **选定方案** | **Transport Intent Coordinator**：纯 service（`resolveTransportTargetTime` + `dispatchTransportIntent`）+ 薄 hook 接线。所有改媒体时间/起播路径只发 intent；管道固定 Peaks 序。Play-from：`fromSec` → display（段内）→ raw≈display 才允许 resume skip → 否则段头。选中 seek 由 SC1 变化或显式 `seekPolicy` 决定；**禁止** SC2 匹配推断已 seek。 |
| **不做什么** | ❌ 不恢复 WS native cursor；❌ 不合并 SC1/SC2；❌ 不改 sticky/WS-FPS；❌ 不引入第二套时钟/hit-test；❌ 不改 list 默认不 seek；❌ UI 层直接 `ws.setTime` / 自写 skip 启发式 |
| **与 ADR / architecture** | 对齐 `desktop-waveform-engine.md` §播放时钟；新增 §Transport Authority；承接 single-clock（G2）与 seek-industry |
| **风险** | RISK-01：接线期双路径并存 — 用 thin wrapper 尽快收口；RISK-02：播放中 defer seek — pointerup 必须执行同一 intent 的 seek 半步 |

---

## 5. 落位预告

| 层 | 文件 / 模块 | 变更类型 |
|----|-------------|----------|
| Spec | `waveform-transport-authority-{research,intent,plan,acceptance}.md` | 新建 |
| Transport | `apps/desktop/src/services/waveform/transport/*` | 新建 types / resolve / dispatch + 测试 |
| Playback | `useWaveformPlayback.ts`、`useWaveformSegmentPlaybackControls.ts` | 经 resolve/dispatch；删散落 resume 启发式 |
| Seek 入口 | `waveformAtomicSeek.ts` | 保持 thin → `wf.seek`（Peaks 序在 playback） |
| Select | `useTranscriptionLayerSelection.ts`、gesture/overlay | 显式 seekPolicy；不读 SC2 定时间 |
| Docs | `desktop-waveform-engine.md` | §Transport Authority |
| Guard | `check-architecture-guard.mjs` | 组件层禁止直接 `ws.setTime`（allowlist service/hook） |

---

## 6. 签收

- [x] 调研 brief 完成（≥2 业内路线 + 本仓复用表 + 决策 + 落位）
- [x] Intent / Plan / Acceptance 已链接
- [ ] 编码与手测见 acceptance

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-07-10 | 初版：Transport Authority；承接 seek-industry + single-clock |
