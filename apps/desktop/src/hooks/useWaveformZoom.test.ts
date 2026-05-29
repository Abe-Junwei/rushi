import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  computeFitAllPxPerSec,
  computeFitSelectionPxPerSec,
  PX_PER_SEC_MAX,
  TIMELINE_PX_PER_SEC,
} from "../utils/pxPerSec";
import { useWaveformZoom } from "./useWaveformZoom";

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

  it("keeps committed pxPerSec frozen while slider drag preview updates", () => {
    const { result } = renderZoomHook();

    act(() => {
      result.current.beginZoomInteraction();
      result.current.setPxPerSecFromSlider(TIMELINE_PX_PER_SEC * 2);
    });

    expect(result.current.pxPerSec).toBe(TIMELINE_PX_PER_SEC * 2);
    expect(result.current.committedPxPerSec).toBe(TIMELINE_PX_PER_SEC);
    expect(result.current.zoomPreviewActive).toBe(true);

    act(() => {
      result.current.commitZoomInteraction();
    });

    expect(result.current.committedPxPerSec).toBe(TIMELINE_PX_PER_SEC * 2);
    expect(result.current.zoomPreviewActive).toBe(false);
  });

  it("setPxPerSecFromSlider accepts slider-range values above manual max", () => {
    const { result } = renderZoomHook();
    const fitAll = computeFitAllPxPerSec(800, 0.5);

    act(() => {
      result.current.setPxPerSecFromSlider(fitAll);
    });

    expect(fitAll).toBeGreaterThan(PX_PER_SEC_MAX);
    expect(result.current.pxPerSec).toBe(fitAll);
    expect(result.current.committedPxPerSec).toBe(fitAll);
  });

  it("setFitPxPerSec applies fit-selection px to preview and committed", () => {
    const { result } = renderHook(() => useWaveformZoom());

    act(() => {
      result.current.setFitPxPerSec(computeFitSelectionPxPerSec(800, 10, 12));
    });

    expect(result.current.pxPerSec).toBe((800 - 24) / 2);
    expect(result.current.committedPxPerSec).toBe(result.current.pxPerSec);
  });

  it("setFitPxPerSec can zoom a short segment past the manual slider ceiling", () => {
    const { result } = renderHook(() => useWaveformZoom());

    act(() => {
      result.current.setFitPxPerSec(computeFitSelectionPxPerSec(800, 10, 10.5));
    });

    expect(result.current.pxPerSec).toBeGreaterThan(PX_PER_SEC_MAX);
    expect(result.current.committedPxPerSec).toBe(result.current.pxPerSec);
  });

  it("setFitPxPerSec does not update committed during slider drag", () => {
    const { result } = renderZoomHook();

    act(() => {
      result.current.beginZoomInteraction();
      result.current.setPxPerSecFromSlider(120);
    });

    act(() => {
      result.current.setFitPxPerSec(computeFitSelectionPxPerSec(800, 10, 12));
    });

    expect(result.current.pxPerSec).toBe((800 - 24) / 2);
    expect(result.current.committedPxPerSec).toBe(TIMELINE_PX_PER_SEC);

    act(() => {
      result.current.commitZoomInteraction();
    });

    expect(result.current.committedPxPerSec).toBe((800 - 24) / 2);
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
    expect(result.current.committedPxPerSec).toBe(TIMELINE_PX_PER_SEC);
  });

  it("resetZoomForMedia uses fit-all when it exceeds manual max", () => {
    const { result } = renderZoomHook();
    const fitAll = computeFitAllPxPerSec(800, 0.5);

    act(() => {
      result.current.setPxPerSecFromSlider(TIMELINE_PX_PER_SEC);
    });

    act(() => {
      result.current.resetZoomForMedia(800, 0.5);
    });

    expect(result.current.pxPerSec).toBe(fitAll);
    expect(result.current.committedPxPerSec).toBe(fitAll);
  });
});
