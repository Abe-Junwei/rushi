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
  saffron-light: '#ffddba'
  saffron-mid: '#85530f'
  saffron-deep: '#452800'
  ochre: '#EAE0C5'
  stone: '#8E8E8E'
  cinnabar: '#963530'
  indigo: '#3D4F5D'
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
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  display-md:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: '1.4'
    letterSpacing: '0'
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.6'
    letterSpacing: '0'
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: '0'
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: '1.0'
    letterSpacing: 0.1em
  mono-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.4'
    letterSpacing: '0'
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

## Colors

The palette is a **Notion-neutral base + warm saffron accent**:

- **Background (`notion-bg` #ffffff):** Pure white for main content areas. Maximizes readability and feels modern.
- **Sidebar (`notion-sidebar` #f7f7f5):** Very light warm gray for the navigation rail. Separates from content without harsh contrast.
- **Text (`notion-text` #37352f):** Notion's signature soft black. High legibility without the harshness of pure #000.
- **Muted Text (`notion-text-muted` #6b6b6b):** For secondary labels, descriptions, placeholders.
- **Dividers (`notion-divider` #e3e2e0):** Very light borders for separation. Used extensively for hairlines.
- **Primary (Saffron #C58A43):** Reserved for the most important CTAs and active selection states. The warm accent prevents the interface from feeling sterile.
- **Danger (Cinnabar #963530):** Used exclusively for destructive actions (delete, remove).
- **Success:** Green for positive status indicators.

## Typography

Single sans-serif font family (Inter) for all UI. No serif display fonts—Notion style favors clean, modern typography throughout.

- **Display:** Large, bold headings for page titles (`display-lg`, `display-md`).
- **Headings:** Semibold for section titles (`headline-sm`).
- **Body:** Regular weight for all content and UI text (`body-md`, `body-sm`).
- **Labels:** Uppercase with wide letter spacing for section headers and metadata (`label-caps`).
- **Monospace:** JetBrains Mono for technical data (file paths, dates, IDs).

**Formatting Rules:**
- Large display text uses tighter letter spacing for a modern feel.
- Labels and captions (11px) always use uppercase with generous letter spacing.
- Monospace paths or technical data use a distinct background or color (`indigo`) to signify their nature.

## Layout & Spacing

**Notion-style Side-Rail + Main Stage** model:

- **Sidebar:** Fixed-width container (~240px) on the left for navigation. Background `notion-sidebar`, separated by a 1px `notion-divider` border.
- **Main Stage:** White background, fluid area for content. Generous padding (`px-8 py-6`).
- **Top Bar:** Slim utility bar (~48px) with subtle bottom border. Brand name left, status indicators right.

**Responsive Behavior:**
- **Desktop (>=1024px):** Standard sidebar layout.
- **Tablet/Mobile (<1024px):** Sidebar collapses or reflows above main content.
- **Spacing Rhythm:** Based on an 8px grid. Cards have 16px padding, sections separated by 24px gaps.

## Elevation & Depth

Hierarchy through **background tone shifts** and **fine borders**—no drop shadows on most elements.

- **Surfaces:** Main content is white. Cards use white with a 1px `notion-border`. Sidebar uses `#f7f7f5`.
- **Borders:** 1px borders in `notion-divider` define boundaries. This creates a crisp, architectural look.
- **Interactive Depth:** Only floating panels (modals, dropdowns) use subtle shadows. Hover effects use background color shifts (`notion-sidebar-hover`).
- **The Busy Layer:** Semi-transparent white wash with light backdrop blur during processing.

## Shapes

**Notion's restrained rounding:**

- **Buttons & Inputs:** 4px radius (`rounded-sm` / `rounded-md`)—small, professional.
- **Cards:** 6px radius (`rounded-md`)—subtle, not playful.
- **Navigation Items:** 4px radius for hover/active states.
- **Status Indicators:** Small circles (6px) for status dots.

## Components

### Buttons
- **Primary:** Saffron background (#C58A43) with white text. 4px radius. Hover darkens to `saffron-mid`.
- **Secondary:** Light gray background (`notion-sidebar`) with `notion-text` text. 4px radius. Hover to `notion-sidebar-hover`. Optional 1px `notion-border`.
- **Ghost:** No background. `notion-text-muted` text. Hover to `notion-sidebar-hover` background.
- **Danger:** White background, cinnabar text and border. Hover fills cinnabar with white text.

### Input Fields
- White background, 1px `notion-border`, 4px radius. On focus: border shifts to saffron with a subtle ring. Use `body-md` for user input.

### Cards
- White background, 1px `notion-border`, 6px radius. No shadow unless floating. Padding 16px–20px.

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
