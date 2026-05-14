/**
 * 设计 token — 与 tailwind.config.js theme.extend.colors 同源。
 * 供 TS 侧内联样式、Rust 侧 docx 导出等引用。
 * 对齐仓库根 DESIGN.md（Clay.com 分析稿）。
 */

export const COLORS = {
  ink: "#0a0a0a",
  paper: "#fffaf0",
  saffron: "#0a0a0a",
  saffronLight: "#e5e5e5",
  saffronMid: "#1f1f1f",
  saffronDeep: "#0a0a0a",
  ochre: "#faf5e8",
  stone: "#6a6a6a",
  cinnabar: "#ef4444",
  indigo: "#1a3a3a",

  bg: "#fffaf0",
  accent: "#ff4d8b",
  accentHover: "#e63e7a",
  textMain: "#0a0a0a",
  textMuted: "#6a6a6a",
  highlight: "#f5f0e0",

  brandBg: "#fffaf0",
  brandOrange: "#e8b94a",
  brandGray: "#faf5e8",
  brandInputBorder: "#e5e5e5",
  brandInputBg: "#fffaf0",
  brandSecondaryBg: "#faf5e8",
  brandSecondaryText: "#3a3a3a",

  success: "#22c55e",
  danger: "#ef4444",
  warning: "#f59e0b",
  gray100: "#f0f0f0",
  gray200: "#ebe6d6",
  gray300: "#e5e5e5",
  gray400: "#9a9a9a",
  gray500: "#6a6a6a",
  gray600: "#3a3a3a",
  gray700: "#1a1a1a",
  gray800: "#0a0a0a",

  clayPink: "#ff4d8b",
  clayTeal: "#1a3a3a",
  clayCard: "#f5f0e0",

  /** P1 WaveSurfer 白底波形条（与 tailwind `zen-p1-wf-*` 同源） */
  p1WaveformSurface: "#ffffff",
  p1WaveformWave: "#c4c4c8",
  p1WaveformProgress: "#8e8e93",
  p1WaveformCursor: "#6a6a6f",
  /** 波形 region 叠色（与 p1WaveformRegionFillColor 一致） */
  p1WaveformRegionLaneLow: "#9ca3af",
  p1WaveformRegionLaneIdle: "#d1d5db",
} as const;

export type ColorToken = keyof typeof COLORS;
