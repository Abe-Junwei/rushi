import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  installWaveformZoomProfileDevTools,
  isWaveformZoomProfileEnabled,
  resetWaveformZoomProfileForTests,
  setWaveformZoomProfileEnabled,
  wfProfileBegin,
  wfProfileFlush,
  wfProfileTime,
  WAVEFORM_ZOOM_PROFILE_STORAGE_KEY,
} from "./waveformZoomProfile";

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

describe("waveformZoomProfile", () => {
  beforeEach(() => {
    resetWaveformZoomProfileForTests();
    installMockLocalStorage();
    window.localStorage.clear();
    vi.mocked(logDesktopUi).mockClear();
  });

  it("is off by default", () => {
    expect(isWaveformZoomProfileEnabled()).toBe(false);
  });

  it("aggregates spans into one log line", () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    setWaveformZoomProfileEnabled(true);
    wfProfileBegin("load-peaks@400px/s");
    wfProfileTime("resample", () => {
      /* noop */
    });
    wfProfileTime("wsZoom", () => {
      /* noop */
    });
    wfProfileFlush();
    expect(logDesktopUi).toHaveBeenCalledWith(
      "INFO",
      expect.stringMatching(/\[wf-profile\] #1 load-peaks@400px\/s resample=.* wsZoom=.* total=/),
    );
    expect(infoSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\[wf-profile\] #1 load-peaks@400px\/s/),
    );
    infoSpy.mockRestore();
  });

  it("does nothing when disabled", () => {
    wfProfileBegin("noop@56px/s");
    wfProfileFlush();
    expect(logDesktopUi).not.toHaveBeenCalled();
  });

  it("exposes dev console helpers", () => {
    installWaveformZoomProfileDevTools();
    expect(window.__rushiWfProfile).toBeDefined();
    window.__rushiWfProfile?.enable();
    expect(window.localStorage.getItem(WAVEFORM_ZOOM_PROFILE_STORAGE_KEY)).toBe("1");
    expect(window.__rushiWfProfile?.recent().length).toBeGreaterThan(0);
    window.__rushiWfProfile?.disable();
    expect(isWaveformZoomProfileEnabled()).toBe(false);
  });
});

declare global {
  interface Window {
    __rushiWfProfile?: {
      enable: () => void;
      disable: () => void;
      enabled: () => boolean;
      recent: () => string[];
      print: () => void;
    };
  }
}

export {};
