import { useCallback, useEffect, useLayoutEffect, useRef, type MutableRefObject, type RefObject } from "react";
import type WaveSurfer from "wavesurfer.js";
import { computeTimelineWidthPx } from "../utils/pxPerSec";
import { writeWaveformTierViewportWidthVar } from "../utils/waveformViewport";
import {
  applyWaveformViewportStretch,
  clearWaveformViewportStretch,
  computeViewportStretchRatio,
  writeWaveformShellLayout,
  writeWaveformStickyShellWidth,
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
  /** Called after viewport transaction completes (hold cleared). */
  onAfterViewportResizeRef?: MutableRefObject<(() => void) | undefined>;
  /** While true, zoom sync defers ws.load(peaks) until after resize. */
  viewportResizeHoldRef?: MutableRefObject<boolean>;
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
 * Single resize orchestrator: one RO + window listener, microtask coalesce,
 * stretch-hold before shell width writes, fit-all refit / WS reRender.
 */
export function useWaveformViewportController(args: UseWaveformViewportControllerArgs) {
  const prevWidthRef = useRef(0);
  const wasReadyRef = useRef(false);
  const resizeSyncMountedRef = useRef(false);
  const pendingResizeMicrotaskRef = useRef(false);
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
      stickyShellRef,
      onFitAllPxPerSecRefit,
    } = argsRef.current;
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
      timelineWidthPx,
      viewportWidthPx: tierW,
    });
    onFitAllPxPerSecRefit?.(refitPx);
  }, []);

  const writeShellLayoutForCurrentZoom = useCallback((tierW: number) => {
    const {
      layoutDurationSecRef,
      layoutTimelineWidthPxRef,
      appliedZoomPxPerSecRef,
      timelineShellRef,
      peaksStageShellRef,
      stickyShellRef,
    } = argsRef.current;
    const dur = layoutDurationSecRef?.current ?? 0;
    const px = appliedZoomPxPerSecRef?.current ?? 0;
    if (dur <= 0 || tierW <= 0 || px <= 0) return;
    const timelineWidthPx =
      layoutTimelineWidthPxRef?.current && layoutTimelineWidthPxRef.current > 0
        ? layoutTimelineWidthPxRef.current
        : computeTimelineWidthPx(dur, px);
    writeWaveformShellLayout({
      timelineShell: timelineShellRef?.current,
      peaksStageShell: peaksStageShellRef?.current,
      stickyShell: stickyShellRef?.current,
      timelineWidthPx,
      viewportWidthPx: tierW,
    });
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

  const runViewportTransaction = useCallback((force = false) => {
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
      } = argsRef.current;
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
        const prev = prevWidthRef.current;

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
          flushViewportLayout(tier, container, argsRef.current.stickyShellRef?.current);
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
        flushViewportLayout(tier, container, argsRef.current.stickyShellRef?.current);
        writeShellLayoutForCurrentZoom(tierW);

        prevWidthRef.current = viewportWidthPx;

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
    },
    [applyFitAllRefit, writeShellLayoutForCurrentZoom, writeTierViewportWidth],
  );

  const scheduleViewportResize = useCallback(
    (force = false) => {
      pendingResizeForceRef.current = pendingResizeForceRef.current || force;
      if (pendingResizeMicrotaskRef.current) return;
      pendingResizeMicrotaskRef.current = true;
      queueMicrotask(() => {
        pendingResizeMicrotaskRef.current = false;
        const forceNow = pendingResizeForceRef.current;
        pendingResizeForceRef.current = false;
        runViewportTransaction(forceNow);
      });
    },
    [runViewportTransaction],
  );

  const refitFitAllIfNeeded = useCallback(() => {
    runViewportTransaction(false);
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
    const width = tierW > 0 ? tierW : containerW;
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
      pendingResizeMicrotaskRef.current = false;
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

  const syncShellLayoutForZoom = useCallback(() => {
    const tierW = argsRef.current.tierScrollRef?.current?.clientWidth ?? 0;
    if (tierW <= 0) return;
    writeTierViewportWidth(tierW);
    writeShellLayoutForCurrentZoom(tierW);
    flushViewportLayout(
      argsRef.current.tierScrollRef?.current,
      argsRef.current.containerRef.current,
      argsRef.current.stickyShellRef?.current,
    );
  }, [writeShellLayoutForCurrentZoom, writeTierViewportWidth]);

  return { refitFitAllIfNeeded, scheduleViewportResize, syncShellLayoutForZoom };
};
