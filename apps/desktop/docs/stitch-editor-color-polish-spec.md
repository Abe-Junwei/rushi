# 编辑区配色精修 — Stitch 需求文档

> **真源：** 仓库根 [`DESIGN.md`](../../../DESIGN.md)（Notion Zen × Serene Scholar 暖色）。  
> **欢迎页对照：** [`stitch-welcome-page-spec.md`](./stitch-welcome-page-spec.md) §3 令牌与侧栏/active 语义。  
> **布局冻结：** 本稿 **只改配色与表面层次**，**禁止**改 DOM 结构、尺寸、间距、控件位置。布局真源见 [`16-stitch-editor-comfort-spec.md`](../../../docs/stitch-upload/16-stitch-editor-comfort-spec.md) 与现网 [`EditorView.tsx`](../src/components/EditorView.tsx)。  
> **波形子域：** 波形舞台细节与 [`19-stitch-waveform-polish-spec.md`](../../../docs/stitch-upload/19-stitch-waveform-polish-spec.md) 对齐；本稿覆盖编辑主列 **全表面配色关系**，波形区不重复改 scroll/zoom 架构。  
> **代码对照：** `EditorView` / `EditorToolbar` / `EditorSegmentToolbar` / `EditorWaveformPane` / `SegmentTextListRow` / `workspace.css` / `waveform.css` / `tokens.ts`。

---

## 0. 本轮目标

在 **不改变布局** 的前提下，为 **阶段 C 校对工作页主编辑列**（工具条 → 波形 → 语段列表 → 底栏）输出一版 Stitch 配色方案，使：

1. 与 **欢迎页 / 左轨侧栏** 的 Notion Zen 中性底 + saffron 强调 **同一套气质**；
2. 在现网基础上 **收敛 legacy 暖色用法**（`zen-ochre` 平铺、`amber-*` 散落类名），改为 **token + color-mix** 的可维护层次；
3. 提升 **语段行 / 波形 / 工具条** 之间的 **表面分层可读性**，避免「全白一片」或「选中块过黄」。

**不在本轮：** 改布局参数、改信息架构、改左轨结构、改浮动对话框尺寸、改波形交互架构。  
**适用流程：** Stitch 出图 → 对照验收帧 → 回写 `tokens.ts` / `tokens.css` / 组件 class / `workspace.css`（**非** layout 文件）。

---

## 1. 问题陈述（现状 vs 目标）

### 1.1 用户场景

用户从 **欢迎页**（暖纸感 callout、saffron 主按钮、侧栏 `notion-sidebar`）进入 **编辑页** 后，期望仍是「同一产品、同一笔记本气质」——冷静、专业、略带 scholarly 暖色，而非突然变成冷白工具页。

### 1.2 现网配色概况（2026-06）

| 区域 | 现网主要 class / token | 问题 |
|------|------------------------|------|
| 主壳 / 顶栏 / 底栏 | `notion-bg` + `notion-divider` | 与欢迎页一致，但 **缺少 subtle 暖底过渡**，中间编辑带偏「纯白 SaaS」 |
| 工具条 | `notion-bg` / hover `notion-sidebar-hover` | Active 段用 `notion-sidebar`，与欢迎侧栏 nav active 一致 ✅ |
| 波形外壳 | `notion-sidebar`；peaks 白底 | 与 [`19-stitch-waveform-polish-spec`](../../../docs/stitch-upload/19-stitch-waveform-polish-spec.md) 一致；**旧 work-page spec 写 `bg-zen-ink` 已过时** |
| Minimap | `zen-paper` 底 | 与下方 sidebar 底栏有色块分层 ✅；需与语段区 **纸感呼应** 而非孤立 |
| 语段行 hover | `notion-sidebar/20` | 过淡，长列表扫视时 **行界不清** |
| 语段行选中 | `bg-zen-ochre/45` + `border-notion-border` | ochre 面积偏大，**与 welcome primary 的 saffron 强调不一致** |
| 低置信 | 列表：`amber-*`（`segmentChrome.ts` 遗留）/ 行：`zen-ochre`；波形：灰 mix | **三处语义未统一**，且部分违反「禁止散落 Tailwind 色名」 |
| 错词 / 选区 | `zen-saffron` dotted underline | 与 DESIGN 一致 ✅ |
| 无音频空态 | `text-zen-stone` | 可改为 `notion-text-muted` 统一 chrome 文案色 |

### 1.3 优化方向（Stitch 应探索、实现须落 token）

- **壳层：** 保持 `notion-bg` 主内容白，但语段滚动区可用 **极淡 `zen-paper` 2–4% mix** 或 `notion-callout-bg` 作「纸感衬底」，与 welcome hero 区暖 undertone 衔接（**不是**全屏 cream）。
- **强调：** Primary / 选中 / playhead / minimap 框 **统一 saffron 家族**（`zen-saffron` / `zen-saffron-mid`），ochre 仅作 **低置信背景 mix 成分**，不再整块 `ochre/45`。
- **低置信：** 列表 + 波形 overlay **同一 amber/saffron 语义轴**（参考 DESIGN `ochre` + `saffron-light` mix），禁用裸 `amber-50` / `amber-200`。
- **分层：** 波形区 `notion-sidebar` → 语段区略暖白 → 底栏回 `notion-bg`；用 **背景色差** 分区，**不增加** 第 3 层容器 border（遵守 Two-Layer Visible Container Rule）。
- **阴影：** 仅 popover / dropdown / 浮动层；语段行 **默认无 shadow**，选中仅 `inset 1px notion-border` 或 saffron 22% 边。

---

## 2. 硬约束（布局与结构 — 禁止改动）

以下尺寸与结构 **必须与现网 / Comfort spec 一致**，Stitch 稿仅替换 fill / stroke / text color：

| 区块 | 冻结参数 | 真源 |
|------|----------|------|
| 顶栏（无文件时） | `h-12`，`px-4 lg:px-10` | `EditorView.tsx` |
| 工具条 | 单行 + 可选第二行，`border-b`，`px-page-margin` | `EditorToolbar.tsx` |
| 语段工具条 | `h-14`，`px-6` | `EditorSegmentToolbar.tsx` |
| 波形区高度 | 可拖拽，Comfort 230–250px 量级 | `EditorWaveformPane.tsx` |
| 语段行 | min 60px+，`px-[9px] py-[9px]`，`rounded-md` | `SegmentTextListRow.tsx` |
| 底栏 | `h-[30px]`，`border-t` | `EditorView.tsx` |
| 左轨（若同框出图） | `w-80` / `lg` 侧栏，**仅配色跟随 welcome** | `WelcomeSidebar.tsx` 模式 |

**禁止：** 增删列、改按钮位置、改波形/列表比例、新增装饰性卡片框、第三层嵌套 border。

---

## 3. 信息架构（配色标注用 — 结构不变）

```text
┌─ EditorToolbar（notion-bg，底 divider）────────────────────────────┐
├─ EditorWaveformPane ───────────────────────────────────────────────┤
│  [Minimap 56px — zen-paper]                                         │
│  [Tier — notion-sidebar 壳 + 白 peaks + overlay]                    │
│  [Transport + Zoom 底栏 — notion-sidebar mix]                       │
├─ EditorSegmentToolbar（notion-bg）──────────────────────────────────┤
├─ EditorSegmentList 滚动区（★ 本轮纸感衬底优化区）────────────────────┤
│  语段行 × N：timestamp | 正文 textarea                               │
├─ Footer 30px（notion-bg，顶 divider）────────────────────────────────┤
└─────────────────────────────────────────────────────────────────────┘
```

左轨若纳入同一 Stitch 画布：**仅**复用 welcome 侧栏 token（`notion-sidebar` / active / hover），不改块序。

---

## 4. 设计令牌映射表（Stitch 必用，禁止 hex 直写）

实现真源：`apps/desktop/src/config/tokens.ts` + `apps/desktop/src/styles/tokens.css` + `tailwind.config.js`。

### 4.1 表面（Surfaces）

| 语义 | 推荐 token | Hex（参考） | 编辑区用途 |
|------|------------|-------------|------------|
| 主内容底 | `notion-bg` | `#ffffff` | 顶栏、工具条、底栏、popover 面 |
| 侧栏 / 波形壳 | `notion-sidebar` | `#f7f7f5` | 波形 tier 外壳、transport 底、左轨 |
| 侧栏 hover | `notion-sidebar-hover` | `#efefef` | 工具按钮 hover、dropdown item |
| 侧栏 active | `notion-sidebar-active` | `#ebebea` | 工具条 segmented 选中、历史列表 hover |
| 纸感衬底 | `zen-paper` | `#F2EFE8` | minimap；语段列表区 **5–8% mix**（Stitch 定 exact mix） |
| Callout 底 | `notion-callout-bg` | `#f1f1ef` | 无音频提示条、inline banner |
| 分割 | `notion-divider` / `notion-border` | `#e3e2e0` | 顶栏/底栏/行内 inset |

### 4.2 文字（Typography colors）

| 语义 | Token | 用途 |
|------|-------|------|
| 正文 | `notion-text` | 语段正文、工具条标签 |
| 次级 | `notion-text-muted` | 时间戳、底栏统计、placeholder |
|  tertiary | `notion-text-light` | 分隔点 `·`、disabled |
| 品牌强调 | `zen-saffron` / `zen-saffron-deep` | 选中边、主按钮、错词 hover |
| 技术 | `zen-indigo` + mono | 路径、ASR URL（与 welcome 一致） |
| 错误 | `zen-cinnabar` | 波形错误 banner、destructive |

### 4.3 语段行状态（★ 本轮核心）

| 状态 | 背景 | 边框 | 文字 | 备注 |
|------|------|------|------|------|
| 默认 | `transparent` | `transparent` | `notion-text` | 列表区底：`zen-paper` **6%** mix in `notion-bg`（建议值，Stitch 可微调 4–10%） |
| Hover | `notion-sidebar-hover` **35–45%** mix | `transparent` | 同左 | 比现网 `/20` 略深，仍 subtle |
| 选中 | `zen-saffron` **10–14%** mix + `zen-paper` **8%** | `notion-border` 或 `zen-saffron/25` 1px | `notion-text` | **替代** `zen-ochre/45`；inset 1px |
| 低置信 | `zen-ochre` **18–24%** mix | `zen-saffron/20` 1px 或 dotted 语义 | `notion-text` | 与选中 **可区分**（ochre 偏黄、选中偏 saffron） |
| 选中 + 低置信 | saffron 12% + ochre 10% 叠 mix | `zen-saffron/35` | 同左 | 优先可读，勿过饱和 |
| Busy | 全局遮罩不变；行 `opacity-40` | — | muted | 不改布局 |

**时间戳列：** 默认 `notion-text-muted`；选中 `zen-saffron-deep` 或 `notion-text` semibold（二选一，Stitch 定稿）。

### 4.4 波形（交叉引用）

| 元素 | Token 方向 | 详见 |
|------|------------|------|
| Tier 壳 | `notion-sidebar` | §19 spec §3.1 |
| Peaks 未播放 / 已播放 | `zen-wf-wave` / `zen-wf-progress`（可向 saffron 15–25% mix） | §19 spec §3.2 |
| Playhead | `zen-saffron-mid` 2px | §19 spec §3.2 |
| Region 默认 / 选中 / 低置信 | ink mix / saffron 18% / laneLow 28% | `segmentChrome.ts` 意图 |
| Minimap 视口框 | `zen-saffron/35` border + `/10` fill | §19 spec §4.1 |

### 4.5 工具条与 Popover

| 元素 | 配色 |
|------|------|
| 默认按钮 | transparent + `notion-text-muted` |
| Hover | `notion-sidebar-hover` |
| Active / 打开 | `notion-sidebar` 底 + `notion-text` |
| Primary 操作 | `controlStyles` saffron 实心（与 welcome CTA 同） |
| Dropdown / 历史面板 | `notion-bg` + `notion-border` + shadow ink 12% |
| Focus ring | `zen-saffron/45` border（已有模式） |

---

## 5. 与欢迎页对齐检查清单

Stitch 定稿须满足：

- [ ] 侧栏与 welcome **`notion-sidebar` 同色**，active/hover 三色阶一致  
- [ ] Primary CTA 与 welcome **同一 saffron 实心**（`CONTROL_BTN_PRIMARY_*`）  
- [ ] 正文字色 **`notion-text` / `notion-text-muted`**，非 `zen-stone` 散落  
- [ ] 品牌块（如侧栏 logo 底）**`zen-saffron` 方块 + 白 icon** 可复用  
- [ ] 语段区纸感 **≤ welcome callout 暖度**；不可整页 `zen-paper` 铺盖（波形 peaks 必须保持白底）  
- [ ] 错误/删除 **cinnabar**；技术字段 **indigo + mono**  
- [ ] **无**未入库 hex、**无** Tailwind 默认 `amber-*` / `gray-*` 在新稿中出现  

---

## 6. 验收帧（Stitch 须出 6 帧，同布局不同状态）

| # | 帧名 | 必须可见 |
|---|------|----------|
| F1 | 默认编辑 | ≥8 语段行；1 行选中；波形 playhead；工具条 default |
| F2 | 低置信 | ≥2 行 `low_confidence`；其中 1 行选中；波形 overlay 与行色一致 |
| F3 | 语段工具条 | 历史 popover 打开；字体设置 dropdown；active 段背景 |
| F4 | 波形强调 | minimap + saffron 视口框；已播放 peaks 带 saffron tint |
| F5 | Busy | 遮罩 + 禁用控件；配色对比仍可读 |
| F6 | 无音频 | 空态文案 + secondary 按钮；无波形占位 |

每帧 **viewport 宽度**：1280px 与 1440px 各一版（可选），但 **组件位置不变**。

---

## 7. Stitch 提示词（英文）

```text
Redesign COLORS ONLY for a desktop transcription editor main column (Notion Zen × warm Serene Scholar).

DO NOT change layout, spacing, component positions, or DOM structure. Keep exact heights:
top toolbar, waveform ~240px, segment toolbar 56px, segment rows ~60px+, footer 30px.

Reference files:
- DESIGN.md (notion-* + zen-saffron palette)
- Welcome page: warm paper undertone, saffron primary, notion-sidebar left rail
- Current editor: white-heavy; selected rows use ochre — unify to saffron-tinted selection

Goals:
1. Unify welcome → editor: same sidebar grays and saffron accents
2. Segment list: subtle zen-paper wash (5–8% mix), clearer hover, selected row saffron 10–14% mix (not solid ochre)
3. Low-confidence: consistent ochre/saffron axis across list + waveform regions (no Tailwind amber-*)
4. Waveform: notion-sidebar shell, white peaks, saffron playhead (see waveform polish spec)
5. Max 2 visible container borders per visual path; use background contrast for depth
6. All colors from design tokens only — no raw hex

Deliver 6 frames: default, low-confidence, segment toolbar popover, waveform emphasis, busy, no-audio.
```

---

## 8. Stitch 提示词（中文）

```text
仅重设计「校对工作页主编辑列」的配色，风格对齐 DESIGN.md 与欢迎页（Notion 中性底 + saffron 暖强调）。

硬性禁止：改布局、改间距、改控件位置、改信息架构。高度与现网一致（工具条、波形约 240px、语段工具条 56px、语段行约 60px+、底栏 30px）。

优化重点：
1. 欢迎页 → 编辑页气质连续：侧栏 notion-sidebar、主按钮 saffron 与欢迎页一致
2. 语段列表：极淡纸感衬底（zen-paper 约 5–8% mix），hover 略加深；选中行改为 saffron 浅 tint，替代大块 zen-ochre/45
3. 低置信：列表与波形 overlay 同一套 ochre/saffron 语义，禁止 amber-50 等散落色名
4. 波形：sidebar 壳 + 白 peaks + saffron playhead（细节见 waveform polish spec）
5. 容器 border 最多 2 层，更深分区用背景色差
6. 全部使用 design token，禁止硬编码 hex

输出 6 个状态帧：默认、低置信、语段工具条弹层、波形强调、busy、无音频。
```

---

## 9. 定稿后回写路径（实现阶段）

| 层级 | 文件 | 改动类型 |
|------|------|----------|
| Token | `apps/desktop/src/config/tokens.ts`, `tokens.css`, `tailwind.config.js` | 新增/微调 mix 常量（如 `editorSegmentListWash`） |
| 语段行 | `SegmentTextListRow.tsx`, `segmentRow/*` | className 选中/hover/低置信 |
| 语段 chrome | `utils/segmentChrome.ts` | 去掉 `amber-*`，改 token mix |
| 工作区 CSS | `styles/components/workspace.css` | textarea selection、错词、learn diff |
| 波形 | `waveform.css`, `waveformSegmentBandCanvasColors.ts` | 与 §19 合并实施 |
| 壳层 | `EditorView.tsx`, `EditorToolbar.tsx`, `EditorSegmentToolbar.tsx` | 仅 bg/text/border class |
| 文档 | `stitch-work-page-spec.md` §3 | 修正过时 `bg-zen-ink` 波形描述 |

**不要改：** `segmentListVirtualWindow.ts`、tier scroll hooks、布局 flex 结构。

---

## 10. 上传 Stitch 建议组合

运行 `bash scripts/prepare-stitch-upload.sh` 后，建议上传：

```text
01-DESIGN.md
04-stitch-welcome-page-spec.md   （若脚本已编号）
stitch-editor-color-polish-spec.md（本文件，同步至 docs/stitch-upload/）
19-stitch-waveform-polish-spec.md （波形 token 子集）
18-stitch-editor-comfort-layout.html（布局参照，仅看结构不看旧色）
```

主提示词：复制 **§7 或 §8**；附言：**「只改 color；layout 以 comfort HTML 为准」**。

---

## 11. 完成定义（Definition of Done）

- [ ] Stitch 6 帧评审通过，token 映射表 §4 已填定稿 mix 百分比  
- [ ] 与 welcome 侧栏同框对比无「换了一个产品」感  
- [ ] 选中 / 低置信 / hover 在 100% 与 125% 缩放下可区分  
- [ ] 无新增第 3 层 container border  
- [ ] 实现 PR 仅含 color/token/CSS class，git diff 无 layout 文件尺寸改动  
- [ ] `npm run typecheck && npm run test` 通过  
