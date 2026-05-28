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
  renderPxPerSec: number;
  zoomToFitTier: () => void;
  zoomToFitSelection: () => void;
};

type TierScrollApi = {
  setTierScrollPx: (scrollLeftPx: number) => void;
};

export function useTranscriptionViewportFit(args: {
  tierScrollRef: RefObject<HTMLDivElement | null>;
  durationRef: MutableRefObject<number>;
  syncWaveformScrollRef: MutableRefObject<(scrollLeftPx: number) => void>;
  scrollApiRef: MutableRefObject<TierScrollApi>;
  wfApiRef: MutableRefObject<WfApi>;
  zoom: WaveformZoomFitApi;
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
    renderTimelineWidthPx,
    waveformReady,
    mediaUrl,
    getSelectedSegment,
  } = args;

  const viewportFitSessionRef = useRef<{
    intent: ViewportFitScrollIntent;
    pxPerSec: number;
    framesLeft: number;
  } | null>(null);

  const applyViewportFitScroll = useCallback(
    (pxPerSec = zoom.renderPxPerSec) => {
      const session = viewportFitSessionRef.current;
      if (!session) return;
      const tier = tierScrollRef.current;
      if (!tier) return;
      const tw = computeTimelineWidthPx(durationRef.current, pxPerSec);
      const targetSl = computeViewportFitScrollPx({
        intent: session.intent,
        viewportWidthPx: tier.clientWidth,
        timelineWidthPx: tw,
        pxPerSec,
      });
      scrollApiRef.current.setTierScrollPx(targetSl);
    },
    [durationRef, scrollApiRef, tierScrollRef, zoom.renderPxPerSec],
  );

  const beginViewportFitSession = useCallback(
    (intent: ViewportFitScrollIntent, pxPerSec: number) => {
      viewportFitSessionRef.current = { intent, pxPerSec, framesLeft: 2 };
      applyViewportFitScroll(pxPerSec);
      const tick = () => {
        const session = viewportFitSessionRef.current;
        if (!session || session.framesLeft <= 0) {
          viewportFitSessionRef.current = null;
          return;
        }
        session.framesLeft -= 1;
        applyViewportFitScroll(session.pxPerSec);
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    },
    [applyViewportFitScroll],
  );

  const zoomToFitTier = useCallback(() => {
    const tier = tierScrollRef.current;
    const dur = durationRef.current;
    const w = tier?.clientWidth ?? 0;
    if (w <= 0 || dur < 0.5) return;
    const px = computeFitAllPxPerSec(w, dur);
    beginViewportFitSession({ kind: "all" }, px);
    zoom.zoomToFitTier();
  }, [beginViewportFitSession, durationRef, tierScrollRef, zoom]);

  const zoomToFitSelection = useCallback(() => {
    const seg = getSelectedSegment();
    const tier = tierScrollRef.current;
    const dur = durationRef.current;
    const w = tier?.clientWidth ?? 0;
    if (!seg || w <= 0 || dur < 0.5) return;
    const px = computeFitSelectionPxPerSec(w, seg.start_sec, seg.end_sec);
    beginViewportFitSession(
      { kind: "selection", startSec: seg.start_sec, endSec: seg.end_sec },
      px,
    );
    zoom.zoomToFitSelection();
  }, [beginViewportFitSession, durationRef, getSelectedSegment, tierScrollRef, zoom]);

  const onWaveformScroll = useCallback(
    (scrollLeftPx: number) => {
      if (viewportFitSessionRef.current && viewportFitSessionRef.current.framesLeft > 0) {
        applyViewportFitScroll();
        return;
      }
      syncWaveformScrollRef.current(scrollLeftPx);
    },
    [applyViewportFitScroll, syncWaveformScrollRef],
  );

  useLayoutEffect(() => {
    const tier = tierScrollRef.current;
    if (!tier || !waveformReady || renderTimelineWidthPx <= 0) return;
    if (viewportFitSessionRef.current && viewportFitSessionRef.current.framesLeft > 0) {
      applyViewportFitScroll(viewportFitSessionRef.current.pxPerSec);
      return;
    }
    const maxSl = Math.max(0, renderTimelineWidthPx - tier.clientWidth);
    const wsSl = wfApiRef.current.getScrollLeft();
    const sl = Math.min(maxSl, Math.max(0, wsSl));
    scrollApiRef.current.setTierScrollPx(sl);
  }, [
    applyViewportFitScroll,
    renderTimelineWidthPx,
    scrollApiRef,
    tierScrollRef,
    waveformReady,
    wfApiRef,
    zoom.renderPxPerSec,
  ]);

  useEffect(() => {
    if (!mediaUrl || !waveformReady) return;
    scrollApiRef.current.setTierScrollPx(0);
  }, [mediaUrl, scrollApiRef, waveformReady]);

  return {
    onWaveformScroll,
    zoomToFitTier,
    zoomToFitSelection,
  };
}
