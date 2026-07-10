import type WaveSurfer from "wavesurfer.js";
import { setCspLayoutRules, setDirectLayoutStyle } from "../../utils/cspElementLayout";
import { WAVEFORM_SCROLL_SYNC_EPSILON_PX } from "../../utils/waveformScrollSync";
import { readTauriStyleCspNonce } from "../../utils/tauriStyleCspNonce";
import { logDesktopUi } from "../desktopUiLog";

/** When set during playback, progress tint follows the visual playhead clock instead of raw WS ratio. */
let visualProgressRatioReader: (() => number | null) | null = null;

/** Last progressWrapper width percent written via direct style (dedupe per-frame writes). */
const lastProgressWidthPercent = new WeakMap<HTMLElement, number>();

/** Elements that already received one-shot static clip/overflow/cursor CSP rules. */
const staticProgressLayoutApplied = new WeakSet<HTMLElement>();

export function setWaveSurferVisualProgressRatioReader(reader: (() => number | null) | null): void {
  visualProgressRatioReader = reader;
}

function resolveWaveSurferProgressRatio(ratio: number, isPlaying: boolean): number {
  if (!isPlaying || !visualProgressRatioReader) return ratio;
  const visual = visualProgressRatioReader();
  if (visual == null || !Number.isFinite(visual)) return ratio;
  return Math.max(0, Math.min(1, visual));
}

/** Round ratio to percent with 4 decimal places (matches prior CSP width formatting). */
export function formatWaveSurferPlayedPercent(ratio: number): number {
  const played = Math.max(0, Math.min(1, ratio));
  return Math.round(played * 1e6) / 1e4;
}

export const WAVESURFER_MAX_CANVAS_CHUNK_PX = 8000;
const WAVESURFER_INTERNAL_SCROLL_LOCK_STYLE_ATTR = "data-rushi-ws-internal-scroll-lock";

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

function readWaveSurferGeom(ws: WaveSurfer): WaveSurferGeom {
  const renderer = ws.getRenderer() as unknown as WaveSurferRendererInternals;
  const scroll = readWaveSurferScrollContainer(ws);
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

function readWaveSurferScrollContainer(ws: WaveSurfer): HTMLElement | null {
  const renderer = ws.getRenderer() as unknown as WaveSurferRendererInternals;
  return renderer.scrollContainer ?? ws.getWrapper()?.parentElement ?? null;
}

/**
 * Push tier scrollLeft into WaveSurfer so lazy canvas tiles track the viewport.
 * Tier remains the only user-facing scroll authority (ADR-0005).
 */
export function syncWaveSurferScrollFromTier(ws: WaveSurfer, scrollLeftPx: number): void {
  if (!Number.isFinite(scrollLeftPx)) return;
  const scroll = readWaveSurferScrollContainer(ws);
  if (!scroll) return;
  const maxSl = Math.max(0, scroll.scrollWidth - scroll.clientWidth);
  const next = Math.max(0, Math.min(maxSl, scrollLeftPx));
  if (Math.abs(scroll.scrollLeft - next) < WAVEFORM_SCROLL_SYNC_EPSILON_PX) return;
  try {
    ws.setScroll(next);
  } catch {
    scroll.scrollLeft = next;
  }
}

function installWaveSurferInternalScrollLockStyle(scroll: HTMLElement): () => void {
  const root = scroll.getRootNode();
  if (!(root instanceof ShadowRoot)) return () => {};
  const existing = root.querySelector(`style[${WAVESURFER_INTERNAL_SCROLL_LOCK_STYLE_ATTR}]`);
  if (existing) return () => {};
  const style = document.createElement("style");
  style.setAttribute(WAVESURFER_INTERNAL_SCROLL_LOCK_STYLE_ATTR, "true");
  const nonce = readTauriStyleCspNonce();
  if (nonce) style.setAttribute("nonce", nonce);
  // Hide WS scrollbar / user pan; programmatic setScroll still works.
  style.textContent = `
    :host .scroll {
      overflow-x: hidden !important;
      overscroll-behavior-x: none;
    }
  `;
  root.appendChild(style);
  return () => style.remove();
}

/**
 * Keep WS internal scrollLeft = tier scrollLeft so lazy virtualization paints the
 * visible window. Does not write back to tier (one-way sync).
 */
export function installWaveSurferTierScrollSync(
  ws: WaveSurfer,
  getTierScrollLeftPx: () => number,
): () => void {
  const scroll = readWaveSurferScrollContainer(ws);
  if (!scroll) return () => {};
  const uninstallStyle = installWaveSurferInternalScrollLockStyle(scroll);
  const apply = () => syncWaveSurferScrollFromTier(ws, getTierScrollLeftPx());
  apply();
  const onScroll = () => apply();
  scroll.addEventListener("scroll", onScroll, { passive: true });
  const unsubscribeAfterRender = subscribeWaveSurferAfterRender(ws, apply);
  return () => {
    scroll.removeEventListener("scroll", onScroll);
    unsubscribeAfterRender();
    uninstallStyle();
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
function readWaveSurferWaveformLayers(ws: WaveSurfer): WaveSurferWaveformLayerNodes | null {
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
    (scope.querySelector('[part="canvases"]')) ??
    wrapper.querySelector(".canvases");
  const progressWrapper =
    (scope.querySelector('[part="progress"]')) ??
    wrapper.querySelector(".progress");
  if (!(canvasWrapper instanceof HTMLElement) || !(progressWrapper instanceof HTMLElement)) {
    return null;
  }
  return { canvasWrapper, progressWrapper };
}

/**
 * WS `renderProgress` clips the main canvas to the unplayed tail and paints the
 * played head into `progressWrapper`. In Tauri release WebViews the progress clones
 * are often missing while the clip remains — playhead-left looks blank.
 * Keep the full waveform on the main canvas (no clip) and drive played tint via
 * `progressWrapper` width + `progressColor` instead.
 */
export function restoreWaveSurferMainCanvasVisibility(
  layers: WaveSurferWaveformLayerNodes,
  ratio: number,
): void {
  setCspLayoutRules(layers.canvasWrapper, { clipPath: "none" });
  const played = Math.max(0, Math.min(1, ratio));
  const playedPercent = Math.round(played * 1e6) / 1e4;
  setCspLayoutRules(layers.progressWrapper, {
    width: `${playedPercent}%`,
    overflow: "hidden",
  });
}

function hideWaveSurferPlayheadCursor(renderer: WaveSurferRendererInternals): void {
  if (!renderer.cursor) return;
  setCspLayoutRules(renderer.cursor, { display: "none", visibility: "hidden" });
}

/** Progress update without main-canvas clip — played tint via progressWrapper overlay. */
export function applyWaveSurferProgressWithoutClip(
  ws: WaveSurfer,
  ratio: number,
): void {
  if (Number.isNaN(ratio)) return;
  const renderer = ws.getRenderer() as unknown as WaveSurferRendererInternals;
  const layers = readWaveSurferWaveformLayers(ws);
  if (!layers) return;
  restoreWaveSurferMainCanvasVisibility(layers, ratio);
  hideWaveSurferPlayheadCursor(renderer);
}

/**
 * Patch renderer.renderProgress.
 *
 * Keep the full waveform on the main canvas (no clipPath) and drive the played
 * tint via `progressWrapper` width. Prefer the visual playhead ratio while
 * playing so tint stays aligned with the DOM playhead / VRP clock.
 *
 * WS-1 spike (freeze tint to 0% while playing) did not pass the fps gate and
 * left played-region paint stuck until pause — do not restore that path.
 */
export function installWaveSurferPlayedRegionDisplayFix(ws: WaveSurfer): () => void {
  const renderer = ws.getRenderer() as unknown as WaveSurferRendererInternals;
  hideWaveSurferPlayheadCursor(renderer);
  const original = renderer.renderProgress?.bind(renderer);
  if (!original) return () => {};

  renderer.renderProgress = (ratio: number, isPlaying: boolean) => {
    // Call original for WS-internal bookkeeping, then immediately undo clipPath
    // and re-apply progressWrapper width through the CSP-safe layout path.
    original(ratio, isPlaying);
    applyWaveSurferProgressWithoutClip(ws, resolveWaveSurferProgressRatio(ratio, isPlaying));
  };

  return () => {
    renderer.renderProgress = original;
  };
}

