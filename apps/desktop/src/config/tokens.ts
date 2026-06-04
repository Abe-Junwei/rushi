/**
 * 设计 token — 与 tailwind.config.js theme.extend.colors 同源。
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
  ochre: "#EAE0C5",
  stone: "#8E8E8E",
  cinnabar: "#963530",
  indigo: "#3D4F5D",

  success: "#1e463a",
  successAction: "#2e6153",
  successSurface: "#eff3f1",
  successBorder: "#e2e9e6",
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

  /** WaveSurfer 白底波形条（与 tailwind `zen-wf-*` 同源） */
  waveformSurface: "#ffffff",
  waveformWave: "#c4c4c8",
  /** 已播放 peaks tint */
  waveformProgress: "#8e8e93",
  waveformCursor: "#6a6a6f",
  /** 波形 region 叠色（与 waveformRegionFillColor 一致） */
  waveformRegionLaneLow: "#9ca3af",
  waveformRegionLaneIdle: "#d1d5db",
} as const;

export type ColorToken = keyof typeof COLORS;
