import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { afterSmoothScrollEnd } from "../utils/tierScrollSmooth";
import { WAVEFORM_SCROLL_SYNC_EPSILON_PX } from "../utils/waveformScrollSync";
import { scrollPxCenterTimeInViewport } from "../utils/waveformProjection";
import type { useProjectWaveform } from "./useProjectWaveform";
import { useTierScrollLayout, type TierScrollLayout } from "./useTierScrollLayout";

export type { TierScrollLayout };

type WfApi = ReturnType<typeof useProjectWaveform>;

type ScrollApplySource = "tier" | "program";

/** Tier scroll is the sole horizontal authority (ADR-0005). */
export function useTierScrollSync(args: {
  tierScrollRef: React.RefObject<HTMLDivElement | null>;
  timelineWidthPx: number;
  mediaDurationSec: number;
  pxPerSec: number;
  wfApiRef: React.MutableRefObject<WfApi>;
  waveformReady: boolean;
  mediaUrl: string | null;
  playbackFollowSuppressUntilRef?: React.MutableRefObject<number>;
}) {
  const argsRef = useRef(args);
  argsRef.current = args;

  const committedScrollLeftRef = useRef(0);
  const prevMediaUrlRef = useRef(args.mediaUrl);
  const prevMediaUrlResetOnlyRef = useRef(args.mediaUrl);
  const prevMediaDurationSecRef = useRef(args.mediaDurationSec);
  const prevTimelineWidthPxRef = useRef(args.timelineWidthPx);
  const prevViewportWidthPxRef = useRef(0);
  const smoothScrollCleanupRef = useRef<(() => void) | null>(null);
  const programmaticScrollUntilRef = useRef(0);

  const tierScrollMetrics = useTierScrollLayout(args.tierScrollRef);

  useLayoutEffect(() => {
    tierScrollMetrics.refreshLayout();
  }, [
    args.timelineWidthPx,
    args.mediaUrl,
    args.waveformReady,
    args.mediaDurationSec,
    args.pxPerSec,
    tierScrollMetrics.refreshLayout,
  ]);

  const mirrorWaveSurferScroll = (scrollLeftPx: number) => {
    const a = argsRef.current;
    if (!a.waveformReady) return;
    const sync = a.wfApiRef.current?.syncWaveSurferScrollPx;
    if (typeof sync === "function") sync(scrollLeftPx);
  };

  const applyScrollLeftPx = (px: number, source: ScrollApplySource) => {
    const a = argsRef.current;
    const tier = a.tierScrollRef.current;
    if (!tier) return;
    const vw = tier.clientWidth;
    const maxSl = Math.max(0, a.timelineWidthPx - vw);
    const sl = Math.max(0, Math.min(maxSl, px));
    if (
      Math.abs(committedScrollLeftRef.current - sl) < WAVEFORM_SCROLL_SYNC_EPSILON_PX &&
      Math.abs(tier.scrollLeft - sl) < WAVEFORM_SCROLL_SYNC_EPSILON_PX
    ) {
      mirrorWaveSurferScroll(sl);
      return;
    }
    if (Math.abs(tier.scrollLeft - sl) > WAVEFORM_SCROLL_SYNC_EPSILON_PX) {
      if (source === "program") {
        programmaticScrollUntilRef.current = performance.now() + 80;
      }
      tier.scrollLeft = sl;
    }
    committedScrollLeftRef.current = sl;
    tierScrollMetrics.liveScrollLeftRef.current = sl;
    tierScrollMetrics.liveClientWidthRef.current = vw;
    mirrorWaveSurferScroll(sl);
  };

  const api = useMemo(
    () => ({
      onTierScroll: () => {
        const tier = argsRef.current.tierScrollRef.current;
        if (!tier) return;
        tierScrollMetrics.liveScrollLeftRef.current = tier.scrollLeft;
        tierScrollMetrics.liveClientWidthRef.current = tier.clientWidth;
        mirrorWaveSurferScroll(tier.scrollLeft);
        const suppressRef = argsRef.current.playbackFollowSuppressUntilRef;
        if (suppressRef && performance.now() >= programmaticScrollUntilRef.current) {
          suppressRef.current = performance.now() + 2500;
        }
        applyScrollLeftPx(tier.scrollLeft, "tier");
      },
      setTierScrollPx: (px: number) => {
        applyScrollLeftPx(px, "program");
      },
      setTierScrollPxSmooth: (px: number) => {
        const tier = argsRef.current.tierScrollRef.current;
        if (!tier) return;
        const vw = tier.clientWidth;
        const maxSl = Math.max(0, argsRef.current.timelineWidthPx - vw);
        const sl = Math.max(0, Math.min(maxSl, px));
        smoothScrollCleanupRef.current?.();
        smoothScrollCleanupRef.current = null;
        if (typeof tier.scrollTo !== "function") {
          applyScrollLeftPx(sl, "program");
          return;
        }
        tier.scrollTo({ left: sl, behavior: "smooth" });
        smoothScrollCleanupRef.current = afterSmoothScrollEnd(tier, (finalSl) => {
          smoothScrollCleanupRef.current = null;
          applyScrollLeftPx(finalSl, "program");
        });
      },
      refreshTierScrollLayout: () => {
        tierScrollMetrics.refreshLayout();
        const el = argsRef.current.tierScrollRef.current;
        if (!el) return;
        committedScrollLeftRef.current = el.scrollLeft;
        tierScrollMetrics.liveScrollLeftRef.current = el.scrollLeft;
        tierScrollMetrics.liveClientWidthRef.current = el.clientWidth;
      },
      seekFromTierClientX: (clientX: number) => {
        const w = argsRef.current.wfApiRef.current;
        const d = argsRef.current.mediaDurationSec;
        if (!w.isReady || d <= 0) return;
        w.seek(w.clientXToTimeSec(clientX));
      },
      onPickAbsoluteTime: (t: number, mode: "seek" | "seekAndCenterViewport") => {
        const w = argsRef.current.wfApiRef.current;
        const d = argsRef.current.mediaDurationSec;
        if (d <= 0) return;
        const clamped = Math.max(0, Math.min(d, t));
        w.seek(clamped);
        if (mode !== "seekAndCenterViewport") return;
        const tier = argsRef.current.tierScrollRef.current;
        if (!tier) return;
        const tw = Math.max(argsRef.current.timelineWidthPx, 1);
        const targetScroll = scrollPxCenterTimeInViewport({
          timeSec: clamped,
          timelineWidthPx: tw,
          durationSec: d,
          viewportWidthPx: tier.clientWidth,
        });
        applyScrollLeftPx(targetScroll, "program");
      },
    }),
    [tierScrollMetrics.refreshLayout, tierScrollMetrics.liveScrollLeftRef, tierScrollMetrics.liveClientWidthRef],
  );

  useLayoutEffect(() => {
    const a = argsRef.current;
    const isMediaUrlChange = prevMediaUrlResetOnlyRef.current !== a.mediaUrl;
    if (!isMediaUrlChange) return;
    prevMediaUrlResetOnlyRef.current = a.mediaUrl;
    committedScrollLeftRef.current = 0;
    tierScrollMetrics.liveScrollLeftRef.current = 0;
    const tier = a.tierScrollRef.current;
    if (tier) {
      programmaticScrollUntilRef.current = performance.now() + 80;
      tier.scrollLeft = 0;
    }
  }, [args.mediaUrl, tierScrollMetrics.liveScrollLeftRef]);

  useLayoutEffect(() => {
    const a = argsRef.current;
    const tier = a.tierScrollRef.current;
    if (!tier || !a.waveformReady) return;

    const isMediaUrlChange = prevMediaUrlRef.current !== a.mediaUrl;
    const prevDur = prevMediaDurationSecRef.current;
    const dur = a.mediaDurationSec;
    const durationExpanded =
      prevDur > 0 &&
      dur > prevDur + 0.5 &&
      Math.abs(dur - prevDur) / Math.max(prevDur, 1) > 0.02;

    const prevTw = prevTimelineWidthPxRef.current;
    const newTw = a.timelineWidthPx;
    prevMediaUrlRef.current = a.mediaUrl;
    prevMediaDurationSecRef.current = dur;
    prevTimelineWidthPxRef.current = newTw;

    const shouldResetScroll = isMediaUrlChange || durationExpanded;
    if (shouldResetScroll) {
      committedScrollLeftRef.current = 0;
      applyScrollLeftPx(0, "program");
      return;
    }

    const vw = tier.clientWidth;
    const prevVw = prevViewportWidthPxRef.current;
    prevViewportWidthPxRef.current = vw;
    const liveSl = tier.scrollLeft;
    let targetSl = committedScrollLeftRef.current;

    const timelineChanged =
      prevTw > 0 && newTw > 0 && Math.abs(prevTw - newTw) > 0.5;
    const viewportChanged =
      prevVw > 0 && vw > 0 && Math.abs(prevVw - vw) > 1;

    if ((timelineChanged || viewportChanged) && dur > 0 && vw > 0) {
      const effectivePrevVw = prevVw > 0 ? prevVw : vw;
      const effectivePrevTw = timelineChanged ? prevTw : newTw;
      const centerPx = liveSl + effectivePrevVw / 2;
      const centerTimeSec = (centerPx / Math.max(effectivePrevTw, 1)) * dur;
      targetSl = scrollPxCenterTimeInViewport({
        timeSec: centerTimeSec,
        timelineWidthPx: newTw,
        durationSec: dur,
        viewportWidthPx: vw,
      });
    } else {
      const maxSl = Math.max(0, newTw - vw);
      targetSl = Math.min(maxSl, Math.max(0, committedScrollLeftRef.current));
    }

    applyScrollLeftPx(targetSl, "program");
  }, [
    args.mediaUrl,
    args.timelineWidthPx,
    args.waveformReady,
    args.mediaDurationSec,
    args.pxPerSec,
    tierScrollMetrics.clientWidthPx,
  ]);

  useEffect(
    () => () => {
      smoothScrollCleanupRef.current?.();
      smoothScrollCleanupRef.current = null;
    },
    [],
  );

  return {
    ...api,
    tierScrollLayout: {
      scrollLeftPx: tierScrollMetrics.scrollLeftPx,
      clientWidthPx: tierScrollMetrics.clientWidthPx,
    },
    tierScrollLive: {
      scrollLeftRef: tierScrollMetrics.liveScrollLeftRef,
      clientWidthRef: tierScrollMetrics.liveClientWidthRef,
    },
  };
}
