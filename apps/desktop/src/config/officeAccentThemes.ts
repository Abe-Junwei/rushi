/**
 * 主题色预设（Fluent accent 系）。
 * 映射到 tokens.css 的 --zen-saffron* / primary-action / accent-action 链。
 */

export type OfficeAccentThemeId =
  | "brand"
  | "blue"
  | "red"
  | "orange"
  | "green"
  | "indigo"
  | "pink"
  | "teal"
  | "gray";

export type OfficeAccentThemePreset = {
  id: OfficeAccentThemeId;
  /** 设置 UI 显示名 */
  label: string;
  /** 主 accent hex（对应 --zen-saffron） */
  base: string;
  /** 悬停 / 深阶（--zen-saffron-mid） */
  mid: string;
  /** 强调深字（--zen-saffron-deep） */
  deep: string;
  /** 浅 tint（--zen-saffron-light） */
  light: string;
  /** 语义 surface / border */
  surface: string;
  border: string;
};

/** 与 tokens.css :root 默认藏红花对账 */
export const BRAND_OFFICE_ACCENT: OfficeAccentThemePreset = {
  id: "brand",
  label: "品牌（藏红花）",
  base: "#C58A43",
  mid: "#85530f",
  deep: "#452800",
  light: "#ffddba",
  surface: "#f9f3ec",
  border: "#eedcc7",
};

/**
 * 主题色预设（Fluent accent 系）。
 */
export const OFFICE_ACCENT_THEME_PRESETS: readonly OfficeAccentThemePreset[] = [
  BRAND_OFFICE_ACCENT,
  {
    id: "blue",
    label: "蓝色",
    base: "#0078D4",
    mid: "#005A9E",
    deep: "#004578",
    light: "#DEECF9",
    surface: "#EFF6FC",
    border: "#C7E0F4",
  },
  {
    id: "red",
    label: "红色",
    base: "#D13438",
    mid: "#A4262C",
    deep: "#751A1F",
    light: "#FDE7E9",
    surface: "#FEF1F1",
    border: "#F1BBBC",
  },
  {
    id: "orange",
    label: "橙色",
    base: "#CA5010",
    mid: "#993B0A",
    deep: "#6B2A07",
    light: "#FFEDD6",
    surface: "#FDF3EC",
    border: "#F4D4BC",
  },
  {
    id: "green",
    label: "绿色",
    base: "#107C10",
    mid: "#0B5A0B",
    deep: "#074007",
    light: "#DFF6DD",
    surface: "#EDF7ED",
    border: "#B7DEB8",
  },
  {
    id: "indigo",
    label: "靛蓝",
    base: "#3D4F5D",
    mid: "#2F3E4A",
    deep: "#1E2830",
    light: "#DCE4E8",
    surface: "#EEF1F3",
    border: "#C5D0D6",
  },
  {
    id: "pink",
    label: "粉色",
    base: "#E3008C",
    mid: "#AD0069",
    deep: "#770049",
    light: "#FCE4F3",
    surface: "#FDF0F8",
    border: "#F5B8DD",
  },
  {
    id: "teal",
    label: "青绿",
    base: "#038387",
    mid: "#026466",
    deep: "#014446",
    light: "#D5F3F4",
    surface: "#E6F7F7",
    border: "#A8DFE0",
  },
  {
    id: "gray",
    label: "灰色",
    base: "#69797E",
    mid: "#4F5D62",
    deep: "#323A3D",
    light: "#E8EBEC",
    surface: "#F0F2F3",
    border: "#C8CFD2",
  },
] as const;

export const DEFAULT_OFFICE_ACCENT_THEME_ID: OfficeAccentThemeId = "brand";

export function isOfficeAccentThemeId(value: string): value is OfficeAccentThemeId {
  return OFFICE_ACCENT_THEME_PRESETS.some((preset) => preset.id === value);
}
