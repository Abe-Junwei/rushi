import { useCallback, type PointerEvent as ReactPointerEvent } from "react";
import { CspLayout } from "./CspLayout";

const RESIZE_HIT_HEIGHT_PX = 16;

/** 波形底缘纵向拖调命中区（仅光标提示，不占文档流高度）。 */
export function ResizeBottomHit(props: {
  busy: boolean;
  ariaLabel: string;
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
}) {
  const { busy, ariaLabel, onPointerDown } = props;

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (busy) return;
      onPointerDown(e);
    },
    [busy, onPointerDown],
  );

  return (
    <CspLayout
      aria-label={ariaLabel}
      onPointerDown={handlePointerDown}
      layout={{ height: RESIZE_HIT_HEIGHT_PX }}
      className={[
        "resize-bottom-hit pointer-events-auto absolute bottom-0 left-0 right-0 cursor-row-resize touch-none select-none bg-transparent",
        busy ? "pointer-events-none opacity-40" : "",
      ].join(" ")}
    />
  );
}
