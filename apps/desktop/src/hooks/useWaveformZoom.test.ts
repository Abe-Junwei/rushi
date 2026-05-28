import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TIMELINE_PX_PER_SEC } from "../utils/pxPerSec";
import { useWaveformZoom } from "./useWaveformZoom";

function renderZoomHook() {
  return renderHook(() =>
    useWaveformZoom({
      getTierWidth: () => 560,
      getDuration: () => 10,
      getSelectedSegment: () => ({ start_sec: 2, end_sec: 4 }),
    }),
  );
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
    vi.stubGlobal("requestAnimationFrame", vi.fn((_cb: FrameRequestCallback) => 1));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps slider changes as preview until interaction commits", () => {
    const { result } = renderZoomHook();

    act(() => {
      result.current.beginZoomInteraction();
      result.current.setPxPerSec(TIMELINE_PX_PER_SEC * 2);
    });

    expect(result.current.pxPerSec).toBe(TIMELINE_PX_PER_SEC * 2);
    expect(result.current.renderPxPerSec).toBe(TIMELINE_PX_PER_SEC);
    expect(result.current.zoomPreviewActive).toBe(true);

    act(() => {
      result.current.commitZoomInteraction();
    });

    expect(result.current.renderPxPerSec).toBe(TIMELINE_PX_PER_SEC * 2);
    expect(result.current.zoomPreviewActive).toBe(false);
  });

  it("flushes the latest visual zoom when slider interaction ends", () => {
    const { result } = renderZoomHook();

    act(() => {
      result.current.beginZoomInteraction();
      result.current.setPxPerSec(TIMELINE_PX_PER_SEC * 2);
    });

    expect(result.current.renderPxPerSec).toBe(TIMELINE_PX_PER_SEC);
    expect(result.current.zoomPreviewActive).toBe(true);

    act(() => {
      result.current.commitZoomInteraction();
    });

    expect(result.current.renderPxPerSec).toBe(TIMELINE_PX_PER_SEC * 2);
    expect(result.current.zoomPreviewActive).toBe(false);
  });

  it("commits discrete zoom commands immediately", () => {
    const { result } = renderZoomHook();

    act(() => {
      result.current.zoomIn();
    });

    expect(result.current.renderPxPerSec).toBe(result.current.pxPerSec);
    expect(result.current.zoomPreviewActive).toBe(false);
  });

  it("zoomToFitTier fits short audio to viewport width", () => {
    const { result } = renderZoomHook();

    act(() => {
      result.current.zoomToFitTier();
    });

    expect(result.current.pxPerSec).toBe(56);
    expect(result.current.renderPxPerSec).toBe(56);
  });

  it("zoomToFitTier can go below manual slider min for long audio", () => {
    const { result } = renderHook(() =>
      useWaveformZoom({
        getTierWidth: () => 800,
        getDuration: () => 3600,
        getSelectedSegment: () => null,
      }),
    );

    act(() => {
      result.current.zoomToFitTier();
    });

    expect(result.current.pxPerSec).toBeCloseTo(800 / 3600, 5);
    expect(result.current.pxPerSec).toBeLessThan(16);
  });

  it("zoomToFitSelection scales to the selected segment span", () => {
    const { result } = renderHook(() =>
      useWaveformZoom({
        getTierWidth: () => 800,
        getDuration: () => 120,
        getSelectedSegment: () => ({ start_sec: 10, end_sec: 12 }),
      }),
    );

    act(() => {
      result.current.zoomToFitSelection();
    });

    expect(result.current.pxPerSec).toBe((800 - 24) / 2);
  });
});
