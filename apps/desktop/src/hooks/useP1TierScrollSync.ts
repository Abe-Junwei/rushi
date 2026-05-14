import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { useProjectWaveform } from "./useProjectWaveform";

type WfApi = ReturnType<typeof useProjectWaveform>;

export function useP1TierScrollSync(args: {
  tierScrollRef: React.RefObject<HTMLDivElement | null>;
  timelineWidthPx: number;
  wfApiRef: React.MutableRefObject<WfApi>;
  mediaUrl: string | null;
  selectedIdx: number;
  /** 语段行数：异步补行后触发 scrollIntoView 对齐 */
  segmentRowCount: number;
}) {
  const scrollSyncingRef = useRef(false);
  const tierScrollLayoutRafRef = useRef(0);

  const [tierScrollLayout, setTierScrollLayout] = useState({ scrollLeft: 0, clientWidth: 400 });

  const refreshTierScrollLayout = useCallback(() => {
    const el = args.tierScrollRef.current;
    if (!el) return;
    const sl = el.scrollLeft;
    const cw = el.clientWidth;
    setTierScrollLayout((prev) =>
      prev.scrollLeft === sl && prev.clientWidth === cw ? prev : { scrollLeft: sl, clientWidth: cw },
    );
  }, [args.tierScrollRef]);

  const setTierScrollPx = useCallback(
    (px: number) => {
      const tier = args.tierScrollRef.current;
      const w = args.wfApiRef.current;
      if (!tier || !w.isReady) return;
      scrollSyncingRef.current = true;
      try {
        const maxSl = Math.max(0, args.timelineWidthPx - tier.clientWidth);
        const sl = Math.max(0, Math.min(maxSl, px));
        tier.scrollLeft = sl;
        w.setScrollLeft(sl);
      } finally {
        scrollSyncingRef.current = false;
        refreshTierScrollLayout();
      }
    },
    [args.timelineWidthPx, args.tierScrollRef, args.wfApiRef, refreshTierScrollLayout],
  );

  const seekFromTierClientX = useCallback(
    (clientX: number) => {
      const w = args.wfApiRef.current;
      if (!w.isReady || (w.duration || 0) <= 0) return;
      const t = w.clientXToTimeSec(clientX);
      w.seek(t);
    },
    [args.wfApiRef],
  );

  const onPickAbsoluteTime = useCallback(
    (t: number, mode: "seek" | "seekAndCenterViewport") => {
      const w = args.wfApiRef.current;
      const d = w.duration || 0;
      if (d <= 0) return;
      const clamped = Math.max(0, Math.min(d, t));
      w.seek(clamped);
      if (mode === "seekAndCenterViewport") {
        const tier = args.tierScrollRef.current;
        if (!tier) return;
        const tw = Math.max(args.timelineWidthPx, 1);
        const vw = tier.clientWidth;
        const targetScroll = (clamped / d) * tw - vw / 2;
        setTierScrollPx(targetScroll);
      }
    },
    [args.timelineWidthPx, args.tierScrollRef, args.wfApiRef, setTierScrollPx],
  );

  const onTierScroll = useCallback(() => {
    const tier = args.tierScrollRef.current;
    if (!tier) return;
    const sl = tier.scrollLeft;
    const w = args.wfApiRef.current;
    if (w.isReady && !scrollSyncingRef.current) {
      scrollSyncingRef.current = true;
      try {
        if (Math.abs(w.getScrollLeft() - sl) > 0.01) w.setScrollLeft(sl);
      } finally {
        scrollSyncingRef.current = false;
      }
    }
    if (tierScrollLayoutRafRef.current) cancelAnimationFrame(tierScrollLayoutRafRef.current);
    tierScrollLayoutRafRef.current = requestAnimationFrame(() => {
      tierScrollLayoutRafRef.current = 0;
      const cw = tier.clientWidth;
      setTierScrollLayout((prev) =>
        prev.scrollLeft === sl && prev.clientWidth === cw ? prev : { scrollLeft: sl, clientWidth: cw },
      );
    });
  }, [args.tierScrollRef, args.wfApiRef]);

  useEffect(() => {
    refreshTierScrollLayout();
  }, [args.timelineWidthPx, args.mediaUrl, refreshTierScrollLayout]);

  useEffect(() => {
    const el = args.tierScrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => refreshTierScrollLayout());
    ro.observe(el);
    return () => ro.disconnect();
  }, [args.tierScrollRef, args.mediaUrl, refreshTierScrollLayout]);

  useEffect(
    () => () => {
      if (tierScrollLayoutRafRef.current) cancelAnimationFrame(tierScrollLayoutRafRef.current);
    },
    [],
  );

  useEffect(() => {
    const tier = args.tierScrollRef.current;
    if (tier) tier.scrollLeft = 0;
  }, [args.mediaUrl, args.tierScrollRef]);

  useLayoutEffect(() => {
    const root = args.tierScrollRef.current;
    if (!root) return;
    const el = root.querySelector<HTMLElement>(`[data-p1-seg-row="${args.selectedIdx}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [args.selectedIdx, args.tierScrollRef, args.segmentRowCount]);

  return {
    onTierScroll,
    setTierScrollPx,
    tierScrollLayout,
    refreshTierScrollLayout,
    seekFromTierClientX,
    onPickAbsoluteTime,
  };
}
