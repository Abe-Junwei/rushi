import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { afterSmoothScrollEnd } from "../utils/tierScrollSmooth";
import { clampTimelineScrollLeftPx, WAVEFORM_SCROLL_SYNC_EPSILON_PX } from "../utils/waveformScrollSync";
import { scrollPxCenterTimeInViewport } from "../utils/waveformProjection";
import type { useProjectWaveform } from "./useProjectWaveform";
import { useTierScrollLayout, type TierScrollLayout } from "./useTierScrollLayout";
import {
  useTierScrollProgrammaticWrites,
  type PendingProgrammaticScrollWrite,
} from "./tierScrollProgrammaticWrites";
import { useTierScrollResizeEffect } from "./useTierScrollResizeEffect";

export type { TierScrollLayout };

type WfApi = ReturnType<typeof useProjectWaveform>;

type ScrollApplySource = "tier" | "program";
type SetTierScrollOptions = {
  timelineWidthPx?: number;
  deferLayoutCommit?: boolean;
  immediate?: boolean;
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
  const programmaticWrites = useTierScrollProgrammaticWrites();

  const tierScrollMetrics = useTierScrollLayout(args.tierScrollRef, {
    shouldCommitScrollLayout: () =>
      performance.now() >= programmaticWrites.deferredLayoutCommitUntilRef.current,
  });

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

  const syncScrollFromTierDom = () => {
    const tier = argsRef.current.tierScrollRef.current;
    if (!tier) return;
    const sl = tier.scrollLeft;
    committedScrollLeftRef.current = sl;
    tierScrollMetrics.liveScrollLeftRef.current = sl;
    tierScrollMetrics.liveClientWidthRef.current = tier.clientWidth;
    mirrorWaveSurferScroll(sl);
  };

  const commitScrollLeftPx = useCallback(
    (
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
          programmaticWrites.markProgrammaticScroll();
        }
        if (options?.deferLayoutCommit) {
          programmaticWrites.markDeferredLayoutCommit();
        }
        tier.scrollLeft = sl;
      }
      committedScrollLeftRef.current = sl;
      tierScrollMetrics.liveScrollLeftRef.current = sl;
      tierScrollMetrics.liveClientWidthRef.current = vw;
      mirrorWaveSurferScroll(sl);
    },
    [programmaticWrites, tierScrollMetrics.liveClientWidthRef, tierScrollMetrics.liveScrollLeftRef],
  );

  const commitPendingProgrammaticScroll = useCallback(
    (pending: PendingProgrammaticScrollWrite) => {
      commitScrollLeftPx(pending.scrollLeftPx, "program", {
        deferLayoutCommit: pending.deferLayoutCommit,
      });
    },
    [commitScrollLeftPx],
  );

  const applyScrollLeftPx = useCallback(
    (px: number, source: ScrollApplySource, options?: SetTierScrollOptions) => {
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
        programmaticWrites.queueProgrammaticScroll(
          sl,
          options?.deferLayoutCommit === true,
          commitPendingProgrammaticScroll,
        );
        return;
      }
      commitScrollLeftPx(sl, source, { deferLayoutCommit: options?.deferLayoutCommit });
    },
    [commitPendingProgrammaticScroll, commitScrollLeftPx, programmaticWrites],
  );

  const api = useMemo(
    () => ({
      onTierScroll: () => {
        syncScrollFromTierDom();
        if (performance.now() >= programmaticWrites.deferredLayoutCommitUntilRef.current) {
          tierScrollMetrics.refreshLayout();
        }
        const suppressRef = argsRef.current.playbackFollowSuppressUntilRef;
        if (suppressRef && performance.now() >= programmaticWrites.programmaticScrollUntilRef.current) {
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
        programmaticWrites.flushPendingProgrammaticScroll(commitPendingProgrammaticScroll);
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
    [
      applyScrollLeftPx,
      commitPendingProgrammaticScroll,
      programmaticWrites,
      tierScrollMetrics.liveClientWidthRef,
      tierScrollMetrics.liveScrollLeftRef,
      tierScrollMetrics.refreshLayout,
    ],
  );

  useLayoutEffect(() => {
    const a = argsRef.current;
    const isMediaUrlChange = prevMediaUrlResetOnlyRef.current !== a.mediaUrl;
    if (!isMediaUrlChange) return;
    prevMediaUrlResetOnlyRef.current = a.mediaUrl;
    committedScrollLeftRef.current = 0;
    tierScrollMetrics.liveScrollLeftRef.current = 0;
    programmaticWrites.resetOnMediaUrlChange(a.tierScrollRef.current);
  }, [args.mediaUrl, programmaticWrites, tierScrollMetrics.liveScrollLeftRef]);

  useTierScrollResizeEffect({
    mediaUrl: args.mediaUrl,
    timelineWidthPx: args.timelineWidthPx,
    waveformReady: args.waveformReady,
    mediaDurationSec: args.mediaDurationSec,
    pxPerSec: args.pxPerSec,
    clientWidthPx: tierScrollMetrics.clientWidthPx,
    tierScrollRef: args.tierScrollRef,
    committedScrollLeftRef,
    prevMediaUrlRef,
    prevMediaDurationSecRef,
    prevTimelineWidthPxRef,
    prevViewportWidthPxRef,
    programmaticWrites,
    applyScrollLeftPx,
  });

  useEffect(
    () => () => {
      smoothScrollCleanupRef.current?.();
      smoothScrollCleanupRef.current = null;
      programmaticWrites.cancelPending();
    },
    [programmaticWrites],
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
