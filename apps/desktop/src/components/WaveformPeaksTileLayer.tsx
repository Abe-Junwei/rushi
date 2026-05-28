import {
  memo,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import { COLORS } from "../config/tokens";
import type { PeakCache } from "../services/waveform/PeakCache";
import { drawWaveformPeaksTile } from "../services/waveform/waveformPeaksCanvasDraw";
import { computeTileLayout } from "../services/waveform/tileGeometry";
import {
  useWaveformTileLifecycle,
  type TileLifecycleEntry,
} from "../hooks/useWaveformTileLifecycle";

/**
 * Content-tile peaks renderer (ADR-0004, P1).
 *
 * Lives **inside** the inline-block content container of `tierScrollRef`,
 * as a sibling to segments overlay. Canvas tiles flow with the timeline
 * content — the browser handles horizontal scrolling natively.
 *
 * Architecture (P1):
 * - `useWaveformTileLifecycle` owns the LRU pool (cap=16) and generation
 *   bumps on `contentKey` change.
 * - Per-frame rAF polls `tierScrollRef.current.scrollLeft` and feeds it to
 *   `computeTileLayout` — bypasses React state lag in `useWaveformViewportMetrics`
 *   that surfaces as right-edge white-flash during fast trackpad fling.
 * Tried-and-rejected zoom-jank mitigations (kept in history for posterity):
 *   1. `useDeferredValue(pxPerSec)` — caused left/right jitter during scroll
 *      because deferred renders fought with the per-frame scrollLeft updates.
 *   2. `stableDrawPxPerSec` gated by `zoomDragging` — when the slider's
 *      `commitZoomInteraction` failed to fire (e.g. pointer released outside
 *      the slider rail), the gate latched and tiles never repainted.
 *
 * Current stance: `pxPerSec` flows straight through. Zoom-slider jank is a
 * known P1 issue (see spike report); will be addressed by upstream throttling
 * in `useWaveformZoomSync` / `useWaveformZoom`, not inside this layer.
 */
export type WaveformPeaksTileLayerProps = {
  peakCache: PeakCache | null;
  pxPerSec: number;
  timelineWidthPx: number;
  heightPx: number;
  viewportWidthPx: number;
  tierScrollRef: RefObject<HTMLElement | null>;
};

const BAR_WIDTH = 2;
const BAR_GAP = 1;
const TILE_CAP = 16;

export const WaveformPeaksTileLayer = memo(function WaveformPeaksTileLayer({
  peakCache,
  pxPerSec,
  timelineWidthPx,
  heightPx,
  viewportWidthPx,
  tierScrollRef,
}: WaveformPeaksTileLayerProps) {
  const [scrollLeftPx, setScrollLeftPx] = useState<number>(0);

  useLayoutEffect(() => {
    let raf = 0;
    const loop = () => {
      const el = tierScrollRef.current;
      if (el) {
        const next = el.scrollLeft;
        setScrollLeftPx((prev) => (prev === next ? prev : next));
      }
      raf = window.requestAnimationFrame(loop);
    };
    raf = window.requestAnimationFrame(loop);
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [tierScrollRef]);

  const layout = useMemo(
    () =>
      computeTileLayout({
        timelineWidthPx,
        viewportWidthPx,
        scrollLeftPx,
        barWidth: BAR_WIDTH,
        barGap: BAR_GAP,
      }),
    [timelineWidthPx, viewportWidthPx, scrollLeftPx],
  );

  // PeakCache identity changes only on mediaUrl change; combined with pxPerSec
  // this is a complete content-invalidation key.
  const contentKey = useMemo(
    () => `${pxPerSec}|${peakCache ? "loaded" : "none"}`,
    [pxPerSec, peakCache],
  );

  const { activeTiles } = useWaveformTileLifecycle({
    layout,
    contentKey,
    cap: TILE_CAP,
  });

  if (!peakCache || heightPx <= 0 || timelineWidthPx <= 0) return null;

  return (
    <div
      className="pointer-events-none absolute left-0 top-0 z-[1]"
      style={{ width: timelineWidthPx, height: heightPx }}
      aria-hidden
    >
      {activeTiles.map((tile) => (
        <WaveformPeaksTile
          key={tile.index}
          tile={tile}
          peakCache={peakCache}
          pxPerSec={pxPerSec}
          timelineWidthPx={timelineWidthPx}
          heightPx={heightPx}
        />
      ))}
    </div>
  );
});

type WaveformPeaksTileProps = {
  tile: TileLifecycleEntry;
  peakCache: PeakCache;
  pxPerSec: number;
  timelineWidthPx: number;
  heightPx: number;
};

/**
 * Custom equality: skip re-render when the tile *content* (index/generation/
 * geometry) and surrounding context (pxPerSec/timelineWidthPx/heightPx/peakCache)
 * are unchanged, even if the `tile` object reference is new. This matters when
 * scroll crosses a tile boundary — `useWaveformTileLifecycle` rebuilds the
 * activeTiles array, which gives every entry a fresh object identity. The
 * default shallow memo would re-run useLayoutEffect on every tile in that case;
 * here we keep React entirely out of the tile reconciliation path unless
 * something visually relevant actually changed.
 */
const tilePropsEqual = (
  prev: WaveformPeaksTileProps,
  next: WaveformPeaksTileProps,
): boolean =>
  prev.tile.index === next.tile.index &&
  prev.tile.generation === next.tile.generation &&
  prev.tile.leftPx === next.tile.leftPx &&
  prev.tile.widthPx === next.tile.widthPx &&
  prev.pxPerSec === next.pxPerSec &&
  prev.timelineWidthPx === next.timelineWidthPx &&
  prev.heightPx === next.heightPx &&
  prev.peakCache === next.peakCache;

const WaveformPeaksTile = memo(function WaveformPeaksTile({
  tile,
  peakCache,
  pxPerSec,
  timelineWidthPx,
  heightPx,
}: WaveformPeaksTileProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastDrawnSignatureRef = useRef<string>("");

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (tile.widthPx <= 0 || heightPx <= 0) return;

    // Skip when content + geometry are identical to what we last painted.
    // This is the core P1 optimization: a tile that scrolls into the LRU
    // cache (no contentKey change, no size change) never repaints. Includes
    // timelineWidthPx so the fit-all floor (320 px min) re-distributes peaks
    // when the floor activates.
    const signature = `${tile.generation}|${tile.leftPx}|${tile.widthPx}|${heightPx}|${timelineWidthPx}`;
    if (lastDrawnSignatureRef.current === signature) return;

    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const cssW = Math.max(1, Math.round(tile.widthPx));
    const cssH = Math.max(1, Math.round(heightPx));
    const targetW = Math.round(cssW * dpr);
    const targetH = Math.round(cssH * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
      canvas.style.width = `${cssW}px`;
      canvas.style.height = `${cssH}px`;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    try {
      const interleaved = peakCache.getInterleavedPeaks(pxPerSec);
      // drawWaveformPeaksTile returns false on empty peaks / out-of-range tile —
      // canvas is left untouched so the previous frame stays visible (avoids
      // white-flash mid-zoom while a new resample is materializing).
      drawWaveformPeaksTile(ctx, interleaved, {
        tileLeftPx: tile.leftPx,
        tileWidthPx: tile.widthPx,
        timelineWidthPx,
        heightPx: cssH,
        pxPerSec,
        durationSec: peakCache.durationSec,
        waveColor: COLORS.waveformWave,
        barWidth: BAR_WIDTH,
        barGap: BAR_GAP,
      });
      lastDrawnSignatureRef.current = signature;
    } catch (err) {
      console.error("[WaveformPeaksTile] draw failed:", err);
    }
  }, [tile.generation, tile.leftPx, tile.widthPx, heightPx, peakCache, pxPerSec, timelineWidthPx]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 block"
      style={{ left: tile.leftPx, width: tile.widthPx, height: heightPx }}
      aria-hidden
    />
  );
}, tilePropsEqual);
