# Plan：center 播放跟随内容亚像素平滑

> **调研**（编码前必读）：[`waveform-center-follow-subpixel-research.md`](./waveform-center-follow-subpixel-research.md)
> **前序**：[`waveform-visual-raf-playhead-research.md`](./waveform-visual-raf-playhead-research.md)（VRP）、[`waveform-unified-scroll-stage-research.md`](./waveform-unified-scroll-stage-research.md)
> **架构**：[`desktop-waveform-engine.md`](../../architecture/desktop-waveform-engine.md) §播放跟随（本轮须修订）
> **状态**：P0+P1 已编码（2026-07-14）；待用户高 zoom 居中手测确认完全消抖

---

## 0. 目标数据流（修复后，A2 倾向形态）

```
center + playing（VRP rAF poll media → schedulePlaybackViewportFrame）
  └─ tierScrollFrameCoordinator 单 rAF
       ├─ scroll-follow (priority 0)
       │    target = resolvePlaybackScrollFollowTargetPx(...)   // 浮点
       │    scrollLeft = round(target)                          // 整数落地（window/scrollbar 用）
       │    coordinator.playbackFractionalPx = target - round(target)   // 共享小数残差
       └─ chrome repaint
            ├─ 内容层 waveform-timeline-overlay-layer（peaks/band/overlay/ruler）：translate3d(-fraction)  ← fraction 消费①
            │     （win.leftPx 仍用整数 S 重算；fraction 不进 window）
            └─ playhead（独立 pin 层，pin transform 保持 translate3d(S) 不变）：
                  effectiveScroll = S + fraction → left = P_px - T = vw/2（固定中线）  ← fraction 消费②
                  【禁止】pin transform 再叠加 fraction（否则 double-count）

edge 模式 / 用户滚动 / pause / seek / zoom
  └─ fraction 归零；纯整数 scrollLeft 路径（零改动）
```

**单一真源契约（防漂移，硬约束）**：

- 播放期水平真源 = **整数 `scrollLeft` + 共享 `playbackFractionalPx`**。
- **所有**视口读者只经 `resolveTierViewportMetricsDuringScrollFrame` 取水平量；**禁止**旁路直接读 `el.scrollLeft` 参与视觉定位（架构守卫 + 测试断言）。
- `playbackFractionalPx` **仅** `center && playing` 有非零值；其余一切路径为 0。
- window 重算（`win.leftPx`）只用整数 `scrollLeft`，fraction **不进** window 计算，只叠加到最终 transform。

---

## 1. Spike（A2 已锁定；spike 只验「符号 + 顺滑 + 无漂移」）

**A2 锁定，A1 弃用**（peer review 2026-07-14）。A1 死穴：(1) 冻结 `scrollLeft` 后长音频 `translate3d(-offsetFloat)` 数值可达数十万 px，浮点变换矩阵在超大数值出现**精度断崖** → 高频微抖；(2) 需手动 reconcile 视口窗口 canvas 的 `win.leftPx`，与冻结 scroll 一旦脱节 1 帧即整体跳变闪烁。A2 让 `scrollLeft = round(T)` 使基础坐标恒在视口附近（数值极小），`fraction` 值域恒 `[-0.5, 0.5]`，只做亚像素微调。

### 1.1 符号契约（The Sign Agreement — 全组件物理对称，禁止 double-count）

设真实浮点目标像素 `T = resolvePlaybackScrollFollowTargetPx(...)`；原生落地 `S = round(T)`；残差 `fraction = T - S ∈ [-0.5, 0.5]`。

| 层 | 是否随原生 scroll 物理平移 | 施加量 | 结果 |
|----|---------------------------|--------|------|
| **内容层** `waveform-timeline-overlay-layer`（peaks/band/overlay/ruler） | 是（-S） | `translate3d(-fraction, 0, 0)` | 采样点 `x` 落视口 `x - S - fraction = x - T` ✓ |
| **pin 层内的 playhead**（独立 `translate3d(S)` 视口锚定，**不吃** 内容层 -fraction） | 否 | 用 `effectiveScroll = S + fraction` 喂 `playheadViewportLeftPx` | `left = P_px - (S+fraction) = P_px - T = vw/2` ✓ |

> **关键修正（防 double-count）**：播放头**固定在 `vw/2`**，不是 `vw/2 + fraction`。内容层的 `-fraction` 已让当前时刻采样点落在 `vw/2`，播放头只需与之对齐。**禁止**同时给 pin 层变换叠加 `fraction`（会两次计入）。fraction 全局只被消费一次：内容层一次（-fraction），playhead 经 effectiveScroll 一次（+fraction 抵消其相对内容层的缺失）。
>
> **单一注入点**：`fraction` 只进「时间→视口」定位；**window 重算（`computeWaveformViewportPeaksWindow`）仍吃整数 `S`**，fraction 不进 window，避免边界 rewindow 抖动。

### 1.2 WKWebView 合成层滞后（Composite Lag）避坑

DOM `translate3d` 立即提交 GPU 合成层，而 Canvas 2D 重绘 / 原生 `scrollLeft` 变更可能延迟 1 帧提交 → 高倍速下播放头与波形 1px 拉伸/分离。

- **所有**参与亚像素平移的元素（内容层、canvas 元素、playhead）**开机即**静态加：`will-change: transform; transform: translate3d(0,0,0);`（拉入同一 GPU 合成上下文）。
- **禁止**播放时才动态加 `will-change`：WebKit Layer Promotion Tearing 会瞬间白屏。

### 1.3 spike 验收（染色法 + 极端环境）

1. **极低 zoom**（`20–40 px/s`）× 1x/2x，center 播放，Retina 屏肉眼确认无 1px 步进、播放头居中、层间不分离。
2. **残差染色法**：临时把 `SUBPIXEL_DEBUG_AMPLIFY` 置 `10`，**仅限极低 zoom**（慢扫过半像素边界）。`amp≠1` 时视觉公式 `X - S - amp*(T-S)` 在 `round` 翻边会跳 ~(|amp|-1)px；高 zoom 每帧多次翻边 → **剧烈来回抖**（2026-07-14 手测已证实）。验完必须改回 `1`。低 zoom 下若波形与播放头同幅同向晃动 → 符号正确。
3. **生产路径 `SUBPIXEL_DEBUG_AMPLIFY` 必须为 1**；spike 通过前不落终态（flag-gated）。

---

## 2. 分片（A2 形态，spike 通过后编码）

### CF-1　coordinator 广播 fraction

**落位**：`tierScrollFrameCoordinator.ts`

- 新增帧内状态 `playbackFractionalPx`（默认 0）+ setter（`setPlaybackFractionalPx`）+ 帧结束或非 center/playing 时归零。
- 通过 `readTierViewportMetricsDuringScrollFrame` / metrics 出口带出（或独立 `readPlaybackFractionalPx()`，由 §CF-2 统一并入 metrics）。
- **验证**：单测 setter → 读回；帧结束/reset 归零。

### CF-2　统一读路径并入 fraction

**落位**：`waveformViewport.ts`（`resolveTierViewportMetricsDuringScrollFrame`）

- 返回的水平量（供定位）= `scrollLeftPx - playbackFractionalPx`（或等价约定，spike 定符号）。
- window 重算专用出口仍返回**整数** `scrollLeftPx`（`computeWaveformViewportPeaksWindow` 输入不含 fraction）。
- **验证**：单测 fraction=0 时与现状逐值相等（回归零漂移）；fraction≠0 时定位量含残差、window 量不含。

### CF-3　follow 落地上报残差

**落位**：`useWaveformPlaybackScrollFollow.ts`

- `center` 分支：`const rounded = Math.round(target); playbackFollowScroll(rounded, {deferLayoutCommit}); setPlaybackFractionalPx(target - rounded);`
- `edge` 分支：不变；不调 setter（保持 0）。
- 移除本轮临时的 `minDeltaPx=0`「半步补丁」中**不再需要**的部分（若 fraction 已承担平滑，可恢复 edge 的 epsilon；center 因每帧都要更新 fraction，仍需低/零 epsilon —— 以 spike 结论定）。
- **验证**：`useWaveformPlaybackScrollFollow.test.ts`：center 写 rounded + 上报残差；edge 无 setter；suppress 生效时不写。

### CF-4　各读者叠加 fraction

**落位**：`waveformScrollPinnedLayers.ts`、`WaveformViewportPeaksCanvas.tsx`、`WaveformSegmentBandCanvas.tsx`、`WaveformViewportPlayhead.tsx`、`useWaveformRulerScrollTrack.ts`

- 所有定位改用 CF-2 的含 fraction 水平量（多数已调 `resolveTierViewportMetricsDuringScrollFrame`，天然继承；逐一核对无旁路 `scrollLeft`）。
- `WaveformViewportPlayhead`：center+playing 时回到 pin 中线（`vw/2`）+ fraction 子像素；其余保持现有 live scrollLeft 映射（撤销本轮临时的「始终 live 映射」改动的 center 分叉，以 spike 结论定）。
- **验证**：`WaveformViewportPlayhead.test.tsx` center+playing pin 中线；pin 层测试 translate 含 fraction。

### CF-5　reconcile（过渡不跳）

**落位**：`useWaveformPlaybackScrollFollow.ts` / `useTierScrollSync.ts`

- pause / seek / 用户滚动 suppress / mode 切 edge / zoom：同帧 `setPlaybackFractionalPx(0)`，确保整数 scrollLeft 已等效落地，无可见跳。
- 复用 `userScrollSuppressUntilRef`、`playbackFollowSuppressUntilRef`。
- **验证**：单测 pause→fraction 归零；seek→归零；切 edge→归零。

### CF-6　架构守卫 + 文档

- 架构守卫（`scripts/check-architecture-guard.mjs` 或新增断言）：视口定位组件**禁止**直接读 `.scrollLeft` 做视觉定位（须经统一出口）。
- `desktop-waveform-engine.md` §播放跟随：补「播放期水平真源 = 整数 scrollLeft + 共享浮点残差（仅 center+playing）」契约与 reconcile 规则。
- 更新 `waveform-center-follow-subpixel-research.md` 签收：spike 形态、编码完成。

---

## 3. 执行时序

| 步 | 内容 | 闸门 |
|----|------|------|
| 1 | 用户确认本 plan | — |
| 2 | spike A1/A2 手测决形态 | 低 zoom center 连续 + 无漂移 |
| 3 | 编码 CF-1…6 | `npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs` |
| 4 | 手测矩阵（§4） | 全绿方可提交 |

---

## 4. 手测矩阵（acceptance 基线）

| 场景 | 验证点 |
|------|--------|
| center × 低 zoom(20–40px/s) × 1x/2x | 内容连续、无 0/1px 步进；播放头居中 |
| center × 高 zoom | 无回归、无缝 |
| edge 模式 | 行为不变（近边缘才滚，无 fraction） |
| 用户滚动打断播放 | suppress 生效；fraction 归零无跳 |
| pause / 空格 | 播放头不跳段头；fraction 归零 |
| seek（点波形/语段） | 落点准确；无残差跳 |
| zoom in/out during play | scroll 保持中心时间；无漂移 |
| 层间对齐 | peaks / band / overlay / ruler / playhead 无 1px 漂移 |
| Tauri release（WKWebView） | 真机 center 顺滑；无合成缝 |

---

## 5. 明确不做（本轮）

- ❌ frameOffset 整套重写（路线 B，unified-scroll-stage 已否决）
- ❌ 改 `edge` 模式 / 用户滚动 / VRP 时钟
- ❌ 让 ruler/band 恢复全量 60fps 重绘（window 仍按整数阈值重算）
- ❌ 顺带修 WR-2/WR-4（zoom resample）、SEL-1（点语段）、WS-FPS（超宽 canvas）——独立根因
- ❌ 引入第二套水平真源或第二 scroll 容器
