import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createWaveformAppliedZoomState } from "../utils/waveformAppliedZoom";
import { useWaveformZoomSync } from "./useWaveformZoomSync";
import { flushRaf, makeWs, zoomSyncBase } from "./useWaveformZoomSync.testHelpers";

describe("useWaveformZoomSync", () => {
  it("disables autoScroll and applies ws.zoom when no peak cache", async () => {
    const ws = makeWs();
    const wsRef = { current: ws as never };
    const appliedZoom = createWaveformAppliedZoomState(56);

    const { rerender } = renderHook(
      (props: { minPxPerSec: number }) =>
        useWaveformZoomSync({
          ...zoomSyncBase,
          wsRef,
          minPxPerSec: props.minPxPerSec,
          appliedZoom,
        }),
      { initialProps: { minPxPerSec: 56 } },
    );

    rerender({ minPxPerSec: 80 });
    await flushRaf();

    expect(appliedZoom.appliedZoomPxPerSecRef.current).toBe(80);
    expect(ws.setOptions).toHaveBeenCalledWith({ autoScroll: false });
    expect(ws.zoom).toHaveBeenCalledWith(80);
  });

  it("calls onZoomApplied after zoom commit", async () => {
    const ws = makeWs();
    const wsRef = { current: ws as never };
    const appliedZoom = createWaveformAppliedZoomState(56);
    const onZoomApplied = vi.fn();
    const onZoomAppliedRef = { current: onZoomApplied };

    const { rerender } = renderHook(
      (props: { minPxPerSec: number }) =>
        useWaveformZoomSync({
          ...zoomSyncBase,
          wsRef,
          minPxPerSec: props.minPxPerSec,
          appliedZoom,
          onZoomAppliedRef,
        }),
      { initialProps: { minPxPerSec: 56 } },
    );

    rerender({ minPxPerSec: 80 });
    await flushRaf();

    expect(onZoomApplied).toHaveBeenCalledWith(80);
  });

  it("applies ws.zoom synchronously in layout effect without waiting for rAF", () => {
    const ws = makeWs();
    const wsRef = { current: ws as never };
    const appliedZoom = createWaveformAppliedZoomState(56);

    const { rerender } = renderHook(
      (props: { minPxPerSec: number }) =>
        useWaveformZoomSync({
          ...zoomSyncBase,
          wsRef,
          minPxPerSec: props.minPxPerSec,
          appliedZoom,
        }),
      { initialProps: { minPxPerSec: 56 } },
    );

    rerender({ minPxPerSec: 80 });

    expect(appliedZoom.appliedZoomPxPerSecRef.current).toBe(80);
    expect(ws.zoom).toHaveBeenCalledWith(80);
  });
});
