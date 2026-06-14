import type WaveSurfer from "wavesurfer.js";
import { logDesktopUi } from "../desktopUiLog";

/** WaveSurfer v7 `renderer-utils` MAX_CANVAS_WIDTH — upper bound for chunk width. */
export const WAVESURFER_MAX_CANVAS_CHUNK_PX = 8000;

export type WaveSurferWaveformLayerNodes = {
  canvasWrapper: HTMLElement;
  progressWrapper: HTMLElement;
};

type WaveSurferRendererInternals = {
  renderProgress?: (ratio: number, isPlaying: boolean) => void;
  canvasWrapper?: HTMLElement;
  progressWrapper?: HTMLElement;
  cursor?: HTMLElement;
  scrollContainer?: HTMLElement;
  isScrollable?: boolean;
  options?: { cursorWidth?: number };
};

/** WS v7 emits `rendered`; older builds used `redrawcomplete`. */
export function subscribeWaveSurferAfterRender(ws: WaveSurfer, handler: () => void): () => void {
  const unsubs: Array<() => void> = [];
  for (const event of ["rendered", "redrawcomplete"] as const) {
    try {
      const unsub = ws.on(event as "redrawcomplete", handler);
      if (typeof unsub === "function") unsubs.push(unsub);
    } catch {
      /* noop */
    }
  }
  return () => {
    for (const unsub of unsubs) unsub();
  };
}

/** Sample coverage from decoded channel 0 (detect asset:// fetch truncation). */
export function readWaveSurferChannelCoverageSec(ws: WaveSurfer): number {
  try {
    const decoded = ws.getDecodedData();
    if (!decoded) return -1;
    const len = decoded.getChannelData(0)?.length ?? 0;
    const sr = decoded.sampleRate;
    if (!(sr > 0) || len <= 0) return -1;
    return len / sr;
  } catch {
    return -1;
  }
}
/** Diagnostic snapshot of WS canvas/scroll geometry (DMG blank-tail triage). */
export type WaveSurferGeom = {
  wsDur: number;
  decodedDur: number;
  channelSec: number;
  scrollW: number;
  clientW: number;
  scrollLeft: number;
  drawnCanvases: number;
  expectedCanvases: number;
  isScrollable: boolean;
};

/** WS chunk width = min(MAX_CANVAS_WIDTH, clientWidth, totalWidth) — needed canvases = ceil(totalWidth/chunk). */
function neededCanvases(scrollW: number, clientW: number): number {
  if (scrollW <= 0) return 1;
  const chunk = Math.min(WAVESURFER_MAX_CANVAS_CHUNK_PX, Math.max(1, clientW), scrollW);
  return Math.max(1, Math.ceil(scrollW / chunk));
}

export function readWaveSurferGeom(ws: WaveSurfer): WaveSurferGeom {
  const renderer = ws.getRenderer() as unknown as WaveSurferRendererInternals;
  const scroll = renderer.scrollContainer ?? ws.getWrapper()?.parentElement ?? null;
  const layers = readWaveSurferWaveformLayers(ws);
  const scrollW = scroll?.scrollWidth ?? 0;
  const clientW = scroll?.clientWidth ?? 0;
  const drawnCanvases = layers ? layers.canvasWrapper.querySelectorAll("canvas").length : 0;
  let decodedDur = -1;
  try {
    decodedDur = ws.getDecodedData()?.duration ?? -1;
  } catch {
    /* noop */
  }
  return {
    wsDur: ws.getDuration(),
    decodedDur,
    channelSec: readWaveSurferChannelCoverageSec(ws),
    scrollW,
    clientW,
    scrollLeft: scroll?.scrollLeft ?? 0,
    drawnCanvases,
    expectedCanvases: neededCanvases(scrollW, clientW),
    isScrollable: renderer.isScrollable ?? scrollW > clientW + 1,
  };
}

function formatWaveSurferGeom(label: string, extra: string, g: WaveSurferGeom): string {
  return `[wf-geom] ${label} ${extra} ws_dur=${g.wsDur.toFixed(1)} decoded_dur=${g.decodedDur.toFixed(1)} channel_sec=${g.channelSec.toFixed(1)} scrollW=${g.scrollW} clientW=${g.clientW} scrollLeft=${Math.round(g.scrollLeft)} drawn=${g.drawnCanvases} needed=${g.expectedCanvases} scrollable=${g.isScrollable}`;
}

/** Read + log geom on next frame (canvas settled). Used after zoom/peaks apply. */
export function logWaveSurferGeomDeferred(ws: WaveSurfer, label: string, extra: string): void {
  const schedule =
    typeof requestAnimationFrame === "function"
      ? requestAnimationFrame
      : (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0);
  schedule(() => {
    try {
      logDesktopUi("INFO", formatWaveSurferGeom(label, extra, readWaveSurferGeom(ws)));
    } catch {
      /* noop */
    }
  });
}

let lastScrollGeomLogMs = 0;
/** Throttled geom log on tier→WS scroll mirror — captures the scrolled (blank-tail) state. */
export function logWaveSurferGeomOnScroll(ws: WaveSurfer): void {
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (now - lastScrollGeomLogMs < 700) return;
  lastScrollGeomLogMs = now;
  try {
    logDesktopUi("INFO", formatWaveSurferGeom("scroll", "", readWaveSurferGeom(ws)));
  } catch {
    /* noop */
  }
}

/** Canvas tile indices WS lazy-renders around `scrollLeft` (±1 neighbor). */
export function waveSurferLazyCanvasIndices(
  scrollLeftPx: number,
  scrollWidthPx: number,
  numCanvases: number,
): number[] {
  if (numCanvases <= 0) return [];
  if (scrollWidthPx <= 0) return [0].filter((i) => i < numCanvases);
  const viewPosition = scrollLeftPx / scrollWidthPx;
  const startCanvas = Math.floor(viewPosition * numCanvases);
  return [startCanvas - 1, startCanvas, startCanvas + 1].filter(
    (i) => i >= 0 && i < numCanvases,
  );
}

export function estimateWaveSurferCanvasCount(scrollWidthPx: number): number {
  if (scrollWidthPx <= 0) return 1;
  return Math.max(1, Math.ceil(scrollWidthPx / WAVESURFER_MAX_CANVAS_CHUNK_PX));
}

/** Prefer renderer fields — shadow DOM queries can fail in release WKWebView. */
export function readWaveSurferWaveformLayers(ws: WaveSurfer): WaveSurferWaveformLayerNodes | null {
  const renderer = ws.getRenderer() as unknown as WaveSurferRendererInternals;
  if (renderer.canvasWrapper && renderer.progressWrapper) {
    return {
      canvasWrapper: renderer.canvasWrapper,
      progressWrapper: renderer.progressWrapper,
    };
  }

  const wrapper = ws.getWrapper();
  if (!wrapper) return null;
  const root = wrapper.getRootNode();
  const scope: ParentNode = root instanceof ShadowRoot ? root : wrapper.ownerDocument ?? document;
  const canvasWrapper =
    (scope.querySelector('[part="canvases"]') as HTMLElement | null) ??
    wrapper.querySelector(".canvases");
  const progressWrapper =
    (scope.querySelector('[part="progress"]') as HTMLElement | null) ??
    wrapper.querySelector(".progress");
  if (!canvasWrapper || !progressWrapper) return null;
  return { canvasWrapper, progressWrapper };
}

/**
 * WS `renderProgress` clips the main canvas to the unplayed tail and paints the
 * played head into `progressWrapper`. In Tauri release WebViews the progress clones
 * are often missing while the clip remains — playhead-left looks blank.
 * Keep cursor/progress math but show the full waveform on the main canvas.
 */
export function restoreWaveSurferMainCanvasVisibility(
  layers: WaveSurferWaveformLayerNodes,
): void {
  layers.canvasWrapper.style.clipPath = "none";
  layers.progressWrapper.style.width = "0";
  layers.progressWrapper.style.overflow = "hidden";
}

function updateWaveSurferPlayheadCursor(
  renderer: WaveSurferRendererInternals,
  ratio: number,
): void {
  if (!renderer.cursor) return;
  const percents = ratio * 100;
  renderer.cursor.style.left = `${percents}%`;
  const cursorWidth = renderer.options?.cursorWidth;
  renderer.cursor.style.transform = cursorWidth
    ? `translateX(-${ratio * cursorWidth}px)`
    : "";
}

/** Cursor-only progress update — never apply WS clipPath / progressWrapper width. */
export function applyWaveSurferProgressWithoutClip(
  ws: WaveSurfer,
  ratio: number,
): void {
  if (Number.isNaN(ratio)) return;
  const renderer = ws.getRenderer() as unknown as WaveSurferRendererInternals;
  const layers = readWaveSurferWaveformLayers(ws);
  if (layers) restoreWaveSurferMainCanvasVisibility(layers);
  updateWaveSurferPlayheadCursor(renderer, ratio);
}

export function refreshWaveSurferProgressVisual(ws: WaveSurfer): void {
  const duration = ws.getDuration();
  if (!(duration > 0)) return;
  const ratio = Math.max(0, Math.min(1, ws.getCurrentTime() / duration));
  applyWaveSurferProgressWithoutClip(ws, ratio);
}

/**
 * Patch renderer.renderProgress so every WS progress update keeps the main canvas
 * fully visible (played tint via progressWrapper is intentionally disabled).
 */
export function installWaveSurferPlayedRegionDisplayFix(ws: WaveSurfer): () => void {
  const renderer = ws.getRenderer() as unknown as WaveSurferRendererInternals;
  const original = renderer.renderProgress?.bind(renderer);
  if (!original) return () => {};

  renderer.renderProgress = (ratio: number, _isPlaying: boolean) => {
    applyWaveSurferProgressWithoutClip(ws, ratio);
  };

  return () => {
    renderer.renderProgress = original;
  };
}

/** WKWebView release builds may skip scroll listeners on programmatic scrollLeft. */
export function notifyWaveSurferScrollContainer(ws: WaveSurfer): void {
  const renderer = ws.getRenderer() as unknown as WaveSurferRendererInternals;
  const scrollHost = renderer.scrollContainer ?? ws.getWrapper()?.parentElement;
  if (!scrollHost) return;
  scrollHost.dispatchEvent(new Event("scroll"));
}

/** Mirror tier scroll into WS; refresh playhead cursor + unified waveform visibility. */
export function syncWaveSurferScrollWithProgressCoverage(
  ws: WaveSurfer,
  scrollLeftPx: number,
): void {
  ws.setScroll(scrollLeftPx);
  notifyWaveSurferScrollContainer(ws);
  refreshWaveSurferProgressVisual(ws);
  logWaveSurferGeomOnScroll(ws);
}

export type WaveformScrollLayerNodes = {
  waveform: HTMLElement | null;
  overlay: HTMLElement | null;
};

/**
 * Drive waveform + segment overlay from tier scroll via a shared CSS transform.
 *
 * Both layers sit inside the sticky viewport at timeline width; tier scroll only
 * moves the outer stage. WaveSurfer renders all canvas tiles eagerly (host wider
 * than timeline); overlay borders share the same translate3d so they never drift
 * from the waveform during momentum scroll (native scroll vs JS mirror desync).
 */
export function positionWaveformScrollLayersByTierScroll(
  layers: WaveformScrollLayerNodes,
  scrollLeftPx: number,
  ws?: WaveSurfer | null,
): void {
  const tx = `translate3d(${-Math.round(scrollLeftPx)}px, 0, 0)`;
  if (layers.waveform) layers.waveform.style.transform = tx;
  if (layers.overlay) layers.overlay.style.transform = tx;
  if (ws) logWaveSurferGeomOnScroll(ws);
}

/** @deprecated Prefer {@link positionWaveformScrollLayersByTierScroll}. */
export function positionWaveSurferHostByScroll(
  host: HTMLElement | null,
  ws: WaveSurfer,
  scrollLeftPx: number,
): void {
  positionWaveformScrollLayersByTierScroll({ waveform: host, overlay: null }, scrollLeftPx, ws);
}
