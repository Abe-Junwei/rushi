import { beforeEach, describe, expect, it } from "vitest";
import {
  applyOfficeAccentColor,
  initOfficeAccentTheme,
  OFFICE_ACCENT_COLOR_STORAGE_KEY,
  OFFICE_ACCENT_THEME_STORAGE_KEY,
  readStoredOfficeAccentColor,
  resetOfficeAccentColor,
} from "./officeAccentTheme";
import { readCspLayoutRulesForElement } from "../../utils/cspElementLayout";

function installMockLocalStorage() {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, String(value));
    },
    removeItem: (key: string) => {
      data.delete(key);
    },
    clear: () => {
      data.clear();
    },
  };
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: storage,
  });
}

describe("officeAccentTheme", () => {
  beforeEach(() => {
    installMockLocalStorage();
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-accent-theme");
    document.documentElement.removeAttribute("data-csp-layout-id");
  });

  it("defaults to brand without data-accent-theme or accent CSP rules", () => {
    expect(readStoredOfficeAccentColor()).toBe("#c58a43");
    initOfficeAccentTheme();
    expect(document.documentElement.dataset.accentTheme).toBeUndefined();
    expect(readCspLayoutRulesForElement(document.documentElement)).toBeUndefined();
  });

  it("persists free hex and writes accent CSS vars via CSP layout", () => {
    applyOfficeAccentColor("#0078D4");
    expect(window.localStorage.getItem(OFFICE_ACCENT_COLOR_STORAGE_KEY)).toBe("#0078d4");
    expect(readStoredOfficeAccentColor()).toBe("#0078d4");
    expect(document.documentElement.dataset.accentTheme).toBeUndefined();
    const rules = readCspLayoutRulesForElement(document.documentElement) ?? "";
    expect(rules).toContain("--accent-action: #0078d4");
    expect(rules).toContain("--accent-h:");
  });

  it("reset clears CSP accent rules back to brand", () => {
    applyOfficeAccentColor("#107c10");
    resetOfficeAccentColor();
    expect(readStoredOfficeAccentColor()).toBe("#c58a43");
    expect(readCspLayoutRulesForElement(document.documentElement)).toBeUndefined();
  });

  it("migrates legacy v1 purple preset id to indigo hex", () => {
    window.localStorage.setItem(OFFICE_ACCENT_THEME_STORAGE_KEY, "purple");
    expect(readStoredOfficeAccentColor()).toBe("#3d4f5d");
    expect(window.localStorage.getItem(OFFICE_ACCENT_COLOR_STORAGE_KEY)).toBe("#3d4f5d");
  });

  it("migrates legacy v1 blue preset id", () => {
    window.localStorage.setItem(OFFICE_ACCENT_THEME_STORAGE_KEY, "blue");
    initOfficeAccentTheme();
    expect(readStoredOfficeAccentColor()).toBe("#0078d4");
    const rules = readCspLayoutRulesForElement(document.documentElement) ?? "";
    expect(rules).toContain("--accent-action: #0078d4");
  });
});
