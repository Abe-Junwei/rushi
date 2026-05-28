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

type WfApi = ReturnType<typeof useProjectWaveform>;

type WaveformZoomFitApi = {
  setFitPxPerSec: (pxPerSec: number) => void;
};

type TierScrollApi = {
  setTierScrollPx: (scrollLeftPx: number) => void;
};

export type PendingViewportFit = {
  intent: ViewportFitScrollIntent;
  pxPerSec: number;
};

/** 在 zoom / peaks resample 完成后计算 tier scroll。 */
export function resolveViewportFitScrollPx(input: {
  pending: PendingViewportFit;
  durationSec: number;
  viewportWidthPx: number;
}): number {
  const tw = computeTimelineWidthPx(input.durationSec, input.pending.pxPerSec);
  return computeViewportFitScrollPx({
    intent: input.pending.intent,
    viewportWidthPx: input.viewportWidthPx,
    timelineWidthPx: tw,
    pxPerSec: input.pending.pxPerSec,
  });
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
  waveformReady: boolean;
  mediaUrl: string | null;
  getSelectedSegment: () => { start_sec: number; end_sec: number } | null;
  suppressWaveformScrollUntilRef: MutableRefObject<number>;
  onTierScrollAdjusted?: () => void;
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
    waveformReady,
    mediaUrl,
    getSelectedSegment,
    suppressWaveformScrollUntilRef,
    onTierScrollAdjusted,
  } = args;

  const pendingViewportFitRef = useRef<PendingViewportFit | null>(null);
  const pendingSegmentFitRafRef = useRef(0);
  const pendingSegmentFitRef = useRef<{ start_sec: number; end_sec: number; forceFullFit: boolean } | null>(
    null,
  );

  const markProgrammaticScroll = useCallback(
    (suppressMs?: number, scrollDeltaPx?: number) => {
      const ms =
        suppressMs ??
        (scrollDeltaPx != null
          ? computeProgrammaticScrollSuppressMs(scrollDeltaPx)
          : WAVEFORM_PROGRAMMATIC_SCROLL_SUPPRESS_MS);
      suppressWaveformScrollUntilRef.current = performance.now() + ms;
    },
    [suppressWaveformScrollUntilRef],
  );

  const applyPendingViewportFit = useCallback(
    (pxPerSec: number, options?: { finalize?: boolean }) => {
      const pending = pendingViewportFitRef.current;
      if (!pending || Math.abs(pending.pxPerSec - pxPerSec) > 0.001) return false;

      const tier = tierScrollRef.current;
      if (!tier) return false;

      const targetSl = resolveViewportFitScrollPx({
        pending,
        durationSec: durationRef.current,
        viewportWidthPx: tier.clientWidth,
      });

      markProgrammaticScroll();
      scrollApiRef.current.setTierScrollPx(targetSl);
      wfApiRef.current.setScrollLeft(targetSl);
      onTierScrollAdjusted?.();
      if (options?.finalize !== false) {
        pendingViewportFitRef.current = null;
      }
      return true;
    },
    [durationRef, markProgrammaticScroll, onTierScrollAdjusted, scrollApiRef, tierScrollRef, wfApiRef],
  );

  const queueViewportFit = useCallback(
    (pending: PendingViewportFit) => {
      pendingViewportFitRef.current = pending;
      zoom.setFitPxPerSec(pending.pxPerSec);
    },
    [zoom],
  );

  const applySelectionViewportScroll = useCallback(
    (seg: { start_sec: number; end_sec: number }, pxPerSec: number) => {
      const tier = tierScrollRef.current;
      const dur = durationRef.current;
      const w = tier?.clientWidth ?? 0;
      if (w <= 0 || dur < 0.5) return;

      const pending: PendingViewportFit = {
        intent: { startSec: seg.start_sec, endSec: seg.end_sec },
        pxPerSec,
      };
      const targetSl = resolveViewportFitScrollPx({
        pending,
        durationSec: dur,
        viewportWidthPx: w,
      });
      const currentSl = tier?.scrollLeft ?? 0;
      markProgrammaticScroll(undefined, Math.abs(targetSl - currentSl));
      scrollApiRef.current.setTierScrollPx(targetSl);
      wfApiRef.current.setScrollLeft(targetSl);
      onTierScrollAdjusted?.();
      pendingViewportFitRef.current = null;
    },
    [durationRef, markProgrammaticScroll, onTierScrollAdjusted, scrollApiRef, tierScrollRef, wfApiRef],
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

      queueViewportFit({
        intent: { startSec: seg.start_sec, endSec: seg.end_sec },
        pxPerSec: px,
      });
    },
    [applySelectionViewportScroll, currentPxPerSecRef, durationRef, queueViewportFit, tierScrollRef],
  );

  const zoomToFitSegment = useCallback(
    (seg: { start_sec: number; end_sec: number }, options?: { forceFullFit?: boolean }) => {
      pendingSegmentFitRef.current = { ...seg, forceFullFit: options?.forceFullFit === true };
      if (pendingSegmentFitRafRef.current) {
        cancelAnimationFrame(pendingSegmentFitRafRef.current);
      }
      pendingSegmentFitRafRef.current = requestAnimationFrame(() => {
        pendingSegmentFitRafRef.current = 0;
        const pending = pendingSegmentFitRef.current;
        pendingSegmentFitRef.current = null;
        if (!pending) return;
        runZoomToFitSegment(
          { start_sec: pending.start_sec, end_sec: pending.end_sec },
          { forceFullFit: pending.forceFullFit },
        );
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
      const pending = pendingViewportFitRef.current;
      const pxPerSec = currentPxPerSecRef.current;
      if (pending && Math.abs(pending.pxPerSec - pxPerSec) > 0.001) return;
      if (shouldSuppressWaveformScrollSync(suppressWaveformScrollUntilRef.current)) return;
      syncWaveformScrollRef.current(scrollLeftPx);
    },
    [currentPxPerSecRef, suppressWaveformScrollUntilRef, syncWaveformScrollRef],
  );

  // 先滚动 tier（finalize: false），保留 pending 直至 peaks resample + ws.load 完成。
  // 若在此时 finalize，onZoomApplied 会失败并 restore 旧 scroll → 视口看似 fit 但 Canvas peaks 空白。
  useLayoutEffect(() => {
    const pending = pendingViewportFitRef.current;
    if (!pending || !waveformReady || renderTimelineWidthPx <= 0) return;
    if (Math.abs(pending.pxPerSec - currentPxPerSec) > 0.001) return;
    applyPendingViewportFit(currentPxPerSec, { finalize: false });
  }, [applyPendingViewportFit, currentPxPerSec, renderTimelineWidthPx, waveformReady]);

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
      if (pendingSegmentFitRafRef.current) {
        cancelAnimationFrame(pendingSegmentFitRafRef.current);
      }
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
