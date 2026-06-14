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
  shouldCommitScrollLayout?: () => boolean;
};

const DEFAULT_BURST_MS = 120;

/** Read tier scroll metrics: scroll burst rAF + window resize; viewport width via refreshLayout. */
export function useTierScrollLayout(
  tierScrollRef: RefObject<HTMLElement | null>,
  options?: UseTierScrollLayoutOptions,
): UseTierScrollLayoutResult {
  const burstMs = options?.burstMs ?? DEFAULT_BURST_MS;
  const liveScrollLeftRef = useRef(0);
  const liveClientWidthRef = useRef(0);
  const shouldCommitScrollLayoutRef = useRef(options?.shouldCommitScrollLayout);
  shouldCommitScrollLayoutRef.current = options?.shouldCommitScrollLayout;
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
    let cancelled = false;

    const updateRefs = () => {
      liveScrollLeftRef.current = el.scrollLeft;
      liveClientWidthRef.current = el.clientWidth;
    };

    const canCommitLayout = () => shouldCommitScrollLayoutRef.current?.() !== false;

    const commitLayout = (options?: { force?: boolean }) => {
      if (!options?.force && !canCommitLayout()) return;
      const next = {
        scrollLeftPx: liveScrollLeftRef.current,
        clientWidthPx: liveClientWidthRef.current,
      };
      setLayout((prev) =>
        prev.scrollLeftPx === next.scrollLeftPx && prev.clientWidthPx === next.clientWidthPx ? prev : next,
      );
    };

    const readLayout = () => {
      updateRefs();
      commitLayout({ force: true });
    };
    readLayoutRef.current = readLayout;

    const loop = () => {
      raf = 0;
      updateRefs();
      if (!cancelled && performance.now() < activeUntil) {
        raf = requestAnimationFrame(loop);
        return;
      }
      commitLayout();
    };

    const scheduleBurst = () => {
      activeUntil = performance.now() + burstMs;
      updateRefs();
      commitLayout();
      if (!raf) raf = requestAnimationFrame(loop);
    };

    readLayout();
    el.addEventListener("scroll", scheduleBurst, { passive: true });
    const onWindowResize = () => {
      updateRefs();
      commitLayout({ force: true });
    };
    window.addEventListener("resize", onWindowResize);

    return () => {
      cancelled = true;
      el.removeEventListener("scroll", scheduleBurst);
      window.removeEventListener("resize", onWindowResize);
      if (raf) cancelAnimationFrame(raf);
      readLayoutRef.current = () => {};
    };
  }, [tierScrollRef, burstMs]);

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
