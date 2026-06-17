/**
 * 主壳层 / 浮层视觉 token（Round 1 真源）。
 * CSS 变量定义见 `styles/tokens.css`；产品语义见 DESIGN.md § Colors / Elevation。
 *
 * R2+ UI 接线：优先引用本文件常量，勿在组件内 ad-hoc shadow 或壳层暖底。
 */

/** `:root` 中主壳层与 accent 变量名（与 tokens.css 对账） */
export const SHELL_VISUAL_CSS_VARS = {
  mainShellBg: "--main-shell-bg",
  mainShellSidebarBg: "--main-shell-sidebar-bg",
  mainShellBorder: "--main-shell-border",
  mainShellMinimapBg: "--main-shell-minimap-bg",
  contentDecorationPaper: "--content-decoration-paper",
  contentDecorationCard: "--content-decoration-card",
  accentEdit: "--accent-edit",
  accentAction: "--accent-action",
  shellElevationShadow: "--shell-elevation-shadow",
  overlayPanelBorder: "--overlay-panel-border",
  overlayPanelBg: "--overlay-panel-bg",
  overlayScrimBg: "--overlay-scrim-bg",
} as const;

/** 双 accent 语义（落码仍用 zen-indigo / zen-primary-action-* utilities） */
export const SHELL_ACCENT = {
  /** 编辑选中 / 焦点：语段行、波形 overlay */
  edit: "zen-indigo",
  /** CTA / 进度 / 手动编辑提示 */
  action: "zen-saffron",
} as const;

/**
 * 主壳层 Tailwind 背景/边线（Welcome · Hub · Editor chrome）。
 * 禁止在导航壳层使用 zen-paper / content-decoration-*。
 */
export const MAIN_SHELL_SURFACE_CLASS = {
  pageBg: "bg-notion-bg",
  sidebarBg: "bg-notion-sidebar",
  border: "border-notion-divider",
  hairlineBorder: "border-notion-border",
} as const;

/**
 * 内容装饰面 Tailwind 背景（Welcome hero、语段卡等）。
 * 禁止用于导航壳层（侧栏 / 顶栏 / 波形 tier / minimap）。
 */
export const CONTENT_DECORATION_SURFACE_CLASS = {
  paperBg: "bg-content-decoration-paper",
  cardBg: "bg-content-decoration-card",
} as const;

/**
 * 挂 body 的浮层壳（对话框 · 菜单 · Toast）— 扁平：边线 + 背景，无 drop shadow。
 * R2 将 DraggableResizablePanel / SegmentContextMenu 等改接此串。
 */
export const FLAT_OVERLAY_PANEL_SHELL_CLASS =
  "rounded-lg border border-notion-border bg-notion-bg shadow-none";

/** 任意壳层/浮层容器应显式 shadow-none，禁止 shadow-md 及以上 */
export const FLAT_SHELL_ELEVATION_CLASS = "shadow-none" as const;

/**
 * 全屏模态遮罩（压暗底层）；浮层面板壳仍 `FLAT_OVERLAY_PANEL_SHELL_CLASS`。
 */
export const OVERLAY_SCRIM_SURFACE_CLASS = {
  bg: "bg-[var(--overlay-scrim-bg)]",
} as const;

export const OVERLAY_SCRIM_LAYER_CLASS = `fixed inset-0 ${OVERLAY_SCRIM_SURFACE_CLASS.bg}`;

/**
 * R2+ UI 壳层映射（历史 → 目标 token）。
 * R7.2–R7.4 已接线；R7.3 Welcome/Hub 壳层已接 MAIN_SHELL_SURFACE_CLASS。
 */
export const SHELL_SURFACE_MIGRATION_MAP = [
  {
    surface: "Editor collapsible sidebar column",
    status: "done",
    current: "box-shadow edge + border-right",
    target: `${MAIN_SHELL_SURFACE_CLASS.border} only; ${FLAT_SHELL_ELEVATION_CLASS}`,
  },
  {
    surface: "Minimap strip",
    status: "done",
    current: "background: var(--zen-paper)",
    target: `background: var(${SHELL_VISUAL_CSS_VARS.mainShellMinimapBg})`,
  },
  {
    surface: "DraggableResizablePanel shell",
    status: "done",
    current: "shadow-2xl",
    target: FLAT_OVERLAY_PANEL_SHELL_CLASS,
  },
  {
    surface: "SegmentContextMenu / ToastHost",
    status: "done",
    current: "shadow-md / custom multi-layer shadow",
    target: FLAT_OVERLAY_PANEL_SHELL_CLASS,
  },
  {
    surface: "Welcome / Hub shell (WorkspaceShellLayout, TopBar, Sidebar)",
    status: "done",
    current: "ad-hoc bg-notion-* / bg-zen-paper on shell",
    target: "MAIN_SHELL_SURFACE_CLASS",
  },
] as const;
