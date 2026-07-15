import { transcriptFontPxFromDragDelta } from "./segmentLayout";

export const TRANSCRIPT_ROW_HEIGHT_DRAG_THRESHOLD_PX = 4;

export type TranscriptRowHeightDragContext = {
  busy: boolean;
  getStartFontPx: () => number;
  setFontPx: (px: number) => void;
};

/** 语段行高 / 字号纵向拖调（波形底缘与语段行内入口共用）。 */
export function bindTranscriptRowHeightPointerDrag(
  target: HTMLElement,
  event: Pick<PointerEvent, "button" | "pointerId" | "clientY">,
  ctx: TranscriptRowHeightDragContext,
): void {
  if (event.button !== 0 || ctx.busy) return;
  target.setPointerCapture(event.pointerId);
  const startY = event.clientY;
  const startF = ctx.getStartFontPx();
  let dragging = false;
  const onMove = (ev: PointerEvent) => {
    if ((ev.buttons & 1) !== 1) return;
    const dy = ev.clientY - startY;
    if (!dragging && Math.abs(dy) < TRANSCRIPT_ROW_HEIGHT_DRAG_THRESHOLD_PX) return;
    dragging = true;
    ctx.setFontPx(transcriptFontPxFromDragDelta(startF, dy));
  };
  const onUp = (ev: PointerEvent) => {
    try {
      target.releasePointerCapture(ev.pointerId);
    } catch {
      /* noop */
    }
    window.removeEventListener("pointermove", onMove);
    window.removeEventListener("pointerup", onUp);
    window.removeEventListener("pointercancel", onUp);
  };
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
}
