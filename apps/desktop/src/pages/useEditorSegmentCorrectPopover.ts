import { useCallback, useMemo, useState } from "react";
import type { CorrectSuggestion } from "../services/editor/correctSuggestions";
import type { CorrectableSpan } from "../services/editor/findCorrectableSpans";
import { applySpanCorrection } from "../services/editor/applySpanCorrection";
import { normalizeSegmentDraftText, segmentDraftKey, segmentDraftStore } from "../hooks/useSegmentDraftStore";
import { applySegmentTextChange } from "./segmentTextLearnMeta";
import type { SegmentDto } from "../tauri/projectApi";
import type { SegmentTextUpdateMeta } from "./segmentTextLearnMeta";

export type SegmentCorrectPopoverState = {
  segmentIdx: number;
  span: CorrectableSpan;
  clientX: number;
  clientY: number;
};

type Args = {
  busy: boolean;
  segmentsRef: React.MutableRefObject<SegmentDto[]>;
  suggestionsForSurface: (surface: string) => CorrectSuggestion[];
  updateSegmentText: (idx: number, text: string, meta?: SegmentTextUpdateMeta) => void;
};

export function useEditorSegmentCorrectPopover({
  busy,
  segmentsRef,
  suggestionsForSurface,
  updateSegmentText,
}: Args) {
  const [popover, setPopover] = useState<SegmentCorrectPopoverState | null>(null);

  const openPopover = useCallback(
    (segmentIdx: number, span: CorrectableSpan, clientX: number, clientY: number) => {
      if (busy) return;
      setPopover({ segmentIdx, span, clientX, clientY });
    },
    [busy],
  );

  const closePopover = useCallback(() => {
    setPopover(null);
  }, []);

  const popoverSuggestions = useMemo(() => {
    if (!popover) return [];
    return suggestionsForSurface(popover.span.surface);
  }, [popover, suggestionsForSurface]);

  const applyInlineCorrection = useCallback(
    (item: CorrectSuggestion) => {
      if (!popover || busy) return;
      const idx = popover.segmentIdx;
      const seg = segmentsRef.current[idx];
      if (!seg) return;
      const key = segmentDraftKey(seg, idx);
      const draft = segmentDraftStore.getDraft(key);
      const liveBase = normalizeSegmentDraftText(draft ?? seg.text ?? "");
      const replacement = item.kind === "rule" ? item.right : item.term;
      const removed = liveBase.slice(popover.span.charStart, popover.span.charEnd) || popover.span.surface;
      const next = applySpanCorrection(liveBase, popover.span, replacement);
      const committedText = normalizeSegmentDraftText(seg.text ?? "");
      applySegmentTextChange(
        seg,
        idx,
        next,
        updateSegmentText,
        {
          learn: {
            committedText,
            liveTextBeforeEdit: liveBase,
            liveAnchor: popover.span.charStart,
            removed,
            inserted: replacement,
          },
        },
      );
      segmentDraftStore.setDraft(key, next);
      setPopover(null);
    },
    [busy, popover, segmentsRef, updateSegmentText],
  );

  return {
    popover,
    popoverSuggestions,
    openPopover,
    closePopover,
    applyInlineCorrection,
  };
}
