# 波形语段视觉分层 — Stitch 需求文档

> **真源：** 根 [`DESIGN.md`](../../../DESIGN.md) Notion Zen。  
> **代码对照：** [`tokens.css`](../src/styles/tokens.css)、[`segmentFillTokens.ts`](../src/config/segmentFillTokens.ts)、[`waveform.css`](../src/styles/components/waveform.css)、[`drawWaveformSegmentBands.ts`](../src/services/waveform/drawWaveformSegmentBands.ts)。  
> **静态原型：** [`stitch-waveform-segment-visual-layout.html`](../stitch-waveform-segment-visual-layout.html)。

## 1. 背景

当前波形存在两类视觉困惑：

- 普通语段灰色 band 过重，容易被误认为“语段实体”，尤其在空白/静音区残影或密集片段附近。
- 相邻语段边界不够稳定，两个语段会看起来像一个整体，用户点击后才发现只选中了前半段。

这次 Stitch 目标不是改交互架构，而是设计一套更清晰、更美观、可主题化的 **波形语段视觉语言**。

## 2. 设计目标

- **波形本体优先：** peaks 是主视觉，segment band 只是辅助阅读层，不应压住波形。
- **边界恒定可见：** 相邻语段即使同色、无间隙，也必须能看出分割点。
- **状态分层明确：** selected / in-selection / idle / low-confidence / gap 不靠同一种灰块表达。
- **空白区域透明：** 无真实语段的时间窗不要出现像语段的灰色块。
- **主题色适配：** 所有颜色必须来自 `--segment-fill-*` / `--accent-action*` / `--notion-*` token，不新增组件内 hex。

## 3. 当前代码约束

### 3.1 Token 真源

```css
--segment-fill-selected
--segment-fill-selected-list
--segment-fill-in-selection-list
--segment-fill-in-selection-waveform
--segment-fill-visited
--segment-fill-idle
--segment-fill-low-confidence
--segment-fill-border
--segment-fill-selected-border
--segment-fill-in-selection-border
--zen-wf-wave
--zen-wf-progress-played
--zen-wf-played-wash
```

Stitch 可以调整比例，但不要引入新色板。落码时会修改 `tokens.css`，canvas 通过 `readWaveformSegmentBandPalette()` 读取并解析。选中高亮必须跟 `--accent-action*`，禁止锁死红色/danger。

### 3.2 当前实现层

| 层 | 代码 | 职责 |
|---|---|---|
| peaks canvas | `WaveformViewportPeaksCanvas` | 主波形，保持最高可读性 |
| segment band canvas | `drawWaveformSegmentBands` | 普通语段底色 + canvas-owned 边界 |
| DOM overlay | `WaveformSegmentRegionItem` | selected / hover / drag handles / low-confidence affordance |
| time ruler | `WaveformTimeRulerCanvas` | 底部时间信息，不应抢语段边界视觉 |

## 4. 推荐视觉方案

### 4.1 基础波形

- 背景：`--zen-wf-surface`，保持白底。
- 未播放 peaks：`--zen-wf-wave`，柔和中性灰。
- 已播放区：`--zen-wf-played-wash` 淡化（中性，不锁 accent，无斜纹）；WS progress 淡色用 `--zen-wf-progress-played`。
- playhead：`--waveform-playhead`，可比当前更清晰，建议 1.5–2px 全高线。

### 4.2 普通语段

- 面填充：`--segment-fill-idle`，非常轻，只让用户知道这里有语段范围。
- 边界：`--segment-fill-border`，1px hairline，优先保证相邻语段可分辨。
- 不加圆角，保持时间轴精确感。
- 语段边界可以在底部增加 tiny notch（可选），但必须 token-driven。

### 4.3 选中语段

- 面填充：`--segment-fill-selected`，淡 accent tint（跟主题色，禁止固定红/粉）。
- 左右边界：`--segment-fill-selected-border`，比面色强，表示“当前可编辑对象”。
- hover/selected 时显示左右 drag handle，handle 颜色从 selected-border 派生。
- 不要把整块做成厚重实心粉色；保留 peaks 可读性。

### 4.4 多选语段

- 面填充：`--segment-fill-in-selection-waveform`。
- 边界：`--segment-fill-in-selection-border`。
- Primary selected 应比其他 in-selection 更强。

### 4.5 低置信度

- 面填充：`--segment-fill-low-confidence`，不要比 selected 更重。
- 边界/handle：建议 dashed 或 subtle marker，用于表达“需要注意”，不要只靠灰块。
- 如果 Stitch 想做斜纹，必须用 token 派生，且不要影响 peaks 识别。

### 4.6 空白 / 静音 / 无语段区域

- 完全透明，展示原始 waveform 和背景。
- 点击语义是 seek，不应有 segment affordance。
- 不允许用灰色矩形表达 gap。

## 5. 必出状态 Frame

1. **Default timeline**：多个普通语段 + 一个 selected + 一个无语段 gap。
2. **Adjacent segments**：两个语段紧贴无空隙，必须能一眼看出边界。
3. **Selected segment**：淡 selected fill + 强左右边界 + handles。
4. **Multi-selection**：primary selected + secondary in-selection。
5. **Low confidence**：低置信度语段的 dashed/marker 方案。
6. **Theme preview**：默认 saffron 与非 saffron accent（如 indigo）各一帧，验证不写死颜色。

## 6. 验收标准

- 不看列表，也能判断相邻语段的分割点。
- selected 不遮挡 peaks 的节奏信息。
- gap 视觉上不像 segment。
- 换 `--accent-action` 后，selected / multi-selected / playhead / minimap viewport 同步换色。
- 低置信度与普通 idle 不混淆。
- 设计能落到现有 token，不要求新增组件结构。

## 7. 禁止项

- 禁止在组件或 CSS 里新增未入库 hex。
- 禁止用大面积深灰表示普通语段。
- 禁止用圆角 pill 表示精确时间语段边界。
- 禁止把低置信度设计成比 selected 更强的主视觉。
- 禁止新增第三层容器 border；波形区域层次靠背景、透明度和 hairline。
