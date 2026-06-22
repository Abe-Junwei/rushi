import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  computeSelectionProfileSyncPathMs,
  installSelectionLatencyProfileDevTools,
  isSelectionLatencyProfileEnabled,
  parseSelectionProfileLine,
  resetSelectionLatencyProfileForTests,
  SELECTION_LATENCY_PROFILE_STORAGE_KEY,
  SELECTION_PROFILE_CI_SYNC_PATH_MAX_MS,
  selectionProfileBegin,
  selectionProfileFlush,
  selectionProfileMeetsCiGate,
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

  it("parseSelectionProfileLine extracts syncPathTotal and spans", () => {
    const line =
      "[selection-profile] #2 waveform idx=68 segments=193 flushSelectedIdx=2.0ms firstPaint=3.5ms listChrome=1.2ms syncPathTotal=5.5ms total=120.0ms";
    const parsed = parseSelectionProfileLine(line);
    expect(parsed).not.toBeNull();
    expect(parsed!.label).toBe("waveform idx=68 segments=193");
    expect(parsed!.spans.firstPaint).toBe(3.5);
    expect(parsed!.syncPathTotalMs).toBe(5.5);
    expect(computeSelectionProfileSyncPathMs(parsed!.spans)).toBe(2);
    expect(selectionProfileMeetsCiGate(parsed!)).toBe(true);
  });

  it("computeSelectionProfileSyncPathMs avoids nested listChrome inside flushSelectedIdx", () => {
    expect(
      computeSelectionProfileSyncPathMs({
        flushSelectedIdx: 119,
        firstPaint: 100,
        listChrome: 100,
        listScroll: 18,
        seek: 1,
      }),
    ).toBe(120);
  });

  it("computeSelectionProfileSyncPathMs excludes firstPaint and listCommit", () => {
    const sync = computeSelectionProfileSyncPathMs({
      flushSelectedIdx: 5,
      firstPaint: 10,
      listCommit: 400,
      listScroll: 20,
    });
    expect(sync).toBe(5);
    expect(sync).toBeLessThanOrEqual(SELECTION_PROFILE_CI_SYNC_PATH_MAX_MS);
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
