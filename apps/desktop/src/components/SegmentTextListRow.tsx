import { memo, useCallback, useRef, type KeyboardEvent, type MouseEvent } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import { SegmentRowTextField } from "./segmentRow/SegmentRowTextField";
import { useSegmentRowTextStyle } from "./segmentRow/useSegmentRowTextStyle";
import { SegmentRowTimestampColumn } from "./segmentRow/SegmentRowTimestampColumn";

export type SegmentTextListRowProps = {
  segment: SegmentDto;
  index: number;
  selected: boolean;
  busy: boolean;
  transcriptFontPx: number;
  segmentRowHeightPx: number;
  transcriptFontFamily: string;
  transcriptFontWeight: 500 | 700;
  transcriptFontItalic: boolean;
  segmentMetaWidthPx: number;
  onSegmentMetaWidthPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onSegmentRowHeightPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
  selectSegmentAt: (idx: number) => void;
  updateSegmentText: (idx: number, text: string) => void;
  onTextareaKeyDown: (idx: number, e: KeyboardEvent<HTMLTextAreaElement>) => void;
  onOpenContextMenu?: (e: MouseEvent<HTMLDivElement>, segmentIdx: number, pointerTimeSec: number) => void;
};

export const SegmentTextListRow = memo(function SegmentTextListRow({
  segment: s,
  index: i,
  selected,
  busy,
  transcriptFontPx,
  segmentRowHeightPx,
  transcriptFontFamily,
  transcriptFontWeight,
  transcriptFontItalic,
  segmentMetaWidthPx,
  onSegmentMetaWidthPointerDown,
  onSegmentRowHeightPointerDown,
  selectSegmentAt,
  updateSegmentText,
  onTextareaKeyDown,
  onOpenContextMenu,
}: SegmentTextListRowProps) {
  const focusOnSelectRef = useRef(false);
  const editorRef = useRef<{ focusEditor: () => void } | null>(null);
  const textStyle = useSegmentRowTextStyle(
    transcriptFontPx,
    transcriptFontFamily,
    transcriptFontWeight,
    transcriptFontItalic,
  );

  const onClickRow = useCallback(() => {
    if (busy) return;
    if (selected) {
      editorRef.current?.focusEditor();
      return;
    }
    focusOnSelectRef.current = true;
    selectSegmentAt(i);
  }, [busy, i, selectSegmentAt, selected]);

  const rowMinHeight = Math.max(60, Math.round(segmentRowHeightPx + 2));
  const metaWidth = Math.max(44, Math.round((segmentMetaWidthPx - 10) / 2));
  const onRowContextMenu = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      onOpenContextMenu?.(e, i, (s.start_sec + s.end_sec) / 2);
    },
    [i, onOpenContextMenu, s.end_sec, s.start_sec],
  );

  return (
    <div
      data-seg-row={i}
      style={{ minHeight: rowMinHeight }}
      className={[
        "group relative flex cursor-text items-start gap-2 rounded-md border border-transparent px-[9px] py-[9px] transition-[background-color,border-color,box-shadow]",
        selected
          ? "border-zen-gray-300 bg-zen-ochre/45 shadow-[inset_0_0_0_1px_rgba(133,83,15,0.14)]"
          : "bg-transparent hover:bg-notion-sidebar/20",
      ].join(" ")}
      onClick={onClickRow}
      onContextMenu={onRowContextMenu}
    >
      <SegmentRowTimestampColumn
        index={i}
        startSec={s.start_sec}
        metaWidth={metaWidth}
        selected={selected}
        busy={busy}
        onMetaWidthPointerDown={onSegmentMetaWidthPointerDown}
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
      />
    </div>
  );
});
