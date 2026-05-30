import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react";

export type TierScrollLayout = {
  scrollLeftPx: number;
  clientWidthPx: number;
};

export type UseTierScrollLayoutResult = TierScrollLayout & {
  /** Re-read scrollLeft/clientWidth from the tier element (e.g. after viewport resize). */
  refreshLayout: () => void;
  /** Live DOM scroll — updated synchronously on scroll / programmatic writes. */
  liveScrollLeftRef: RefObject<number>;
  liveClientWidthRef: RefObject<number>;
};

export type UseTierScrollLayoutOptions = {
  burstMs?: number;
  resyncDeps?: readonly unknown[];
};

const DEFAULT_BURST_MS = 120;

/** Read tier scroll metrics: scroll burst rAF + window resize; viewport width via refreshLayout. */
export function useTierScrollLayout(
  tierScrollRef: RefObject<HTMLElement | null>,
  options?: UseTierScrollLayoutOptions,
): UseTierScrollLayoutResult {
  const burstMs = options?.burstMs ?? DEFAULT_BURST_MS;
  const resyncDeps = options?.resyncDeps ?? [];
  const liveScrollLeftRef = useRef(0);
  const liveClientWidthRef = useRef(0);
  const [layout, setLayout] = useState<TierScrollLayout>({
    scrollLeftPx: 0,
    clientWidthPx: 0,
  });
  const readLayoutRef = useRef<() => void>(() => {});

  useLayoutEffect(() => {
    const el = tierScrollRef.current;
    if (!el) return;

    let raf = 0;
    let activeUntil = 0;

    const readLayout = () => {
      liveScrollLeftRef.current = el.scrollLeft;
      liveClientWidthRef.current = el.clientWidth;
      const next = {
        scrollLeftPx: liveScrollLeftRef.current,
        clientWidthPx: liveClientWidthRef.current,
      };
      setLayout((prev) =>
        prev.scrollLeftPx === next.scrollLeftPx && prev.clientWidthPx === next.clientWidthPx ? prev : next,
      );
    };
    readLayoutRef.current = readLayout;

    const loop = () => {
      raf = 0;
      readLayout();
      if (performance.now() < activeUntil) {
        raf = requestAnimationFrame(loop);
      }
    };

    const scheduleBurst = () => {
      activeUntil = performance.now() + burstMs;
      readLayout();
      if (!raf) raf = requestAnimationFrame(loop);
    };

    readLayout();
    el.addEventListener("scroll", scheduleBurst, { passive: true });
    window.addEventListener("resize", scheduleBurst);

    return () => {
      el.removeEventListener("scroll", scheduleBurst);
      window.removeEventListener("resize", scheduleBurst);
      if (raf) cancelAnimationFrame(raf);
      readLayoutRef.current = () => {};
    };
  }, [tierScrollRef, burstMs]);

  useLayoutEffect(() => {
    const el = tierScrollRef.current;
    if (!el) return;
    setLayout((prev) => {
      const next = { scrollLeftPx: el.scrollLeft, clientWidthPx: el.clientWidth };
      return prev.scrollLeftPx === next.scrollLeftPx && prev.clientWidthPx === next.clientWidthPx ? prev : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- layout drivers
  }, [tierScrollRef, ...resyncDeps]);

  const refreshLayout = useCallback(() => {
    readLayoutRef.current();
  }, []);

  return {
    scrollLeftPx: layout.scrollLeftPx,
    clientWidthPx: layout.clientWidthPx,
    refreshLayout,
    liveScrollLeftRef,
    liveClientWidthRef,
  };
}

export function readTierScrollLayout(tier: HTMLElement): TierScrollLayout {
  return { scrollLeftPx: tier.scrollLeft, clientWidthPx: tier.clientWidth };
}
