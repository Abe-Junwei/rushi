import { useCallback, useEffect, useState } from "react";
import { measureFloatingPanelBodyStack } from "../components/floatingPanelFitSections";

export type FloatingPanelBodyMeasureStrategy = "stack" | "box";

/** ResizeObserver 测量对话框正文区 scrollHeight，供 contentFitHeight 与估算取 max。 */
export function useFloatingPanelBodyMeasure(
  enabled = true,
  strategy: FloatingPanelBodyMeasureStrategy = "stack",
) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const [bodyHeight, setBodyHeight] = useState<number | null>(null);

  const bodyRef = useCallback((el: HTMLElement | null) => {
    setNode(el);
  }, []);

  useEffect(() => {
    if (!enabled || !node || typeof ResizeObserver === "undefined") {
      setBodyHeight(null);
      return;
    }

    const measure = () => {
      setBodyHeight(
        strategy === "box"
          ? Math.ceil(node.scrollHeight)
          : measureFloatingPanelBodyStack(node),
      );
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    for (const child of Array.from(node.children)) {
      if (child instanceof HTMLElement) ro.observe(child);
    }
    return () => ro.disconnect();
  }, [enabled, node, strategy]);

  return { bodyRef, bodyHeight };
}
