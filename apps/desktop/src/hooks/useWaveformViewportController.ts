import { useCallback, useEffect, useLayoutEffect, useRef, type MutableRefObject, type RefObject } from "react";
import type WaveSurfer from "wavesurfer.js";
import { computeTimelineWidthPx } from "../utils/pxPerSec";
import { resolveFitAllPxPerSecAdjustment } from "../utils/waveformZoomBarState";
import { writeWaveformTierViewportWidthVar } from "../utils/waveformViewport";
import {
  applyWaveformViewportStretch,
  clearWaveformViewportStretch,
  computeViewportStretchRatio,
  writeWaveformPeaksStageShellWidth,
  writeWaveformStickyShellWidth,
  writeWaveformTimelineShellWidth,
} from "../utils/waveformViewportStretch";

const WIDTH_EPSILON_PX = 1;
const PX_PER_SEC_EPSILON = 1e-6;

export type UseWaveformViewportControllerArgs = {
  wsRef: RefObject<WaveSurfer | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  stickyShellRef?: RefObject<HTMLDivElement | null>;
  stretchShellRef?: RefObject<HTMLDivElement | null>;
  tierScrollRef?: RefObject<HTMLElement | null>;
  isReady: boolean;
  deferDecodeMount: boolean;
  syncScrollAfterRender?: () => void;
  /** Live tier layout refresh (replaces duplicate tier RO in useTierScrollSync). */
  onAfterViewportResizeRef?: MutableRefObject<(() => void) | undefined>;
  refitFitAllPxPerSec?: (viewportWidthPx: number) => number | null;
  appliedZoomPxPerSecRef?: MutableRefObject<number>;
  onFitAllPxPerSecRefit?: (pxPerSec: number) => void;
  layoutDurationSecRef?: MutableRefObject<number>;
  layoutTimelineWidthPxRef?: MutableRefObject<number>;
  timelineShellRef?: RefObject<HTMLDivElement | null>;
  peaksStageShellRef?: RefObject<HTMLDivElement | null>;
};

function flushViewportLayout(
  tier: HTMLElement | null | undefined,
  container: HTMLElement | null | undefined,
  sticky: HTMLElement | null | undefined,
): void {
  if (tier) void tier.offsetWidth;
  if (sticky) void sticky.offsetWidth;
  if (container) void container.offsetWidth;
}

/**
 * Single resize orchestrator: one RO + window listener, rAF coalesce,
 * stretch-hold before shell width writes, fit-all refit / WS reRender.
 */
export function useWaveformViewportController(args: UseWaveformViewportControllerArgs) {
  const prevWidthRef = useRef(0);
  const wasReadyRef = useRef(false);
  const resizeSyncMountedRef = useRef(false);
  const pendingResizeRafRef = useRef(0);
  const pendingResizeForceRef = useRef(false);
  const argsRef = useRef(args);
  argsRef.current = args;

  const clearStretch = useCallback(() => {
    clearWaveformViewportStretch(argsRef.current.stretchShellRef?.current);
  }, []);

  const writeTierViewportWidth = useCallback((tierW: number) => {
    const tier = argsRef.current.tierScrollRef?.current;
    if (!tier || tierW <= 0) return;
    writeWaveformTierViewportWidthVar(tier, tierW);
    const sticky = argsRef.current.stickyShellRef?.current;
    if (sticky) writeWaveformStickyShellWidth(sticky, tierW);
  }, []);

  const writeFitAllShellWidths = useCallback((refitPx: number, tierW: number) => {
    const {
      layoutDurationSecRef,
      layoutTimelineWidthPxRef,
      timelineShellRef,
      peaksStageShellRef,
      onFitAllPxPerSecRefit,
    } = argsRef.current;
    const dur = layoutDurationSecRef?.current ?? 0;
    if (dur <= 0) return;
    const timelineWidthPx = computeTimelineWidthPx(dur, refitPx);
    if (layoutTimelineWidthPxRef) {
      layoutTimelineWidthPxRef.current = timelineWidthPx;
    }
    const stageWidthPx = Math.max(timelineWidthPx, tierW);
    const timelineShell = timelineShellRef?.current;
    const peaksStageShell = peaksStageShellRef?.current;
    if (timelineShell) writeWaveformTimelineShellWidth(timelineShell, timelineWidthPx);
    if (peaksStageShell) writeWaveformPeaksStageShellWidth(peaksStageShell, stageWidthPx);
    onFitAllPxPerSecRefit?.(refitPx);
  }, []);

  const applyFitAllRefit = useCallback((refitPx: number, tierW: number) => {
    const { wsRef, appliedZoomPxPerSecRef, syncScrollAfterRender } = argsRef.current;
    const ws = wsRef.current;
    if (!ws || !appliedZoomPxPerSecRef) return false;
    const pxUnchanged = Math.abs(refitPx - appliedZoomPxPerSecRef.current) <= PX_PER_SEC_EPSILON;
    try {
      if (!pxUnchanged) {
        ws.zoom(refitPx);
        appliedZoomPxPerSecRef.current = refitPx;
      }
      writeFitAllShellWidths(refitPx, tierW);
      prevWidthRef.current = tierW;
      syncScrollAfterRender?.();
      flushViewportLayout(
        argsRef.current.tierScrollRef?.current,
        argsRef.current.containerRef?.current,
        argsRef.current.stickyShellRef?.current,
      );
      return true;
    } catch {
      return false;
    }
  }, [writeFitAllShellWidths]);

  const runViewportTransaction = useCallback(
    (force = false, options?: { staleFitAllOnViewportGrow?: boolean }) => {
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
      } = argsRef.current;
      const ws = wsRef.current;
      const container = containerRef.current;
      const tier = tierScrollRef?.current;
      const stretch = stretchShellRef?.current;
      if (!ws) return;
      if (deferDecodeMount && !isReady) return;

      const tierW = tier?.clientWidth ?? 0;
      const containerW = container?.clientWidth ?? 0;
      const measuredWidth = containerW > 0 ? containerW : tierW;
      if (measuredWidth <= 0) return;

      const prev = prevWidthRef.current;

      const refitPx = (() => {
        if (tierW <= 0) return null;
        if (refitFitAllPxPerSec) {
          return refitFitAllPxPerSec(tierW);
        }
        const dur = argsRef.current.layoutDurationSecRef?.current ?? 0;
        const px = argsRef.current.appliedZoomPxPerSecRef?.current ?? 0;
        if (dur <= 0) return null;
        return resolveFitAllPxPerSecAdjustment(tierW, dur, px, {
          staleFitAllOnViewportGrow: options?.staleFitAllOnViewportGrow,
        });
      })();

      if (refitPx != null) {
        const stretchTarget = tierW > 0 ? tierW : measuredWidth;
        const stretchRatio = computeViewportStretchRatio(
          prev > 0 ? prev : stretchTarget,
          stretchTarget,
        );
        if (stretch && stretchRatio != null) {
          applyWaveformViewportStretch(stretch, stretchRatio);
        }
        writeTierViewportWidth(tierW);
        flushViewportLayout(tier, container, argsRef.current.stickyShellRef?.current);
        if (applyFitAllRefit(refitPx, tierW)) {
          onAfterViewportResizeRef?.current?.();
          return;
        }
      }

      if (!force && prev > 0 && Math.abs(prev - measuredWidth) <= WIDTH_EPSILON_PX) {
        onAfterViewportResizeRef?.current?.();
        return;
      }

      const stretchTarget = tierW > 0 ? tierW : measuredWidth;
      const stretchRatio = computeViewportStretchRatio(prev > 0 ? prev : stretchTarget, stretchTarget);
      if (stretch && stretchRatio != null) {
        applyWaveformViewportStretch(stretch, stretchRatio);
      }

      writeTierViewportWidth(tierW);
      flushViewportLayout(tier, container, argsRef.current.stickyShellRef?.current);

      prevWidthRef.current = measuredWidth;

      try {
        ws.getRenderer().reRender();
      } catch {
        /* noop */
      }
      syncScrollAfterRender?.();
      onAfterViewportResizeRef?.current?.();
    },
    [applyFitAllRefit, writeTierViewportWidth],
  );

  const scheduleViewportResize = useCallback(
    (force = false) => {
      pendingResizeForceRef.current = pendingResizeForceRef.current || force;
      if (pendingResizeRafRef.current) return;
      pendingResizeRafRef.current = requestAnimationFrame(() => {
        pendingResizeRafRef.current = 0;
        const forceNow = pendingResizeForceRef.current;
        pendingResizeForceRef.current = false;
        runViewportTransaction(forceNow, { staleFitAllOnViewportGrow: true });
      });
    },
    [runViewportTransaction],
  );

  const refitFitAllIfNeeded = useCallback(() => {
    runViewportTransaction(false, { staleFitAllOnViewportGrow: false });
  }, [runViewportTransaction]);

  useEffect(() => {
    const ws = args.wsRef.current;
    if (!ws || !args.isReady || args.deferDecodeMount) return;
    const unsub = ws.on("redrawcomplete", () => {
      clearStretch();
    });
    return unsub;
  }, [args.deferDecodeMount, args.isReady, args.wsRef, clearStretch]);

  useLayoutEffect(() => {
    const tierW = argsRef.current.tierScrollRef?.current?.clientWidth ?? 0;
    const containerW = argsRef.current.containerRef.current?.clientWidth ?? 0;
    const width = containerW > 0 ? containerW : tierW;
    if (width > 0 && prevWidthRef.current <= 0) {
      prevWidthRef.current = width;
    }
    if (tierW > 0) {
      writeTierViewportWidth(tierW);
    }
  }, [args.containerRef, writeTierViewportWidth]);

  useLayoutEffect(() => {
    const readyNow = args.isReady && !args.deferDecodeMount;
    if (!resizeSyncMountedRef.current) {
      resizeSyncMountedRef.current = true;
      wasReadyRef.current = readyNow;
      return;
    }
    const prevReady = wasReadyRef.current;
    wasReadyRef.current = readyNow;
    if (readyNow && !prevReady) {
      scheduleViewportResize(true);
    }
  }, [args.deferDecodeMount, args.isReady, scheduleViewportResize]);

  useLayoutEffect(() => {
    const tier = args.tierScrollRef?.current;
    const container = args.containerRef.current;
    if (typeof ResizeObserver === "undefined") return;

    const onViewportResize = () => {
      scheduleViewportResize(false);
    };

    const ro = new ResizeObserver(onViewportResize);
    window.addEventListener("resize", onViewportResize);
    if (tier) ro.observe(tier);
    if (container) ro.observe(container);

    return () => {
      window.removeEventListener("resize", onViewportResize);
      ro.disconnect();
      clearStretch();
      if (pendingResizeRafRef.current) {
        cancelAnimationFrame(pendingResizeRafRef.current);
        pendingResizeRafRef.current = 0;
      }
      pendingResizeForceRef.current = false;
    };
  }, [
    args.containerRef,
    args.tierScrollRef,
    args.deferDecodeMount,
    args.isReady,
    clearStretch,
    scheduleViewportResize,
  ]);

  return { refitFitAllIfNeeded, scheduleViewportResize };
};
