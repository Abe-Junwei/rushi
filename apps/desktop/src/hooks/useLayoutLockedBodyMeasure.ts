import { useEffect, useRef, useState } from "react";
import {
  useFloatingPanelBodyMeasure,
  type FloatingPanelBodyMeasureStrategy,
} from "./useFloatingPanelBodyMeasure";

/** 仅在 layoutRev 变化时更新实测高度，避免输入框等内容变化触发面板抖动。 */
export function useLayoutLockedBodyMeasure(
  enabled: boolean,
  layoutRev: number,
  lockToLayoutRev: boolean,
  strategy: FloatingPanelBodyMeasureStrategy = "stack",
) {
  const { bodyRef, bodyHeight } = useFloatingPanelBodyMeasure(enabled, strategy);
  const layoutRevRef = useRef(layoutRev);
  const [lockedBodyHeight, setLockedBodyHeight] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      layoutRevRef.current = layoutRev;
      setLockedBodyHeight(null);
      return;
    }
    if (bodyHeight == null) return;

    if (!lockToLayoutRev) {
      setLockedBodyHeight(bodyHeight);
      return;
    }

    if (layoutRevRef.current !== layoutRev) {
      layoutRevRef.current = layoutRev;
      setLockedBodyHeight(bodyHeight);
      return;
    }

    setLockedBodyHeight((prev) => (prev == null ? bodyHeight : prev));
  }, [bodyHeight, enabled, layoutRev, lockToLayoutRev]);

  return { bodyRef, bodyHeight: enabled ? lockedBodyHeight : null };
}
