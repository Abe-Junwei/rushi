import { beforeEach, describe, expect, it } from "vitest";
import {
  applyOfficeShellTheme,
  initOfficeShellTheme,
  OFFICE_SHELL_THEME_STORAGE_KEY,
  readStoredOfficeShellThemeId,
} from "./officeShellTheme";

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

describe("officeShellTheme", () => {
  beforeEach(() => {
    installMockLocalStorage();
    window.localStorage.clear();
    delete document.documentElement.dataset.shellTheme;
    delete document.documentElement.dataset.theme;
  });

  it("defaults to colorful shell without data attributes", () => {
    expect(readStoredOfficeShellThemeId()).toBe("default");
    initOfficeShellTheme();
    expect(document.documentElement.dataset.shellTheme).toBeUndefined();
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });

  it("persists dark-gray and sets dark mode", () => {
    applyOfficeShellTheme("dark-gray");
    expect(window.localStorage.getItem(OFFICE_SHELL_THEME_STORAGE_KEY)).toBe("dark-gray");
    expect(document.documentElement.dataset.shellTheme).toBe("dark-gray");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("restores light root when switching back to default", () => {
    applyOfficeShellTheme("black");
    applyOfficeShellTheme("default");
    expect(document.documentElement.dataset.shellTheme).toBeUndefined();
    expect(document.documentElement.dataset.theme).toBeUndefined();
  });
});
