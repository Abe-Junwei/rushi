import {
  DEFAULT_OFFICE_SHELL_THEME_ID,
  getOfficeShellThemePreset,
  isOfficeShellThemeId,
  type OfficeShellThemeId,
} from "../../config/officeShellThemes";
import { readStoredOfficeAccentColor, applyOfficeAccentColor } from "./officeAccentTheme";

export const OFFICE_SHELL_THEME_STORAGE_KEY = "rushi.office-shell-theme.v1";

const listeners = new Set<() => void>();

function notifyOfficeShellThemeChanged(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function readStoredOfficeShellThemeId(): OfficeShellThemeId {
  if (typeof window === "undefined") return DEFAULT_OFFICE_SHELL_THEME_ID;
  const raw = window.localStorage.getItem(OFFICE_SHELL_THEME_STORAGE_KEY);
  if (!raw || !isOfficeShellThemeId(raw)) return DEFAULT_OFFICE_SHELL_THEME_ID;
  return raw;
}

function writeStoredOfficeShellThemeId(id: OfficeShellThemeId): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(OFFICE_SHELL_THEME_STORAGE_KEY, id);
}

function applyShellThemeToRoot(root: HTMLElement, id: OfficeShellThemeId): void {
  const preset = getOfficeShellThemePreset(id);
  if (id === DEFAULT_OFFICE_SHELL_THEME_ID) {
    delete root.dataset.shellTheme;
    delete root.dataset.theme;
  } else {
    root.dataset.shellTheme = id;
    if (preset.isDark) {
      root.dataset.theme = "dark";
    } else {
      delete root.dataset.theme;
    }
  }
}

/** 启动时调用：恢复壳层主题，并重新套用当前 accent（暗色骨架会改默认 saffron）。 */
export function initOfficeShellTheme(): OfficeShellThemeId {
  const id = readStoredOfficeShellThemeId();
  applyOfficeShellTheme(id, { reapplyAccent: false });
  applyOfficeAccentColor(readStoredOfficeAccentColor());
  return id;
}

export function applyOfficeShellTheme(
  id: OfficeShellThemeId,
  options: { reapplyAccent?: boolean } = {},
): void {
  if (typeof document === "undefined") return;
  const { reapplyAccent = true } = options;
  applyShellThemeToRoot(document.documentElement, id);
  writeStoredOfficeShellThemeId(id);
  if (reapplyAccent) {
    applyOfficeAccentColor(readStoredOfficeAccentColor());
  }
  notifyOfficeShellThemeChanged();
}

export function subscribeOfficeShellTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getOfficeShellThemeSnapshot(): OfficeShellThemeId {
  return readStoredOfficeShellThemeId();
}
