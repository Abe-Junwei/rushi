/**
 * 设计 token — hex 真源见 styles/tokens.css；Tailwind 映射见 zen-tailwind.css @theme。
 * 供 TS 侧内联样式、Rust 侧 docx 导出等引用。
 * 对齐仓库根 DESIGN.md（Notion Zen）。
 */

export const COLORS = {
  ink: "#2C2C2C",
  paper: "#F2EFE8",
  saffron: "#C58A43",
  saffronLight: "#ffddba",
  saffronMid: "#85530f",
  saffronDeep: "#452800",
  /** 实心 Primary CTA（WCAG AA 白字）；见 tokens.css --zen-primary-action-* */
  primaryActionBg: "#C58A43",
  primaryActionBgHover: "#85530f",
  primaryActionFg: "#ffffff",
  primaryActionFgHover: "#ffffff",
  ochre: "#EAE0C5",
  stone: "#8E8E8E",
  cinnabar: "#963530",
  indigo: "#3D4F5D",

  success: "#1e463a",
  successAction: "#2e6153",
  successSurface: "#eff3f1",
  successBorder: "#e2e9e6",
  saffronSurface: "#f9f3ec",
  saffronBorder: "#eedcc7",
  cinnabarSurface: "#f5ebea",
  cinnabarBorder: "#dab8b7",
  danger: "#963530",
  warning: "#f59e0b",

  /** Notion 风格令牌 */
  notionBg: "#ffffff",
  notionSidebar: "#f7f7f5",
  notionSidebarHover: "#efefef",
  notionSidebarActive: "#ebebea",
  secondaryContainer: "#e7e2d9",
  notionDivider: "#e3e2e0",
  notionBorder: "#e3e2e0",
  notionText: "#37352f",
  /** Stitch on-surface-variant */
  notionTextVariant: "#514538",
  notionTextMuted: "#6b6b6b",
  notionTextLight: "#9ca3af",
  notionCalloutBg: "#f1f1ef",
  notionCalloutBorder: "#e3e2e0",

  /** 主壳层 — 对齐 tokens.css --main-shell-* */
  mainShellBg: "#ffffff",
  mainShellSidebarBg: "#f7f7f5",
  mainShellBorder: "#e3e2e0",
  mainShellMinimapBg: "#f7f7f5",
  /** 内容装饰面 — 不进导航壳 */
  contentDecorationPaper: "#F2EFE8",
  contentDecorationCard: "#f5f0e0",
  /** Dual accent */
  accentEdit: "#3D4F5D",
  accentAction: "#C58A43",
  accentActionStrong: "#85530f",
  shellElevationShadow: "none",

  /** WaveSurfer 白底波形条（与 tailwind `zen-wf-*` 同源） */
  waveformSurface: "#ffffff",
  waveformWave: "#c4c4c8",
  /** 已播放 peaks 基色（progress 层未混 saffron 前） */
  waveformProgress: "#8e8e93",
  /**
   * 已播放 peaks tint — `color-mix(in srgb, saffron-mid 22%, wf-progress)`（Stitch 原型）。
   * CSS 真源：`--zen-wf-progress-played` in tokens.css
   */
  waveformProgressPlayed: "#8c8176",
  waveformCursor: "#6a6a6f",
  /** 波形 region 叠色（与 segmentChrome.ts waveformRegionFillColor 一致） */
  waveformRegionLaneLow: "#9ca3af",
  waveformRegionLaneIdle: "#d1d5db",
  waveformRegionVisitedMix: "#85530f",
} as const;
