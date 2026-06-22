import { describe, expect, it, afterEach } from "vitest";
import { readCspLayoutRulesForElement } from "../../utils/cspElementLayout";
import { clearAllCspScopeRulesForTests } from "../../utils/cspNonceStyleRegistry";
import {
  applyWaveSurferProgressWithoutClip,
  estimateWaveSurferCanvasCount,
  installWaveSurferInternalScrollLock,
  installWaveSurferPlayedRegionDisplayFix,
  resetWaveSurferInternalScroll,
  restoreWaveSurferMainCanvasVisibility,
  setWaveSurferVisualProgressRatioReader,
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
      isPlaying: () => false,
    } as unknown as import("wavesurfer.js").default;

    applyWaveSurferProgressWithoutClip(ws, 0.25);

    expect(readCspLayoutRulesForElement(canvasWrapper)).toContain("clip-path: none");
    expect(readCspLayoutRulesForElement(progressWrapper)).toContain("width: 0%");
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

    expect(readCspLayoutRulesForElement(canvasWrapper)).toContain("clip-path: none");
    expect(readCspLayoutRulesForElement(progressWrapper)).toContain("width: 0%");
    expect(readCspLayoutRulesForElement(cursor)).toContain("display: none");

    uninstall();
    renderer.renderProgress(0.4, false);
    expect(canvasWrapper.style.clipPath).toContain("40%");
    expect(progressWrapper.style.width).toBe("40%");
  });

  it("uses visual progress ratio while playing when a reader is registered", () => {
    const canvasWrapper = document.createElement("div");
    const progressWrapper = document.createElement("div");
    const cursor = document.createElement("div");
    const renderer = {
      canvasWrapper,
      progressWrapper,
      cursor,
      options: { cursorWidth: 1 },
      renderProgress(_ratio: number, _isPlaying: boolean) {},
    };
    const ws = {
      getRenderer: () => renderer,
      getWrapper: () => null,
      isPlaying: () => true,
    } as unknown as import("wavesurfer.js").default;

    setWaveSurferVisualProgressRatioReader(() => 0.55);
    const uninstall = installWaveSurferPlayedRegionDisplayFix(ws);
    renderer.renderProgress(0.4, true);

    expect(readCspLayoutRulesForElement(progressWrapper)).toMatch(/width:\s*55(\.\d+)?%/);
    uninstall();
  });
});

describe("installWaveSurferInternalScrollLock", () => {
  function createScrollableWaveSurfer() {
    const host = document.createElement("div");
    const shadow = host.attachShadow({ mode: "open" });
    const scrollContainer = document.createElement("div");
    scrollContainer.className = "scroll";
    scrollContainer.scrollLeft = 160;
    shadow.appendChild(scrollContainer);
    const renderedHandlers = new Set<() => void>();
    const ws = {
      getRenderer: () => ({ scrollContainer }),
      getWrapper: () => null,
      on: (event: string, handler: () => void) => {
        if (event === "rendered" || event === "redrawcomplete") {
          renderedHandlers.add(handler);
        }
        return () => renderedHandlers.delete(handler);
      },
    } as unknown as import("wavesurfer.js").default;
    return { renderedHandlers, scrollContainer, shadow, ws };
  }

  it("resets WaveSurfer internal scroll to keep tier scroll as the sole authority", () => {
    const { scrollContainer, ws } = createScrollableWaveSurfer();

    resetWaveSurferInternalScroll(ws);

    expect(scrollContainer.scrollLeft).toBe(0);
  });

  it("locks internal scroll during scroll and render events", () => {
    const { scrollContainer, renderedHandlers, shadow, ws } = createScrollableWaveSurfer();

    const uninstall = installWaveSurferInternalScrollLock(ws);

    expect(scrollContainer.scrollLeft).toBe(0);
    const lockStyle = shadow.querySelector("style[data-rushi-ws-internal-scroll-lock]");
    expect(lockStyle?.textContent).toContain("overflow-x: hidden");

    scrollContainer.scrollLeft = 320;
    scrollContainer.dispatchEvent(new Event("scroll"));
    expect(scrollContainer.scrollLeft).toBe(0);

    scrollContainer.scrollLeft = 240;
    renderedHandlers.forEach((handler) => handler());
    expect(scrollContainer.scrollLeft).toBe(0);

    uninstall();
    expect(shadow.querySelector("style[data-rushi-ws-internal-scroll-lock]")).toBeNull();
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

