import {
  captureTranscriptTextareaSelection,
  readTranscriptTextareaSelection,
} from "../utils/transcriptSelection";
import type { FindReplaceDialogState } from "./findReplaceTypes";

export function triggerFindReplaceShortcut(args: {
  dialogPhase: FindReplaceDialogState["phase"];
  openFindReplace: (initialFind?: string, initialReplace?: string) => void;
  focusFindInput: (restoreSelection?: boolean) => void;
  clearFindSearchDebounce: () => void;
  setFindText: (value: string) => void;
  commitFindSearch: (query: string, activeMatchIndex: number) => void;
}): void {
  const sel = captureTranscriptTextareaSelection() || readTranscriptTextareaSelection();
  if (args.dialogPhase === "panel") {
    if (sel) {
      args.clearFindSearchDebounce();
      args.setFindText(sel);
      args.commitFindSearch(sel, 0);
    }
    args.focusFindInput(Boolean(sel));
    return;
  }
  if (args.dialogPhase !== "closed") return;
  args.openFindReplace(sel || undefined);
}
