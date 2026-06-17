import {
  DEFAULT_OFFICE_ACCENT_THEME_ID,
  getOfficeAccentThemePreset,
  isOfficeAccentThemeId,
  type OfficeAccentThemeId,
  type OfficeAccentThemePreset,
} from "../../config/officeAccentThemes";

export const OFFICE_ACCENT_THEME_STORAGE_KEY = "rushi.office-accent-theme.v1";

const ACCENT_CSS_PROPERTIES = [
  "--zen-saffron",
  "--zen-saffron-mid",
  "--zen-saffron-deep",
  "--zen-saffron-light",
  "--zen-primary-action-bg",
  "--zen-primary-action-bg-hover",
  "--zen-saffron-surface",
  "--zen-saffron-border",
  "--accent-action",
  "--accent-action-strong",
  "--workbench-toggle-active-bg",
  "--workbench-toggle-active-text",
] as const;

const listeners = new Set<() => void>();

function notifyOfficeAccentThemeChanged(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function readStoredOfficeAccentThemeId(): OfficeAccentThemeId {
  if (typeof window === "undefined") return DEFAULT_OFFICE_ACCENT_THEME_ID;
  const raw = window.localStorage.getItem(OFFICE_ACCENT_THEME_STORAGE_KEY);
  if (!raw || !isOfficeAccentThemeId(raw)) return DEFAULT_OFFICE_ACCENT_THEME_ID;
  return raw;
}

function writeStoredOfficeAccentThemeId(id: OfficeAccentThemeId): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(OFFICE_ACCENT_THEME_STORAGE_KEY, id);
}

function applyPresetToRoot(root: HTMLElement, preset: OfficeAccentThemePreset): void {
  root.dataset.accentTheme = preset.id;
  root.style.setProperty("--zen-saffron", preset.base);
  root.style.setProperty("--zen-saffron-mid", preset.mid);
  root.style.setProperty("--zen-saffron-deep", preset.deep);
  root.style.setProperty("--zen-saffron-light", preset.light);
  root.style.setProperty("--zen-primary-action-bg", preset.base);
  root.style.setProperty("--zen-primary-action-bg-hover", preset.mid);
  root.style.setProperty("--zen-saffron-surface", preset.surface);
  root.style.setProperty("--zen-saffron-border", preset.border);
  root.style.setProperty("--accent-action", preset.base);
  root.style.setProperty("--accent-action-strong", preset.mid);
  root.style.setProperty("--workbench-toggle-active-bg", preset.base);
  root.style.setProperty("--workbench-toggle-active-text", "#ffffff");
}

function clearAccentOverrides(root: HTMLElement): void {
  delete root.dataset.accentTheme;
  for (const property of ACCENT_CSS_PROPERTIES) {
    root.style.removeProperty(property);
  }
}

/** 启动时调用：从 localStorage 恢复 accent。brand 时清除 inline 覆盖，回退 tokens.css。 */
export function initOfficeAccentTheme(): OfficeAccentThemeId {
  const id = readStoredOfficeAccentThemeId();
  applyOfficeAccentTheme(id);
  return id;
}

export function applyOfficeAccentTheme(id: OfficeAccentThemeId): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (id === DEFAULT_OFFICE_ACCENT_THEME_ID) {
    clearAccentOverrides(root);
  } else {
    applyPresetToRoot(root, getOfficeAccentThemePreset(id));
  }
  writeStoredOfficeAccentThemeId(id);
  notifyOfficeAccentThemeChanged();
}

export function subscribeOfficeAccentTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getOfficeAccentThemeSnapshot(): OfficeAccentThemeId {
  return readStoredOfficeAccentThemeId();
}
