import { useCallback, useEffect, useState } from "react";
import { isWorkbenchToolbarCompactWidth } from "./useWorkbenchToolbarCompact";

/** 热词与记忆主舞台宽度 <1024px 时切换窄屏布局（顶部分段 + 底部抽屉）。 */
export function useGlossaryPageCompactFromElement(): {
  rootRef: (node: HTMLElement | null) => void;
  compact: boolean;
} {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [compact, setCompact] = useState(false);
  const rootRef = useCallback((el: HTMLElement | null) => {
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

  return { rootRef, compact };
}
