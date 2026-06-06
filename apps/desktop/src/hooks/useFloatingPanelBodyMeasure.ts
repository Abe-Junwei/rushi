import { useCallback, useEffect, useState } from "react";
import { measureFloatingPanelBodyStack } from "../components/floatingPanelFitSections";

/** ResizeObserver 测量对话框正文区 scrollHeight，供 contentFitHeight 与估算取 max。 */
export function useFloatingPanelBodyMeasure(enabled = true) {
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
      setBodyHeight(measureFloatingPanelBodyStack(node));
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(node);
    return () => ro.disconnect();
  }, [enabled, node]);

  return { bodyRef, bodyHeight };
}
