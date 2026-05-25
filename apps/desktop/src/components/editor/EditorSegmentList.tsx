import { useLayoutEffect, useRef } from "react";
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
  onOpenSegmentContextMenu: (menu: SegmentCtxMenuState) => void;
}

export function EditorSegmentList({
  controller: c,
  tx,
  appearance: a,
  onOpenSegmentContextMenu,
}: EditorSegmentListProps) {
  const segmentListRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const root = segmentListRef.current;
    if (!root) return;
    const el = root.querySelector<HTMLElement>(`[data-seg-row="${c.selectedIdx}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "instant" });
  }, [c.currentFileId, c.selectedIdx, c.segments.length]);

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
      className="min-h-0 flex-1 overflow-y-auto bg-notion-bg px-6 py-2.5"
      role="list"
      aria-label="语段文本列表"
    >
      <div className="space-y-2.5">
        {c.segments.map((s, i) => (
          <SegmentTextListRow
            key={i}
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
            selectSegmentAt={tx.selectSegmentAt}
            updateSegmentText={c.updateSegmentText}
            onTextareaKeyDown={tx.onSegmentTextareaKeyDown}
            onContextMenu={(e) => {
              if (c.busy) return;
              e.preventDefault();
              e.stopPropagation();
              const pointerTimeSec = (s.start_sec + s.end_sec) / 2;
              onOpenSegmentContextMenu({ x: e.clientX, y: e.clientY, segmentIdx: i, pointerTimeSec });
            }}
          />
        ))}
      </div>
    </div>
  );
}
