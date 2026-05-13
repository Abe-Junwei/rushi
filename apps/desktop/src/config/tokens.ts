/**
 * 设计 token — 与 tailwind.config.js theme.extend.colors 同源。
 * 供 TS 侧内联样式、Rust 侧 docx 导出等引用。
 */

export const COLORS = {
  // Zen 系列
  ink: "#2C2C2C",
  paper: "#F2EFE8",
  saffron: "#C58A43",
  saffronLight: "#E5BC94",
  saffronMid: "#D49A5B",
  saffronDeep: "#C69C6D",
  ochre: "#EAE0C5",
  stone: "#8E8E8E",
  cinnabar: "#963530",
  indigo: "#3D4F5D",

  // App 系列
  bg: "#f3f1e8",
  accent: "#d4a373",
  accentHover: "#bc8a5f",
  textMain: "#333333",
  textMuted: "#666666",
  highlight: "#ede4d0",

  // Brand 系列
  brandBg: "#f7f3ed",
  brandOrange: "#d9a066",
  brandGray: "#e5e2dd",
  brandInputBorder: "#e5c19d",
  brandInputBg: "#fdfcfb",
  brandSecondaryBg: "#f0f1f3",
  brandSecondaryText: "#5a5a5a",

  // 语义化
  success: "#4ADE80",
  danger: "#EF4444",
  warning: "#F59E0B",
  gray100: "#F4F4F5",
  gray200: "#ECECEC",
  gray300: "#E0E0E0",
  gray400: "#8E8E8E",
  gray500: "#555555",
  gray600: "#444444",
  gray700: "#333333",
  gray800: "#2A2A2A",
} as const;

export type ColorToken = keyof typeof COLORS;
