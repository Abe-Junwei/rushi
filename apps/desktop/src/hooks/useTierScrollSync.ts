import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { afterSmoothScrollEnd } from "../utils/tierScrollSmooth";
import { WAVEFORM_SCROLL_SYNC_EPSILON_PX } from "../utils/waveformScrollSync";
import type { useProjectWaveform } from "./useProjectWaveform";

type WfApi = ReturnType<typeof useProjectWaveform>;

/** tier = 用户滚动/程序化定位；waveform = WaveSurfer 播放 autoScroll 等内部滚动。 */
type ScrollApplySource = "tier" | "waveform" | "program";

export function useTierScrollSync(args: {
  tierScrollRef: React.RefObject<HTMLDivElement | null>;
  timelineWidthPx: number;
  wfApiRef: React.MutableRefObject<WfApi>;
  waveformReady: boolean;
  mediaUrl: string | null;
}) {
  const argsRef = useRef(args);
  argsRef.current = args;

  const committedScrollLeftRef = useRef(0);
  const prevMediaUrlRef = useRef(args.mediaUrl);
  const smoothScrollCleanupRef = useRef<(() => void) | null>(null);

  const [tierScrollLayout, setTierScrollLayout] = useState({ clientWidth: 400 });

  const applyScrollLeftPx = (px: number, source: ScrollApplySource) => {
    const a = argsRef.current;
    const tier = a.tierScrollRef.current;
    if (!tier) return;
    const vw = tier.clientWidth;
    const maxSl = Math.max(0, a.timelineWidthPx - vw);
    const sl = Math.max(0, Math.min(maxSl, px));
    const w = a.wfApiRef.current;
    const shouldSyncWaveform = source !== "waveform" && w.isReady && Math.abs(w.getScrollLeft() - sl) > WAVEFORM_SCROLL_SYNC_EPSILON_PX;
    if (
      !shouldSyncWaveform &&
      Math.abs(committedScrollLeftRef.current - sl) < WAVEFORM_SCROLL_SYNC_EPSILON_PX &&
      Math.abs(tier.scrollLeft - sl) < WAVEFORM_SCROLL_SYNC_EPSILON_PX
    ) {
      return;
    }
    if (Math.abs(tier.scrollLeft - sl) > WAVEFORM_SCROLL_SYNC_EPSILON_PX) {
      tier.scrollLeft = sl;
    }
    committedScrollLeftRef.current = sl;
    setTierScrollLayout((prev) => (prev.clientWidth === vw ? prev : { clientWidth: vw }));
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
        applyScrollLeftPx(scrollLeft, "waveform");
      },
      refreshTierScrollLayout: () => {
        const el = argsRef.current.tierScrollRef.current;
        if (!el) return;
        committedScrollLeftRef.current = el.scrollLeft;
        const vw = el.clientWidth;
        setTierScrollLayout((prev) => (prev.clientWidth === vw ? prev : { clientWidth: vw }));
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
    [],
  );

  useLayoutEffect(() => {
    const a = argsRef.current;
    const tier = a.tierScrollRef.current;
    if (!tier || !a.waveformReady) return;
    const maxSl = Math.max(0, a.timelineWidthPx - tier.clientWidth);
    const isMediaUrlChange = prevMediaUrlRef.current !== a.mediaUrl;
    prevMediaUrlRef.current = a.mediaUrl;
    // waveformReady 首次变为 true 时，优先用 WS 当前 scroll 而非旧的 committedScrollLeft，
    // 防止 WS 重新 mount 后 tier 被拉到上一个音频的位置。
    const wsScroll = a.wfApiRef.current.isReady ? a.wfApiRef.current.getScrollLeft() : 0;
    const sl = isMediaUrlChange
      ? 0
      : Math.min(maxSl, Math.max(0, committedScrollLeftRef.current === 0 ? wsScroll : committedScrollLeftRef.current));
    if (isMediaUrlChange) {
      committedScrollLeftRef.current = 0;
    }
    applyScrollLeftPx(sl, "program");
  }, [args.mediaUrl, args.timelineWidthPx, args.waveformReady]);

  useEffect(() => {
    api.refreshTierScrollLayout();
  }, [api, args.timelineWidthPx, args.mediaUrl]);

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

  // mediaUrl 变更时的 scroll 重置已合并到上面的 useLayoutEffect 中

  return {
    ...api,
    tierScrollLayout,
  };
}
