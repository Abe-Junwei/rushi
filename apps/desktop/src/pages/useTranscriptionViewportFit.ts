import { useCallback, useEffect, useRef, type MutableRefObject, type RefObject } from "react";
import {
  computeFitAllPxPerSec,
  computeFitSelectionPxPerSec,
  computeViewportFitScrollPx,
  resolveSelectionFitPxPerSec,
  resolveViewportFitLayoutPxPerSec,
  type ViewportFitScrollIntent,
} from "../utils/pxPerSec";
import { computeTimelineWidthPx } from "../utils/segmentLayout";
import {
  computeProgrammaticScrollSuppressMs,
  WAVEFORM_PROGRAMMATIC_SCROLL_SUPPRESS_MS,
} from "../utils/waveformScrollSync";
import type { useProjectWaveform } from "../hooks/useProjectWaveform";

type WfApi = ReturnType<typeof useProjectWaveform>;

type WaveformZoomFitApi = {
  setFitPxPerSec: (pxPerSec: number) => void;
  enterFitAllLayout: (pxPerSec: number) => void;
};

type TierScrollApi = {
  setTierScrollPx: (
    scrollLeftPx: number,
    options?: { timelineWidthPx?: number; immediate?: boolean; deferLayoutCommit?: boolean },
  ) => void;
};

export type PendingViewportFit = { intent: ViewportFitScrollIntent; pxPerSec: number };

/** Compute tier scroll target for a pending viewport-fit. */
export function resolveViewportFitScrollPx(input: {
  pending: PendingViewportFit;
  durationSec: number;
  viewportWidthPx: number;
}): number {
  const { pending, durationSec, viewportWidthPx } = input;
  const tw = computeTimelineWidthPx(durationSec, pending.pxPerSec);
  return computeViewportFitScrollPx({ intent: pending.intent, viewportWidthPx, timelineWidthPx: tw, durationSec });
}

export function runZoomToFitAll(input: {
  tier: HTMLDivElement | null;
  durationSec: number;
  queueViewportFit: (pending: PendingViewportFit, options?: { fitAll?: boolean }) => void;
}): void {
  const w = input.tier?.clientWidth ?? 0;
  if (w <= 0 || input.durationSec < 0.5) return;

  const px = resolveViewportFitLayoutPxPerSec(
    computeFitAllPxPerSec(w, input.durationSec),
    input.durationSec,
  );
  input.queueViewportFit(
    { intent: { startSec: 0, endSec: input.durationSec }, pxPerSec: px },
    { fitAll: true },
  );
}

export function useTranscriptionViewportFit(args: {
  tierScrollRef: RefObject<HTMLDivElement | null>;
  durationRef: MutableRefObject<number>;
  scrollApiRef: MutableRefObject<TierScrollApi>;
  wfApiRef: MutableRefObject<WfApi>;
  zoom: WaveformZoomFitApi;
  currentPxPerSec: number;
  currentPxPerSecRef: MutableRefObject<number>;
  waveformReady: boolean;
  mediaUrl: string | null;
  getSelectedSegment: () => { start_sec: number; end_sec: number } | null;
  playbackFollowSuppressUntilRef: MutableRefObject<number>;
}) {
  const {
    tierScrollRef,
    durationRef,
    scrollApiRef,
    wfApiRef,
    zoom,
    currentPxPerSecRef,
    waveformReady,
    mediaUrl,
    getSelectedSegment,
    playbackFollowSuppressUntilRef,
  } = args;

  const pendingViewportFitRef = useRef<PendingViewportFit | null>(null);
  const pendingSegmentFitRafRef = useRef(0);
  const pendingSegmentFitRef = useRef<{ start_sec: number; end_sec: number; forceFullFit: boolean } | null>(null);

  const markProgrammaticScroll = useCallback(
    (suppressMs?: number, scrollDeltaPx?: number) => {
      const ms =
        suppressMs ??
        (scrollDeltaPx != null
          ? computeProgrammaticScrollSuppressMs(scrollDeltaPx)
          : WAVEFORM_PROGRAMMATIC_SCROLL_SUPPRESS_MS);
      playbackFollowSuppressUntilRef.current = performance.now() + ms;
    },
    [playbackFollowSuppressUntilRef],
  );

  const writeTierScroll = useCallback(
    (targetSl: number, timelineWidthPx?: number) => {
      scrollApiRef.current.setTierScrollPx(targetSl, {
        ...(timelineWidthPx != null ? { timelineWidthPx } : {}),
        immediate: true,
      });
    },
    [scrollApiRef],
  );

  const applyPendingViewportFit = useCallback(
    (pxPerSec: number, options?: { finalize?: boolean; skipScroll?: boolean }) => {
      const pending = pendingViewportFitRef.current;
      if (!pending) return false;
      if (Math.abs(pending.pxPerSec - pxPerSec) > 0.001) {
        pendingViewportFitRef.current = { ...pending, pxPerSec };
      }
      const tier = tierScrollRef.current;
      if (!tier) return false;
      const scrollPending = pendingViewportFitRef.current!;

      if (!options?.skipScroll) {
        const tw = computeTimelineWidthPx(durationRef.current, scrollPending.pxPerSec);
        const targetSl = resolveViewportFitScrollPx({
          pending: scrollPending,
          durationSec: durationRef.current,
          viewportWidthPx: tier.clientWidth,
        });
        markProgrammaticScroll(undefined, Math.abs(targetSl - tier.scrollLeft));
        writeTierScroll(targetSl, tw);
      }
      if (options?.finalize !== false) {
        pendingViewportFitRef.current = null;
      }
      return true;
    },
    [durationRef, markProgrammaticScroll, tierScrollRef, writeTierScroll],
  );

  const queueViewportFit = useCallback(
    (pending: PendingViewportFit, options?: { fitAll?: boolean }) => {
      const needsPeaksResample = Math.abs(pending.pxPerSec - currentPxPerSecRef.current) > 0.001;
      pendingViewportFitRef.current = pending;
      if (options?.fitAll) {
        zoom.enterFitAllLayout(pending.pxPerSec);
      } else {
        zoom.setFitPxPerSec(pending.pxPerSec);
      }

      if (!needsPeaksResample) {
        const tier = tierScrollRef.current;
        const dur = durationRef.current;
        if (tier && tier.clientWidth > 0 && dur >= 0.5) {
          const tw = computeTimelineWidthPx(dur, pending.pxPerSec);
          const targetSl = resolveViewportFitScrollPx({
            pending,
            durationSec: dur,
            viewportWidthPx: tier.clientWidth,
          });
          markProgrammaticScroll(undefined, Math.abs(targetSl - tier.scrollLeft));
          writeTierScroll(targetSl, tw);
        }
        pendingViewportFitRef.current = null;
        return;
      }
    },
    [currentPxPerSecRef, durationRef, markProgrammaticScroll, tierScrollRef, writeTierScroll, zoom],
  );

  const applySelectionViewportScroll = useCallback(
    (seg: { start_sec: number; end_sec: number }, pxPerSec: number) => {
      const tier = tierScrollRef.current;
      const dur = durationRef.current;
      const w = tier?.clientWidth ?? 0;
      if (w <= 0 || dur < 0.5) return;

      const pending: PendingViewportFit = { intent: { startSec: seg.start_sec, endSec: seg.end_sec }, pxPerSec };
      const tw = computeTimelineWidthPx(dur, pxPerSec);
      const targetSl = resolveViewportFitScrollPx({ pending, durationSec: dur, viewportWidthPx: w });
      markProgrammaticScroll(undefined, Math.abs(targetSl - (tier?.scrollLeft ?? 0)));
      writeTierScroll(targetSl, tw);
      pendingViewportFitRef.current = null;
    },
    [durationRef, markProgrammaticScroll, tierScrollRef, writeTierScroll],
  );

  const revealSegmentInViewport = useCallback(
    (seg: { start_sec: number; end_sec: number }) => {
      applySelectionViewportScroll(seg, currentPxPerSecRef.current);
    },
    [applySelectionViewportScroll, currentPxPerSecRef],
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
      const px = resolveViewportFitLayoutPxPerSec(pxRaw, dur);

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
    zoomToFitSegment(seg, { forceFullFit: true });
  }, [getSelectedSegment, zoomToFitSegment]);

  const zoomToFitAll = () => {
    runZoomToFitAll({
      tier: tierScrollRef.current,
      durationSec: durationRef.current,
      queueViewportFit,
    });
  };

  const cancelViewportFit = useCallback(() => {
    pendingViewportFitRef.current = null;
    pendingSegmentFitRef.current = null;
    if (pendingSegmentFitRafRef.current) {
      cancelAnimationFrame(pendingSegmentFitRafRef.current);
      pendingSegmentFitRafRef.current = 0;
    }
    wfApiRef.current.cancelInFlightZoom?.();
  }, [wfApiRef]);

  useEffect(() => {
    if (!mediaUrl || !waveformReady) return;
    pendingViewportFitRef.current = null;
    pendingSegmentFitRef.current = null;
    if (pendingSegmentFitRafRef.current) {
      cancelAnimationFrame(pendingSegmentFitRafRef.current);
      pendingSegmentFitRafRef.current = 0;
    }
    markProgrammaticScroll();
  }, [markProgrammaticScroll, mediaUrl, waveformReady]);

  useEffect(
    () => () => {
      if (pendingSegmentFitRafRef.current) cancelAnimationFrame(pendingSegmentFitRafRef.current);
    },
    [],
  );

  return {
    zoomToFitSelection,
    zoomToFitAll,
    zoomToFitSegment,
    revealSegmentInViewport,
    applyPendingViewportFit,
    cancelViewportFit,
  };
}
