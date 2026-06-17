import { useCallback, useEffect, useLayoutEffect, useRef, type MutableRefObject, type RefObject } from "react";
import type WaveSurfer from "wavesurfer.js";
import { clearWaveformViewportStretch } from "../utils/waveformViewportStretch";
import { subscribeWaveSurferAfterRender } from "../services/waveform/waveformSurferProgressCoverage";
import type { WaveformAppliedZoomState } from "../utils/waveformAppliedZoom";
import {
  createWaveformViewportResizeTransaction,
  flushViewportLayout,
} from "./waveformViewportResizeTransaction";

export type UseWaveformViewportControllerArgs = {
  wsRef: RefObject<WaveSurfer | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  stickyShellRef?: RefObject<HTMLDivElement | null>;
  stretchShellRef?: RefObject<HTMLDivElement | null>;
  waveformScrollLayerRef?: RefObject<HTMLDivElement | null>;
  overlayScrollLayerRef?: RefObject<HTMLDivElement | null>;
  tierScrollRef?: RefObject<HTMLElement | null>;
  isReady: boolean;
  deferDecodeMount: boolean;
  syncScrollAfterRender?: () => void;
  /** Called after viewport transaction completes (hold cleared). */
  onAfterViewportResizeRef?: MutableRefObject<(() => void) | undefined>;
  /** While true, zoom sync defers ws.load(peaks) until after resize. */
  viewportResizeHoldRef?: MutableRefObject<boolean>;
  refitFitAllPxPerSec?: (viewportWidthPx: number) => number | null;
  /** WS-applied zoom state (TRUTH-010); fit-all refit writes via markAppliedZoomWs. */
  appliedZoom?: WaveformAppliedZoomState;
  onFitAllPxPerSecRefit?: (pxPerSec: number) => void;
  layoutDurationSecRef?: MutableRefObject<number>;
  layoutTimelineWidthPxRef?: MutableRefObject<number>;
  timelineShellRef?: RefObject<HTMLDivElement | null>;
  peaksStageShellRef?: RefObject<HTMLDivElement | null>;
};

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

  const resizeTransactionRef = useRef(
    createWaveformViewportResizeTransaction({
      getArgs: () => argsRef.current,
      prevWidthRef,
    }),
  );

  const clearStretch = useCallback(() => {
    clearWaveformViewportStretch(argsRef.current.stretchShellRef?.current);
  }, []);

  const { writeTierViewportWidth, writeShellLayoutForCurrentZoom, runViewportTransaction } =
    resizeTransactionRef.current;

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
    const unsub = subscribeWaveSurferAfterRender(ws, () => {
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
