import { memo, useCallback, useRef, type KeyboardEvent, type MouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import { SegmentRowTextField } from "./segmentRow/SegmentRowTextField";
import { SegmentRowStageBadge } from "./segmentRow/SegmentRowStageBadge";
import { useSegmentRowTextStyle } from "./segmentRow/useSegmentRowTextStyle";
import { SegmentRowTimestampColumn } from "./segmentRow/SegmentRowTimestampColumn";
import type { CorrectableSpan } from "../services/editor/findCorrectableSpans";

export type SegmentTextListRowProps = {
  segment: SegmentDto;
  index: number;
  selected: boolean;
  inSelection?: boolean;
  busy: boolean;
  transcriptFontPx: number;
  segmentRowHeightPx: number;
  transcriptFontFamily: string;
  transcriptFontWeight: 500 | 700;
  transcriptFontItalic: boolean;
  segmentMetaWidthPx: number;
  onSegmentMetaWidthPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onTimestampPointerDown?: (index: number, e: React.PointerEvent<HTMLElement>) => void;
  onRowRangePointerDown?: (index: number, e: React.PointerEvent<HTMLElement>) => void;
  consumeRowRangeClickSuppress?: () => boolean;
  onSegmentRowHeightPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
  selectSegmentAt: (idx: number, opts?: { shiftKey?: boolean; toggle?: boolean }) => void;
  updateSegmentText: (idx: number, text: string) => void;
  onTextareaKeyDown: (idx: number, e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onOpenContextMenu?: (
    e: MouseEvent<HTMLElement>,
    segmentIdx: number,
    pointerTimeSec: number,
    selectionText?: string,
  ) => void;
  onOpenTextContextMenu?: (e: MouseEvent<HTMLElement>, selectionText: string) => void;
  onRevealSelectedSegment?: () => void;
  findReplaceHighlight?: { charStart: number; charEnd: number } | null;
  correctionRulesHighlight?: { charStart: number; charEnd: number } | null;
  spansForText: (text: string) => CorrectableSpan[];
  onCorrectableSpanClick: (span: CorrectableSpan, event: React.MouseEvent<HTMLButtonElement>) => void;
  hasUnsavedDraft?: boolean;
  onOpenAnnotation?: (segmentIdx: number) => void;
};

export const SegmentTextListRow = memo(function SegmentTextListRow({
  segment: s,
  index: i,
  selected,
  inSelection = false,
  busy,
  transcriptFontPx,
  segmentRowHeightPx,
  transcriptFontFamily,
  transcriptFontWeight,
  transcriptFontItalic,
  segmentMetaWidthPx,
  onSegmentMetaWidthPointerDown,
  onTimestampPointerDown,
  onRowRangePointerDown,
  consumeRowRangeClickSuppress,
  onSegmentRowHeightPointerDown,
  selectSegmentAt,
  updateSegmentText,
  onTextareaKeyDown,
  onOpenContextMenu,
  onOpenTextContextMenu,
  onRevealSelectedSegment,
  findReplaceHighlight,
  correctionRulesHighlight,
  spansForText,
  onCorrectableSpanClick,
  hasUnsavedDraft = false,
  onOpenAnnotation,
}: SegmentTextListRowProps) {
  const focusOnSelectRef = useRef(false);
  const editorRef = useRef<{ focusEditor: () => void } | null>(null);
  const textStyle = useSegmentRowTextStyle(
    transcriptFontPx,
    transcriptFontFamily,
    transcriptFontWeight,
    transcriptFontItalic,
  );

  const pointerTimeSec = (s.start_sec + s.end_sec) / 2;

  const onClickRow = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (busy) return;
      if (consumeRowRangeClickSuppress?.()) return;
      if ((e.target as HTMLElement).closest("textarea")) return;
      if (e.shiftKey) {
        focusOnSelectRef.current = false;
        selectSegmentAt(i, { shiftKey: true });
        return;
      }
      if (e.metaKey || e.ctrlKey) {
        focusOnSelectRef.current = false;
        selectSegmentAt(i, { toggle: true });
        return;
      }
      if (selected) {
        editorRef.current?.focusEditor();
        onRevealSelectedSegment?.();
        return;
      }
      focusOnSelectRef.current = true;
      selectSegmentAt(i);
    },
    [busy, consumeRowRangeClickSuppress, i, onRevealSelectedSegment, selectSegmentAt, selected],
  );

  const onRowPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (busy || e.button !== 0) return;
      if ((e.target as HTMLElement).closest(
        "textarea, button, [role='separator'], [aria-label='拖拽调整语段高度']",
      )) {
        return;
      }
      onRowRangePointerDown?.(i, e);
    },
    [busy, i, onRowRangePointerDown],
  );

  const rowMinHeight = Math.max(60, Math.round(segmentRowHeightPx + 2));
  const metaWidth = Math.max(44, Math.round((segmentMetaWidthPx - 10) / 2));

  const onRowContextMenu = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest('textarea[aria-label="语段正文"]')) return;
      onOpenContextMenu?.(e, i, pointerTimeSec, "");
    },
    [i, onOpenContextMenu, pointerTimeSec],
  );

  return (
    <div
      data-seg-row={i}
      style={{ minHeight: rowMinHeight }}
      className={[
        "group relative flex cursor-text items-start gap-2 rounded-md border border-transparent px-[9px] py-[9px] transition-[background-color,border-color,box-shadow]",
        selected
          ? "seg-row-selected"
          : inSelection
            ? "seg-row-in-selection"
            : "bg-transparent hover:border-notion-divider",
      ].join(" ")}
      onClick={onClickRow}
      onPointerDown={onRowPointerDown}
      onContextMenu={onRowContextMenu}
    >
      <SegmentRowTimestampColumn
        index={i}
        startSec={s.start_sec}
        metaWidth={metaWidth}
        selected={selected}
        inSelection={inSelection}
        busy={busy}
        onMetaWidthPointerDown={onSegmentMetaWidthPointerDown}
        onTimestampPointerDown={onTimestampPointerDown}
      />

      <SegmentRowTextField
        segment={s}
        index={i}
        selected={selected}
        busy={busy}
        segmentRowHeightPx={segmentRowHeightPx}
        textStyle={textStyle}
        focusOnSelectRef={focusOnSelectRef}
        editorRef={editorRef}
        onSegmentRowHeightPointerDown={onSegmentRowHeightPointerDown}
        selectSegmentAt={selectSegmentAt}
        updateSegmentText={updateSegmentText}
        onTextareaKeyDown={onTextareaKeyDown}
        findReplaceHighlight={findReplaceHighlight}
        correctionRulesHighlight={correctionRulesHighlight}
        spansForText={spansForText}
        onCorrectableSpanClick={onCorrectableSpanClick}
        onOpenTextContextMenu={onOpenTextContextMenu}
      />

      <SegmentRowStageBadge
        segment={s}
        segmentIdx={i}
        hasUnsavedDraft={hasUnsavedDraft}
        busy={busy}
        onOpenAnnotation={onOpenAnnotation}
      />
    </div>
  );
});
