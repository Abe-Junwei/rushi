import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { afterSmoothScrollEnd } from "../utils/tierScrollSmooth";
import { clampTimelineScrollLeftPx, WAVEFORM_SCROLL_SYNC_EPSILON_PX } from "../utils/waveformScrollSync";
import { scrollPxCenterTimeInViewport } from "../utils/waveformProjection";
import type { useProjectWaveform } from "./useProjectWaveform";
import { useTierScrollLayout, type TierScrollLayout } from "./useTierScrollLayout";

export type { TierScrollLayout };

type WfApi = ReturnType<typeof useProjectWaveform>;

type ScrollApplySource = "tier" | "program";
type SetTierScrollOptions = {
  timelineWidthPx?: number;
  deferLayoutCommit?: boolean;
  immediate?: boolean;
};
type PendingProgrammaticScrollWrite = {
  scrollLeftPx: number;
  deferLayoutCommit: boolean;
};

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
  const deferredLayoutCommitUntilRef = useRef(0);
  const programmaticScrollRafRef = useRef(0);
  const pendingProgrammaticScrollRef = useRef<PendingProgrammaticScrollWrite | null>(null);

  const tierScrollMetrics = useTierScrollLayout(args.tierScrollRef, {
    shouldCommitScrollLayout: () => performance.now() >= deferredLayoutCommitUntilRef.current,
  });

  useLayoutEffect(() => {
    tierScrollMetrics.refreshLayout();
  }, [
    args.timelineWidthPx,
    args.mediaUrl,
    args.waveformReady,
    args.mediaDurationSec,
    args.pxPerSec,
    tierScrollMetrics.clientWidthPx,
    tierScrollMetrics.refreshLayout,
  ]);

  const mirrorWaveSurferScroll = (scrollLeftPx: number) => {
    const a = argsRef.current;
    if (!a.waveformReady) return;
    const sync = a.wfApiRef.current?.syncWaveSurferScrollPx;
    if (typeof sync === "function") sync(scrollLeftPx);
  };

  const syncScrollFromTierDom = () => {
    const tier = argsRef.current.tierScrollRef.current;
    if (!tier) return;
    const sl = tier.scrollLeft;
    committedScrollLeftRef.current = sl;
    tierScrollMetrics.liveScrollLeftRef.current = sl;
    tierScrollMetrics.liveClientWidthRef.current = tier.clientWidth;
    mirrorWaveSurferScroll(sl);
  };

  const commitScrollLeftPx = (
    sl: number,
    source: ScrollApplySource,
    options?: Pick<SetTierScrollOptions, "deferLayoutCommit">,
  ) => {
    const a = argsRef.current;
    const tier = a.tierScrollRef.current;
    if (!tier) return;
    const vw = tier.clientWidth;
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
      if (options?.deferLayoutCommit) {
        deferredLayoutCommitUntilRef.current = performance.now() + 120;
      }
      tier.scrollLeft = sl;
    }
    committedScrollLeftRef.current = sl;
    tierScrollMetrics.liveScrollLeftRef.current = sl;
    tierScrollMetrics.liveClientWidthRef.current = vw;
    mirrorWaveSurferScroll(sl);
  };

  const flushPendingProgrammaticScroll = () => {
    programmaticScrollRafRef.current = 0;
    const pending = pendingProgrammaticScrollRef.current;
    pendingProgrammaticScrollRef.current = null;
    if (!pending) return;
    commitScrollLeftPx(pending.scrollLeftPx, "program", {
      deferLayoutCommit: pending.deferLayoutCommit,
    });
  };

  const queueProgrammaticScroll = (scrollLeftPx: number, deferLayoutCommit: boolean) => {
    pendingProgrammaticScrollRef.current = { scrollLeftPx, deferLayoutCommit };
    if (programmaticScrollRafRef.current) return;
    programmaticScrollRafRef.current = requestAnimationFrame(() => {
      flushPendingProgrammaticScroll();
    });
  };

  const applyScrollLeftPx = (px: number, source: ScrollApplySource, options?: SetTierScrollOptions) => {
    const a = argsRef.current;
    const tier = a.tierScrollRef.current;
    if (!tier) return;
    const vw = tier.clientWidth;
    const timelineWidthPx = options?.timelineWidthPx ?? a.timelineWidthPx;
    const sl = clampTimelineScrollLeftPx({
      scrollLeftPx: px,
      timelineWidthPx,
      viewportWidthPx: vw,
    });
    if (source === "program" && !options?.immediate) {
      queueProgrammaticScroll(sl, options?.deferLayoutCommit === true);
      return;
    }
    commitScrollLeftPx(sl, source, { deferLayoutCommit: options?.deferLayoutCommit });
  };

  const api = useMemo(
    () => ({
      onTierScroll: () => {
        syncScrollFromTierDom();
        if (performance.now() >= deferredLayoutCommitUntilRef.current) {
          tierScrollMetrics.refreshLayout();
        }
        const suppressRef = argsRef.current.playbackFollowSuppressUntilRef;
        if (suppressRef && performance.now() >= programmaticScrollUntilRef.current) {
          suppressRef.current = performance.now() + 2500;
        }
      },
      setTierScrollPx: (px: number, options?: SetTierScrollOptions) => {
        applyScrollLeftPx(px, "program", options);
      },
      setTierScrollPxSmooth: (px: number) => {
        const tier = argsRef.current.tierScrollRef.current;
        if (!tier) return;
        const vw = tier.clientWidth;
        const sl = clampTimelineScrollLeftPx({
          scrollLeftPx: px,
          timelineWidthPx: argsRef.current.timelineWidthPx,
          viewportWidthPx: vw,
        });
        smoothScrollCleanupRef.current?.();
        smoothScrollCleanupRef.current = null;
        if (typeof tier.scrollTo !== "function") {
          applyScrollLeftPx(sl, "program", { immediate: true });
          return;
        }
        tier.scrollTo({ left: sl, behavior: "smooth" });
        smoothScrollCleanupRef.current = afterSmoothScrollEnd(tier, (finalSl) => {
          smoothScrollCleanupRef.current = null;
          applyScrollLeftPx(finalSl, "program", { immediate: true });
        });
      },
      refreshTierScrollLayout: () => {
        flushPendingProgrammaticScroll();
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
        applyScrollLeftPx(targetScroll, "program", { immediate: true });
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
    pendingProgrammaticScrollRef.current = null;
    if (programmaticScrollRafRef.current) {
      cancelAnimationFrame(programmaticScrollRafRef.current);
      programmaticScrollRafRef.current = 0;
    }
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
      applyScrollLeftPx(0, "program", { immediate: true });
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

    if (timelineChanged && dur > 0 && vw > 0) {
      const maxSl = Math.max(0, newTw - vw);
      const hasPendingProgrammaticScroll = pendingProgrammaticScrollRef.current != null;
      const recentProgrammaticScroll = performance.now() < programmaticScrollUntilRef.current;
      if (hasPendingProgrammaticScroll || recentProgrammaticScroll) {
        targetSl = Math.min(maxSl, Math.max(0, liveSl));
      } else {
        const effectivePrevVw = prevVw > 0 ? prevVw : vw;
        const centerPx = liveSl + effectivePrevVw / 2;
        const centerTimeSec = (centerPx / Math.max(prevTw, 1)) * dur;
        targetSl = scrollPxCenterTimeInViewport({
          timeSec: centerTimeSec,
          timelineWidthPx: newTw,
          durationSec: dur,
          viewportWidthPx: vw,
        });
      }
    } else if (viewportChanged && dur > 0 && vw > 0) {
      const effectivePrevVw = prevVw > 0 ? prevVw : vw;
      const centerPx = liveSl + effectivePrevVw / 2;
      const centerTimeSec = (centerPx / Math.max(newTw, 1)) * dur;
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

    applyScrollLeftPx(targetSl, "program", { immediate: true });
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
      pendingProgrammaticScrollRef.current = null;
      if (programmaticScrollRafRef.current) {
        cancelAnimationFrame(programmaticScrollRafRef.current);
        programmaticScrollRafRef.current = 0;
      }
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
