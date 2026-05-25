/**
 * 设计 token — 与 tailwind.config.js theme.extend.colors 同源。
 * 供 TS 侧内联样式、Rust 侧 docx 导出等引用。
 * 对齐仓库根 DESIGN.md（Serene Scholar）。
 */

export const COLORS = {
  ink: "#2C2C2C",
  paper: "#F2EFE8",
  saffron: "#C58A43",
  saffronLight: "#ffddba",
  saffronMid: "#85530f",
  saffronDeep: "#452800",
  ochre: "#EAE0C5",
  stone: "#8E8E8E",
  cinnabar: "#963530",
  indigo: "#3D4F5D",

  bg: "#fcf9f2",
  accent: "#C58A43",
  accentHover: "#85530f",
  textMain: "#2C2C2C",
  textMuted: "#8E8E8E",
  highlight: "#F5F0E0",

  brandBg: "#fcf9f2",
  brandOrange: "#C58A43",
  brandGray: "#f1eee7",
  brandInputBorder: "#E5E5E5",
  brandInputBg: "#ffffff",
  brandSecondaryBg: "#F5F0E0",
  brandSecondaryText: "#514538",

  success: "#22c55e",
  danger: "#963530",
  warning: "#f59e0b",
  gray100: "#f0f0f0",
  gray200: "#e5e2db",
  gray300: "#d5c3b3",
  gray400: "#837567",
  gray500: "#514538",
  gray600: "#5f5e5e",
  gray700: "#31312c",
  gray800: "#1c1c18",

  clayPink: "#C58A43",
  clayTeal: "#3D4F5D",
  clayCard: "#F5F0E0",

  /** Notion 风格令牌 */
  notionBg: "#ffffff",
  notionSidebar: "#f7f7f5",
  notionSidebarHover: "#efefef",
  notionSidebarActive: "#ebebea",
  notionDivider: "#e3e2e0",
  notionBorder: "#e3e2e0",
  notionText: "#37352f",
  notionTextMuted: "#6b6b6b",
  notionTextLight: "#9ca3af",
  notionCalloutBg: "#f1f1ef",
  notionCalloutBorder: "#e3e2e0",

  /** WaveSurfer 白底波形条（与 tailwind `zen-wf-*` 同源） */
  waveformSurface: "#ffffff",
  waveformWave: "#c4c4c8",
  waveformProgress: "#8e8e93",
  waveformCursor: "#6a6a6f",
  /** 波形 region 叠色（与 waveformRegionFillColor 一致） */
  waveformRegionLaneLow: "#9ca3af",
  waveformRegionLaneIdle: "#d1d5db",
} as const;

export type ColorToken = keyof typeof COLORS;
