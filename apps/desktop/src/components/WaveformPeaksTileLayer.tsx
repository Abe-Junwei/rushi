import {
  memo,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { COLORS } from "../config/tokens";
import type { PeakCache } from "../services/waveform/PeakCache";
import {
  drawWaveformPeaksTile,
  prepareCanvasDprDraw,
} from "../services/waveform/waveformPeaksCanvasDraw";
import { computeTileLayout } from "../services/waveform/tileGeometry";
import {
  peakCacheIdentity,
  waveformTileDrawSignature,
} from "../services/waveform/waveformTileDrawSignature";
import {
  useWaveformTileLifecycle,
  type TileLifecycleEntry,
} from "../hooks/useWaveformTileLifecycle";

/**
 * Content-tile peaks renderer (ADR-0004 / ADR-0005).
 *
 * Layout width uses `layoutTimelineWidthPx`; peaks draw uses `drawTimelineWidthPx`
 * + `drawPxPerSec` so slider drag does not bump generation every frame.
 */
export type WaveformPeaksTileLayerProps = {
  peakCache: PeakCache | null;
  layoutPxPerSec: number;
  drawPxPerSec: number;
  layoutTimelineWidthPx: number;
  drawTimelineWidthPx: number;
  mediaDurationSec: number;
  heightPx: number;
  scrollLeftPx: number;
  viewportWidthPx: number;
};

const BAR_WIDTH = 2;
const BAR_GAP = 1;
const TILE_CAP = 24;
const OVERSCAN_TILES = 5;

export const WaveformPeaksTileLayer = memo(function WaveformPeaksTileLayer({
  peakCache,
  layoutPxPerSec: _layoutPxPerSec,
  drawPxPerSec,
  layoutTimelineWidthPx,
  drawTimelineWidthPx,
  mediaDurationSec,
  heightPx,
  scrollLeftPx,
  viewportWidthPx,
}: WaveformPeaksTileLayerProps) {
  void _layoutPxPerSec;

  const layout = useMemo(
    () =>
      computeTileLayout({
        timelineWidthPx: layoutTimelineWidthPx,
        viewportWidthPx,
        scrollLeftPx,
        barWidth: BAR_WIDTH,
        barGap: BAR_GAP,
        overscanTiles: OVERSCAN_TILES,
      }),
    [layoutTimelineWidthPx, viewportWidthPx, scrollLeftPx],
  );

  const contentKey = useMemo(
    () =>
      peakCache
        ? `${drawPxPerSec}|${peakCacheIdentity(peakCache)}`
        : `${drawPxPerSec}|none`,
    [drawPxPerSec, peakCache],
  );

  const layoutGeometryKey = useMemo(
    () =>
      `${viewportWidthPx}|${layout.tileWidthPx}|${layout.totalTiles}|${layoutTimelineWidthPx}`,
    [layout.tileWidthPx, layout.totalTiles, layoutTimelineWidthPx, viewportWidthPx],
  );

  const { activeTiles } = useWaveformTileLifecycle({
    layout,
    contentKey,
    layoutGeometryKey,
    cap: TILE_CAP,
  });

  if (!peakCache || heightPx <= 0 || layoutTimelineWidthPx <= 0) return null;

  return (
    <div
      className="pointer-events-none absolute left-0 top-0 z-[1]"
      style={{ width: layoutTimelineWidthPx, height: heightPx }}
      aria-hidden
    >
      {activeTiles.map((tile) => (
        <WaveformPeaksTile
          key={tile.index}
          tile={tile}
          peakCache={peakCache}
          drawPxPerSec={drawPxPerSec}
          layoutTimelineWidthPx={layoutTimelineWidthPx}
          drawTimelineWidthPx={drawTimelineWidthPx}
          mediaDurationSec={mediaDurationSec}
          heightPx={heightPx}
        />
      ))}
    </div>
  );
});

type WaveformPeaksTileProps = {
  tile: TileLifecycleEntry;
  peakCache: PeakCache;
  drawPxPerSec: number;
  /** Tile positions live in layout space; peak columns map via layout width. */
  layoutTimelineWidthPx: number;
  /** Draw px/s + draw width — signature / generation only. */
  drawTimelineWidthPx: number;
  mediaDurationSec: number;
  heightPx: number;
};

const tilePropsEqual = (
  prev: WaveformPeaksTileProps,
  next: WaveformPeaksTileProps,
): boolean =>
  prev.tile.index === next.tile.index &&
  prev.tile.generation === next.tile.generation &&
  prev.tile.leftPx === next.tile.leftPx &&
  prev.tile.widthPx === next.tile.widthPx &&
  prev.drawPxPerSec === next.drawPxPerSec &&
  prev.layoutTimelineWidthPx === next.layoutTimelineWidthPx &&
  prev.drawTimelineWidthPx === next.drawTimelineWidthPx &&
  prev.mediaDurationSec === next.mediaDurationSec &&
  prev.heightPx === next.heightPx &&
  prev.peakCache === next.peakCache;

const WaveformPeaksTile = memo(function WaveformPeaksTile({
  tile,
  peakCache,
  drawPxPerSec,
  layoutTimelineWidthPx,
  drawTimelineWidthPx,
  mediaDurationSec,
  heightPx,
}: WaveformPeaksTileProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastDrawnSignatureRef = useRef<string>("");

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (tile.widthPx <= 0 || heightPx <= 0) return;

    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const signature = waveformTileDrawSignature({
      generation: tile.generation,
      leftPx: tile.leftPx,
      widthPx: tile.widthPx,
      heightPx,
      drawTimelineWidthPx: drawTimelineWidthPx ?? layoutTimelineWidthPx,
      layoutTimelineWidthPx,
      mediaDurationSec: mediaDurationSec ?? 0,
      dpr,
      drawPxPerSec,
      peakCache,
    });
    if (lastDrawnSignatureRef.current === signature) return;
    const cssW = Math.max(1, Math.round(tile.widthPx));
    const cssH = Math.max(1, Math.round(heightPx));
    const ctx = prepareCanvasDprDraw(canvas, cssW, cssH);
    if (!ctx) return;

    try {
      const layoutMedia =
        mediaDurationSec > 0 ? mediaDurationSec : peakCache.durationSec;
      const interleaved = peakCache.getInterleavedPeaks(drawPxPerSec, layoutMedia);
      const drew = drawWaveformPeaksTile(ctx, interleaved, {
        tileLeftPx: tile.leftPx,
        tileWidthPx: tile.widthPx,
        // Peaks columns are uniform in time; tile left/width are in layout px space.
        timelineWidthPx: layoutTimelineWidthPx,
        heightPx: cssH,
        pxPerSec: drawPxPerSec,
        peakDurationSec: peakCache.durationSec,
        mediaDurationSec:
          mediaDurationSec > 0 ? mediaDurationSec : peakCache.durationSec,
        waveColor: COLORS.waveformWave,
        barWidth: BAR_WIDTH,
        barGap: BAR_GAP,
      });
      if (drew) {
        lastDrawnSignatureRef.current = signature;
        canvas.style.opacity = "1";
      }
    } catch (err) {
      console.error("[WaveformPeaksTile] draw failed:", err);
      ctx.clearRect(0, 0, cssW, cssH);
      lastDrawnSignatureRef.current = "";
      canvas.style.opacity = "0";
    }
  }, [
    tile.generation,
    tile.leftPx,
    tile.widthPx,
    heightPx,
    peakCache,
    drawPxPerSec,
    layoutTimelineWidthPx,
    drawTimelineWidthPx,
    mediaDurationSec,
  ]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute top-0 block"
      style={{ left: tile.leftPx, width: tile.widthPx, height: heightPx, opacity: 0 }}
      aria-hidden
    />
  );
}, tilePropsEqual);
