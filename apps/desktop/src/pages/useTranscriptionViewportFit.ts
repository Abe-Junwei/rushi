import { useCallback, useEffect, useLayoutEffect, useRef, type MutableRefObject, type RefObject } from "react";
import {
  computeFitAllPxPerSec,
  computeFitSelectionPxPerSec,
  computeViewportFitScrollPx,
  type ViewportFitScrollIntent,
} from "../utils/pxPerSec";
import { computeTimelineWidthPx } from "../utils/segmentLayout";
import type { useProjectWaveform } from "../hooks/useProjectWaveform";

type WfApi = ReturnType<typeof useProjectWaveform>;

type WaveformZoomFitApi = {
  zoomToFitTier: () => void;
  zoomToFitSelection: () => void;
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
  renderTimelineWidthPx: number;
  waveformReady: boolean;
  mediaUrl: string | null;
  getSelectedSegment: () => { start_sec: number; end_sec: number } | null;
}) {
  const {
    tierScrollRef,
    durationRef,
    syncWaveformScrollRef,
    scrollApiRef,
    wfApiRef,
    zoom,
    currentPxPerSec,
    renderTimelineWidthPx,
    waveformReady,
    mediaUrl,
    getSelectedSegment,
  } = args;

  const pendingViewportFitRef = useRef<PendingViewportFit | null>(null);

  const applyPendingViewportFit = useCallback(
    (pxPerSec: number) => {
      const pending = pendingViewportFitRef.current;
      if (!pending || Math.abs(pending.pxPerSec - pxPerSec) > 0.001) return false;

      const tier = tierScrollRef.current;
      if (!tier) return false;

      const targetSl = resolveViewportFitScrollPx({
        pending,
        durationSec: durationRef.current,
        viewportWidthPx: tier.clientWidth,
      });

      scrollApiRef.current.setTierScrollPx(targetSl);
      wfApiRef.current.setScrollLeft(targetSl);
      pendingViewportFitRef.current = null;
      return true;
    },
    [durationRef, scrollApiRef, tierScrollRef, wfApiRef],
  );

  const zoomToFitTier = useCallback(() => {
    const tier = tierScrollRef.current;
    const dur = durationRef.current;
    const w = tier?.clientWidth ?? 0;
    if (w <= 0 || dur < 0.5) return;
    const px = computeFitAllPxPerSec(w, dur);
    pendingViewportFitRef.current = { intent: { kind: "all" }, pxPerSec: px };
    zoom.zoomToFitTier();
    if (Math.abs(currentPxPerSec - px) < 0.001) {
      applyPendingViewportFit(px);
    }
  }, [applyPendingViewportFit, currentPxPerSec, durationRef, tierScrollRef, zoom]);

  const zoomToFitSelection = useCallback(() => {
    const seg = getSelectedSegment();
    const tier = tierScrollRef.current;
    const dur = durationRef.current;
    const w = tier?.clientWidth ?? 0;
    if (!seg || w <= 0 || dur < 0.5) return;
    const px = computeFitSelectionPxPerSec(w, seg.start_sec, seg.end_sec);
    pendingViewportFitRef.current = {
      intent: { kind: "selection", startSec: seg.start_sec, endSec: seg.end_sec },
      pxPerSec: px,
    };
    zoom.zoomToFitSelection();
    if (Math.abs(currentPxPerSec - px) < 0.001) {
      applyPendingViewportFit(px);
    }
  }, [applyPendingViewportFit, currentPxPerSec, durationRef, getSelectedSegment, tierScrollRef, zoom]);

  const onWaveformScroll = useCallback(
    (scrollLeftPx: number) => {
      if (pendingViewportFitRef.current) return;
      syncWaveformScrollRef.current(scrollLeftPx);
    },
    [syncWaveformScrollRef],
  );

  useLayoutEffect(() => {
    const tier = tierScrollRef.current;
    if (!tier || !waveformReady || renderTimelineWidthPx <= 0) return;
    if (pendingViewportFitRef.current) return;

    const maxSl = Math.max(0, renderTimelineWidthPx - tier.clientWidth);
    const wsSl = wfApiRef.current.getScrollLeft();
    const sl = Math.min(maxSl, Math.max(0, wsSl));
    scrollApiRef.current.setTierScrollPx(sl);
  }, [
    renderTimelineWidthPx,
    scrollApiRef,
    tierScrollRef,
    waveformReady,
    wfApiRef,
  ]);

  useEffect(() => {
    if (!mediaUrl || !waveformReady) return;
    pendingViewportFitRef.current = null;
    scrollApiRef.current.setTierScrollPx(0);
  }, [mediaUrl, scrollApiRef, waveformReady]);

  return {
    onWaveformScroll,
    zoomToFitTier,
    zoomToFitSelection,
    applyPendingViewportFit,
  };
}
