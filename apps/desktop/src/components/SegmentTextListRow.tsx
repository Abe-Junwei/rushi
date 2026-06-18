import { memo, useCallback, useRef, type KeyboardEvent, type MouseEvent, type PointerEvent as ReactPointerEvent } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import { CspLayout } from "./CspLayout";
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
  onOpenTextContextMenu?: (
    e: MouseEvent<HTMLElement>,
    segmentIdx: number,
    pointerTimeSec: number,
    selectionText: string,
  ) => void;
  onRevealSelectedSegment?: () => void;
  findReplaceHighlight?: { charStart: number; charEnd: number } | null;
  correctionRulesHighlight?: { charStart: number; charEnd: number } | null;
  spansForText: (text: string) => CorrectableSpan[];
  onCorrectableSpanClick: (
    segmentIdx: number,
    span: CorrectableSpan,
    event: React.MouseEvent<HTMLButtonElement>,
  ) => void;
  hasUnsavedDraft?: boolean;
  onOpenAnnotation?: (segmentIdx: number) => void;
};

function highlightEqual(
  a: { charStart: number; charEnd: number } | null | undefined,
  b: { charStart: number; charEnd: number } | null | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b) return !a && !b;
  return a.charStart === b.charStart && a.charEnd === b.charEnd;
}

function segmentTextListRowPropsEqual(
  prev: SegmentTextListRowProps,
  next: SegmentTextListRowProps,
): boolean {
  if (prev.index !== next.index) return false;
  if (prev.selected !== next.selected) return false;
  if (prev.inSelection !== next.inSelection) return false;
  if (prev.busy !== next.busy) return false;
  if (prev.hasUnsavedDraft !== next.hasUnsavedDraft) return false;
  if (prev.transcriptFontPx !== next.transcriptFontPx) return false;
  if (prev.segmentRowHeightPx !== next.segmentRowHeightPx) return false;
  if (prev.transcriptFontFamily !== next.transcriptFontFamily) return false;
  if (prev.transcriptFontWeight !== next.transcriptFontWeight) return false;
  if (prev.transcriptFontItalic !== next.transcriptFontItalic) return false;
  if (prev.segmentMetaWidthPx !== next.segmentMetaWidthPx) return false;
  if (!highlightEqual(prev.findReplaceHighlight, next.findReplaceHighlight)) return false;
  if (!highlightEqual(prev.correctionRulesHighlight, next.correctionRulesHighlight)) return false;

  const ps = prev.segment;
  const ns = next.segment;
  if (ps.uid !== ns.uid) return false;
  if (ps.text !== ns.text) return false;
  if (ps.start_sec !== ns.start_sec) return false;
  if (ps.end_sec !== ns.end_sec) return false;
  if (ps.kind !== ns.kind) return false;
  if (ps.text_stage !== ns.text_stage) return false;
  if (ps.annotation !== ns.annotation) return false;

  return (
    prev.selectSegmentAt === next.selectSegmentAt &&
    prev.updateSegmentText === next.updateSegmentText &&
    prev.onTextareaKeyDown === next.onTextareaKeyDown &&
    prev.onSegmentMetaWidthPointerDown === next.onSegmentMetaWidthPointerDown &&
    prev.onTimestampPointerDown === next.onTimestampPointerDown &&
    prev.onRowRangePointerDown === next.onRowRangePointerDown &&
    prev.consumeRowRangeClickSuppress === next.consumeRowRangeClickSuppress &&
    prev.onSegmentRowHeightPointerDown === next.onSegmentRowHeightPointerDown &&
    prev.onOpenContextMenu === next.onOpenContextMenu &&
    prev.onOpenTextContextMenu === next.onOpenTextContextMenu &&
    prev.onRevealSelectedSegment === next.onRevealSelectedSegment &&
    prev.spansForText === next.spansForText &&
    prev.onCorrectableSpanClick === next.onCorrectableSpanClick &&
    prev.onOpenAnnotation === next.onOpenAnnotation
  );
}

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
      const textarea = (e.target as HTMLElement).closest("textarea");
      if (textarea && !textarea.readOnly) return;
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
        "button, [role='separator'], [aria-label='拖拽调整语段高度']",
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

  const onOpenTextContextMenuForRow = useCallback(
    (e: MouseEvent<HTMLElement>, selectionText: string) => {
      onOpenTextContextMenu?.(e, i, pointerTimeSec, selectionText);
    },
    [i, onOpenTextContextMenu, pointerTimeSec],
  );

  const onCorrectableSpanClickForRow = useCallback(
    (span: CorrectableSpan, event: React.MouseEvent<HTMLButtonElement>) => {
      onCorrectableSpanClick(i, span, event);
    },
    [i, onCorrectableSpanClick],
  );

  return (
    <CspLayout
      data-seg-row={i}
      layout={{ "--seg-row-min-height": `${rowMinHeight}px` }}
      className={[
        "seg-row-shell group relative cursor-text rounded-md border border-transparent px-[9px] py-[9px] transition-[background-color,border-color,box-shadow]",
        selected
          ? "seg-row-selected"
          : inSelection
            ? "seg-row-in-selection"
            : "bg-transparent hover:border-notion-divider hover:bg-notion-sidebar/35",
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
        onRowRangePointerDown={onRowRangePointerDown}
        selectSegmentAt={selectSegmentAt}
        updateSegmentText={updateSegmentText}
        onTextareaKeyDown={onTextareaKeyDown}
        findReplaceHighlight={findReplaceHighlight}
        correctionRulesHighlight={correctionRulesHighlight}
        spansForText={spansForText}
        onCorrectableSpanClick={onCorrectableSpanClickForRow}
        onOpenTextContextMenu={onOpenTextContextMenuForRow}
      />

      <SegmentRowStageBadge
        segment={s}
        segmentIdx={i}
        hasUnsavedDraft={hasUnsavedDraft}
        busy={busy}
        onOpenAnnotation={onOpenAnnotation}
      />
    </CspLayout>
  );
}, segmentTextListRowPropsEqual);
