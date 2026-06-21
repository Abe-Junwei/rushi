import type { KeyboardEvent, MouseEvent } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import type { CorrectableSpan } from "../services/editor/findCorrectableSpans";

export type SegmentRowTextFieldControllerArgs = {
  segment: SegmentDto;
  index: number;
  selected: boolean;
  busy: boolean;
  segmentRowHeightPx: number;
  focusOnSelectRef: React.MutableRefObject<boolean>;
  editorRef?: React.RefObject<{ focusEditor: () => void } | null>;
  onSegmentRowHeightPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onRowRangePointerDown?: (index: number, e: React.PointerEvent<HTMLElement>) => void;
  selectSegmentAt: (idx: number) => void;
  updateSegmentText: (idx: number, text: string) => void;
  onTextareaKeyDown: (idx: number, e: KeyboardEvent<HTMLTextAreaElement>) => void;
  findReplaceHighlight?: { charStart: number; charEnd: number } | null;
  correctionRulesHighlight?: { charStart: number; charEnd: number } | null;
  spansForText: (text: string) => CorrectableSpan[];
  onCorrectableSpanClick: (span: CorrectableSpan, event: React.MouseEvent<HTMLButtonElement>) => void;
  onOpenTextContextMenu?: (e: MouseEvent<HTMLElement>, selectionText: string) => void;
};
