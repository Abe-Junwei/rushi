import { useDeferredValue, useMemo } from "react";
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
    spansForText,
    onCorrectableSpanClick: _onCorrectableSpanClick,
    ...editingArgs
  } = args;

  const editing = useSegmentRowTextFieldEditing({ ...editingArgs, spansForText, selected, busy });

  useSegmentRowTextFieldFocusSync({
    selected,
    busy,
    focusOnSelectRef,
    textareaRef: editing.textareaRef,
    findReplaceHighlight,
    correctionRulesHighlight,
  });

  const textAreaMinHeight = Math.max(36, Math.round(segmentRowHeightPx - 24));
  const panelHighlight = findReplaceHighlight ?? correctionRulesHighlight;
  const panelPreviewOpen = isFindReplacePanelOpen() || isCorrectionRulesPanelOpen();
  const hasPanelHighlight = panelHighlight != null;
  const showPanelHighlightMirror = panelPreviewOpen && hasPanelHighlight && !busy;

  const deferredLiveText = useDeferredValue(editing.liveText);
  const mirrorLiveText = selected
    ? panelPreviewOpen
      ? editing.liveText
      : deferredLiveText
    : editing.committedText;
  const mirrorCorrectableSpans = useMemo(
    () => spansForText(mirrorLiveText),
    [mirrorLiveText, spansForText],
  );

  const showCorrectableMirror =
    !panelHighlight &&
    mirrorCorrectableSpans.length > 0 &&
    !busy &&
    (!selected || !editing.isTextareaFocused);

  return {
    ...editing,
    textAreaMinHeight,
    panelHighlight,
    hasPanelHighlight,
    showPanelHighlightMirror,
    showCorrectableMirror,
    mirrorLiveText,
    mirrorCorrectableSpans,
  };
}
