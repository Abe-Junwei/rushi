import { useCallback, useState } from "react";

/** 跟踪 `<details>` 展开态，供 contentFitHeight 重算。 */
export function useFloatingPanelDetailsExpansion(initial: Record<string, boolean> = {}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>(initial);

  const setDetailsExpanded = useCallback((key: string, open: boolean) => {
    setExpanded((prev) => {
      if (prev[key] === open) return prev;
      return { ...prev, [key]: open };
    });
  }, []);

  const isDetailsExpanded = useCallback(
    (key: string, defaultOpen = false) => expanded[key] ?? defaultOpen,
    [expanded],
  );

  return { isDetailsExpanded, setDetailsExpanded };
}
