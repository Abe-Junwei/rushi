import { serializeTranscriptEditorState } from "./serializeTranscriptEditorState";
import { primarySegmentIdx } from "./selectionField";
import { getTranscriptEditorView } from "./transcriptEditorViewHandle";
import { readTranscriptEditorCoreEnabled } from "./transcriptEditorCoreFlag";
import {
  applyProjectedStructureMutation,
  type ApplyProjectedStructureMutationHandlers,
} from "./applyProjectedStructureMutation";
import type { SegmentDto } from "../../../tauri/projectTypes";

/**
 * After a CM6 structure command, persist via legacy pushUndo + publishStructure.
 * Returns false when core flag is off or no view is mounted.
 */
export function persistTranscriptStructureFromView(
  baseline: readonly SegmentDto[],
  handlers: Omit<ApplyProjectedStructureMutationHandlers, "getBaseline">,
): boolean {
  if (!readTranscriptEditorCoreEnabled()) return false;
  const view = getTranscriptEditorView();
  if (!view) return false;
  const projected = serializeTranscriptEditorState(view.state);
  applyProjectedStructureMutation(projected, primarySegmentIdx(view.state), {
    getBaseline: () => baseline,
    ...handlers,
  });
  return true;
}
