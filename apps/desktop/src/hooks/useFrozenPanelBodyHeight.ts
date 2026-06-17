import { useEffect, useRef, useState } from "react";

/** 仅在 layoutRev 变化或首次测得高度时提交，避免输入框 ResizeObserver 触发面板抖动。 */
export function useFrozenPanelBodyHeight(
  bodyHeight: number | null,
  layoutRev: number,
  enabled: boolean,
): number | null {
  const layoutRevRef = useRef(layoutRev);
  const [frozen, setFrozen] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setFrozen(null);
      layoutRevRef.current = layoutRev;
      return;
    }
    if (bodyHeight == null) return;
    const layoutChanged = layoutRev !== layoutRevRef.current;
    if (frozen == null || layoutChanged) {
      layoutRevRef.current = layoutRev;
      setFrozen(bodyHeight);
    }
  }, [bodyHeight, enabled, frozen, layoutRev]);

  return enabled ? frozen : null;
}
