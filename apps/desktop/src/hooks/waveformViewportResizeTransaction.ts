import type { MutableRefObject } from "react";
import { computeTimelineWidthPx } from "../utils/pxPerSec";
import { markAppliedZoomWs } from "../utils/waveformAppliedZoom";
import { writeWaveformTierViewportWidthVar } from "../utils/waveformViewport";
import {
  applyWaveformViewportStretch,
  computeViewportStretchRatio,
  writeWaveformShellLayout,
  writeWaveformStickyShellWidth,
} from "../utils/waveformViewportStretch";
import type { UseWaveformViewportControllerArgs } from "./useWaveformViewportController";

export const WIDTH_EPSILON_PX = 1;
export const PX_PER_SEC_EPSILON = 1e-6;

export function flushViewportLayout(
  tier: HTMLElement | null | undefined,
  container: HTMLElement | null | undefined,
  sticky: HTMLElement | null | undefined,
): void {
  if (tier) void tier.offsetWidth;
  if (sticky) void sticky.offsetWidth;
  if (container) void container.offsetWidth;
}

export type WaveformViewportResizeTransactionCtx = {
  getArgs: () => UseWaveformViewportControllerArgs;
  prevWidthRef: MutableRefObject<number>;
};

export function createWaveformViewportResizeTransaction(ctx: WaveformViewportResizeTransactionCtx) {
  const writeTierViewportWidth = (tierW: number) => {
    const args = ctx.getArgs();
    const tier = args.tierScrollRef?.current;
    if (!tier || tierW <= 0) return;
    writeWaveformTierViewportWidthVar(tier, tierW);
    const sticky = args.stickyShellRef?.current;
    if (sticky) writeWaveformStickyShellWidth(sticky, tierW);
  };

  const writeFitAllShellWidths = (refitPx: number, tierW: number) => {
    const {
      layoutDurationSecRef,
      layoutTimelineWidthPxRef,
      timelineShellRef,
      peaksStageShellRef,
      stickyShellRef,
      onFitAllPxPerSecRefit,
      waveformScrollLayerRef,
      overlayScrollLayerRef,
    } = ctx.getArgs();
    const dur = layoutDurationSecRef?.current ?? 0;
    if (dur <= 0) return;
    const timelineWidthPx = computeTimelineWidthPx(dur, refitPx);
    if (layoutTimelineWidthPxRef) {
      layoutTimelineWidthPxRef.current = timelineWidthPx;
    }
    writeWaveformShellLayout({
      timelineShell: timelineShellRef?.current,
      peaksStageShell: peaksStageShellRef?.current,
      stickyShell: stickyShellRef?.current,
      waveformScrollLayer: waveformScrollLayerRef?.current,
      overlayScrollLayer: overlayScrollLayerRef?.current,
      timelineWidthPx,
      viewportWidthPx: tierW,
    });
    onFitAllPxPerSecRefit?.(refitPx);
  };

  const writeShellLayoutForCurrentZoom = (tierW: number) => {
    const {
      layoutDurationSecRef,
      layoutTimelineWidthPxRef,
      appliedZoom,
      timelineShellRef,
      peaksStageShellRef,
      stickyShellRef,
      waveformScrollLayerRef,
      overlayScrollLayerRef,
    } = ctx.getArgs();
    const dur = layoutDurationSecRef?.current ?? 0;
    const px = appliedZoom?.appliedZoomPxPerSecRef.current ?? 0;
    if (dur <= 0 || tierW <= 0 || px <= 0) return;
    const timelineWidthPx =
      layoutTimelineWidthPxRef?.current && layoutTimelineWidthPxRef.current > 0
        ? layoutTimelineWidthPxRef.current
        : computeTimelineWidthPx(dur, px);
    writeWaveformShellLayout({
      timelineShell: timelineShellRef?.current,
      peaksStageShell: peaksStageShellRef?.current,
      stickyShell: stickyShellRef?.current,
      waveformScrollLayer: waveformScrollLayerRef?.current,
      overlayScrollLayer: overlayScrollLayerRef?.current,
      timelineWidthPx,
      viewportWidthPx: tierW,
    });
  };

  const applyFitAllRefit = (refitPx: number, tierW: number) => {
    const { wsRef, appliedZoom, syncScrollAfterRender } = ctx.getArgs();
    const ws = wsRef.current;
    const appliedPxRef = appliedZoom?.appliedZoomPxPerSecRef;
    if (!ws || !appliedZoom || !appliedPxRef) return false;
    const pxUnchanged = Math.abs(refitPx - appliedPxRef.current) <= PX_PER_SEC_EPSILON;
    try {
      if (!pxUnchanged) {
        ws.zoom(refitPx);
        markAppliedZoomWs(appliedZoom, refitPx);
      }
      writeFitAllShellWidths(refitPx, tierW);
      ctx.prevWidthRef.current = tierW;
      syncScrollAfterRender?.();
      const args = ctx.getArgs();
      flushViewportLayout(
        args.tierScrollRef?.current,
        args.containerRef?.current,
        args.stickyShellRef?.current,
      );
      return true;
    } catch {
      return false;
    }
  };

  const runViewportTransaction = (force = false) => {
    const {
      wsRef,
      containerRef,
      tierScrollRef,
      stretchShellRef,
      deferDecodeMount,
      isReady,
      syncScrollAfterRender,
      refitFitAllPxPerSec,
      onAfterViewportResizeRef,
      viewportResizeHoldRef,
      stickyShellRef,
    } = ctx.getArgs();
    const ws = wsRef.current;
    const container = containerRef.current;
    const tier = tierScrollRef?.current;
    const stretch = stretchShellRef?.current;
    if (!ws) return;
    if (deferDecodeMount && !isReady) return;

    const tierW = tier?.clientWidth ?? 0;
    const containerW = container?.clientWidth ?? 0;
    /** Tier scrollport width — not WS canvas width (default zoom keeps canvas >> viewport). */
    const viewportWidthPx = tierW > 0 ? tierW : containerW;
    if (viewportWidthPx <= 0) return;

    if (viewportResizeHoldRef) viewportResizeHoldRef.current = true;
    try {
      const prev = ctx.prevWidthRef.current;

      const refitPx =
        tierW > 0 && refitFitAllPxPerSec ? refitFitAllPxPerSec(tierW) : null;

      if (refitPx != null) {
        const stretchRatio = computeViewportStretchRatio(
          prev > 0 ? prev : viewportWidthPx,
          viewportWidthPx,
        );
        if (stretch && stretchRatio != null) {
          applyWaveformViewportStretch(stretch, stretchRatio);
        }
        writeTierViewportWidth(tierW);
        flushViewportLayout(tier, container, stickyShellRef?.current);
        if (applyFitAllRefit(refitPx, tierW)) {
          return;
        }
      }

      if (!force && prev > 0 && Math.abs(prev - viewportWidthPx) <= WIDTH_EPSILON_PX) {
        return;
      }

      const stretchRatio = computeViewportStretchRatio(
        prev > 0 ? prev : viewportWidthPx,
        viewportWidthPx,
      );
      if (stretch && stretchRatio != null) {
        applyWaveformViewportStretch(stretch, stretchRatio);
      }

      writeTierViewportWidth(tierW);
      flushViewportLayout(tier, container, stickyShellRef?.current);
      writeShellLayoutForCurrentZoom(tierW);

      ctx.prevWidthRef.current = viewportWidthPx;

      try {
        ws.getRenderer().reRender();
      } catch {
        /* noop */
      }
      syncScrollAfterRender?.();
    } finally {
      if (viewportResizeHoldRef) viewportResizeHoldRef.current = false;
      onAfterViewportResizeRef?.current?.();
    }
  };

  return {
    writeTierViewportWidth,
    writeShellLayoutForCurrentZoom,
    runViewportTransaction,
  };
}
