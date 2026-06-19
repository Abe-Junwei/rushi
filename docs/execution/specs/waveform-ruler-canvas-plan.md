# Plan：嵌入时间尺 Canvas 化

> **Research**：[`waveform-ruler-canvas-research.md`](./waveform-ruler-canvas-research.md)  
> **Acceptance**：[`waveform-ruler-canvas-acceptance.md`](./waveform-ruler-canvas-acceptance.md)  
> **状态**：已编码（2026-06-20）  
> **估时**：3 个纵向薄片 × 2–4h（共 ~1–1.5 人日）

---

## 0. 目标与非目标

### 目标

将 **embedded overlay 时间尺**（`WaveformLiveTimeRuler` @ `EditorWaveformPeaksStage`）从：

```text
React DOM ticks + translate3d(delta) + 节流 rebuild
```

改为：

```text
Viewport Canvas + drawWaveformTimeRuler + subscribeTierScrollFrame（与 band 同范式）
```

完成后：

- scroll / 播放跟随 / wheel 热路径：**零 React commit** 驱标尺位移。
- tick 密度、可见窗、坐标投影：**复用现有纯函数**，不 fork 第二套算法。
- playhead 线仍由 `WaveformViewportPlayhead` 承担；标尺 **不画 playhead 线**（现状 `showPlayheadLine={false}` 保持）。

### 非目标

- 不改 tier scroll 真源、播放跟随 suppress 逻辑（已修复，保持）。
- 不迁移 ink/light 独立标尺条（可 Phase 2）；本 plan 只覆盖 **embedded + overlayOnWaveform + coordinateSpace=viewport**。
- 不把标尺移到 timeline 内容层。
- 不引入 WS TimelinePlugin 依赖。

---

## 1. 目标架构

### 1.1 数据流

```text
tierScrollRef.scrollLeft (DOM-first)
  └─► subscribeTierScrollFrame
        ├─► WaveformSegmentBandCanvas.paint
        ├─► WaveformViewportPlayhead.writeTransform
        └─► WaveformTimeRulerCanvas.paint   ← 新增

drawWaveformTimeRuler(ctx, {
  scrollLeftPx, viewportWidthPx, timelineWidthPx, durationSec,
  currentTimeSec, formatMediaTime, palette, interactionActive, ...
})
  └─► buildVisibleRulerTicks(paddedVisibleTimeWindow(...))  // 已有
  └─► timeToTimelinePx → viewport x = timelinePx - scrollLeftPx
```

### 1.2 DOM（embedded 路径）

```text
waveformStickyShellRef (sticky, width=viewport)
  WaveformViewportPlayhead
  div.pointer-events-auto
    canvas.waveform-time-ruler-canvas   ← 新增 z 与 band 协调
    div.ruler-hit-layer (optional)      ← pointer drag/click，或 canvas 承担
```

删除 embedded 路径下：

- `WaveformTimeRulerTickLayer` 挂载
- `useWaveformTimeRulerMetrics` 的 viewport translate / bumpTickWindow
- `WaveformTimeRuler` 内 `viewportTickLayerRef` translate effect

---

## 2. 实施阶段（纵向薄片）

### R0 — 契约与纯函数（~2h）

**交付**

| 文件 | 内容 |
|------|------|
| `services/waveform/drawWaveformTimeRuler.ts` | 纯函数：清屏、minor/major 竖线、label `fillText`、interaction 高亮 major |
| `services/waveform/drawWaveformTimeRuler.test.ts` | 用 mock ctx 断言 tick 数量、viewport x 公式、label stride |
| `utils/waveformRulerCanvasColors.ts` | `readWaveformRulerCanvasPalette()` — resolve CSS vars |

**接口草案**

```typescript
export type DrawWaveformTimeRulerInput = {
  ctx: CanvasRenderingContext2D;
  scrollLeftPx: number;
  viewportWidthPx: number;
  timelineWidthPx: number;
  durationSec: number;
  currentTimeSec: number;
  formatMediaTime: (sec: number) => string;
  embeddedOverlay: true;
  interactionActive: boolean;
  palette: WaveformRulerCanvasPalette;
};

export function drawWaveformTimeRuler(input: DrawWaveformTimeRulerInput): void;
```

**验证**：`npm run test -- drawWaveformTimeRuler` 绿；无 UI 改动。

---

### R1 — Canvas 组件 + 接线（~3h）

**交付**

| 文件 | 内容 |
|------|------|
| `components/WaveformTimeRulerCanvas.tsx` | 镜像 `WaveformSegmentBandCanvas`：tierScrollRef、subscribeTierScrollFrame、subscribeAppAppearance、DPR resize |
| `components/WaveformTimeRulerCanvas.test.tsx` | mount + flushTierScrollFrame 后 canvas 有像素（或 spy draw） |
| `EditorWaveformPeaksStage.tsx` | `WaveformLiveTimeRuler` → `WaveformTimeRulerCanvas` + 保留 interaction props |
| `hooks/useWaveformTimeRulerInteraction.ts` | 复用；`liveScrollLeftPx` 仍从 tier DOM 读 |

**组件要点**

- Canvas 尺寸：`width = viewportWidthPx`, `height = 22`, `pointer-events: none`（hit 层单独处理）。
- Paint 读：`resolveTierViewportMetrics`（与 band 一致）。
- 不在 `useEffect` 里 listen scroll — **只** `subscribeTierScrollFrame`。

**验证**：typecheck；手测打开 Editor 可见底边刻度；快速横滚无 React profiler commit 风暴。

---

### R2 — 交互 + 清理 + 文档（~2–3h）

**交付**

- **交互**：pointer down on 22px 区域 → 现有 `useWaveformTimeRulerInteraction`（drag scrub / click seek）；hit 层 `absolute inset-0` 透明 div。
- **删除 dead code**（embedded 路径）：
  - `WaveformTimeRuler.tsx` 中 embedded overlay 分支（或整文件仅留 ink/light stub）
  - `useWaveformTimeRulerMetrics.ts` viewport translate 逻辑
  - 生产移除 `useWaveformRulerScrollTrack` import（文件可保留给测试或删除）
- **文档**：更新 `desktop-waveform-engine.md` §舞台 DOM、§chroming 表、scroll 热路径描述。
- **守卫**：`viewportChromeTransformAllowlist` 移除 ruler scroll-track；可选新增「embedded ruler 禁止 DOM translate」规则。

**验证**： acceptance 全矩阵 + 项目闸门。

---

## 3. 与现有模块对齐清单

| Concern | 对齐方式 |
|---------|----------|
| Scroll 读取 | `resolveTierScrollLeftPx` / `resolveTierViewportMetrics` |
| 可见窗 | `paddedVisibleTimeWindow`（1.5×，与 band 一致） |
| Tick 步长 | `buildVisibleRulerTicks` — **禁止复制** |
| 帧合并 | `scheduleTierScrollFrame` / `flushTierScrollFrame`（wheel 已 flush） |
| 主题色 | `readWaveformRulerCanvasPalette` + `subscribeAppAppearance` |
| 播放时间 | `currentTimeSec` 来自 `useWaveformLiveClock`；仅 major 高亮，不每帧 React 画 tick |
| Playhead | 仍 `WaveformViewportPlayhead`；标尺不重复画线 |
| CSP | canvas layout 经 `setCspLayoutRules`；禁止 `el.style` |

---

## 4. 风险与缓解

| ID | 风险 | 缓解 |
|----|------|------|
| R1 | Retina 下文字糊 | `ctx.scale(dpr,dpr)`；font-size 11px 对齐 `text-label` |
| R2 | 长音频 label 过多 | 沿用 `computeEmbeddedRulerLabelStride`；viewport cull |
| R3 | 点击寻位偏移 | hit 层用 tier clientX + `liveScrollLeftPx`；单测 `clientXToTimeSec` 不变 |
| R4 | 与 band 争 rAF | 同 `subscribeTierScrollFrame` Set 顺序无关；避免 paint 内 DOM 读以外的重计算 |
| R5 | ink/light 回归 | 本 plan 不删 `WaveformTimeRuler` ink/light 分支；guard 区分路径 |

---

## 5. 编码顺序（禁止跳步）

1. R0 纯函数 + 测试（无 UI）
2. R1 Canvas 组件 + Editor 接线
3. R2 交互 + 删 dead code + doc + guard
4. Acceptance 手测矩阵
5. 可选 Phase 2：ink/light 标尺 Canvas 化（另开 acceptance 附录）

---

## 6. 完成定义

```bash
npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs
```

且 [`waveform-ruler-canvas-acceptance.md`](./waveform-ruler-canvas-acceptance.md) 手测矩阵全部勾选。

**变更记录**

| 日期 | 说明 |
|------|------|
| 2026-06-20 | 初版 Plan：R0–R2 三薄片 + 架构对齐 |
