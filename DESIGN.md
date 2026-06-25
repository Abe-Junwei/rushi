---
name: Notion Zen (Serene Scholar × Notion)
colors:
  # Notion 中性基础
  notion-bg: '#ffffff'
  notion-sidebar: '#f7f7f5'
  notion-sidebar-hover: '#efefef'
  notion-sidebar-active: '#ebebea'
  notion-divider: '#e3e2e0'
  notion-border: '#e3e2e0'
  notion-text: '#37352f'
  notion-text-muted: '#6b6b6b'
  notion-text-light: '#9ca3af'
  notion-callout-bg: '#f1f1ef'
  notion-callout-border: '#e3e2e0'
  # Serene Scholar 暖色强调（保留）
  ink: '#2C2C2C'
  paper: '#F2EFE8'
  saffron: '#C58A43'
  primary: '#C58A43'
  primary-foreground: '#ffffff'
  saffron-light: '#ffddba'
  saffron-mid: '#85530f'
  saffron-deep: '#452800'
  ochre: '#EAE0C5'
  stone: '#8E8E8E'
  cinnabar: '#963530'
  surface: '#fcf9f2'
  surface-dim: '#dcdad3'
  surface-bright: '#fcf9f2'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3ec'
  surface-container: '#f1eee7'
  surface-container-high: '#ebe8e1'
  surface-container-highest: '#e5e2db'
  surface-card: '#F5F0E0'
  hairline: '#E5E5E5'
  outline: '#837567'
  outline-variant: '#d5c3b3'
  # 波形 / WaveSurfer（与 tokens.ts COLORS.waveform* / tailwind zen-wf-* 同源）
  waveform-surface: '#ffffff'
  waveform-wave: '#c4c4c8'
  waveform-progress: '#8e8e93'
  waveform-cursor: '#6a6a6f'
# Type scale（5 级，code-ratified；落码真源 = zen-tailwind.css @theme --text-*）
# token 仅承载 fontSize；line-height/weight/letterSpacing 由 leading-*/font-*/tracking-* 与 typography.ts 控制。
# 禁止再用 text-[Npx] arbitrary；新增字号必须走这 5 级。
typography:
  display:
    fontFamily: Inter
    fontSize: 28px   # 页面 H1（欢迎 / Hub / 环境页标题）
  heading:
    fontFamily: Inter
    fontSize: 18px   # 侧栏品牌、面板大标题
  title:
    fontFamily: Inter
    fontSize: 14px   # 区块标题、副标题、导航标题
  body:
    fontFamily: Inter
    fontSize: 12px   # 主力正文 / 控件文字（最高频）
  label:
    fontFamily: Inter
    fontSize: 11px   # 标签 / meta / caption / badge
  mono:
    fontFamily: JetBrains Mono
    fontSize: 12px   # 技术信息（路径 / ID）；字号同 body
rounded:
  sm: 0.25rem   # 4px — 按钮、输入框
  DEFAULT: 0.5rem
  md: 0.375rem  # 6px — 卡片
  lg: 0.75rem
  xl: 1rem
  full: 9999px
spacing:
  margin-page: 2rem
  gutter: 1rem
  stack-sm: 0.5rem
  stack-md: 1rem
  stack-lg: 2rem
  aside-width: 18rem
---

## Brand & Style

A transcription/review desktop app that blends **Notion's minimalist clarity** with **Serene Scholar's warm, academic temperament**. The result is a workspace that feels clean, modern, and focused—like a well-organized digital notebook with a touch of scholarly warmth.

The chosen style is **Minimalist-Editorial**. It relies on heavy whitespace, a clean white-forward palette for surfaces, and warm saffron accents for primary actions. Unlike standard SaaS tools that feel cold, this design system uses Notion's proven information architecture (left sidebar, card-based content, hover-reveal actions) with a warm paper-like undertone to create a workspace that encourages deep focus.

**落码真源：** 颜色与尺寸以本文件为意图说明；实现以 `apps/desktop/tailwind.config.js` + `apps/desktop/src/config/tokens.ts` + `apps/desktop/src/styles/tokens.css` 为准。禁止页面层散落未入库 hex。

## Colors

The palette is a **Notion-neutral base + warm saffron accent**:

- **Background (`notion-bg` #ffffff):** Pure white for main content areas. Maximizes readability and feels modern.
- **Sidebar (`notion-sidebar` #f7f7f5):** Very light warm gray for the navigation rail. Separates from content without harsh contrast.
- **Text (`notion-text` #37352f):** Notion's signature soft black. High legibility without the harshness of pure #000.
- **Muted Text (`notion-text-muted` #6b6b6b):** For secondary labels, descriptions, placeholders.
- **Dividers (`notion-divider` #e3e2e0):** Very light borders for separation. Used extensively for hairlines.
- **Primary (Saffron #C58A43):** **动作 / 进度 / CTA**（Primary 按钮、工作条 toggle、手动编辑提示、播放头刻度）。
- **Edit accent:** Removed — 语段选中 / 波形 overlay / LLM chip 与 **accent-action** 共用主题色链。
- **Danger (Cinnabar #963530):** Used exclusively for destructive actions (delete, remove).
- **Success:** Green for positive status indicators.

**Shell accent（全应用统一，随 Office 主题色 remap）**

| 语义 | Token | 用途 |
|------|-------|------|
| 选中 / 多选 / CTA / 进度 | `--accent-action` / `--accent-action-strong` | 语段行、波形 overlay、Primary 按钮、播放头、minimap、visited 带 |
| 兼容别名 | `--accent-edit` | 等于 `--accent-action`；旧 Tailwind `accent-edit` 仍可用 |

**Main shell vs 内容装饰**

- **主壳层**（Welcome / Project Hub / Editor chrome）：`notion-bg` · `notion-sidebar` · `notion-divider`（`tokens.css` `--main-shell-*`）。导航侧栏、顶栏、波形 tier 外壳、minimap 条 **禁止** `zen-paper`。
- **内容装饰面**：`zen-paper` · `surface-card`（`--content-decoration-*`）仅用于 Welcome hero、语段卡等 **内容区**，不进导航壳。

**Legacy warm surfaces (`paper`, `surface-card`, `ochre`):** 仅作内容装饰；主工作台壳层优先 `notion-*` / `--main-shell-*`。

### Waveform tokens

波形区在 Notion 侧栏底上叠白底 peaks；语段 / 进度 chroming 走 `--accent-action*` 与 `--segment-fill-*`，见 `tokens.css`。

| Token | 语义 | CSS 变量 | 用途 |
|-------|------|----------|------|
| 未播放 peaks | 中性灰 | `--zen-wf-wave` | WaveSurfer 柱形、minimap |
| 已播放 peaks | action-strong mix | `--zen-wf-progress-played` | 已播放 tint |
| 播放头 | action | `--waveform-playhead` | 视口全高 playhead |
| Minimap 视口 | action | `--waveform-minimap-viewport-*` | 总览视口框 |
| 语段选中 | action | `--segment-fill-selected` | 列表 / overlay 28% |
| 语段多选（波形） | action | `--segment-fill-in-selection-waveform` | overlay 12% |
| 语段多选（列表） | action | `--segment-fill-in-selection-list` | 列表行 8% |
| 语段未播放 | ink | `--segment-fill-idle` | band 11% mix |
| 语段已播放 | action-strong | `--segment-fill-visited` | band 14% mix |

落码 Tailwind：`accent-action` / `accent-action-strong`（`accent-edit` 为兼容别名；禁止组件直引 `zen-saffron*`）。

## Typography

Single sans-serif font family (Inter) for all UI. No serif display fonts—Notion style favors clean, modern typography throughout.

- **Display (`text-display` 28px):** Page titles (Welcome / Hub / 环境页 H1).
- **Heading (`text-heading` 18px):** Sidebar brand, panel headings.
- **Title (`text-title` 14px):** Section titles, subtitles, nav titles.
- **Body (`text-body` 12px):** Default content and UI text (highest frequency).
- **Label (`text-label` 11px):** Labels, meta, captions, badges (often uppercase + wide tracking).
- **Monospace (`font-mono`, 12px = body):** Technical data (file paths, dates, IDs).

**Formatting Rules:**
- Large display text uses tighter letter spacing for a modern feel.
- Labels and captions (11px) always use uppercase with generous letter spacing.
- Monospace paths or technical data use `notion-text-muted` + mono (neutral, not accent).
- Timecode in toolbars uses tabular nums (`font-variant-numeric: tabular-nums`).

**Serif 例外（legacy，仍允许）：**
- 欢迎页品牌标题（如侧栏「如是我闻」）可用 `Noto Serif SC`。
- 校对工作页 **语段正文** 默认衬线（`editorTranscriptAppearance`），与 UI chrome 的 Inter 分离。
- 除此以外的新增 UI chrome（工具栏、面板、按钮、波形底栏）统一 Inter。

## Layout & Spacing

**Notion-style Side-Rail + Main Stage** model:

- **Sidebar:** Fixed-width container (~240px) on the left for navigation. Background `notion-sidebar`, separated by a 1px `notion-divider` border.
- **Main Stage:** White background, fluid area for content. Generous padding (`px-8 py-6`).
- **Top Bar:** Slim utility bar (**48px / `h-12`**) with subtle bottom border. Brand name left, status indicators right.

**Prominent controls（欢迎页 / 建项 hero）：** 40px 高（`CONTROL_BTN_*_PROMINENT`），4px 圆角；环境面板与工作页工具栏仍用 32px 标准 `CONTROL_*`。

**Responsive Behavior:**
- **Desktop (>=1024px):** Standard sidebar layout.
- **Tablet/Mobile (<1024px):** Sidebar collapses or reflows above main content.
- **Spacing Rhythm:** Based on an 8px grid. Cards have 16px padding, sections separated by 24px gaps.

## Elevation & Depth

Hierarchy through **background tone shifts** and **fine borders**—**no drop shadows** on shell chrome or body-portaled overlays (dialogs, menus, toast).

- **Surfaces:** Main content is white (`--main-shell-bg`). Sidebar uses `#f7f7f5` (`--main-shell-sidebar-bg`). Cards use white with a 1px `notion-border`.
- **Borders:** 1px borders in `notion-divider` / `notion-border` define boundaries. Collapsible sidebar uses **border-right only**—no edge box-shadow.
- **Interactive Depth:** Hover uses background color shifts (`notion-sidebar-hover`). Floating panels use **`border-notion-border` + `bg-notion-bg` + `shadow-none`**（见 `shellVisualTokens.ts` `FLAT_OVERLAY_PANEL_SHELL_CLASS`）。
- **The Busy Layer:** 半透明遮罩 `--overlay-scrim-bg`（约 26% ink mix）；浮层面板仍 flat、无 drop shadow、**无 backdrop-blur**。
- **Panel CSS:** 同一路径上最多 2 层可见容器 `border`；更深层级用背景色差与间距区分（见 Jieyu 面板规则）。

**落码真源：** `apps/desktop/src/styles/tokens.css`（`--shell-elevation-shadow: none`）· `apps/desktop/src/config/shellVisualTokens.ts`

## Shapes

**Notion's restrained rounding:**

- **Buttons & Inputs:** 4px radius (`rounded-sm` / `rounded-md`)—small, professional.
- **Cards:** 6px radius (`rounded-md`)—subtle, not playful.
- **Navigation Items:** 4px radius for hover/active states.
- **Status Indicators:** Small circles (6px) for status dots.

## Components

### Buttons
- **Primary:** `primary-action` — **saffron 底 + 白字**（rest ~3:1；hover saffron-mid + 白字 AA）。 **4px radius (`rounded-sm`). Height 32px (`h-8`).**
- **Secondary:** `notion-sidebar` background with `notion-text` text. 4px radius. Hover to `notion-sidebar-hover`. 1px `notion-border`.
- **Ghost:** No background. `notion-text-muted` text. Hover to `notion-sidebar-hover` background.
- **Danger:** White background, cinnabar text and border. Hover fills cinnabar with white text.

**落码：** 环境面板 / 欢迎页等复用 `apps/desktop/src/config/controlStyles.ts` 的 `CONTROL_*` 常量（已与上表对齐）。

### Input Fields
- White background, 1px `notion-border`, **4px radius**, **height 32px**. On focus: border shifts to saffron with a subtle ring. Use `text-body` for user input.

### Cards
- White background, 1px `notion-border`, **6px radius (`rounded-md`)**. **No shadow** (including floating). Padding 16px–20px.

### Navigation (Sidebar)
- Items: 4px radius, padding `px-3 py-2`.
- Active: `bg-notion-sidebar-active`.
- Hover: `bg-notion-sidebar-hover`.
- No left border indicator—Notion uses background color only.
- Each item: icon (16px, muted) + label (`text-sm font-medium`) + optional description (`text-[11px] text-muted`).

### Lists
- No outer container border (unlike cards).
- Each row: compact height (`h-10` or `h-11`), full-width, 4px radius.
- Hover: `bg-notion-sidebar-hover`.
- Actions: opacity-0 by default, opacity-100 on hover with transition.

### Progress Indicators
- **Pulse Bar:** Thin horizontal track with saffron pulse effect during busy states.
- **Status Dots:** 6px circles, green for ok, red for error.

### Waveform stage
- **Tier shell:** `notion-sidebar` 背景；横向滚动；高度可拖拽。
- **Peaks:** 白底 + 中性灰柱（`--zen-wf-wave`）；已播放 `--zen-wf-progress-played`（`accent-action-strong` mix）。
- **Playhead / minimap:** `--waveform-playhead`、`--waveform-minimap-*`（`accent-action` 族）；WS 内置 cursor 隐藏。
- **语段 overlay:** `--segment-fill-*`；单选 / 列表主选 28%，多选波形 12% / 列表 8%；手动 stage chip 固定 `--zen-status-warn*`；左右 **8px handle** 拖拽边界。
- **Minimap（可选）:** `--main-shell-minimap-bg`；`accent-action` 视口框 + playhead。
- **工作条（波形与语段之间）:** **40px**（`h-8` 触控）；有音频时三栏 transport / 编辑 / zoom；无音频时单行居中仅编辑。视口 `<1024px` 时中间收进「编辑 ▾」、右区保留 ±。
- **底栏（语段列表下）:** 30px 三列 grid；无状态 hint 时每 8s 轮换快捷键提示（与设置页共用真源）。
- **语段点击（波形 overlay）：** 首次点击未选中语段 → 选中并 seek 到语段头；已在该语段内再次点击 → seek 到点击位置（钳在语段内）；语段播放从当前 playhead 起（若在语段内）。

### Floating dialogs
- 使用 `compactDialog` preset + `controlStyles.ts`（Notion/Zen 控件）；勿使用已移除的 serene 面板变体。

### Icons (Lucide)
- Use a strict three-tier size system for Lucide icons in `apps/desktop/src/components`:
  - **SM (14px):** Dense controls, chevrons, inline utility actions.
  - **MD (18px):** Default toolbar, nav, panel action icons.
  - **LG (20px):** Primary action emphasis and hero/supportive symbols.
- All icon stroke width must be unified to `2`.
- In code, use shared constants from `apps/desktop/src/components/lucideIconSpec.ts`:
  - `LUCIDE_ICON_SIZE_SM`, `LUCIDE_ICON_SIZE_MD`, `LUCIDE_ICON_SIZE_LG`
  - `LUCIDE_ICON_STROKE_WIDTH`
- Do not hardcode icon size class pairs like `h-3.5 w-3.5`, `h-[18px] w-[18px]`, `h-5 w-5` on Lucide tags.

## Stitch 同步

运行 `bash scripts/prepare-stitch-upload.sh` 会将本文件复制为 `docs/stitch-upload/01-DESIGN.md`。**以仓库根 `DESIGN.md` 为唯一编辑入口**，勿只改 stitch-upload 副本。
