import {
  DEFAULT_OFFICE_ACCENT_THEME_ID,
  isOfficeAccentThemeId,
  type OfficeAccentThemeId,
} from "../../config/officeAccentThemes";

export const OFFICE_ACCENT_THEME_STORAGE_KEY = "rushi.office-accent-theme.v1";

const listeners = new Set<() => void>();

function notifyOfficeAccentThemeChanged(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function readStoredOfficeAccentThemeId(): OfficeAccentThemeId {
  if (typeof window === "undefined") return DEFAULT_OFFICE_ACCENT_THEME_ID;
  const raw = window.localStorage.getItem(OFFICE_ACCENT_THEME_STORAGE_KEY);
  if (raw === "purple") return "indigo";
  if (!raw || !isOfficeAccentThemeId(raw)) return DEFAULT_OFFICE_ACCENT_THEME_ID;
  return raw;
}

function writeStoredOfficeAccentThemeId(id: OfficeAccentThemeId): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(OFFICE_ACCENT_THEME_STORAGE_KEY, id);
}

function clearAccentDataset(root: HTMLElement): void {
  delete root.dataset.accentTheme;
}

/** 启动时调用：从 localStorage 恢复 accent。brand 时清除 data-accent-theme，回退 tokens.css。 */
export function initOfficeAccentTheme(): OfficeAccentThemeId {
  const id = readStoredOfficeAccentThemeId();
  applyOfficeAccentTheme(id);
  return id;
}

export function applyOfficeAccentTheme(id: OfficeAccentThemeId): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (id === DEFAULT_OFFICE_ACCENT_THEME_ID) {
    clearAccentDataset(root);
  } else {
    root.dataset.accentTheme = id;
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
