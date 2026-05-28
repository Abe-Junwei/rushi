import { useCallback, useLayoutEffect, type MouseEvent as ReactMouseEvent } from "react";
import type { ProjectControllerApi } from "../../pages/useProjectController";
import type { TranscriptionLayerApi } from "../../pages/useTranscriptionLayer";
import { SegmentTextListRow } from "../SegmentTextListRow";
import type { useEditorTranscriptAppearance } from "./useEditorTranscriptAppearance";

interface SegmentCtxMenuState {
  x: number;
  y: number;
  segmentIdx: number;
  pointerTimeSec: number;
}

type AppearanceApi = ReturnType<typeof useEditorTranscriptAppearance>;

interface EditorSegmentListProps {
  controller: ProjectControllerApi;
  tx: TranscriptionLayerApi;
  appearance: AppearanceApi;
  listRef: React.RefObject<HTMLDivElement | null>;
  onOpenSegmentContextMenu: (menu: SegmentCtxMenuState) => void;
}

export function EditorSegmentList({
  controller: c,
  tx,
  appearance: a,
  listRef: segmentListRef,
  onOpenSegmentContextMenu,
}: EditorSegmentListProps) {
  const onOpenRowContextMenu = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>, segmentIdx: number, pointerTimeSec: number) => {
      if (c.busy) return;
      e.preventDefault();
      e.stopPropagation();
      onOpenSegmentContextMenu({ x: e.clientX, y: e.clientY, segmentIdx, pointerTimeSec });
    },
    [c.busy, onOpenSegmentContextMenu],
  );

  useLayoutEffect(() => {
    const root = segmentListRef.current;
    if (!root) return;
    const el = root.querySelector<HTMLElement>(`[data-seg-row="${c.selectedIdx}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [c.currentFileId, c.selectedIdx, c.segments.length, segmentListRef]);

  if (c.segments.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-[14px] leading-relaxed text-notion-text-muted">
        尚未有语段：请先「从 ASR 拉取语段」。
      </div>
    );
  }

  return (
    <div
      ref={segmentListRef}
      className="min-h-0 flex-1 overflow-y-auto bg-notion-bg p-2.5"
      role="list"
      aria-label="语段文本列表"
    >
      <div className="space-y-2.5">
        {c.segments.map((s, i) => (
          <SegmentTextListRow
            key={s.uid ? `${s.uid}#${i}` : `seg-${i}`}
            segment={s}
            index={i}
            selected={i === c.selectedIdx}
            busy={c.busy}
            transcriptFontPx={tx.transcriptFontPx}
            segmentRowHeightPx={tx.transcriptRowHeightPx}
            transcriptFontFamily={a.transcriptFontFamily}
            transcriptFontWeight={a.transcriptFontWeight}
            transcriptFontItalic={a.transcriptFontItalic}
            segmentMetaWidthPx={a.transcriptMetaWidthPx}
            onSegmentMetaWidthPointerDown={a.beginTranscriptMetaWidthDrag}
            onSegmentRowHeightPointerDown={tx.beginTranscriptRowHeightDrag}
            selectSegmentAt={tx.selectSegmentFromList}
            updateSegmentText={c.updateSegmentText}
            onTextareaKeyDown={tx.onSegmentTextareaKeyDown}
            onOpenContextMenu={onOpenRowContextMenu}
          />
        ))}
      </div>
    </div>
  );
}
