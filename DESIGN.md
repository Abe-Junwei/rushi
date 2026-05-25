---
name: Serene Scholar
colors:
  surface: '#fcf9f2'
  surface-dim: '#dcdad3'
  surface-bright: '#fcf9f2'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f6f3ec'
  surface-container: '#f1eee7'
  surface-container-high: '#ebe8e1'
  surface-container-highest: '#e5e2db'
  on-surface: '#1c1c18'
  on-surface-variant: '#514538'
  inverse-surface: '#31312c'
  inverse-on-surface: '#f3f0e9'
  outline: '#837567'
  outline-variant: '#d5c3b3'
  surface-tint: '#85530f'
  primary: '#85530f'
  on-primary: '#ffffff'
  primary-container: '#c58a43'
  on-primary-container: '#452800'
  inverse-primary: '#fcba6e'
  secondary: '#5f5e5e'
  on-secondary: '#ffffff'
  secondary-container: '#e4e2e1'
  on-secondary-container: '#656464'
  tertiary: '#166589'
  on-tertiary: '#ffffff'
  tertiary-container: '#5b9dc4'
  on-tertiary-container: '#003248'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#ffddba'
  primary-fixed-dim: '#fcba6e'
  on-primary-fixed: '#2b1700'
  on-primary-fixed-variant: '#673d00'
  secondary-fixed: '#e4e2e1'
  secondary-fixed-dim: '#c8c6c5'
  on-secondary-fixed: '#1b1c1c'
  on-secondary-fixed-variant: '#474747'
  tertiary-fixed: '#c6e7ff'
  tertiary-fixed-dim: '#8dcef7'
  on-tertiary-fixed: '#001e2d'
  on-tertiary-fixed-variant: '#004c6b'
  background: '#fcf9f2'
  on-background: '#1c1c18'
  surface-variant: '#e5e2db'
  ink: '#2C2C2C'
  paper: '#F2EFE8'
  saffron: '#C58A43'
  ochre: '#EAE0C5'
  stone: '#8E8E8E'
  cinnabar: '#963530'
  indigo: '#3D4F5D'
  surface-card: '#F5F0E0'
  hairline: '#E5E5E5'
typography:
  display-lg:
    fontFamily: Noto Serif SC
    fontSize: 48px
    fontWeight: '500'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  display-md:
    fontFamily: Noto Serif SC
    fontSize: 32px
    fontWeight: '500'
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
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.4'
    letterSpacing: '0'
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
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

The design system is built for a focused, editorial desktop environment that bridges traditional scholarship with modern technology. The brand personality is **calm, deliberate, and academic**, evoking the feeling of working in a quiet library or with high-quality stationery.

The chosen style is **Minimalist-Tactile**. It relies on heavy whitespace, a sophisticated paper-like color palette, and clear typographic hierarchy. Unlike standard digital tools that feel clinical, this design system uses warm organic tones and high-contrast "ink" typography to create a workspace that encourages deep focus and reduces digital fatigue. Visual hierarchy is established through subtle hairlines and shifts in surface tone rather than aggressive shadows or gradients.

## Colors

The palette is rooted in a "Zen Paper" aesthetic, using warm, low-strain backgrounds and high-legibility foregrounds.

- **Primary (Saffron):** Reserved for the most important calls to action (e.g., "New Project") and active selection states. It provides a warm, energetic contrast to the neutral base.
- **Secondary/Text (Ink):** A soft black used for primary typography and high-contrast UI elements. It mimics the appearance of ink on paper.
- **Neutral (Paper):** The foundation of the app. It uses a slightly warm, off-white hue to reduce eye strain during long working sessions.
- **Functional Accents:**
  - **Cinnabar:** Used exclusively for critical errors and destructive actions.
  - **Ochre/Stone:** Used for secondary metadata, disabled states, and auxiliary hints.
  - **Indigo:** Reserved for technical/monospace data like file paths or code.

## Typography

This design system uses a dual-font approach to balance editorial elegance with functional clarity.

- **Serif (Noto Serif SC):** Used for large displays and section headers. It provides a "scholarly" feel, giving the user a sense of importance and permanence.
- **Sans-Serif (Inter):** Used for all functional UI components, labels, and dense body text. It is chosen for its exceptional legibility at small sizes and its neutral, modern character.

**Formatting Rules:**
- Large display text should use optical kerning and tighter letter spacing.
- Labels and captions (11px) should always use uppercase with generous letter spacing to maintain readability.
- Monospace paths or technical data should use the UI font (Inter) but be styled with a distinct background or color (`indigo`) to signify their nature.

## Layout & Spacing

The design system utilizes a **Side-Rail + Main Stage** model, optimized for desktop productivity.

- **Aside (Side-Rail):** A fixed-width container (approx. 280px) on the left for navigation and project-level controls. It is separated by a subtle right-hand hairline.
- **Main Stage:** A fluid area that centers content horizontally for "Welcome" states and fills the remaining space for "Working" states.
- **Top Bar:** A slim, 64px tall utility bar that persists across states, featuring a bottom hairline.

**Responsive Behavior:**
- **Desktop (>=1024px):** Standard side-rail layout.
- **Tablet/Mobile (<1024px):** The side-rail reflows to sit above the Main Stage. The top bar may wrap content to preserve touch targets.
- **Spacing Rhythm:** Based on an 8px (0.5rem) grid. Margins between editorial sections should be generous (stack-lg) to preserve the "calm" atmosphere.

## Elevation & Depth

Hierarchy is achieved through **Tonal Layering** and **Fine Outlines** rather than traditional drop shadows.

- **Surfaces:** The background is `paper`. Cards and active containers use `surface-card` (a slightly deeper cream) to appear closer to the user.
- **Borders:** Hairline borders (1px) in `hairline` or `stone` define boundaries. This creates a crisp, architectural look.
- **Interactive Depth:** Only the Primary CTA uses a soft, saffron-tinted shadow to signify its "floating" importance. Other elements use subtle shifts in background color (e.g., white-to-cream) on hover.
- **The Busy Layer:** A semi-transparent white wash with a light backdrop blur is used to block interaction while maintaining visual context during processing tasks.

## Shapes

The shape language is "Soft-Modern," using intentional rounding to counteract the formal feel of the Serif typography.

- **Standard UI (Inputs, Buttons):** 12px (rounded-xl) for a friendly, modern touch.
- **Containers (Cards):** 24px (rounded-2xl) to clearly define major content blocks against the page floor.
- **Status Indicators:** Pills (9999px) for badges and status dots to provide a visual contrast to the linear grid.

## Components

### Buttons
- **Primary:** Saffron background with white text. 12px radius. Focused on the "New Project" action.
- **Secondary:** Transparent/White-translucent background with a `hairline` border. On hover, the border and text transition toward saffron.
- **Tertiary:** No border or background. Used for utility actions in the Top Bar (e.g., "Collapse Environment").

### Input Fields
- White background, 1px `hairline` border, 12px radius. On focus, the border color shifts to `saffron` with a subtle ring. Use `body-md` for user input.

### Cards
- **Editorial Card:** Used for "Recent Projects" or "Confirm Project." Background is `surface-card` with 24px radius.
- **List Items:** Within cards, list items use `ink` for titles and `stone` for dates. Hovering an item applies a very pale saffron background.

### Navigation
- **Project Selector:** A styled `<select>` element in the side-rail. Minimalist border, consistent with input fields.
- **Top Bar:** Features "Status Dots" for technical dependencies (FFmpeg, ASR). Dots are 8px circles in green (ok) or red (fail).

### Progress Indicators
- **Pulse Bar:** A thin horizontal track with a `saffron` pulse effect, used during "Busy" states. Accompanied by a `mono-sm` timer.

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
