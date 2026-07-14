# 波形区视觉精修 — Stitch 需求文档

> **真源：** 设计系统见仓库根 [`DESIGN.md`](../../../DESIGN.md)（Notion Zen）。  
> **代码对照：** [`EditorWaveformPane.tsx`](../src/components/editor/EditorWaveformPane.tsx)、[`waveform.css`](../src/styles/components/waveform.css)。  
> **静态原型：** [`stitch-waveform-polish-layout.html`](../stitch-waveform-polish-layout.html)（同步为 `docs/stitch-upload/20-stitch-waveform-polish-layout.html`）。

## 0. 本轮目标

在 **Notion Zen** 基线上，精修 **校对工作页（阶段 C）波形舞台**，使其实现稿与 Stitch 稿一致，并达到专业转写/DAW 工具的 **可读性 + 编辑 affordance** 标准。

**不在本轮（Stitch 视觉）：** 改 scroll/zoom 架构、改语段列表布局。  
**交互真源（已实现，供验收对照）：** 语段 tap 两段式 seek、缩放栏 `layoutIntent` 互斥高亮、fit-selection 下点语段 re-fit — 见 [`desktop-waveform-engine.md`](../../../docs/architecture/desktop-waveform-engine.md)。

**适用：** Stitch 出图 → 回写 token / CSS → 对照 HTML 原型验收。

---

## 1. 视觉定位

| 维度 | 要求 |
|------|------|
| 风格 | Notion Zen — `notion-sidebar` 壳 + 白底 peaks + saffron 强调 |
| 气质 | 冷静、专业、低装饰；像 Notion 嵌入块 + Logic 时间轴的混合 |
| 参照（仅借鉴形态，不抄色） | Descript 语段色带、Premiere 全高 playhead、Logic 嵌入标尺 |
| 禁止 | 第三层容器 border；硬编码 hex；纸感 cream 全铺盖波形（`paper` 留给语段卡） |

---

## 2. 信息架构（与代码一致）

自上而下 **单一波形列**（主区扣掉工具条后的 flex-1 区域顶部）：

```text
┌─ [可选] Minimap 56px（zen-paper 底）──────────────────────┐
│  灰 peaks 缩略（垂直居中）+ saffron 视口框 + playhead 竖线  │
├─ Tier 横向滚动区 (高度 ≈ 220–280px，可拖拽下边放大) ───────┤
│  ┌ sticky 视口宽 ─────────────────────────────────────┐  │
│  │ 白底 peaks 柱形 (zen-wf-wave / zen-wf-progress)      │  │
│  │ z-3 语段 overlay（全高竖条，左右边线）               │  │
│  │ z-8 选中语段播放控件（底边上方，居中于语段）         │  │
│  │ z-10 嵌入时间尺 22px（透明叠在波形底边，无刻度背景带）│  │
│  └────────────────────────────────────────────────────┘  │
│  （timeline 宽于视口 → 横向滚动；语段/标尺随 timeline 移动）│
├─ Bottom toolbar 40px ─────────────────────────────────────┤
│  左：Transport（播放/时间/倍速/跳转）  右：Zoom 簇          │
└───────────────────────────────────────────────────────────┘
         ↓ 下方接语段列表（本轮不 redesign）
```

**z-index 栈（勿改层级关系）：** peaks z-1 → overlay z-3 → region-action z-8 → ruler z-10 → 状态 banner z-30。

---

## 3. 设计令牌（必须来自 DESIGN / tokens）

### 3.1 表面

| 区域 | Token | 值 |
|------|-------|-----|
| Tier 外壳 / minimap 底 | `notion-sidebar` | `#f7f7f5` |
| Peaks 画布 | `waveform-surface` / `zen-wf-surface` | `#ffffff` |
| 底栏 / header 类条 | `notion-sidebar` 80–92% mix | — |

### 3.2 波形绘制

| 语义 | Token | 当前值 | Stitch 可微调方向 |
|------|-------|--------|-------------------|
| 未播放 peaks | `zen-wf-wave` | `#c4c4c8` | 略暖或略深，保持与 sidebar 对比 |
| 已播放 peaks | `zen-wf-progress` | `#8e8e93` | **建议** 向 `saffron-mid` 15–25% mix，与品牌一致 |
| Playhead 线 | `zen-wf-cursor` | `#6a6a6f` | **建议** 2px `saffron-mid` 全高竖线（可保留 WS progress tint 作辅） |

### 3.3 语段 overlay

| 状态 | 填充 | 边线 |
|------|------|------|
| 默认 | `ink` 或 `waveformRegionLaneIdle` 18–22% | 左右 1px `notion-text` 12% |
| 选中 | `ink` 24–28% 或 saffron 12% | 左右 2px `zen-saffron` 55%；inset saffron 竖条 |
| 低置信 | `waveformRegionLaneLow` 32% | 与语段卡 amber 语义一致 |
| 框选预览 | `zen-indigo` 18% + 虚线左右边 | 新建语段拖拽 |

### 3.4 强调色

- 主操作 / 选中 / minimap 视口框：`zen-saffron` `#C58A43`
-  destructive： `zen-cinnabar`
- 文字：`notion-text` / `notion-text-muted`

---

## 4. 组件规格

### 4.1 Minimap（`WaveformMinimapStrip`，56px）

- 全宽；**无**上下 border / **无** horizontal padding；背景 `zen-paper`（`#F2EFE8`），与下方 40px sidebar 底栏以色块分层。
- Canvas：同主波形 peak 色；柱形**相对中线垂直居中**（上下 ~22% 留白）。
- **视口框：** `border saffron/35`，`bg saffron/10`，`rounded-sm`（2–4px）。
- **Playhead：** 2px 竖线，`saffron-mid` 混色。
- 点击 well：seek + 滚动主视口对齐点击时刻。

### 4.2 主波形 Peaks

- Sticky 视口宽；高度随「波形高度拖拽」变化（默认 ~220–250px 视觉区）。
- 柱形：`barWidth 2` + `gap 1` + `radius 2`（与 WaveSurfer 一致）。
- 底边 **22px 嵌入标尺**，无刻度背景条；刻度从波形底边向上生长。
- **Playhead（待精修）：** 全高 1–2px 线 + 标尺三角头（可选）；与 progress tint 并存时 playhead 线必须更清晰。

### 4.3 嵌入时间尺（22px）

- `appearance: embedded`，`overlayOnWaveform: true`。
- Major tick + label（`tabular-nums`，11–12px，`notion-text/72`）。
- Minor tick 更短；**底边可选 8px 高 gradient fade**（`paper/white 0→40%`）提升刻度可读性，**不加 border 容器**。
- 标尺 playhead 可与 WS 合并：若保留 WS progress，标尺可 suppress playhead。

### 4.4 语段 Overlay

- **全高**竖向区域（与 peaks 同高，不含标尺带时可全高至 tier 底）。
- 仅 **左右 border**，`border-radius: 0`。
- **Handle（Stitch 必画）：** 选中或 hover 时，左右各 3px 宽竖向 grip（`saffron/50`），`ew-resize` 光标区 8px。
- **Lane（探索）：** 重叠语段可用 70–85% 高度 band + lane 间距，避免全高叠影（若信息过密可只做选中语段全高）。
- **点击（已实现）：** 首次点未选中语段 → 选中 + playhead 到语段头；已在该语段内再点 → playhead 到点击位置（`resolveSegmentOverlayTap`）；语段播放：段内从 playhead；**已过段尾从 playhead 续播**；段前仍跳段头。

### 4.5 语段内联播放控件（`WaveformSegmentPlaybackControls`）

- 位置：语段水平中心，**底边 = 标尺顶 + 4px**。
- 按钮 24×24；窄语段隐藏倍速/循环。
- **Stitch 建议：** 控件组外包 `notion-bg/85` pill + hairline，opacity 选中 100% / 默认 85%。

### 4.6 底栏 Transport + Zoom（40px）

- 背景：`notion-sidebar` 88% mix + 顶内阴影；与 minimap `zen-paper` 以色块区分。
- **左簇：** 播放 30px 圆钮（**统一 Lucide 风格**）、时间 `tabular-nums`、倍速、跳转输入 4.25rem。
- **右簇：** 波形总览 switch | `BoxMargin` 适配语段 | `ArrowAutofitWidth` 整段可见 | sep | ZoomOut | ZoomIn | ZoomReset（Tabler）。
- Active zoom 模式：`icon-btn-active`（saffron 18% 底）；`layoutIntent` 驱动互斥（`manual` 时三者均不亮）。

---

## 5. 必出 Frame（Stitch）

| # | Frame | 说明 |
|---|-------|------|
| F1 | **默认编辑** | Minimap 开；3+ 语段；1 选中；playhead 在 30%；底栏完整 |
| F2 | **放大语段** | px/s 高；选中语段宽 >120px；显示 handle grip + 内联控件 + 可选 speaker/time chip |
| F3 | **Peaks 加载** | 中心 status「正在生成波形…」；minimap pending 遮罩 |
| F4 | **Minimap 关** | 仅主 tier + 底栏（设置项关闭 minimap） |
| F5 | **窄窗** | 视口宽约 900px；底栏 zoom 区可截断；transport 不折行优先 |
| F6 | **低置信语段** | overlay + 下方语段卡 amber 语义一致 |

---

## 6. 间距与尺寸（硬约束）

| 元素 | 尺寸 |
|------|------|
| Minimap 高 | 56px（`zen-paper` 底，peaks 垂直居中） |
| 嵌入标尺 | 22px |
| 底栏 | 40px |
| 播放钮 | 30×30px，圆形 |
| Icon 按钮 | 30×30px，6px radius |
| 语段 handle 热区 | 8px 宽 |
| Tier 默认可视高 | 220–250px（Comfort）；可拖拽放大 |

---

## 7. Stitch 提示词（主提示，可复制）

```text
Design the waveform stage for a desktop Chinese transcription editor (Rushi) in Notion Zen style.

Context: Notion-neutral surfaces (#f7f7f5 sidebar, #ffffff waveform canvas) with warm saffron (#C58A43) accents. This is NOT a dark DAW timeline. Below the waveform is a transcript list (out of scope—show only a thin placeholder strip).

Structure top to bottom:
1) Optional 56px minimap on zen-paper (#F2EFE8): centered gray waveform thumbnail, saffron viewport rectangle, thin playhead line; no outer border/padding.
2) Main waveform tier (~240px tall, horizontally scrollable): white canvas with gray vertical peak bars; played portion slightly darker/warmer; FULL-HEIGHT vertical playhead line in saffron-mid (2px).
3) Segment overlays: full-height translucent vertical bands with LEFT/RIGHT borders only (no top/bottom border). Selected segment: saffron edge accents + visible 3px resize grips on left/right. Floating mini transport pill centered on selected segment, just above the time ruler.
4) Embedded time ruler (22px) overlaid on bottom of waveform—transparent background, ticks growing upward from bottom edge, tabular-nums labels.
5) Bottom toolbar (40px, notion-sidebar tint): left = play/pause, timecode, speed, go-to-time; right = minimap toggle (`LayoutBottombar`), BoxMargin fit-segment, ArrowAutofitWidth fit-all, ZoomOut/ZoomIn/ZoomReset — Tabler MIT.

Deliver frames: default, zoomed-in selected segment with handles, loading state, narrow window.

Typography: Inter only. Timecode: tabular nums. No drop shadows except floating pills/menus. Max 2 visible border layers on nested containers—use background tone for depth.

Reference tokens in uploaded 01-DESIGN.md. Match layout proportions in uploaded 20-stitch-waveform-polish-layout.html.
```

---

## 8. Stitch 提示词（中文补充）

```text
为中文转写桌面应用 Rushi 设计「波形舞台」精修稿，风格 Notion Zen。

层次：可选 56px 总览 minimap（zen-paper 底，peaks 居中）→ 主波形横向滚动区（白底灰 peaks + saffron 播放头竖线）→ 语段透明竖条 overlay（仅左右边线，选中显示拖拽 grip；tap 两段式 seek）→ 底部嵌入 22px 时间尺（无背景带）→ 40px 底栏（播放簇 + Lucide 缩放簇）。

重点精修：1) playhead 全高清晰可见；2) 已播放 peaks 略带 saffron 暖色；3) 选中语段 handle 与内联播放控件 pill；4) minimap 视口框与 playhead；5) 与 DESIGN.md token 一致，禁止随意 hex。

出 6 个状态帧：默认、放大选中、加载中、无 minimap、窄窗、低置信语段。
```

---

## 9. 验收清单

- [ ] 与 `01-DESIGN.md` Notion Zen token 一致，波形小节有对应色
- [ ] DOM 层级与 §2 一致（minimap / tier / overlay / ruler / toolbar）
- [ ] Playhead 在全高波形上可一眼定位
- [ ] 语段 overlay 仅左右边线；选中态 saffron 语义明确
- [ ] Handle grip 在选中/hover 态可见
- [ ] 嵌入标尺无独立白条背景
- [ ] 底栏 transport 与 zoom 分组清晰；active 缩放态可辨
- [ ] 6 个 Frame 齐全
- [ ] 窄窗不断裂 transport 主路径

---

## 10. 回写代码路径（Stitch 定稿后）

| Stitch 决策 | 落码位置 |
|-------------|----------|
| 波形色 / playhead | `tokens.ts`, `tailwind.config.js`, `useProjectWaveformMount.ts` |
| 语段 overlay / handle | `waveform.css`, `segmentChrome.ts` |
| Minimap / 标尺 | `WaveformMinimapStrip.tsx`, `WaveformTimeRulerCanvas.tsx`, `waveform.css` |
| 底栏控件 | `waveform.css`, `EditorWaveformPane.tsx`, `WaveformZoomBar.tsx` |
| 设计真源 | 仓库根 `DESIGN.md` → `prepare-stitch-upload.sh` |

验证：`npm run typecheck && npm run test && node scripts/check-architecture-guard.mjs`
