import { beforeEach, describe, expect, it } from "vitest";
import {
  applyUiDisplayScale,
  DEFAULT_UI_DISPLAY_SCALE,
  initUiDisplayScale,
  readStoredUiDisplayScale,
  scaleUiPanelPx,
  snapUiDisplayScale,
  UI_DISPLAY_SCALE_STORAGE_KEY,
} from "./uiDisplayScale";

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

describe("uiDisplayScale", () => {
  beforeEach(() => {
    installMockLocalStorage();
    window.localStorage.clear();
    delete document.documentElement.dataset.uiScale;
  });

  it("defaults to 100% without storage", () => {
    expect(readStoredUiDisplayScale()).toBe(DEFAULT_UI_DISPLAY_SCALE);
    initUiDisplayScale();
    expect(document.documentElement.dataset.uiScale).toBeUndefined();
  });

  it("snaps invalid values to nearest preset", () => {
    expect(snapUiDisplayScale(1.12)).toBe(1.1);
    expect(snapUiDisplayScale(1.4)).toBe(1.5);
    expect(snapUiDisplayScale(Number.NaN)).toBe(1);
  });

  it("persists and applies 125%", () => {
    applyUiDisplayScale(1.25);
    expect(window.localStorage.getItem(UI_DISPLAY_SCALE_STORAGE_KEY)).toBe("1.25");
    expect(document.documentElement.dataset.uiScale).toBe("1.25");
    expect(readStoredUiDisplayScale()).toBe(1.25);
  });

  it("restores stored scale on init", () => {
    window.localStorage.setItem(UI_DISPLAY_SCALE_STORAGE_KEY, "1.5");
    initUiDisplayScale();
    expect(document.documentElement.dataset.uiScale).toBe("1.5");
  });

  it("scaleUiPanelPx multiplies by active scale", () => {
    expect(scaleUiPanelPx(400, 1)).toBe(400);
    expect(scaleUiPanelPx(400, 1.25)).toBe(500);
    expect(scaleUiPanelPx(280, 1.5)).toBe(420);
  });
});
