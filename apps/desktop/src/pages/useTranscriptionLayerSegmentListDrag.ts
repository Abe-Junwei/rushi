import { useCallback, useRef, type MutableRefObject, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import type { TranscriptionLayerInput } from "./transcriptionLayerTypes";
import {
  isEditableSegmentBodyTextarea,
  querySegmentListScrollRoot,
  resolveSegmentListRowIndexFromPoint,
  segmentListRangeDragExceededSlop,
  segmentListRangeDragVerticalIntentExceededSlop,
} from "../utils/segmentListVirtualWindow";
import { blurActiveTranscriptTextarea } from "../utils/transcriptSelection";
import { nextListSelectSource } from "../utils/segmentListSelectSource";

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
    fromEditableText: boolean;
    startClientX: number;
    startClientY: number;
  } | null>(null);
  const suppressSegmentListRowClickRef = useRef(false);
  const listSelectSourceStateRef = useRef({ lastAtMs: 0 });

  const onSegmentListRangePointerDown = useCallback(
    (idx: number, e: ReactPointerEvent<HTMLElement>) => {
      const c = ctxRef.current;
      if (c.busy || e.button !== 0) return;
      if ((e.target as HTMLElement).closest('[role="separator"]')) return;
      e.stopPropagation();

      const fromEditableText = isEditableSegmentBodyTextarea(
        (e.target as HTMLElement).closest('textarea[aria-label="语段正文"]'),
      );

      segmentListRangeDragRef.current = {
        anchorIdx: idx,
        pointerId: e.pointerId,
        moved: false,
        fromEditableText,
        startClientX: e.clientX,
        startClientY: e.clientY,
      };
      if (e.shiftKey) {
        selectSegmentAtRef.current(idx, "list", { shiftKey: true });
      } else if (e.metaKey || e.ctrlKey) {
        selectSegmentAtRef.current(idx, "list", { toggle: true });
      } else {
        selectSegmentAtRef.current(
          idx,
          nextListSelectSource(Date.now(), listSelectSourceStateRef.current),
        );
      }

      const onMove = (ev: PointerEvent) => {
        const drag = segmentListRangeDragRef.current;
        if (!drag || ev.pointerId !== drag.pointerId) return;
        if (
          !drag.moved &&
          !(drag.fromEditableText
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
        }
        const scrollRoot = segmentListRef.current ?? querySegmentListScrollRoot();
        const hoverIdx = resolveSegmentListRowIndexFromPoint(
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
