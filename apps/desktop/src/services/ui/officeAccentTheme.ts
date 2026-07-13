/**
 * Obsidian-style free accent color: store #hex, derive ramp, apply CSS vars via CSP registry.
 * Research: docs/execution/specs/obsidian-style-accent-color-research.md
 */

import {
  BRAND_OFFICE_ACCENT,
  resolveAccentHexFromLegacyId,
} from "../../config/officeAccentThemes";
import {
  deriveAccentRamp,
  isBrandAccentHex,
  normalizeAccentHex,
} from "../../utils/deriveAccentRamp";
import { clearCspLayoutRules, setCspLayoutRules } from "../../utils/cspElementLayout";

/** @deprecated v1 preset id; migrated to {@link OFFICE_ACCENT_COLOR_STORAGE_KEY}. */
export const OFFICE_ACCENT_THEME_STORAGE_KEY = "rushi.office-accent-theme.v1";

export const OFFICE_ACCENT_COLOR_STORAGE_KEY = "rushi.office-accent-color.v2";

const ACCENT_LAYOUT_OWNER = "office-accent";

const listeners = new Set<() => void>();

function notifyOfficeAccentThemeChanged(): void {
  for (const listener of listeners) {
    listener();
  }
}

function clearAccentDataset(root: HTMLElement): void {
  delete root.dataset.accentTheme;
}

function writeAccentLayoutVars(root: HTMLElement, hex: string): void {
  const ramp = deriveAccentRamp(hex);
  setCspLayoutRules(
    root,
    {
      "--zen-saffron": ramp.base,
      "--zen-saffron-mid": ramp.mid,
      "--zen-saffron-deep": ramp.deep,
      "--zen-saffron-light": ramp.light,
      "--zen-primary-action-bg": ramp.base,
      "--zen-primary-action-bg-hover": ramp.mid,
      "--zen-saffron-surface": ramp.surface,
      "--zen-saffron-border": ramp.border,
      "--accent-action": ramp.base,
      "--accent-action-strong": ramp.mid,
      "--workbench-toggle-active-bg": ramp.base,
      "--workbench-toggle-active-text": "#ffffff",
      "--accent-h": String(ramp.accentH),
      "--accent-s": `${ramp.accentS}%`,
      "--accent-l": `${ramp.accentL}%`,
    },
    ACCENT_LAYOUT_OWNER,
  );
}

function writeStoredOfficeAccentColor(hex: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(OFFICE_ACCENT_COLOR_STORAGE_KEY, hex);
}

/** Migrate v1 preset id → v2 hex once; returns resolved hex. */
function migrateLegacyAccentStorage(): string | null {
  if (typeof window === "undefined") return null;
  const existing = window.localStorage.getItem(OFFICE_ACCENT_COLOR_STORAGE_KEY);
  if (normalizeAccentHex(existing)) return normalizeAccentHex(existing);
  const legacy = window.localStorage.getItem(OFFICE_ACCENT_THEME_STORAGE_KEY);
  if (!legacy) return null;
  const hex = normalizeAccentHex(resolveAccentHexFromLegacyId(legacy));
  if (!hex) return null;
  writeStoredOfficeAccentColor(hex);
  return hex;
}

export function readStoredOfficeAccentColor(): string {
  if (typeof window === "undefined") {
    return normalizeAccentHex(BRAND_OFFICE_ACCENT.base) ?? "#c58a43";
  }
  const fromV2 = normalizeAccentHex(
    window.localStorage.getItem(OFFICE_ACCENT_COLOR_STORAGE_KEY),
  );
  if (fromV2) return fromV2;
  const migrated = migrateLegacyAccentStorage();
  if (migrated) return migrated;
  return normalizeAccentHex(BRAND_OFFICE_ACCENT.base) ?? "#c58a43";
}

/** Apply accent hex to document + persist. Brand clears CSP accent overrides (tokens.css). */
export function applyOfficeAccentColor(hex: string): void {
  if (typeof document === "undefined") return;
  const normalized = normalizeAccentHex(hex) ?? readStoredOfficeAccentColor();
  const root = document.documentElement;
  clearAccentDataset(root);
  if (isBrandAccentHex(normalized)) {
    clearCspLayoutRules(root, ACCENT_LAYOUT_OWNER);
  } else {
    writeAccentLayoutVars(root, normalized);
  }
  writeStoredOfficeAccentColor(normalized);
  notifyOfficeAccentThemeChanged();
}

export function resetOfficeAccentColor(): void {
  applyOfficeAccentColor(BRAND_OFFICE_ACCENT.base);
}

/** 启动时调用：迁移 v1 并恢复 accent。 */
export function initOfficeAccentTheme(): string {
  const hex = readStoredOfficeAccentColor();
  applyOfficeAccentColor(hex);
  return hex;
}

/**
 * @deprecated Prefer {@link applyOfficeAccentColor}. Maps legacy preset id → hex.
 */
export function applyOfficeAccentTheme(id: string): void {
  applyOfficeAccentColor(resolveAccentHexFromLegacyId(id));
}

export function subscribeOfficeAccentTheme(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getOfficeAccentColorSnapshot(): string {
  return readStoredOfficeAccentColor();
}

/** @deprecated Use {@link getOfficeAccentColorSnapshot}. */
export function getOfficeAccentThemeSnapshot(): string {
  return getOfficeAccentColorSnapshot();
}

/** @deprecated Use {@link readStoredOfficeAccentColor}. */
export function readStoredOfficeAccentThemeId(): string {
  return readStoredOfficeAccentColor();
}
