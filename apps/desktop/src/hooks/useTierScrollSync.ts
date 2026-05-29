import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { afterSmoothScrollEnd } from "../utils/tierScrollSmooth";
import {
  WAVEFORM_SCROLL_REVERSE_SYNC_EPSILON_PX,
  WAVEFORM_SCROLL_SYNC_EPSILON_PX,
} from "../utils/waveformScrollSync";
import type { useProjectWaveform } from "./useProjectWaveform";
import { useTierScrollLayout, type TierScrollLayout } from "./useTierScrollLayout";

export type { TierScrollLayout };

type WfApi = ReturnType<typeof useProjectWaveform>;

/** tier = 用户滚动/程序化定位；waveform = WaveSurfer 播放 autoScroll 等内部滚动。 */
type ScrollApplySource = "tier" | "waveform" | "program";

export function useTierScrollSync(args: {
  tierScrollRef: React.RefObject<HTMLDivElement | null>;
  timelineWidthPx: number;
  wfApiRef: React.MutableRefObject<WfApi>;
  waveformReady: boolean;
  mediaUrl: string | null;
  /** ADR-0005: canvas peaks — tier-only scroll, no WS read/write. */
  peaksCanvasActive: boolean;
}) {
  const argsRef = useRef(args);
  argsRef.current = args;

  const committedScrollLeftRef = useRef(0);
  const prevMediaUrlRef = useRef(args.mediaUrl);
  const smoothScrollCleanupRef = useRef<(() => void) | null>(null);

  const tierScrollMetrics = useTierScrollLayout(args.tierScrollRef, {
    resyncDeps: [args.timelineWidthPx, args.mediaUrl, args.waveformReady],
  });

  const applyScrollLeftPx = (px: number, source: ScrollApplySource) => {
    const a = argsRef.current;
    const tier = a.tierScrollRef.current;
    if (!tier) return;
    const vw = tier.clientWidth;
    const maxSl = Math.max(0, a.timelineWidthPx - vw);
    const sl = Math.max(0, Math.min(maxSl, px));
    const w = a.wfApiRef.current;
    const shouldSyncWaveform =
      !a.peaksCanvasActive &&
      source !== "waveform" &&
      w.isReady &&
      Math.abs(w.getScrollLeft() - sl) > WAVEFORM_SCROLL_SYNC_EPSILON_PX;
    if (
      !shouldSyncWaveform &&
      Math.abs(committedScrollLeftRef.current - sl) < WAVEFORM_SCROLL_SYNC_EPSILON_PX &&
      Math.abs(tier.scrollLeft - sl) < WAVEFORM_SCROLL_SYNC_EPSILON_PX
    ) {
      return;
    }
    const writeEpsilon =
      source === "waveform"
        ? WAVEFORM_SCROLL_REVERSE_SYNC_EPSILON_PX
        : WAVEFORM_SCROLL_SYNC_EPSILON_PX;
    if (Math.abs(tier.scrollLeft - sl) > writeEpsilon) {
      tier.scrollLeft = sl;
    }
    committedScrollLeftRef.current = sl;
    if (shouldSyncWaveform) {
      w.setScrollLeft(sl);
    }
  };

  const api = useMemo(
    () => ({
      onTierScroll: () => {
        const tier = argsRef.current.tierScrollRef.current;
        if (!tier) return;
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
      syncWaveformScrollPx: (scrollLeft: number) => {
        if (argsRef.current.peaksCanvasActive) return;
        applyScrollLeftPx(scrollLeft, "waveform");
      },
      refreshTierScrollLayout: () => {
        tierScrollMetrics.refreshLayout();
        const el = argsRef.current.tierScrollRef.current;
        if (!el) return;
        committedScrollLeftRef.current = el.scrollLeft;
      },
      seekFromTierClientX: (clientX: number) => {
        const w = argsRef.current.wfApiRef.current;
        if (!w.isReady || (w.duration || 0) <= 0) return;
        w.seek(w.clientXToTimeSec(clientX));
      },
      onPickAbsoluteTime: (t: number, mode: "seek" | "seekAndCenterViewport") => {
        const w = argsRef.current.wfApiRef.current;
        const d = w.duration || 0;
        if (d <= 0) return;
        const clamped = Math.max(0, Math.min(d, t));
        w.seek(clamped);
        if (mode !== "seekAndCenterViewport") return;
        const tier = argsRef.current.tierScrollRef.current;
        if (!tier) return;
        const tw = Math.max(argsRef.current.timelineWidthPx, 1);
        const targetScroll = (clamped / d) * tw - tier.clientWidth / 2;
        applyScrollLeftPx(targetScroll, "program");
      },
    }),
    [tierScrollMetrics.refreshLayout],
  );

  useLayoutEffect(() => {
    const a = argsRef.current;
    const tier = a.tierScrollRef.current;
    if (!tier || !a.waveformReady) return;
    const maxSl = Math.max(0, a.timelineWidthPx - tier.clientWidth);
    const isMediaUrlChange = prevMediaUrlRef.current !== a.mediaUrl;
    prevMediaUrlRef.current = a.mediaUrl;
    const wsScroll = a.wfApiRef.current.isReady ? a.wfApiRef.current.getScrollLeft() : 0;
    const sl = isMediaUrlChange
      ? 0
      : Math.min(
          maxSl,
          Math.max(
            0,
            a.peaksCanvasActive
              ? committedScrollLeftRef.current
              : committedScrollLeftRef.current === 0
                ? wsScroll
                : committedScrollLeftRef.current,
          ),
        );
    if (isMediaUrlChange) {
      committedScrollLeftRef.current = 0;
    }
    applyScrollLeftPx(sl, "program");
  }, [args.mediaUrl, args.timelineWidthPx, args.waveformReady]);

  useEffect(() => {
    const el = args.tierScrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => api.refreshTierScrollLayout());
    ro.observe(el);
    return () => ro.disconnect();
  }, [api, args.tierScrollRef, args.mediaUrl]);

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
  };
}
