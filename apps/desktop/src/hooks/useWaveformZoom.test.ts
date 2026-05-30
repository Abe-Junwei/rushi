import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  computeFitAllPxPerSec,
  computeFitSelectionPxPerSec,
  PX_PER_SEC_MAX,
  resolveDefaultEditingPxPerSec,
  TIMELINE_PX_PER_SEC,
} from "../utils/pxPerSec";
import { DRAW_PX_PER_SEC_DEBOUNCE_MS, useWaveformZoom } from "./useWaveformZoom";

function renderZoomHook() {
  return renderHook(() => useWaveformZoom());
}

describe("useWaveformZoom", () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => storage.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        storage.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        storage.delete(key);
      }),
      clear: vi.fn(() => {
        storage.clear();
      }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("setPxPerSecFromSlider accepts slider-range values above manual max", () => {
    const { result } = renderZoomHook();
    const fitAll = computeFitAllPxPerSec(800, 0.5);

    act(() => {
      result.current.setPxPerSecFromSlider(fitAll);
    });

    expect(fitAll).toBeGreaterThan(PX_PER_SEC_MAX);
    expect(result.current.pxPerSec).toBe(fitAll);
  });

  it("setFitPxPerSec applies fit-selection px/s immediately", () => {
    const { result } = renderHook(() => useWaveformZoom());

    act(() => {
      result.current.setFitPxPerSec(computeFitSelectionPxPerSec(800, 10, 12));
    });

    expect(result.current.pxPerSec).toBe((800 * 0.8) / 2);
  });

  it("setFitPxPerSec can zoom a short segment past the manual slider ceiling", () => {
    const { result } = renderHook(() => useWaveformZoom());

    act(() => {
      result.current.setFitPxPerSec(computeFitSelectionPxPerSec(800, 10, 10.5));
    });

    expect(result.current.pxPerSec).toBeGreaterThan(PX_PER_SEC_MAX);
  });

  it("resetZoom restores design default pxPerSec", () => {
    const { result } = renderZoomHook();

    act(() => {
      result.current.setPxPerSecFromSlider(TIMELINE_PX_PER_SEC * 2);
    });
    expect(result.current.pxPerSec).toBe(TIMELINE_PX_PER_SEC * 2);

    act(() => {
      result.current.resetZoom();
    });

    expect(result.current.pxPerSec).toBe(TIMELINE_PX_PER_SEC);
  });

  it("resetZoomForMedia uses per-file geometric default", () => {
    const { result } = renderZoomHook();
    const expected = resolveDefaultEditingPxPerSec(800, 0.5);

    act(() => {
      result.current.setPxPerSecFromSlider(TIMELINE_PX_PER_SEC);
    });

    act(() => {
      result.current.resetZoomForMedia(800, 0.5);
    });

    expect(result.current.pxPerSec).toBeCloseTo(expected, 4);
    expect(expected).toBeGreaterThan(PX_PER_SEC_MAX);
  });

  it("resetZoomForMedia sets default intent for typical media", () => {
    const { result } = renderZoomHook();

    act(() => {
      result.current.setPxPerSecFromSlider(TIMELINE_PX_PER_SEC * 2);
    });

    act(() => {
      result.current.resetZoomForMedia(800, 120);
    });

    expect(result.current.pxPerSec).toBeCloseTo(resolveDefaultEditingPxPerSec(800, 120), 4);
    expect(result.current.layoutIntent).toBe("default");
  });

  it("enterFitAllLayout sets fit-all intent", () => {
    const { result } = renderZoomHook();
    const fitAll = computeFitAllPxPerSec(1200, 3600);

    act(() => {
      result.current.enterFitAllLayout(fitAll);
    });

    expect(result.current.layoutIntent).toBe("fit-all");
    expect(result.current.pxPerSec).toBe(fitAll);
  });

  it("manual slider change clears fit-all intent", () => {
    const { result } = renderZoomHook();

    act(() => {
      result.current.enterFitAllLayout(computeFitAllPxPerSec(800, 3600));
    });
    act(() => {
      result.current.setPxPerSecFromSlider(TIMELINE_PX_PER_SEC);
    });

    expect(result.current.layoutIntent).toBe("manual");
  });

  it("setPxPerSecFromSlider updates layout immediately and debounces draw px/s", () => {
    vi.useFakeTimers();
    const { result } = renderZoomHook();

    act(() => {
      result.current.setPxPerSecFromSlider(TIMELINE_PX_PER_SEC * 2);
    });

    expect(result.current.layoutPxPerSec).toBe(TIMELINE_PX_PER_SEC * 2);
    expect(result.current.drawPxPerSec).toBe(TIMELINE_PX_PER_SEC);

    act(() => {
      vi.advanceTimersByTime(DRAW_PX_PER_SEC_DEBOUNCE_MS);
    });

    expect(result.current.drawPxPerSec).toBe(TIMELINE_PX_PER_SEC * 2);
    vi.useRealTimers();
  });

  it("setFitPxPerSec syncs layout and draw immediately", () => {
    const { result } = renderZoomHook();
    const fitPx = computeFitSelectionPxPerSec(800, 10, 12);

    act(() => {
      result.current.setFitPxPerSec(fitPx);
    });

    expect(result.current.layoutPxPerSec).toBe(fitPx);
    expect(result.current.drawPxPerSec).toBe(fitPx);
  });
});
