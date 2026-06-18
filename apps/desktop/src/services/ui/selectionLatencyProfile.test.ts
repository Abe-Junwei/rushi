import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  installSelectionLatencyProfileDevTools,
  isSelectionLatencyProfileEnabled,
  resetSelectionLatencyProfileForTests,
  SELECTION_LATENCY_PROFILE_STORAGE_KEY,
  selectionProfileBegin,
  selectionProfileFlush,
  selectionProfileTime,
  setSelectionLatencyProfileEnabled,
} from "./selectionLatencyProfile";

vi.mock("../desktopUiLog", () => ({
  logDesktopUi: vi.fn(),
}));

import { logDesktopUi } from "../desktopUiLog";

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

describe("selectionLatencyProfile", () => {
  beforeEach(() => {
    resetSelectionLatencyProfileForTests();
    installMockLocalStorage();
    window.localStorage.clear();
    vi.mocked(logDesktopUi).mockClear();
  });

  it("is off by default", () => {
    expect(isSelectionLatencyProfileEnabled()).toBe(false);
  });

  it("aggregates selection spans into one log line", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    setSelectionLatencyProfileEnabled(true);
    selectionProfileBegin("list idx=3 segments=197");
    selectionProfileTime("flushSelectedIdx", () => {
      /* noop */
    });
    selectionProfileTime("viewport", () => {
      /* noop */
    });
    selectionProfileFlush();
    expect(logDesktopUi).toHaveBeenCalledWith(
      "INFO",
      expect.stringMatching(/\[selection-profile\] #1 list idx=3 segments=197 .*total=/),
    );
    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\[selection-profile\] #1 list idx=3 segments=197/),
    );
    infoSpy.mockRestore();
  });

  it("does nothing when disabled", () => {
    selectionProfileBegin("noop");
    selectionProfileFlush();
    expect(logDesktopUi).not.toHaveBeenCalled();
  });

  it("exposes dev console helpers", () => {
    installSelectionLatencyProfileDevTools();
    expect(window.__rushiSelectionProfile).toBeDefined();
    const on = window.__rushiSelectionProfile?.enable();
    expect(on?.enabled).toBe(true);
    expect(window.localStorage.getItem(SELECTION_LATENCY_PROFILE_STORAGE_KEY)).toBe("1");
    expect(window.__rushiSelectionProfile?.recent().length).toBeGreaterThan(0);
    const off = window.__rushiSelectionProfile?.disable();
    expect(off?.enabled).toBe(false);
    expect(isSelectionLatencyProfileEnabled()).toBe(false);
  });
});

export {};
