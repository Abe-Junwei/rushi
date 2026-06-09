import { isCorrectionRulesPanelOpen } from "../pages/correctionRulesPanelTypes";
import { isFindReplacePanelOpen } from "../pages/findReplaceTypes";
import { useSegmentRowTextFieldEditing } from "./useSegmentRowTextFieldEditing";
import { useSegmentRowTextFieldFocusSync } from "./useSegmentRowTextFieldFocusSync";
import type { SegmentRowTextFieldControllerArgs } from "./useSegmentRowTextFieldController.types";

export type { SegmentRowTextFieldControllerArgs } from "./useSegmentRowTextFieldController.types";

export function useSegmentRowTextFieldController(args: SegmentRowTextFieldControllerArgs) {
  const {
    selected,
    busy,
    segmentRowHeightPx,
    focusOnSelectRef,
    findReplaceHighlight,
    correctionRulesHighlight,
    onCorrectableSpanClick: _onCorrectableSpanClick,
    ...editingArgs
  } = args;

  const editing = useSegmentRowTextFieldEditing({ ...editingArgs, selected, busy });

  useSegmentRowTextFieldFocusSync({
    selected,
    busy,
    focusOnSelectRef,
    textareaRef: editing.textareaRef,
    findReplaceHighlight,
    correctionRulesHighlight,
  });

  const textAreaMinHeight = Math.max(36, Math.round(segmentRowHeightPx - (selected ? 24 : 30)));
  const panelHighlight = findReplaceHighlight ?? correctionRulesHighlight;
  const panelPreviewOpen = isFindReplacePanelOpen() || isCorrectionRulesPanelOpen();
  const hasPanelHighlight = panelHighlight != null;
  const showPanelHighlightMirror = selected && panelPreviewOpen && hasPanelHighlight && !busy;
  const showCorrectableMirror =
    selected &&
    !panelHighlight &&
    editing.correctableSpans.length > 0 &&
    !busy;

  return {
    ...editing,
    textAreaMinHeight,
    panelHighlight,
    hasPanelHighlight,
    showPanelHighlightMirror,
    showCorrectableMirror,
  };
}
