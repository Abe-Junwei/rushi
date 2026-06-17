import { beforeEach, describe, expect, it } from "vitest";
import {
  applyOfficeAccentTheme,
  initOfficeAccentTheme,
  OFFICE_ACCENT_THEME_STORAGE_KEY,
  readStoredOfficeAccentThemeId,
} from "./officeAccentTheme";

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
    document.documentElement.style.removeProperty("--zen-saffron");
  });

  it("defaults to brand and does not inline override saffron", () => {
    expect(readStoredOfficeAccentThemeId()).toBe("brand");
    initOfficeAccentTheme();
    expect(document.documentElement.style.getPropertyValue("--zen-saffron")).toBe("");
    expect(document.documentElement.dataset.accentTheme).toBeUndefined();
  });

  it("persists and applies blue accent variables", () => {
    applyOfficeAccentTheme("blue");
    expect(window.localStorage.getItem(OFFICE_ACCENT_THEME_STORAGE_KEY)).toBe("blue");
    expect(readStoredOfficeAccentThemeId()).toBe("blue");
    expect(document.documentElement.dataset.accentTheme).toBe("blue");
    expect(document.documentElement.style.getPropertyValue("--zen-saffron").trim()).toBe("#0078D4");
    expect(document.documentElement.style.getPropertyValue("--zen-primary-action-bg-hover").trim()).toBe(
      "#005A9E",
    );
  });

  it("restores tokens.css when switching back to brand", () => {
    applyOfficeAccentTheme("green");
    applyOfficeAccentTheme("brand");
    expect(document.documentElement.style.getPropertyValue("--zen-saffron")).toBe("");
    expect(document.documentElement.dataset.accentTheme).toBeUndefined();
  });
});
