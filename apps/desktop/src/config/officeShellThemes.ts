/**
 * 壳层主题（彩色 / 白 / 浅灰 / 深灰 / 黑）。
 * 通过 `<html data-shell-theme>` + `[data-theme="dark"]` 覆盖 tokens.css 中的 notion / shell 变量。
 */

export type OfficeShellThemeId = "default" | "white" | "light-gray" | "dark-gray" | "black";

export type OfficeShellThemePreset = {
  id: OfficeShellThemeId;
  label: string;
  /** 设置 UI 预览条（顶栏色） */
  previewTop: string;
  /** 设置 UI 预览条（内容区色） */
  previewBody: string;
  isDark: boolean;
};

export const OFFICE_SHELL_THEME_PRESETS: readonly OfficeShellThemePreset[] = [
  {
    id: "default",
    label: "彩色",
    previewTop: "#f7f7f5",
    previewBody: "#ffffff",
    isDark: false,
  },
  {
    id: "white",
    label: "白色",
    previewTop: "#ffffff",
    previewBody: "#ffffff",
    isDark: false,
  },
  {
    id: "light-gray",
    label: "浅灰",
    previewTop: "#f3f2f1",
    previewBody: "#faf9f8",
    isDark: false,
  },
  {
    id: "dark-gray",
    label: "深灰",
    previewTop: "#333333",
    previewBody: "#292929",
    isDark: true,
  },
  {
    id: "black",
    label: "黑色",
    previewTop: "#252423",
    previewBody: "#1b1a19",
    isDark: true,
  },
] as const;

export const DEFAULT_OFFICE_SHELL_THEME_ID: OfficeShellThemeId = "default";

export function isOfficeShellThemeId(value: string): value is OfficeShellThemeId {
  return OFFICE_SHELL_THEME_PRESETS.some((preset) => preset.id === value);
}

export function getOfficeShellThemePreset(id: OfficeShellThemeId): OfficeShellThemePreset {
  return OFFICE_SHELL_THEME_PRESETS.find((preset) => preset.id === id) ?? OFFICE_SHELL_THEME_PRESETS[0];
}
