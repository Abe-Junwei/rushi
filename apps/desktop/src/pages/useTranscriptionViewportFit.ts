import { useCallback, useEffect, useLayoutEffect, useRef, type MutableRefObject, type RefObject } from "react";
import {
  computeFitSelectionPxPerSec,
  computeViewportFitScrollPx,
  quantizePxPerSecForPeaksLoad,
  resolveSelectionFitPxPerSec,
  type ViewportFitScrollIntent,
} from "../utils/pxPerSec";
import { computeTimelineWidthPx } from "../utils/segmentLayout";
import {
  computeProgrammaticScrollSuppressMs,
  shouldSuppressWaveformScrollSync,
  WAVEFORM_PROGRAMMATIC_SCROLL_SUPPRESS_MS,
} from "../utils/waveformScrollSync";
import type { useProjectWaveform } from "../hooks/useProjectWaveform";
import { reduceViewportFitPhase, shouldBlockWaveformScrollSync } from "../services/waveform/viewportFitStateMachine";
import type { ViewportFitPhase } from "../services/waveform/waveformTimelineTypes";

type WfApi = ReturnType<typeof useProjectWaveform>;

type WaveformZoomFitApi = { setFitPxPerSec: (pxPerSec: number) => void };

type TierScrollApi = { setTierScrollPx: (scrollLeftPx: number) => void };

export type PendingViewportFit = { intent: ViewportFitScrollIntent; pxPerSec: number };

/** Compute tier scroll target for a pending viewport-fit. */
export function resolveViewportFitScrollPx(input: {
  pending: PendingViewportFit;
  durationSec: number;
  viewportWidthPx: number;
}): number {
  const { pending, durationSec, viewportWidthPx } = input;
  const tw = computeTimelineWidthPx(durationSec, pending.pxPerSec);
  return computeViewportFitScrollPx({ intent: pending.intent, viewportWidthPx, timelineWidthPx: tw, durationSec, pxPerSec: pending.pxPerSec });
}

export function useTranscriptionViewportFit(args: {
  tierScrollRef: RefObject<HTMLDivElement | null>;
  durationRef: MutableRefObject<number>;
  syncWaveformScrollRef: MutableRefObject<(scrollLeftPx: number) => void>;
  scrollApiRef: MutableRefObject<TierScrollApi>;
  wfApiRef: MutableRefObject<WfApi>;
  zoom: WaveformZoomFitApi;
  currentPxPerSec: number;
  currentPxPerSecRef: MutableRefObject<number>;
  renderTimelineWidthPx: number;
  drawPxPerSec: number;
  waveformReady: boolean;
  mediaUrl: string | null;
  getSelectedSegment: () => { start_sec: number; end_sec: number } | null;
  suppressWaveformScrollUntilRef: MutableRefObject<number>;
  /** ADR-0005: tier-only scroll when canvas peaks are active. */
  peaksCanvasActive: boolean;
}) {
  const {
    tierScrollRef,
    durationRef,
    syncWaveformScrollRef,
    scrollApiRef,
    wfApiRef,
    zoom,
    currentPxPerSec,
    currentPxPerSecRef,
    renderTimelineWidthPx,
    drawPxPerSec,
    waveformReady,
    mediaUrl,
    getSelectedSegment,
    suppressWaveformScrollUntilRef,
    peaksCanvasActive,
  } = args;

  const pendingViewportFitRef = useRef<PendingViewportFit | null>(null);
  const viewportFitPhaseRef = useRef<ViewportFitPhase>("idle");
  const pendingSegmentFitRafRef = useRef(0);
  const pendingSegmentFitRef = useRef<{ start_sec: number; end_sec: number; forceFullFit: boolean } | null>(null);

  const markProgrammaticScroll = useCallback(
    (suppressMs?: number, scrollDeltaPx?: number) => {
      const ms = suppressMs ?? (scrollDeltaPx != null ? computeProgrammaticScrollSuppressMs(scrollDeltaPx) : WAVEFORM_PROGRAMMATIC_SCROLL_SUPPRESS_MS);
      suppressWaveformScrollUntilRef.current = performance.now() + ms;
    },
    [suppressWaveformScrollUntilRef],
  );

  const writeTierScroll = useCallback(
    (targetSl: number) => {
      scrollApiRef.current.setTierScrollPx(targetSl);
      if (!peaksCanvasActive) wfApiRef.current.setScrollLeft(targetSl);
    },
    [peaksCanvasActive, scrollApiRef, wfApiRef],
  );

  const applyPendingViewportFit = useCallback(
    (pxPerSec: number, options?: { finalize?: boolean }) => {
      const pending = pendingViewportFitRef.current;
      if (!pending || Math.abs(pending.pxPerSec - pxPerSec) > 0.001) return false;
      const tier = tierScrollRef.current;
      if (!tier) return false;

      const targetSl = resolveViewportFitScrollPx({ pending, durationSec: durationRef.current, viewportWidthPx: tier.clientWidth });
      markProgrammaticScroll();
      writeTierScroll(targetSl);
      viewportFitPhaseRef.current = reduceViewportFitPhase(viewportFitPhaseRef.current, { type: "scrollApplied" });
      if (options?.finalize !== false) {
        pendingViewportFitRef.current = null;
        viewportFitPhaseRef.current = reduceViewportFitPhase(viewportFitPhaseRef.current, { type: "finalize" });
      }
      return true;
    },
    [durationRef, markProgrammaticScroll, tierScrollRef, writeTierScroll],
  );

  const queueViewportFit = useCallback(
    (pending: PendingViewportFit) => {
      const needsPeaksResample = Math.abs(pending.pxPerSec - drawPxPerSec) > 0.001;
      viewportFitPhaseRef.current = reduceViewportFitPhase(viewportFitPhaseRef.current, { type: "queue", needsPeaksResample });
      pendingViewportFitRef.current = pending;
      zoom.setFitPxPerSec(pending.pxPerSec);
      // Scroll tier immediately — do not wait for peaks reload to avoid blank main view.
      const tier = tierScrollRef.current;
      const dur = durationRef.current;
      if (tier && tier.clientWidth > 0 && dur >= 0.5) {
        const targetSl = resolveViewportFitScrollPx({ pending, durationSec: dur, viewportWidthPx: tier.clientWidth });
        markProgrammaticScroll(undefined, Math.abs(targetSl - tier.scrollLeft));
        writeTierScroll(targetSl);
      }
    },
    [drawPxPerSec, durationRef, markProgrammaticScroll, tierScrollRef, writeTierScroll, zoom],
  );

  const applySelectionViewportScroll = useCallback(
    (seg: { start_sec: number; end_sec: number }, pxPerSec: number) => {
      const tier = tierScrollRef.current;
      const dur = durationRef.current;
      const w = tier?.clientWidth ?? 0;
      if (w <= 0 || dur < 0.5) return;

      const pending: PendingViewportFit = { intent: { startSec: seg.start_sec, endSec: seg.end_sec }, pxPerSec };
      const targetSl = resolveViewportFitScrollPx({ pending, durationSec: dur, viewportWidthPx: w });
      markProgrammaticScroll(undefined, Math.abs(targetSl - (tier?.scrollLeft ?? 0)));
      writeTierScroll(targetSl);
      pendingViewportFitRef.current = null;
    },
    [durationRef, markProgrammaticScroll, tierScrollRef, writeTierScroll],
  );

  const runZoomToFitSegment = useCallback(
    (seg: { start_sec: number; end_sec: number }, options?: { forceFullFit?: boolean }) => {
      const tier = tierScrollRef.current;
      const dur = durationRef.current;
      const w = tier?.clientWidth ?? 0;
      if (w <= 0 || dur < 0.5) return;

      const pxRaw = options?.forceFullFit
        ? computeFitSelectionPxPerSec(w, seg.start_sec, seg.end_sec)
        : resolveSelectionFitPxPerSec(w, seg.start_sec, seg.end_sec, currentPxPerSecRef.current);
      const px = quantizePxPerSecForPeaksLoad(pxRaw);

      if (Math.abs(px - currentPxPerSecRef.current) < 0.001) {
        applySelectionViewportScroll(seg, px);
        return;
      }
      queueViewportFit({ intent: { startSec: seg.start_sec, endSec: seg.end_sec }, pxPerSec: px });
    },
    [applySelectionViewportScroll, currentPxPerSecRef, durationRef, queueViewportFit, tierScrollRef],
  );

  const zoomToFitSegment = useCallback(
    (seg: { start_sec: number; end_sec: number }, options?: { forceFullFit?: boolean }) => {
      pendingSegmentFitRef.current = { ...seg, forceFullFit: options?.forceFullFit === true };
      if (pendingSegmentFitRafRef.current) cancelAnimationFrame(pendingSegmentFitRafRef.current);
      pendingSegmentFitRafRef.current = requestAnimationFrame(() => {
        pendingSegmentFitRafRef.current = 0;
        const pending = pendingSegmentFitRef.current;
        pendingSegmentFitRef.current = null;
        if (!pending) return;
        runZoomToFitSegment({ start_sec: pending.start_sec, end_sec: pending.end_sec }, { forceFullFit: pending.forceFullFit });
      });
    },
    [runZoomToFitSegment],
  );

  const zoomToFitSelection = useCallback(() => {
    const seg = getSelectedSegment();
    if (!seg) return;
    zoomToFitSegment(seg, { forceFullFit: false });
  }, [getSelectedSegment, zoomToFitSegment]);

  const cancelViewportFit = useCallback(() => {
    viewportFitPhaseRef.current = reduceViewportFitPhase(viewportFitPhaseRef.current, { type: "cancel" });
    pendingViewportFitRef.current = null;
    pendingSegmentFitRef.current = null;
    if (pendingSegmentFitRafRef.current) {
      cancelAnimationFrame(pendingSegmentFitRafRef.current);
      pendingSegmentFitRafRef.current = 0;
    }
    wfApiRef.current.cancelInFlightZoom?.();
  }, [wfApiRef]);

  const onWaveformScroll = useCallback(
    (scrollLeftPx: number) => {
      if (peaksCanvasActive) return;
      if (shouldBlockWaveformScrollSync(viewportFitPhaseRef.current)) return;
      const pending = pendingViewportFitRef.current;
      const pxPerSec = currentPxPerSecRef.current;
      if (pending && Math.abs(pending.pxPerSec - pxPerSec) > 0.001) return;
      if (shouldSuppressWaveformScrollSync(suppressWaveformScrollUntilRef.current)) return;
      syncWaveformScrollRef.current(scrollLeftPx);
    },
    [currentPxPerSecRef, peaksCanvasActive, suppressWaveformScrollUntilRef, syncWaveformScrollRef],
  );

  // Scroll tier immediately; keep pending until draw px/s and peaks are ready.
  useLayoutEffect(() => {
    const pending = pendingViewportFitRef.current;
    if (!pending || !waveformReady || renderTimelineWidthPx <= 0) return;
    if (Math.abs(pending.pxPerSec - currentPxPerSec) > 0.001) return;
    if (Math.abs(pending.pxPerSec - drawPxPerSec) > 0.001) return;
    applyPendingViewportFit(currentPxPerSec, { finalize: false });
    viewportFitPhaseRef.current = reduceViewportFitPhase(viewportFitPhaseRef.current, { type: "peaksReady" });
  }, [applyPendingViewportFit, currentPxPerSec, drawPxPerSec, renderTimelineWidthPx, waveformReady]);

  useEffect(() => {
    if (!mediaUrl || !waveformReady) return;
    pendingViewportFitRef.current = null;
    pendingSegmentFitRef.current = null;
    if (pendingSegmentFitRafRef.current) {
      cancelAnimationFrame(pendingSegmentFitRafRef.current);
      pendingSegmentFitRafRef.current = 0;
    }
    markProgrammaticScroll();
    scrollApiRef.current.setTierScrollPx(0);
  }, [markProgrammaticScroll, mediaUrl, scrollApiRef, waveformReady]);

  useEffect(
    () => () => {
      if (pendingSegmentFitRafRef.current) cancelAnimationFrame(pendingSegmentFitRafRef.current);
    },
    [],
  );

  return {
    onWaveformScroll,
    zoomToFitSelection,
    zoomToFitSegment,
    applyPendingViewportFit,
    cancelViewportFit,
    markProgrammaticScroll,
  };
}
