import type { KeyboardEvent, MouseEvent } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import type { CorrectableSpan } from "../services/editor/findCorrectableSpans";

export type SegmentRowTextFieldEditingArgs = {
  segment: SegmentDto;
  index: number;
  selected: boolean;
  busy: boolean;
  editorRef?: React.RefObject<{ focusEditor: () => void } | null>;
  onSegmentRowHeightPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
  onRowRangePointerDown?: (index: number, e: React.PointerEvent<HTMLElement>) => void;
  updateSegmentText: (idx: number, text: string) => void;
  selectSegmentAt: (idx: number) => void;
  onTextareaKeyDown: (idx: number, e: KeyboardEvent<HTMLTextAreaElement>) => void;
  spansForText: (text: string) => CorrectableSpan[];
  onOpenTextContextMenu?: (e: MouseEvent<HTMLElement>, selectionText: string) => void;
};
