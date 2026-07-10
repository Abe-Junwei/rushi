# 波形语段视觉分层 — 定稿

> **状态：定稿 ✅**（非待 Stitch 补帧；画面已直接产出）  
> **真源：** 根 [`DESIGN.md`](../../../DESIGN.md) Notion Zen。  
> **交互原型：** [`stitch-waveform-segment-visual-layout.html`](../stitch-waveform-segment-visual-layout.html)  
> **定稿画面：** [`stitch-waveform-frames/`](./stitch-waveform-frames/)  
> **代码对照：** [`tokens.css`](../src/styles/tokens.css)、[`segmentFillTokens.ts`](../src/config/segmentFillTokens.ts)、[`waveform.css`](../src/styles/components/waveform.css)、[`drawWaveformSegmentBands.ts`](../src/services/waveform/drawWaveformSegmentBands.ts)。

## 1. 问题

- 普通语段灰块过重，易被当成实体；gap 若残留灰块会误导点击。
- 相邻语段同色紧贴时，边界不够稳，看起来像一整段。
- 多选时 primary / secondary 层级不清；已播放若用大面积斜纹会压住 peaks。

## 2. 定稿原则

1. **Peaks first** — band 只是辅助阅读层；idle ≤ 5% text，selected ≤ 14% accent。
2. **Boundary constant** — 相邻无空隙靠 hairline；selected 用更强 border + 左右 handles。
3. **Gap = nothing** — 无真实 `segments[]` 的时间窗零填充；点击 = seek。
4. **Played = wash only** — 播放头左侧用 `--zen-wf-played-wash` 淡化；未播放 peaks 用柔和 `--zen-wf-wave`。禁止斜纹底，禁止把已播放区锁成 accent/红色实心 tint。
5. **Token only** — 颜色全部来自 `--segment-fill-*` / `--accent-action*` / `--zen-wf-*`，组件内禁止新 hex。选中高亮跟主题 accent，禁止 danger/cinnabar。

## 3. Token 真源

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
--waveform-playhead
--zen-wf-wave
--zen-wf-progress-played
--zen-wf-played-wash
```

换 shell accent（如 indigo）时，selected / in-selection / playhead / minimap 同步换色；已播放 wash 保持中性，不跟 accent。

## 4. 分层职责

| 层 | 代码 | 职责 |
|---|---|---|
| peaks canvas | `WaveformViewportPeaksCanvas` | 主波形 + played tint |
| segment band canvas | `drawWaveformSegmentBands` | idle / in-selection 底色 + canvas-owned 边界 |
| DOM overlay | `WaveformSegmentRegionItem` | selected / hover / handles / low-confidence dashed |
| time ruler | `WaveformTimeRulerCanvas` | 底部时间，不抢边界 |

## 5. 定稿 Frame（已交付）

| ID | 内容 | 文件 |
|---|---|---|
| F1 | Default + 透明 gap + selected + low-conf | [`waveform-f1-default-gap.png`](./stitch-waveform-frames/waveform-f1-default-gap.png) |
| F2 | 相邻 idle 紧贴 + hairline + selected | [`waveform-f2-adjacent-boundaries.png`](./stitch-waveform-frames/waveform-f2-adjacent-boundaries.png) |
| F3 | 多选层级（primary + handles / secondary） | [`waveform-f3-multi-select.png`](./stitch-waveform-frames/waveform-f3-multi-select.png) |
| F4 | Indigo accent 主题验证 | [`waveform-f4-accent-indigo.png`](./stitch-waveform-frames/waveform-f4-accent-indigo.png) |

HTML 内另有同结构的 token 驱动可交互原型，与上表画面一致。

## 6. 状态映射

| 状态 | Fill | Border | Affordance |
|---|---|---|---|
| idle | `--segment-fill-idle` | `--segment-fill-border` hairline | 无 |
| visited | `--segment-fill-visited` | `--segment-fill-border` hairline | 中性 10% text，弱于 selected |
| selected (primary) | `--segment-fill-selected` | `--segment-fill-selected-border` | 左右 handles |
| in-selection | `--segment-fill-in-selection-waveform` | `--segment-fill-in-selection-border` | 无 handle |
| low-confidence | `--segment-fill-low-confidence` | dashed border | 弱于 selected |
| gap | transparent | none | seek only |
| played | wash | n/a | `--zen-wf-played-wash`（中性，非 accent） |

## 7. 验收

- 不看列表也能判断相邻语段分割点。
- selected 不遮挡 peaks 节奏。
- gap 视觉上不像 segment。
- 换 `--accent-action` 后 selected / multi / playhead 同步换色。
- 低置信与 idle 不混淆；不比 selected 更抢眼。
- 无组件内未入库 hex；无第三层容器 border。

## 8. 禁止项

- 大面积深灰 idle / 斜纹 played 底 / 圆角 pill 语段边界。
- 组件或 CSS 新增未入库 hex。
- 低置信做成比 selected 更强的主视觉。
