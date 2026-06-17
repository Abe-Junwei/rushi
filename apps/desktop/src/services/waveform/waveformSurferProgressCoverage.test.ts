import { describe, expect, it } from "vitest";
import {
  applyWaveSurferProgressWithoutClip,
  estimateWaveSurferCanvasCount,
  installWaveSurferPlayedRegionDisplayFix,
  positionWaveformScrollLayersByTierScroll,
  positionWaveSurferHostByScroll,
  restoreWaveSurferMainCanvasVisibility,
  syncWaveSurferScrollWithProgressCoverage,
  WAVESURFER_MAX_CANVAS_CHUNK_PX,
  waveSurferLazyCanvasIndices,
} from "./waveformSurferProgressCoverage";

describe("restoreWaveSurferMainCanvasVisibility", () => {
  it("removes progress clip and sizes progressWrapper to the played ratio", () => {
    const canvasWrapper = document.createElement("div");
    canvasWrapper.style.clipPath = "polygon(6% 0%, 100% 0%, 100% 100%, 6% 100%)";
    const progressWrapper = document.createElement("div");
    progressWrapper.style.width = "6%";

    restoreWaveSurferMainCanvasVisibility({ canvasWrapper, progressWrapper }, 0.25);

    expect(canvasWrapper.style.clipPath).toBe("none");
    expect(progressWrapper.style.width).toBe("25%");
    expect(progressWrapper.style.overflow).toBe("hidden");
  });
});

describe("applyWaveSurferProgressWithoutClip", () => {
  it("hides WS shadow cursor without applying clipPath on the main canvas", () => {
    const canvasWrapper = document.createElement("div");
    const progressWrapper = document.createElement("div");
    const cursor = document.createElement("div");
    const renderer = {
      canvasWrapper,
      progressWrapper,
      cursor,
      options: { cursorWidth: 1 },
    };
    const ws = {
      getRenderer: () => renderer,
      getWrapper: () => null,
    } as unknown as import("wavesurfer.js").default;

    applyWaveSurferProgressWithoutClip(ws, 0.25);

    expect(canvasWrapper.style.clipPath).toBe("none");
    expect(progressWrapper.style.width).toBe("25%");
    expect(cursor.style.display).toBe("none");
    expect(cursor.style.visibility).toBe("hidden");
  });
});

describe("installWaveSurferPlayedRegionDisplayFix", () => {
  it("replaces renderProgress so clip is never applied but played tint remains", () => {
    const canvasWrapper = document.createElement("div");
    const progressWrapper = document.createElement("div");
    const cursor = document.createElement("div");
    const renderer = {
      canvasWrapper,
      progressWrapper,
      cursor,
      options: { cursorWidth: 1 },
      renderProgress(ratio: number, _isPlaying: boolean) {
        const percents = ratio * 100;
        canvasWrapper.style.clipPath = `polygon(${percents}% 0%, 100% 0%, 100% 100%, ${percents}% 100%)`;
        progressWrapper.style.width = `${percents}%`;
        cursor.style.left = `${percents}%`;
      },
    };
    const ws = {
      getRenderer: () => renderer,
      getWrapper: () => null,
      getDuration: () => 100,
      getCurrentTime: () => 40,
      isPlaying: () => false,
    } as unknown as import("wavesurfer.js").default;

    const uninstall = installWaveSurferPlayedRegionDisplayFix(ws);
    renderer.renderProgress(0.4, false);

    expect(canvasWrapper.style.clipPath).toBe("none");
    expect(progressWrapper.style.width).toBe("40%");
    expect(cursor.style.display).toBe("none");

    uninstall();
    renderer.renderProgress(0.4, false);
    expect(canvasWrapper.style.clipPath).toContain("40%");
    expect(progressWrapper.style.width).toBe("40%");
  });
});

describe("waveSurferLazyCanvasIndices", () => {
  it("matches WS getLazyRenderRange (center ±1)", () => {
    const scrollWidthPx = WAVESURFER_MAX_CANVAS_CHUNK_PX * 5;
    const numCanvases = 5;
    expect(
      waveSurferLazyCanvasIndices(WAVESURFER_MAX_CANVAS_CHUNK_PX * 2, scrollWidthPx, numCanvases),
    ).toEqual([1, 2, 3]);
  });

  it("clamps at timeline start", () => {
    expect(waveSurferLazyCanvasIndices(0, WAVESURFER_MAX_CANVAS_CHUNK_PX * 4, 4)).toEqual([0, 1]);
  });
});

describe("estimateWaveSurferCanvasCount", () => {
  it("ceil-divides scroll width by chunk size", () => {
    expect(estimateWaveSurferCanvasCount(WAVESURFER_MAX_CANVAS_CHUNK_PX)).toBe(1);
    expect(estimateWaveSurferCanvasCount(WAVESURFER_MAX_CANVAS_CHUNK_PX + 1)).toBe(2);
  });
});

describe("syncWaveSurferScrollWithProgressCoverage", () => {
  it("dispatches scroll on the WS scroll host after programmatic setScroll", () => {
    const events: string[] = [];
    const scrollHost = document.createElement("div");
    scrollHost.addEventListener("scroll", () => events.push("scroll"));
    const ws = {
      setScroll: (px: number) => {
        scrollHost.scrollLeft = px;
      },
      getRenderer: () => ({ scrollContainer: scrollHost }),
      getWrapper: () => null,
      getDuration: () => 0,
      getCurrentTime: () => 0,
    } as unknown as import("wavesurfer.js").default;

    syncWaveSurferScrollWithProgressCoverage(ws, 120);

    expect(scrollHost.scrollLeft).toBe(120);
    expect(events).toContain("scroll");
  });
});

describe("positionWaveformScrollLayersByTierScroll", () => {
  it("applies the same translate3d to waveform and overlay layers", () => {
    const waveform = document.createElement("div");
    const overlay = document.createElement("div");
    positionWaveformScrollLayersByTierScroll({ waveform, overlay }, 8000);
    expect(waveform.style.transform).toBe("translate3d(-8000px, 0, 0)");
    expect(overlay.style.transform).toBe("translate3d(-8000px, 0, 0)");
  });
});

describe("positionWaveSurferHostByScroll", () => {
  it("offsets only the waveform host when overlay layer is omitted", () => {
    const host = document.createElement("div");
    const ws = {
      getRenderer: () => ({ cursor: null }),
      getWrapper: () => null,
      getDuration: () => 0,
      getCurrentTime: () => 0,
    } as unknown as import("wavesurfer.js").default;

    positionWaveSurferHostByScroll(host, ws, 8000);

    expect(host.style.transform).toBe("translate3d(-8000px, 0, 0)");
  });

  it("tolerates a null host (WS not yet mounted)", () => {
    const ws = {
      getRenderer: () => ({ cursor: null }),
      getWrapper: () => null,
      getDuration: () => 0,
      getCurrentTime: () => 0,
    } as unknown as import("wavesurfer.js").default;
    expect(() => positionWaveSurferHostByScroll(null, ws, 120)).not.toThrow();
  });
});
