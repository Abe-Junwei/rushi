import { useLayoutEffect, useState, type RefObject } from "react";

/** 订阅元素 clientHeight（ResizeObserver）；不可用时回落 0。 */
export function useViewportHeight(ref: RefObject<HTMLElement | null>): number {
  const [height, setHeight] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const sync = () => setHeight(el.clientHeight);
    sync();

    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return height;
}
