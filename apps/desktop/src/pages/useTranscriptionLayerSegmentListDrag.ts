import { useCallback, useRef, type MutableRefObject, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import type { TranscriptionLayerInput } from "./transcriptionLayerTypes";
import {
  isSegmentBodyTextarea,
  querySegmentListScrollRoot,
  resolveSegmentListRangeDragHoverIndex,
  segmentListRangeDragExceededSlop,
  segmentListRangeDragVerticalIntentExceededSlop,
} from "../utils/segmentListVirtualWindow";
import { computeSegmentListDragAutoScrollDelta } from "../utils/segmentListDragAutoScroll";
import { blurActiveTranscriptTextarea } from "../utils/transcriptSelection";

type SelectSegmentAtRef = MutableRefObject<
  (idx: number, source?: import("../utils/waveformViewMode").SegmentSelectSource, opts?: { shiftKey?: boolean; toggle?: boolean }) => void
>;

export function useTranscriptionLayerSegmentListDrag(opts: {
  ctxRef: RefObject<TranscriptionLayerInput>;
  segmentListRef: RefObject<HTMLDivElement | null>;
  selectSegmentAtRef: SelectSegmentAtRef;
}) {
  const { ctxRef, segmentListRef, selectSegmentAtRef } = opts;

  const segmentListRangeDragRef = useRef<{
    anchorIdx: number;
    pointerId: number;
    moved: boolean;
    fromTextBody: boolean;
    startClientX: number;
    startClientY: number;
    lastClientX?: number;
    lastClientY?: number;
  } | null>(null);
  const suppressSegmentListRowClickRef = useRef(false);
  const listSelectSourceStateRef = useRef({ lastAtMs: 0 });

  const onSegmentListRangePointerDown = useCallback(
    (idx: number, e: ReactPointerEvent<HTMLElement>) => {
      const c = ctxRef.current;
      if (c.busy || e.button !== 0) return;
      if ((e.target as HTMLElement).closest('[role="separator"]')) return;
      e.stopPropagation();

      const fromTextBody = isSegmentBodyTextarea(
        (e.target as HTMLElement).closest('textarea[aria-label="语段正文"]'),
      );

      segmentListRangeDragRef.current = {
        anchorIdx: idx,
        pointerId: e.pointerId,
        moved: false,
        fromTextBody,
        startClientX: e.clientX,
        startClientY: e.clientY,
      };
      if (e.shiftKey) {
        suppressSegmentListRowClickRef.current = true;
        selectSegmentAtRef.current(idx, "list", { shiftKey: true });
      } else if (e.metaKey || e.ctrlKey) {
        suppressSegmentListRowClickRef.current = true;
        selectSegmentAtRef.current(idx, "list", { toggle: true });
      }

      const autoScrollRafRef = { current: 0 as number | null };
      const stopAutoScroll = () => {
        if (autoScrollRafRef.current != null) {
          window.cancelAnimationFrame(autoScrollRafRef.current);
          autoScrollRafRef.current = null;
        }
      };
      const tickAutoScroll = () => {
        const drag = segmentListRangeDragRef.current;
        const scrollRoot = segmentListRef.current ?? querySegmentListScrollRoot();
        if (!drag || !scrollRoot || !drag.moved) {
          stopAutoScroll();
          return;
        }
        const rect = scrollRoot.getBoundingClientRect();
        const clientY = drag.lastClientY ?? drag.startClientY;
        const clientX = drag.lastClientX ?? drag.startClientX;
        const delta = computeSegmentListDragAutoScrollDelta({
          clientY,
          rootTop: rect.top,
          rootBottom: rect.bottom,
        });
        if (delta !== 0) {
          scrollRoot.scrollTop = Math.max(0, scrollRoot.scrollTop + delta);
        }
        const hoverIdx = resolveSegmentListRangeDragHoverIndex(
          scrollRoot,
          clientX,
          clientY,
          ctxRef.current.segments.length,
        );
        if (hoverIdx != null) {
          ctxRef.current.selectSegmentRange(drag.anchorIdx, hoverIdx);
        }
        autoScrollRafRef.current = window.requestAnimationFrame(tickAutoScroll);
      };

      const onMove = (ev: PointerEvent) => {
        const drag = segmentListRangeDragRef.current;
        if (!drag || ev.pointerId !== drag.pointerId) return;
        drag.lastClientX = ev.clientX;
        drag.lastClientY = ev.clientY;
        if (
          !drag.moved &&
          !(drag.fromTextBody
            ? segmentListRangeDragVerticalIntentExceededSlop(
                drag.startClientX,
                drag.startClientY,
                ev.clientX,
                ev.clientY,
              )
            : segmentListRangeDragExceededSlop(
                drag.startClientX,
                drag.startClientY,
                ev.clientX,
                ev.clientY,
              ))
        ) {
          return;
        }
        if (!drag.moved) {
          drag.moved = true;
          blurActiveTranscriptTextarea();
          stopAutoScroll();
          autoScrollRafRef.current = window.requestAnimationFrame(tickAutoScroll);
        }
        const scrollRoot = segmentListRef.current ?? querySegmentListScrollRoot();
        const hoverIdx = resolveSegmentListRangeDragHoverIndex(
          scrollRoot,
          ev.clientX,
          ev.clientY,
          ctxRef.current.segments.length,
        );
        if (hoverIdx == null) return;
        ev.preventDefault();
        ctxRef.current.selectSegmentRange(drag.anchorIdx, hoverIdx);
      };

      const onUp = (ev: PointerEvent) => {
        const drag = segmentListRangeDragRef.current;
        if (!drag || ev.pointerId !== drag.pointerId) return;
        if (drag.moved) suppressSegmentListRowClickRef.current = true;
        segmentListRangeDragRef.current = null;
        stopAutoScroll();
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [ctxRef, segmentListRef, selectSegmentAtRef],
  );

  const consumeSegmentListRangeClickSuppress = useCallback(() => {
    if (!suppressSegmentListRowClickRef.current) return false;
    suppressSegmentListRowClickRef.current = false;
    return true;
  }, []);

  return {
    onSegmentListRangePointerDown,
    onTimestampPointerDown: onSegmentListRangePointerDown,
    consumeSegmentListRangeClickSuppress,
    listSelectSourceStateRef,
  };
}
