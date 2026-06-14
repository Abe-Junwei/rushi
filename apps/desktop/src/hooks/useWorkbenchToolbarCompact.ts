import { useCallback, useEffect, useState } from "react";

/** 工具条可用宽度低于此值时收进「编辑 / 缩放」菜单。 */
export const WORKBENCH_TOOLBAR_COMPACT_BREAKPOINT_PX = 1024;

export function workbenchToolbarCompactMediaQuery(): string {
  return `(max-width: ${WORKBENCH_TOOLBAR_COMPACT_BREAKPOINT_PX - 1}px)`;
}

export function isWorkbenchToolbarCompactWidth(widthPx: number): boolean {
  return widthPx > 0 && widthPx < WORKBENCH_TOOLBAR_COMPACT_BREAKPOINT_PX;
}

function isWorkbenchToolbarCompactViewport(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(workbenchToolbarCompactMediaQuery()).matches;
}

/** 按工具条 track 实际宽度（侧栏展开后变窄）决定是否紧凑布局。 */
export function useWorkbenchToolbarCompactFromElement(): {
  trackRef: (node: HTMLElement | null) => void;
  compact: boolean;
} {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [compact, setCompact] = useState(false);
  const trackRef = useCallback((el: HTMLElement | null) => {
    setNode(el);
  }, []);

  useEffect(() => {
    if (!node) {
      setCompact(false);
      return;
    }

    const sync = () => {
      setCompact(isWorkbenchToolbarCompactWidth(node.clientWidth));
    };

    sync();

    if (typeof ResizeObserver !== "undefined") {
      const ro = new ResizeObserver(sync);
      ro.observe(node);
      return () => ro.disconnect();
    }

    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, [node]);

  return { trackRef, compact };
}

/**
 * 无 track 测量时的回退（窄视口）。编辑页应优先用 `useWorkbenchToolbarCompactFromElement`。
 * @deprecated 编辑工作条请由 EditorWorkbenchToolbar 传入 compactLayout。
 */
export function useWorkbenchToolbarCompact(): boolean {
  const [compact, setCompact] = useState(isWorkbenchToolbarCompactViewport);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(workbenchToolbarCompactMediaQuery());
    const sync = () => setCompact(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  return compact;
}
