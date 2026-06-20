import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { scheduleTierScrollFrame } from "../utils/tierScrollFrameCoordinator";

export type TierScrollLayout = {
  scrollLeftPx: number;
  clientWidthPx: number;
};

export type UseTierScrollLayoutResult = TierScrollLayout & {
  /** Re-read scrollLeft/clientWidth from the tier element (e.g. after viewport resize). */
  refreshLayout: () => void;
  /** Schedule a deferred layout commit (wheel-forward / imperative scroll without `scroll`). */
  notifyScrollActivity: () => void;
  /** Live DOM scroll — updated synchronously on scroll / programmatic writes. */
  liveScrollLeftRef: RefObject<number>;
  liveClientWidthRef: RefObject<number>;
};

export type UseTierScrollLayoutOptions = {
  burstMs?: number;
  shouldCommitScrollLayout?: () => boolean;
};

const DEFAULT_BURST_MS = 120;

/** Read tier scroll metrics: scroll burst rAF + window/element resize; viewport width via refreshLayout. */
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
  const notifyScrollActivityRef = useRef<() => void>(() => {});

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
      setLayout((prev) => {
        if (prev.scrollLeftPx === next.scrollLeftPx && prev.clientWidthPx === next.clientWidthPx) {
          return prev;
        }
        scheduleTierScrollFrame();
        return next;
      });
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
      if (!raf) raf = requestAnimationFrame(loop);
    };
    notifyScrollActivityRef.current = scheduleBurst;

    readLayout();
    el.addEventListener("scroll", scheduleBurst, { passive: true });
    const onWindowResize = () => {
      updateRefs();
      commitLayout({ force: true });
    };
    window.addEventListener("resize", onWindowResize);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        updateRefs();
        commitLayout({ force: true });
      });
      ro.observe(el);
    }

    return () => {
      cancelled = true;
      el.removeEventListener("scroll", scheduleBurst);
      window.removeEventListener("resize", onWindowResize);
      ro?.disconnect();
      if (raf) cancelAnimationFrame(raf);
      readLayoutRef.current = () => {};
      notifyScrollActivityRef.current = () => {};
    };
  }, [tierScrollRef, burstMs]);

  const refreshLayout = useCallback(() => {
    readLayoutRef.current();
  }, []);

  const notifyScrollActivity = useCallback(() => {
    notifyScrollActivityRef.current();
  }, []);

  return {
    scrollLeftPx: layout.scrollLeftPx,
    clientWidthPx: layout.clientWidthPx,
    refreshLayout,
    notifyScrollActivity,
    liveScrollLeftRef,
    liveClientWidthRef,
  };
}
