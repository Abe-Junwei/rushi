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
  });

  it("defaults to brand and does not set data-accent-theme", () => {
    expect(readStoredOfficeAccentThemeId()).toBe("brand");
    initOfficeAccentTheme();
    expect(document.documentElement.dataset.accentTheme).toBeUndefined();
  });

  it("persists and applies blue accent via data-accent-theme", () => {
    applyOfficeAccentTheme("blue");
    expect(window.localStorage.getItem(OFFICE_ACCENT_THEME_STORAGE_KEY)).toBe("blue");
    expect(readStoredOfficeAccentThemeId()).toBe("blue");
    expect(document.documentElement.dataset.accentTheme).toBe("blue");
  });

  it("restores tokens.css when switching back to brand", () => {
    applyOfficeAccentTheme("green");
    applyOfficeAccentTheme("brand");
    expect(document.documentElement.dataset.accentTheme).toBeUndefined();
  });
});
