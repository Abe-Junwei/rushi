import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useWaveformZoomSync } from "./useWaveformZoomSync";

describe("useWaveformZoomSync", () => {
  it("calls ws.zoom synchronously in layout effect when minPxPerSec changes", () => {
    const zoom = vi.fn();
    const ws = { zoom };
    const wsRef = { current: ws as never };
    const appliedZoomPxPerSecRef = { current: 56 };

    const { rerender } = renderHook(
      (props: { minPxPerSec: number }) =>
        useWaveformZoomSync({
          wsRef,
          isReady: true,
          minPxPerSec: props.minPxPerSec,
          appliedZoomPxPerSecRef,
        }),
      { initialProps: { minPxPerSec: 56 } },
    );

    expect(zoom).not.toHaveBeenCalled();

    rerender({ minPxPerSec: 112 });

    expect(zoom).toHaveBeenCalledTimes(1);
    expect(zoom).toHaveBeenCalledWith(112);
    expect(appliedZoomPxPerSecRef.current).toBe(112);
  });
});
