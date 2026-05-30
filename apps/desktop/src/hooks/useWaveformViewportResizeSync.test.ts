import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWaveformViewportResizeSync } from "./useWaveformViewportResizeSync";
import { WAVEFORM_TIER_VIEWPORT_WIDTH_VAR } from "../utils/waveformViewport";

async function flushRaf() {
  await act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
}

function createSyncArgs(width: number) {
  const reRender = vi.fn();
  const syncScrollAfterRender = vi.fn();
  const redrawcompleteHandlers: Array<() => void> = [];
  const tier = document.createElement("div");
  Object.defineProperty(tier, "clientWidth", { configurable: true, value: width });
  Object.defineProperty(tier, "offsetWidth", { configurable: true, value: width });
  const sticky = document.createElement("div");
  const stretch = document.createElement("div");
  const tierScrollRef = { current: tier };
  const stickyShellRef = { current: sticky };
  const stretchShellRef = { current: stretch };
  const containerRef = {
    current: {
      clientWidth: width,
      offsetWidth: width,
      getBoundingClientRect: () => ({}),
    } as HTMLDivElement,
  };
  const ws = {
    zoom: vi.fn(),
    getRenderer: () => ({ reRender }),
    getWidth: () => tierScrollRef.current?.clientWidth ?? width,
    on: (event: string, cb: () => void) => {
      if (event === "redrawcomplete") redrawcompleteHandlers.push(cb);
      return () => {
        const idx = redrawcompleteHandlers.indexOf(cb);
        if (idx >= 0) redrawcompleteHandlers.splice(idx, 1);
      };
    },
  };
  return {
    reRender,
    syncScrollAfterRender,
    redrawcompleteHandlers,
    tierScrollRef,
    stickyShellRef,
    stretchShellRef,
    containerRef,
    wsRef: { current: ws as never },
  };
}

describe("useWaveformViewportResizeSync", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mountWithRo(args: ReturnType<typeof createSyncArgs>, extra: Record<string, unknown> = {}) {
    let roCallback: (() => void) | undefined;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(cb: () => void) {
          roCallback = cb;
        }
        observe() {}
        disconnect() {}
      },
    );
    renderHook(() =>
      useWaveformViewportResizeSync({
        wsRef: args.wsRef,
        containerRef: args.containerRef,
        stickyShellRef: args.stickyShellRef,
        stretchShellRef: args.stretchShellRef,
        tierScrollRef: args.tierScrollRef,
        isReady: true,
        deferDecodeMount: false,
        syncScrollAfterRender: args.syncScrollAfterRender,
        ...extra,
      }),
    );
    return () => roCallback?.();
  }

  async function triggerViewportGrow(
    args: ReturnType<typeof createSyncArgs>,
    fireRo: () => void,
    nextWidth: number,
  ) {
    Object.defineProperty(args.tierScrollRef.current!, "clientWidth", {
      configurable: true,
      value: nextWidth,
    });
    Object.defineProperty(args.tierScrollRef.current!, "offsetWidth", {
      configurable: true,
      value: nextWidth,
    });
    args.containerRef.current = {
      clientWidth: nextWidth,
      offsetWidth: nextWidth,
      getBoundingClientRect: () => ({}),
    } as HTMLDivElement;
    await act(async () => {
      fireRo();
    });
    await flushRaf();
  }

  it("re-renders WaveSurfer when viewport width changes", async () => {
    const args = createSyncArgs(800);
    const fireRo = mountWithRo(args);

    await triggerViewportGrow(args, fireRo, 1600);

    expect(args.reRender).toHaveBeenCalledTimes(1);
    expect(args.stickyShellRef.current!.style.width).toBe("1600px");
    expect(args.stretchShellRef.current!.style.transform).toBe("scaleX(2)");
  });

  it("clears stretch transform after redrawcomplete", async () => {
    const args = createSyncArgs(800);
    const fireRo = mountWithRo(args);

    await triggerViewportGrow(args, fireRo, 1600);

    expect(args.stretchShellRef.current!.style.transform).toBe("scaleX(2)");

    await act(async () => {
      args.redrawcompleteHandlers.forEach((handler) => handler());
    });

    expect(args.stretchShellRef.current!.style.transform).toBe("");
  });

  it("re-renders when tier ResizeObserver fires", async () => {
    const args = createSyncArgs(800);
    const fireRo = mountWithRo(args);

    await triggerViewportGrow(args, fireRo, 1200);

    expect(args.reRender).toHaveBeenCalledTimes(1);
  });

  it("writes tier viewport width CSS variable before re-render", async () => {
    const args = createSyncArgs(800);
    const fireRo = mountWithRo(args);

    await triggerViewportGrow(args, fireRo, 1600);

    expect(args.tierScrollRef.current!.style.getPropertyValue(WAVEFORM_TIER_VIEWPORT_WIDTH_VAR)).toBe(
      "1600px",
    );
  });

  it("refits fit-all when viewport width is unchanged but px/s is stale", async () => {
    const args = createSyncArgs(1200);
    const appliedZoomPxPerSecRef = { current: 0.07 };
    const onFitAllPxPerSecRefit = vi.fn();
    const layoutDurationSecRef = { current: 3 * 3600 + 40 * 60 + 29 };
    const timelineShell = document.createElement("div");

    let roCallback: (() => void) | undefined;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(cb: () => void) {
          roCallback = cb;
        }
        observe() {}
        disconnect() {}
      },
    );

    renderHook(() =>
      useWaveformViewportResizeSync({
        wsRef: args.wsRef,
        containerRef: args.containerRef,
        stickyShellRef: args.stickyShellRef,
        stretchShellRef: args.stretchShellRef,
        tierScrollRef: args.tierScrollRef,
        isReady: true,
        deferDecodeMount: false,
        appliedZoomPxPerSecRef,
        onFitAllPxPerSecRefit,
        layoutDurationSecRef,
        timelineShellRef: { current: timelineShell },
      }),
    );

    await act(async () => {
      roCallback?.();
    });
    await flushRaf();

    expect(onFitAllPxPerSecRefit).toHaveBeenCalled();
    expect(timelineShell.style.width).not.toBe("");
  });

  it("ws.zoom without ws.load when fit-all refit is needed on grow", async () => {
    const args = createSyncArgs(1200);
    const appliedZoomPxPerSecRef = { current: 0.09 };
    const onFitAllPxPerSecRefit = vi.fn();
    const refitFitAllPxPerSec = vi.fn(() => 0.145);
    const timelineShell = document.createElement("div");
    const peaksStageShell = document.createElement("div");
    const layoutDurationSecRef = { current: 4 * 3600 + 29 };
    const layoutTimelineWidthPxRef = { current: 1200 };

    const fireRo = mountWithRo(args, {
      refitFitAllPxPerSec,
      appliedZoomPxPerSecRef,
      onFitAllPxPerSecRefit,
      layoutDurationSecRef,
      layoutTimelineWidthPxRef,
      timelineShellRef: { current: timelineShell },
      peaksStageShellRef: { current: peaksStageShell },
    });

    await triggerViewportGrow(args, fireRo, 1920);
    await flushRaf();

    expect(refitFitAllPxPerSec).toHaveBeenCalledWith(1920);
    expect((args.wsRef.current as { zoom: ReturnType<typeof vi.fn> }).zoom).toHaveBeenCalledWith(0.145);
    expect(onFitAllPxPerSecRefit).toHaveBeenCalledWith(0.145);
    expect(args.stretchShellRef.current!.style.transform).toBe("scaleX(1.6)");
    expect(timelineShell.style.width).not.toBe("");
    expect(peaksStageShell.style.width).not.toBe("");
    expect(args.reRender).not.toHaveBeenCalled();
  });
});
