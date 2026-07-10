import { EditorView } from "@codemirror/view";
import type { SegmentDto } from "../../../tauri/projectTypes";
import { serializeTranscriptEditorState } from "./serializeTranscriptEditorState";

export type TransactionPersistenceBridgeHandlers = {
  /**
   * Called when the CM6 doc changes. Receives the serialized SegmentDto[] projection.
   * This is the only flag-on path that may feed dirty/autosave/undo from text edits.
   */
  onSegmentsProjected: (segments: SegmentDto[]) => void;
};

/**
 * Unique bridge: CM6 transaction (doc change) → SegmentDto[] projection.
 * Structure mutations (P6) must also flow through CM6 transactions that hit this bridge.
 */
export function createTransactionPersistenceBridge(
  handlers: TransactionPersistenceBridgeHandlers,
) {
  return EditorView.updateListener.of((update) => {
    if (!update.docChanged) return;
    handlers.onSegmentsProjected(serializeTranscriptEditorState(update.state));
  });
}
