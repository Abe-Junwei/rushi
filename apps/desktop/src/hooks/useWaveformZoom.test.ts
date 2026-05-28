import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { computeFitSelectionPxPerSec, TIMELINE_PX_PER_SEC } from "../utils/pxPerSec";
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

  it("uses single pxPerSec for render (no CSS scaleX preview)", () => {
    const { result } = renderZoomHook();

    act(() => {
      result.current.beginZoomInteraction();
      result.current.setPxPerSec(TIMELINE_PX_PER_SEC * 2);
    });

    expect(result.current.pxPerSec).toBe(TIMELINE_PX_PER_SEC * 2);
    expect(result.current.renderPxPerSec).toBe(TIMELINE_PX_PER_SEC * 2);
    expect(result.current.zoomPreviewActive).toBe(false);

    act(() => {
      result.current.commitZoomInteraction();
    });

    expect(result.current.renderPxPerSec).toBe(TIMELINE_PX_PER_SEC * 2);
  });

  it("commits discrete zoom commands immediately", () => {
    const { result } = renderZoomHook();

    act(() => {
      result.current.zoomIn();
    });

    expect(result.current.renderPxPerSec).toBe(result.current.pxPerSec);
    expect(result.current.zoomPreviewActive).toBe(false);
  });

  it("setFitPxPerSec applies fit-selection px", () => {
    const { result } = renderHook(() => useWaveformZoom());

    act(() => {
      result.current.setFitPxPerSec(computeFitSelectionPxPerSec(800, 10, 12));
    });

    expect(result.current.pxPerSec).toBe((800 - 24) / 2);
  });

  it("resetZoom restores design default pxPerSec", () => {
    const { result } = renderZoomHook();

    act(() => {
      result.current.setPxPerSec(TIMELINE_PX_PER_SEC * 2);
    });
    expect(result.current.pxPerSec).toBe(TIMELINE_PX_PER_SEC * 2);

    act(() => {
      result.current.resetZoom();
    });

    expect(result.current.pxPerSec).toBe(TIMELINE_PX_PER_SEC);
    expect(result.current.renderPxPerSec).toBe(TIMELINE_PX_PER_SEC);
  });
});
