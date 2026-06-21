import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { clampTimelineScrollLeftPx, WAVEFORM_SCROLL_SYNC_EPSILON_PX } from "../utils/waveformScrollSync";
import { registerTierScrollFrameMetricsSupplier, scheduleTierScrollFrame } from "../utils/tierScrollFrameCoordinator";
import { resolveTierViewportMetrics } from "../utils/waveformViewport";
import type { useProjectWaveform } from "./useProjectWaveform";
import { useTierScrollLayout, type TierScrollLayout } from "./useTierScrollLayout";
import { useTierScrollProgrammaticWrites, type PendingProgrammaticScrollWrite } from "./tierScrollProgrammaticWrites";
import { useTierScrollResizeEffect } from "./useTierScrollResizeEffect";
import { centerTierAtClientX, pickAbsoluteTimeInTierViewport, seekFromTierClientX } from "./tierScrollSeekActions";
import { useTierScrollWheelMotion } from "./useTierScrollWheelMotion";
import { useTierScrollDomActivity } from "./useTierScrollDomActivity";
import { useTierScrollMediaResetEffect } from "./useTierScrollMediaResetEffect";

export type { TierScrollLayout };

type WfApi = ReturnType<typeof useProjectWaveform>;

type ScrollApplySource = "tier" | "program";
type SetTierScrollOptions = { timelineWidthPx?: number; deferLayoutCommit?: boolean; immediate?: boolean };
type TransientScrollCancelReason = "selectionReveal" | "pointer" | "wheel" | "minimap" | "manualScroll" | "nativeScroll" | "resize" | "playback";

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
  const programmaticWrites = useTierScrollProgrammaticWrites();

  const tierScrollMetrics = useTierScrollLayout(args.tierScrollRef, {
    shouldCommitScrollLayout: () =>
      performance.now() >= programmaticWrites.deferredLayoutCommitUntilRef.current,
  });

  /* eslint-disable react-hooks/exhaustive-deps -- tierScrollMetrics is a stable hook-returned object; we list its granular callbacks/refs below */
  useLayoutEffect(() => {
    tierScrollMetrics.refreshLayout();
  }, [args.timelineWidthPx, args.mediaUrl, args.waveformReady, args.mediaDurationSec, args.pxPerSec, tierScrollMetrics.refreshLayout]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const scheduleViewportChromeFrame = () => {
    if (!argsRef.current.waveformReady) return;
    scheduleTierScrollFrame();
  };
  const extendPlaybackFollowSuppressForUserIntent = useCallback(() => {
    const suppressRef = argsRef.current.playbackFollowSuppressUntilRef;
    if (suppressRef) {
      suppressRef.current = performance.now() + 2500;
    }
  }, []);
  const suppressPlaybackFollowForScrollEvent = useCallback(() => {
    const suppressRef = argsRef.current.playbackFollowSuppressUntilRef;
    if (!suppressRef) return;
    if (programmaticWrites.isRecentPlaybackFollowScrollWrite()) return;
    if (programmaticWrites.isRecentProgrammaticScroll()) return;
    suppressRef.current = performance.now() + 2500;
  }, [programmaticWrites]);

  const syncScrollFromTierDom = () => {
    const tier = argsRef.current.tierScrollRef.current;
    if (!tier) return;
    const sl = tier.scrollLeft;
    committedScrollLeftRef.current = sl;
    tierScrollMetrics.liveScrollLeftRef.current = sl;
    tierScrollMetrics.liveClientWidthRef.current = tier.clientWidth;
    scheduleViewportChromeFrame();
  };

  /* eslint-disable react-hooks/exhaustive-deps -- programmaticWrites/tierScrollMetrics are stable hook-returned objects; only their referenced callbacks/refs affect identity */
  const commitScrollLeftPx = useCallback(
    (sl: number, source: ScrollApplySource, options?: Pick<SetTierScrollOptions, "deferLayoutCommit">) => {
      const a = argsRef.current;
      const tier = a.tierScrollRef.current;
      if (!tier) return;
      const vw = tier.clientWidth;
      if (
        Math.abs(committedScrollLeftRef.current - sl) < WAVEFORM_SCROLL_SYNC_EPSILON_PX &&
        Math.abs(tier.scrollLeft - sl) < WAVEFORM_SCROLL_SYNC_EPSILON_PX
      ) {
        scheduleViewportChromeFrame();
        return;
      }
      if (Math.abs(tier.scrollLeft - sl) > WAVEFORM_SCROLL_SYNC_EPSILON_PX) {
        if (source === "program") {
          if (options?.deferLayoutCommit) {
            programmaticWrites.markPlaybackFollowScrollWrite();
          } else {
            programmaticWrites.markProgrammaticScroll();
          }
        }
        if (options?.deferLayoutCommit) {
          programmaticWrites.markDeferredLayoutCommit();
        }
        tier.scrollLeft = sl;
      }
      committedScrollLeftRef.current = sl;
      tierScrollMetrics.liveScrollLeftRef.current = sl;
      tierScrollMetrics.liveClientWidthRef.current = vw;
      scheduleViewportChromeFrame();
      if (source === "program" && !options?.deferLayoutCommit) {
        tierScrollMetrics.refreshLayout();
      }
    },
    [programmaticWrites, tierScrollMetrics.liveClientWidthRef, tierScrollMetrics.liveScrollLeftRef, tierScrollMetrics.refreshLayout],
  );
  /* eslint-enable react-hooks/exhaustive-deps */

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
        programmaticWrites.queueProgrammaticScroll(sl, options?.deferLayoutCommit === true, commitPendingProgrammaticScroll);
        return;
      }
      commitScrollLeftPx(sl, source, { deferLayoutCommit: options?.deferLayoutCommit });
    },
    [commitPendingProgrammaticScroll, commitScrollLeftPx, programmaticWrites],
  );

  const { applyWheelScrollDelta, cancelWheelMotion } = useTierScrollWheelMotion({
    tierScrollRef: args.tierScrollRef,
    getTimelineWidthPx: () => argsRef.current.timelineWidthPx,
    commitWheelScrollFrame: (scrollLeftPx) => {
      applyScrollLeftPx(scrollLeftPx, "tier", { immediate: true });
      tierScrollActivityRef.current.notifyScrollActivity();
      extendPlaybackFollowSuppressForUserIntent();
    },
  });

  const cancelTransientScrollMotion = useCallback(
    (_reason: TransientScrollCancelReason) => {
      cancelWheelMotion();
      programmaticWrites.cancelPending();
    },
    [cancelWheelMotion, programmaticWrites],
  );

  const shouldCancelTransientMotionForNativeScroll = useCallback(() => {
    const tier = argsRef.current.tierScrollRef.current;
    if (!tier) return false;
    return Math.abs(tier.scrollLeft - committedScrollLeftRef.current) > WAVEFORM_SCROLL_SYNC_EPSILON_PX;
  }, []);

  const tierScrollActivityRef = useTierScrollDomActivity({
    tierScrollRef: args.tierScrollRef,
    syncScrollFromTierDom,
    notifyScrollActivity: tierScrollMetrics.notifyScrollActivity,
    suppressPlaybackFollowForScrollEvent,
    shouldCancelTransientScrollMotion: shouldCancelTransientMotionForNativeScroll,
    cancelTransientScrollMotion: () => cancelTransientScrollMotion("nativeScroll"),
    programmaticScrollUntilRef: programmaticWrites.programmaticScrollUntilRef,
  });

  const commitUserScrubScroll = useCallback(
    (px: number) => {
      cancelTransientScrollMotion("pointer");
      applyScrollLeftPx(px, "tier", { immediate: true });
      tierScrollActivityRef.current.notifyScrollActivity();
      extendPlaybackFollowSuppressForUserIntent();
    },
    [applyScrollLeftPx, cancelTransientScrollMotion, extendPlaybackFollowSuppressForUserIntent, tierScrollActivityRef],
  );

  /* eslint-disable react-hooks/exhaustive-deps -- programmaticWrites/tierScrollMetrics are stable hook-returned objects; suppressPlaybackFollowForUserScroll is a stable local callback */
  const api = useMemo(
    () => ({
      onTierScroll: () => {
        tierScrollActivityRef.current.syncScrollFromTierDom();
        tierScrollActivityRef.current.notifyScrollActivity();
        suppressPlaybackFollowForScrollEvent();
      },
      setTierScrollPx: (px: number, options?: SetTierScrollOptions) => {
        applyScrollLeftPx(px, "program", options);
      },
      revealSelectionScroll: (px: number, options?: { timelineWidthPx?: number }) => {
        cancelTransientScrollMotion("selectionReveal");
        applyScrollLeftPx(px, "program", {
          ...(options?.timelineWidthPx != null ? { timelineWidthPx: options.timelineWidthPx } : {}),
          immediate: true,
        });
      },
      minimapScrubScroll: (px: number) => {
        cancelTransientScrollMotion("minimap");
        applyScrollLeftPx(px, "program", { immediate: true });
      },
      playbackFollowScroll: (px: number) => {
        applyScrollLeftPx(px, "program", { deferLayoutCommit: true, immediate: true });
      },
      userScrubScroll: commitUserScrubScroll,
      applyWheelScrollDelta,
      cancelTransientScrollMotion,
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
        seekFromTierClientX(argsRef.current, clientX);
      },
      centerTierAtClientX: (clientX: number) => {
        centerTierAtClientX(argsRef.current, clientX, (scrollLeftPx) => {
          cancelTransientScrollMotion("pointer");
          applyScrollLeftPx(scrollLeftPx, "program", { immediate: true });
          tierScrollActivityRef.current.notifyScrollActivity();
          extendPlaybackFollowSuppressForUserIntent();
        });
      },
      onPickAbsoluteTime: (t: number, mode: "seek" | "seekAndCenterViewport") => {
        pickAbsoluteTimeInTierViewport(argsRef.current, t, mode, (scrollLeftPx) => {
          applyScrollLeftPx(scrollLeftPx, "program", { immediate: true });
        });
      },
    }),
    [
      applyScrollLeftPx, applyWheelScrollDelta, cancelTransientScrollMotion, commitUserScrubScroll,
      commitPendingProgrammaticScroll, programmaticWrites.programmaticScrollUntilRef,
      tierScrollMetrics.liveClientWidthRef, tierScrollMetrics.liveScrollLeftRef, tierScrollMetrics.refreshLayout,
    ],
  );

  useTierScrollMediaResetEffect({
    mediaUrl: args.mediaUrl,
    tierScrollRef: args.tierScrollRef,
    committedScrollLeftRef,
    liveScrollLeftRef: tierScrollMetrics.liveScrollLeftRef,
    prevMediaUrlResetOnlyRef,
    programmaticWrites,
  });

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
      cancelTransientScrollMotion("manualScroll");
      programmaticWrites.cancelPending();
    },
    [cancelTransientScrollMotion, programmaticWrites],
  );

  useEffect(() => {
    registerTierScrollFrameMetricsSupplier(() => {
      const tier = argsRef.current.tierScrollRef.current;
      if (!tier) return null;
      return resolveTierViewportMetrics({
        tierScrollEl: tier,
        tierScrollLive: tierScrollMetrics.liveScrollLeftRef
          ? { scrollLeftRef: tierScrollMetrics.liveScrollLeftRef, clientWidthRef: tierScrollMetrics.liveClientWidthRef }
          : undefined,
        tierScrollLayout: {
          scrollLeftPx: tierScrollMetrics.scrollLeftPx,
          clientWidthPx: tierScrollMetrics.clientWidthPx,
        },
      });
    });
    return () => registerTierScrollFrameMetricsSupplier(null);
  }, [tierScrollMetrics.clientWidthPx, tierScrollMetrics.liveClientWidthRef, tierScrollMetrics.liveScrollLeftRef, tierScrollMetrics.scrollLeftPx]);

  return {
    ...api,
    tierScrollLayout: { scrollLeftPx: tierScrollMetrics.scrollLeftPx, clientWidthPx: tierScrollMetrics.clientWidthPx },
    tierScrollLive: { scrollLeftRef: tierScrollMetrics.liveScrollLeftRef, clientWidthRef: tierScrollMetrics.liveClientWidthRef },
  };
}
