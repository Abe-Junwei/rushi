import { useEffect, useState } from "react";

/** `<1024px` 时工作条进入紧凑布局（编辑/缩放收进菜单）。 */
export const WORKBENCH_TOOLBAR_COMPACT_BREAKPOINT_PX = 1024;

export function workbenchToolbarCompactMediaQuery(): string {
  return `(max-width: ${WORKBENCH_TOOLBAR_COMPACT_BREAKPOINT_PX - 1}px)`;
}

export function isWorkbenchToolbarCompactViewport(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(workbenchToolbarCompactMediaQuery()).matches;
}

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
