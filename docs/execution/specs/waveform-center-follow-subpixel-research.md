# 调研：center 播放跟随内容亚像素平滑（去整数 scrollLeft 步进）

> **状态**：规划门禁（2026-07-14）
> **关联路线图**：[`rushi-execution-roadmap.md`](../plans/rushi-execution-roadmap.md) §波形成熟度
> **前序（必读）**：
> - [`waveform-visual-raf-playhead-research.md`](./waveform-visual-raf-playhead-research.md)（VRP：播放头时钟已 rAF 轮询 media 至 ~50–60fps；本文补内容侧）
> - [`waveform-unified-scroll-stage-research.md`](./waveform-unified-scroll-stage-research.md)（已落地路线 A：统一原生 scroll 舞台；**已否决** Peaks 式 frameOffset 整套重写）
> - [`waveform-scroll-smoothness-research.md`](./waveform-scroll-smoothness-research.md)（S1/S2 imperative 热路径 + coordinator）
> **关联 spec**：`waveform-center-follow-subpixel-plan.md`（编码前须链接本文）
> **门禁**：未完成本文 **不得** 进入 Plan 定稿与业务编码（见 [`AGENTS.md`](../../../AGENTS.md) · `.cursor/rules/feature-research-gate.mdc`）

---

## 0. 为什么本文单独成篇（与前序的边界）

- **VRP** 修的是**视觉驱动源**：播放中用独立 rAF 轮询 `ws.getCurrentTime()`，把播放头/canvas 的更新频率从被 `audioprocess`（WKWebView 实测 13–17Hz）限速提升到 ~50–60fps。**它没改内容位移的量化粒度**。
- **unified-scroll-stage** 把舞台从「sticky + 反向 mirror」重排为「统一原生 scroll 真源 + 视口窗口 canvas + pin 层」，消除了层间 1px 漂移；同时**明确否决**了整套 frameOffset 重写（路线 B：需自建惯性/可访问性/scrollbar）。
- 残留症状（用户 2026-07-14 反馈）：**全局 center 播放时播放头「顺」但波形内容「一格一格」步进**。根因不在帧率、不在 mirror，而在 **center 跟随每帧写原生 `scrollLeft`，被浏览器量化为整数像素**；低 `px/s`（低 zoom）时每帧位移 < 1px，被吞成 0 或跳 1，产生 stutter。本文只解决这一格问题，且明确复用（不重开）前两篇的成果。

---

## 1. 问题陈述

| 项 | 内容 |
|----|------|
| 用户场景 | 全局 center 播放跟随：期望播放头固定视口中线、波形/语段带随时间**连续平滑**左移（DAW scroll-in-play 手感）。当前低 zoom 下内容按整数 px 步进跳动。 |
| 本仓现状 | **scroll 真源** = `tierScrollRef.scrollLeft`（原生 `overflow-x`）。center 跟随：`useWaveformPlaybackScrollFollow` 每个 playback tick 调 `resolvePlaybackScrollFollowTargetPx` 算目标并写 `playbackFollowScroll(target)` → 原生 `scrollLeft`（**浏览器量化为整数**）。内容位置：`WaveformViewportPeaksCanvas` / `WaveformSegmentBandCanvas` 是**视口窗口 canvas**，按 `scrollLeftPx` 算窗、shell 定位到 `win.leftPx`；`WaveformViewportPlayhead` 与 WS host 经 `useWaveformScrollPinnedLayers` 用 `translate3d(scrollLeft)` pin 回视口。所有读者都以 `scrollLeftPx` 为唯一水平真源。 |
| 已做的半步补丁（本轮临时，未定稿） | `useWaveformPlaybackScrollFollow` 对 center 把 `minDeltaPx` 设 0（不再被 0.5px epsilon 吞掉小位移）；`useTierScrollSync.commitScrollLeftPx` 在 `deferLayoutCommit` 时 epsilon=0；`WaveformViewportPlayhead` 播放头始终按 **live scrollLeft** 算 `leftPx`（不再 pin 到 `vw/2`）。**局限**：这些只让「请求」更细，但原生 `scrollLeft` 落地仍是整数 → 内容仍步进。需架构决策，不能只靠 epsilon。 |
| 成功标准 | 低 zoom（如 20–40 px/s）× 1x/2x 播放，center 模式下 `__rushiScrollProfile` 观测内容位移**每帧连续**（无 0/1px 交替 stutter）；播放头保持视口中线；**层间无 1px 漂移**（peaks/band/overlay/ruler/playhead 同步）；pause/seek/用户滚动 suppress/zoom 全回归；`edge` 模式行为不变。 |

### 1.1 当前 center 跟随链路

```text
playback tick (VRP rAF poll media → schedulePlaybackViewportFrame)
  └─ tierScrollFrameCoordinator 单 rAF
       ├─ playbackSubscribers（priority 0 = scroll-follow）
       │    └─ useWaveformPlaybackScrollFollow → playbackFollowScroll(target)
       │         └─ tierScrollRef.scrollLeft = round(target)   ← 整数量化在此
       └─ tierScrollSubscribers（chrome repaint）
            ├─ WaveformViewportPeaksCanvas.paint(scrollLeftPx)  ← 读回整数 scrollLeft
            ├─ WaveformSegmentBandCanvas.paint(scrollLeftPx)
            ├─ useWaveformScrollPinnedLayers（playhead / WS host）translate3d(scrollLeft)
            └─ WaveformViewportPlayhead / ruler
```

**关键观察**：唯一水平真源是 `scrollLeftPx`，一旦它被浏览器量化为整数，**所有**下游读者都继承整数步进 → 内容和 pin 层一起「一格一格」。这也意味着：**只要引入一个共享的浮点水平真源，所有读者会一并平滑**（既是机会也是防漂移的硬约束）。

---

## 2. 业内成熟路线（≥2）

| # | 路线 | 代表实现 / 产品 | 核心机制 | 链接或路径 |
|---|------|-----------------|----------|------------|
| **A** | **固定播放头 + 内容层浮点 transform（scroll-in-play）** | Logic Pro / Adobe Audition「Centered」；多数 Web DAW | 播放中**不逐帧改 scrollLeft**；native scroll 停在整数锚点，整条时间线内容层用 `translate3d(floatX,0,0)` 连续平移；播放头 pin 视口中线。暂停/用户操作时把锚点 reconcile 回 `scrollLeft`、清 transform。 | 行业惯例；对照 [`waveform-scroll-smoothness-research.md`](./waveform-scroll-smoothness-research.md) §2 路线 A/C |
| **B** | **逻辑 frameOffset（浮点视口起点，canvas 命令式重绘）** | [BBC Peaks.js](https://github.com/bbc/peaks.js) ZoomView | `getFrameOffset()` 浮点视口起点；播放 auto-scroll 改 offset 后命令式重绘 canvas，**完全绕开 DOM scroll**。 | [Peaks API](https://github.com/bbc/peaks.js/blob/master/doc/API.md) |
| **C** | **rAF 轮询 player time 驱动 Animation**（仅播放头，不解决内容量化） | Peaks.js Konva Animation / WaveSurfer v7 Timer | 每帧读 `getCurrentTime()` 重画。**Rushi 已在 VRP 采纳**。 | [`waveform-visual-raf-playhead-research.md`](./waveform-visual-raf-playhead-research.md) |
| **D** | （对照）子像素 CSS 变换普适性 | 浏览器合成器 | `transform: translate3d` 接受浮点并由 GPU 合成子像素；`scrollLeft` 则被量化为整数 CSS px（WebKit/WKWebView 亦然）。 | CSSOM `scrollLeft` 为 integer；`transform` 为 float（合成器上采样） |

---

## 3. 可复用评估

| 路线 | 复用度 | 可直接用的部分 | 与 Rushi 约束冲突 | 进度 / 内存 / 运维 |
|------|--------|----------------|-------------------|---------------------|
| **A 固定头 + 内容浮点 transform** | **高** | VRP playback tick、`tierScrollFrameCoordinator` 单 rAF、`useWaveformPlaybackScrollFollow` 的 target 计算、pin 层 `translate3d` 机制（已在用）。只需把「写整数 scrollLeft」改为「写浮点内容 offset」。 | 必须**单一浮点真源**，让 peaks/band 窗口、pin 层、ruler、playhead 全部消费同一 offset，否则复活层间漂移（unified-scroll-stage 刚消除）。窗口 canvas 的 `win.leftPx` 与 offset 的整数/小数拆分需对齐。 | 无额外重绘：窗口仍按整数阈值重算，小数只进 transform。 |
| **B frameOffset 整套** | **低** | 概念参考 | **已被 unified-scroll-stage 明确否决**：需替换原生惯性/scrollbar/可访问性/programmatic scroll。 | 不做。 |
| **C VRP** | 已落地 | — | — | 仅播放头；对内容量化无效。 |

**本仓已有、必须先复用再扩展的模块（禁止第二套真源）：**

- `useWaveformPlaybackScrollFollow` — center 目标计算保留；改「落地方式」而非重写。
- `tierScrollFrameCoordinator` — 单 rAF + playback/scroll 双 subscriber 保留；浮点 offset 在此帧内一次性广播。
- `useWaveformScrollPinnedLayers` / `syncWaveformScrollPinnedLayers` — pin 层 `translate3d` 已是浮点，天然可加子像素残差。
- `WaveformViewportPeaksCanvas` / `WaveformSegmentBandCanvas` — 视口窗口 canvas；`win.leftPx` 定位保留，子像素残差走 shell transform 或统一 offset。
- `resolveTierViewportMetricsDuringScrollFrame` / `waveformViewport` — 统一读路径，是植入浮点 offset 的唯一入口。
- `WaveformViewportPlayhead` / `useWaveformRulerScrollTrack` — 已改读 live scrollLeft，需改读统一 offset。

---

## 4. 决策摘要

| 问题 | 结论 |
|------|------|
| **选定方案** | **路线 A（窄薄片）**：仅在 **center + playing** 期，引入**单一浮点水平真源** `playbackViewportOffsetPx`（整数部分仍落 `scrollLeft` 供 window 重算与滚动条，小数残差广播给所有视口读者的 `translate3d`）。播放头 pin 视口中线（子像素由 transform 承担）。暂停 / 用户滚动 / seek / zoom：清 offset，reconcile 回纯 `scrollLeft`，回到现有整数路径。 |
| **不做什么** | ❌ 不重开 frameOffset 整套（路线 B，已否决）；❌ 不动 `edge` 模式（无步进问题）；❌ 不改 VRP 时钟或引入第二决策时钟；❌ 不让 ruler/band 恢复 60fps 全量重绘（窗口仍按整数阈值重算，小数只进 transform）；❌ 不顺带修 zoom resample（WR-2/WR-4）、点语段延迟（SEL-1）、WS canvas fps（WS-FPS）——这些是独立根因，见 §4.1。 |
| **与 ADR / architecture 关系** | 继承 [`desktop-waveform-engine.md`](../../architecture/desktop-waveform-engine.md)：tier 仍是 scroll 真源、projection 真源、B15 display/interaction 分离不变。新增的是**播放期水平真源从「整数 scrollLeft」升级为「整数 scrollLeft + 共享浮点残差」**，须在该文档「播放跟随」段落补契约。 |
| **风险与 spike 项** | 见 §5。核心 spike：验证「整数 scroll 锚点 + 浮点内容 transform」在 WKWebView 下 (a) 无层间漂移、(b) 无合成器 1px 缝、(c) window 重算阈值与 offset 拆分不产生边界抖动。**未 spike 前不定稿 Plan 的落地形态**（两种子形态见下）。 |

### 4.0 落地形态：A2 锁定（peer review 2026-07-14）

**A2 = 整数 scroll + 小数残差广播**：每帧写 `round(target)` 到 `scrollLeft`，把 `fraction = target - round(target) ∈ [-0.5, 0.5]` 作为共享真源注入定位。

**A1（全内容层浮点平移）弃用**，死穴：
- **精度断崖**：冻结 `scrollLeft` 后长音频 `translate3d(-offsetFloat)` 数值可达数十万 px，浮点变换矩阵在超大数值精度断崖式下跌 → 肉眼高频微抖。
- **DOM 撕裂**：需手动 reconcile 视口窗口 canvas `win.leftPx`，与冻结 scroll 脱节 1 帧即整体跳变闪烁。

A2 让基础坐标恒在视口附近（数值极小），fraction 恒 `[-0.5, 0.5]` 只做亚像素微调。**符号契约 + 防 double-count + 合成层避坑见 plan §1**。spike 只用「染色法（fraction ×10）+ 极低 zoom」实证符号与顺滑，不再 A1/A2 对照。

### 4.1 明确不在本薄片（独立根因，防止范围蔓延）

| ID | 问题 | 为何本方案无效 | 出处 |
|----|------|----------------|------|
| WR-2/WR-4 | 连续/深 zoom `resample()` 主线程 1–4s | transform 平移不触及 resample | [`waveform-visual-raf-playhead-research.md`](./waveform-visual-raf-playhead-research.md) §5 |
| SEL-1 | 点语段慢（React commit） | 与播放平移无关 | [`waveform-selection-click-latency-research.md`](./waveform-selection-click-latency-research.md) |
| WS-FPS | 超宽 WS canvas fps 低 | 独立于 center 跟随 | [`waveform-ws-canvas-fps-research.md`](./waveform-ws-canvas-fps-research.md) |

---

## 5. 预判风险

| 风险 | 触发点 | 预防 / 验证 |
|------|--------|-------------|
| **层间漂移复活** | 某读者未消费浮点残差（peaks/band/overlay/ruler/playhead/pin 任一遗漏） | **单一 offset 契约**：所有读者只经 `resolveTierViewportMetricsDuringScrollFrame` 拿含 fraction 的水平量；架构守卫/测试断言无旁路读 `scrollLeft`。 |
| window 边界抖动 | scroll 整数跨阈值重算窗时，fraction 跳变 | window 重算仍按整数 `scrollLeft`；fraction 只叠加在最终 transform，不参与 `win.leftPx` 计算。 |
| 久播锚点漂移（A1） | 长时间冻结 scroll 累积浮点误差 | 周期 reconcile（如每 N 帧或 offset 超阈值）把整数部分沉回 scrollLeft。 |
| pause/seek/用户滚动过渡跳变 | offset→scrollLeft reconcile 瞬间 | reconcile 时同帧把 fraction 归零并写等效整数 scrollLeft，禁止可见跳。覆盖 `playbackFollowSuppressUntilRef`。 |
| **WKWebView 合成层滞后（1px 缝）** | DOM `translate3d` 立即提交 GPU，Canvas 2D/原生 scrollLeft 延迟 1 帧 → 播放头与波形拉伸/分离 | **所有**参与层开机即静态 `will-change: transform; transform: translate3d(0,0,0)`（同一合成上下文）；**禁止**播放时动态加 will-change（Layer Promotion Tearing 白屏）。 |
| **double-count** | pin 层与内容层都叠加 fraction | fraction 全局只消费两次且相互抵消（内容层 -fraction；playhead effectiveScroll +fraction），播放头固定 vw/2；见 plan §1.1。 |
| hook / coordinator 超阈值 | 继续堆 `useWaveformPlaybackScrollFollow` | fraction 广播落 coordinator/service，不在 hook 内堆状态。 |
| edge 模式回归 | 误把 fraction 应用到 edge | fraction 仅 `center && playing` 生效；edge 与用户滚动路径零改动。 |

---

## 6. 落位预告（非最终实现，spike 后定稿）

| 层 | 文件 / 模块 | 变更类型 |
|----|-------------|----------|
| 协调器 | `tierScrollFrameCoordinator.ts` | 帧内暴露/广播 `playbackFractionalPx`（或 `viewportOffsetPx`）；仅 center+playing 有值 |
| 读路径 | `waveformViewport.ts`（`resolveTierViewportMetricsDuringScrollFrame`） | 返回值并入 fraction，成为**唯一**水平真源出口 |
| follow hook | `useWaveformPlaybackScrollFollow.ts` | center 落地：写 `round(target)` + 上报 `target-round` 残差（A2）；或冻结 + 报浮点 offset（A1） |
| pin 层 | `waveformScrollPinnedLayers.ts` | `translate3d` 叠加 fraction |
| 内容 canvas | `WaveformViewportPeaksCanvas.tsx` / `WaveformSegmentBandCanvas.tsx` | shell/canvas 位置叠加 fraction（window 重算不变） |
| chrome | `WaveformViewportPlayhead.tsx` / `useWaveformRulerScrollTrack.ts` / `WaveformSegmentOverlay` | 统一读含 fraction 的水平量；playhead 回到 pin 中线 + 子像素 |
| sync | `useTierScrollSync.ts` | reconcile：pause/seek/用户滚动时归零 fraction、沉回整数 scrollLeft |
| 文档 | `desktop-waveform-engine.md` §播放跟随 | 补「播放期水平真源 = 整数 scrollLeft + 共享浮点残差」契约 |
| 测试 | `useWaveformPlaybackScrollFollow.test.ts`、`WaveformViewportPlayhead.test.tsx`、coordinator/pin 测试 | center fraction 广播、reconcile 归零、edge 不受影响、无旁路读 scrollLeft |

---

## 7. 签收

- [x] 调研 brief 完成（含前序边界 + 业内路线 + 两候选形态 + 防漂移契约）
- [x] plan 已链接本文（A2 锁定 + 符号契约）
- [x] A2 spike 骨架落地（flag-gated，`PLAYBACK_SUBPIXEL_ENABLED`）；typecheck / 定向 test / guard / lint 全绿
- [ ] **待用户桌面手测**：极低 zoom center 顺滑 + `SUBPIXEL_DEBUG_AMPLIFY=10` 染色验符号；通过后收敛终态（去 flag / 补 acceptance）

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-07-14 | 初版：对照 Logic/Audition scroll-in-play（内容浮点 transform）与已否决的 Peaks frameOffset；确定窄薄片 = center+playing 单一浮点水平真源；划清与 VRP / unified-scroll-stage / WR/SEL/WS-FPS 边界 |
