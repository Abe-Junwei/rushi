import { describe, expect, it, afterEach } from "vitest";
import { readCspLayoutRulesForElement } from "../../utils/cspElementLayout";
import { clearAllCspScopeRulesForTests } from "../../utils/cspNonceStyleRegistry";
import {
  applyWaveSurferProgressWithoutClip,
  estimateWaveSurferCanvasCount,
  installWaveSurferTierScrollSync,
  installWaveSurferPlayedRegionDisplayFix,
  restoreWaveSurferMainCanvasVisibility,
  setWaveSurferVisualProgressRatioReader,
  syncWaveSurferScrollFromTier,
  WAVESURFER_MAX_CANVAS_CHUNK_PX,
  waveSurferLazyCanvasIndices,
} from "./waveformSurferProgressCoverage";

afterEach(() => {
  setWaveSurferVisualProgressRatioReader(null);
  clearAllCspScopeRulesForTests();
});

describe("restoreWaveSurferMainCanvasVisibility", () => {
  it("removes progress clip and sizes progressWrapper to the played ratio", () => {
    const canvasWrapper = document.createElement("div");
    canvasWrapper.style.clipPath = "polygon(6% 0%, 100% 0%, 100% 100%, 6% 100%)";
    const progressWrapper = document.createElement("div");
    progressWrapper.style.width = "6%";

    restoreWaveSurferMainCanvasVisibility({ canvasWrapper, progressWrapper }, 0.25);

    expect(readCspLayoutRulesForElement(canvasWrapper)).toContain("clip-path: none");
    expect(readCspLayoutRulesForElement(progressWrapper)).toContain("width: 25%");
    expect(readCspLayoutRulesForElement(progressWrapper)).toContain("overflow: hidden");
  });
});

describe("applyWaveSurferProgressWithoutClip", () => {
  it("sizes progressWrapper to the played ratio without clipping the main canvas", () => {
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
      isPlaying: () => false,
    } as unknown as import("wavesurfer.js").default;

    applyWaveSurferProgressWithoutClip(ws, 0.25);

    expect(readCspLayoutRulesForElement(canvasWrapper)).toContain("clip-path: none");
    expect(readCspLayoutRulesForElement(progressWrapper)).toContain("width: 25%");
    expect(readCspLayoutRulesForElement(cursor)).toContain("display: none");
    expect(readCspLayoutRulesForElement(cursor)).toContain("visibility: hidden");
  });

  it("applies played ratio while playing", () => {
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
      isPlaying: () => true,
    } as unknown as import("wavesurfer.js").default;

    applyWaveSurferProgressWithoutClip(ws, 0.25);

    expect(readCspLayoutRulesForElement(progressWrapper)).toContain("width: 25%");
  });
});

describe("installWaveSurferPlayedRegionDisplayFix", () => {
  it("replaces renderProgress so clip is never applied and played tint follows ratio when paused", () => {
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

    expect(readCspLayoutRulesForElement(canvasWrapper)).toContain("clip-path: none");
    expect(readCspLayoutRulesForElement(progressWrapper)).toContain("width: 40%");
    expect(readCspLayoutRulesForElement(cursor)).toContain("display: none");

    uninstall();
    renderer.renderProgress(0.4, false);
    expect(canvasWrapper.style.clipPath).toContain("40%");
    expect(progressWrapper.style.width).toBe("40%");
  });

  it("keeps live played tint while playing and prefers visual playhead ratio", () => {
    const canvasWrapper = document.createElement("div");
    const progressWrapper = document.createElement("div");
    const cursor = document.createElement("div");
    let originalCalls = 0;
    const renderer = {
      canvasWrapper,
      progressWrapper,
      cursor,
      options: { cursorWidth: 1 },
      renderProgress(_ratio: number, _isPlaying: boolean) {
        originalCalls += 1;
      },
    };
    const ws = {
      getRenderer: () => renderer,
      getWrapper: () => null,
      isPlaying: () => true,
    } as unknown as import("wavesurfer.js").default;

    setWaveSurferVisualProgressRatioReader(() => 0.55);
    const uninstall = installWaveSurferPlayedRegionDisplayFix(ws);
    renderer.renderProgress(0.4, true);
    renderer.renderProgress(0.5, true);

    expect(originalCalls).toBe(2);
    expect(readCspLayoutRulesForElement(progressWrapper)).toContain("width: 55%");
    uninstall();
  });
});

describe("installWaveSurferTierScrollSync", () => {
  function createScrollableWaveSurfer() {
    const host = document.createElement("div");
    const shadow = host.attachShadow({ mode: "open" });
    const scrollContainer = document.createElement("div");
    scrollContainer.className = "scroll";
    Object.defineProperty(scrollContainer, "scrollWidth", { configurable: true, value: 10_000 });
    Object.defineProperty(scrollContainer, "clientWidth", { configurable: true, value: 800 });
    scrollContainer.scrollLeft = 160;
    shadow.appendChild(scrollContainer);
    const renderedHandlers = new Set<() => void>();
    const ws = {
      getRenderer: () => ({ scrollContainer }),
      getWrapper: () => null,
      setScroll: (px: number) => {
        scrollContainer.scrollLeft = px;
      },
      on: (event: string, handler: () => void) => {
        if (event === "rendered" || event === "redrawcomplete") {
          renderedHandlers.add(handler);
        }
        return () => renderedHandlers.delete(handler);
      },
    } as unknown as import("wavesurfer.js").default;
    return { renderedHandlers, scrollContainer, shadow, ws };
  }

  it("syncs WaveSurfer scrollLeft from tier and restores after render", () => {
    const { scrollContainer, renderedHandlers, shadow, ws } = createScrollableWaveSurfer();
    let tierScroll = 420;

    const uninstall = installWaveSurferTierScrollSync(ws, () => tierScroll);

    expect(scrollContainer.scrollLeft).toBe(420);
    const lockStyle = shadow.querySelector("style[data-rushi-ws-internal-scroll-lock]");
    expect(lockStyle?.textContent).toContain("overflow-x: hidden");

    scrollContainer.scrollLeft = 50;
    scrollContainer.dispatchEvent(new Event("scroll"));
    expect(scrollContainer.scrollLeft).toBe(420);

    tierScroll = 900;
    renderedHandlers.forEach((handler) => handler());
    expect(scrollContainer.scrollLeft).toBe(900);

    uninstall();
    expect(shadow.querySelector("style[data-rushi-ws-internal-scroll-lock]")).toBeNull();
  });

  it("syncWaveSurferScrollFromTier clamps to scroll range", () => {
    const { scrollContainer, ws } = createScrollableWaveSurfer();
    syncWaveSurferScrollFromTier(ws, 50_000);
    expect(scrollContainer.scrollLeft).toBe(9200);
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

