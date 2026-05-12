import type { PointerEvent as ReactPointerEvent } from "react";

const RESIZE_HIT_HEIGHT_PX = 12;

/** 波形 / 语段轨下边缘：无可见线，仅保留纵向拖调命中区（不占文档流高度）。 */
export function P1ResizeBottomHit(props: {
  busy: boolean;
  ariaLabel: string;
  onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
}) {
  const { busy, ariaLabel, onPointerDown } = props;
  return (
    <div
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      className={[
        "pointer-events-auto absolute bottom-0 left-0 right-0 z-20 cursor-row-resize touch-none select-none bg-transparent",
        busy ? "pointer-events-none opacity-40" : "",
      ].join(" ")}
      style={{ height: RESIZE_HIT_HEIGHT_PX }}
    />
  );
}
