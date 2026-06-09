import { useEffect, useRef } from "react";
import { isCorrectionRulesPanelOpen } from "../pages/correctionRulesPanelTypes";
import { isFindReplacePanelOpen } from "../pages/findReplaceTypes";

export function useSegmentRowTextFieldFocusSync(input: {
  selected: boolean;
  busy: boolean;
  focusOnSelectRef: React.MutableRefObject<boolean>;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  findReplaceHighlight?: { charStart: number; charEnd: number } | null;
  correctionRulesHighlight?: { charStart: number; charEnd: number } | null;
}) {
  const {
    selected,
    busy,
    focusOnSelectRef,
    textareaRef,
    findReplaceHighlight,
    correctionRulesHighlight,
  } = input;
  const lastSyncedFindHighlightRef = useRef<string | null>(null);

  useEffect(() => {
    if (!selected || busy) return;
    const el = textareaRef.current;
    const panelHighlight = findReplaceHighlight ?? correctionRulesHighlight;
    const panelPreviewOpen = isFindReplacePanelOpen() || isCorrectionRulesPanelOpen();
    if (panelHighlight) {
      if (panelPreviewOpen) return;
      const key = `${panelHighlight.charStart}:${panelHighlight.charEnd}`;
      if (lastSyncedFindHighlightRef.current === key) return;
      lastSyncedFindHighlightRef.current = key;
      el?.focus();
      el?.setSelectionRange(panelHighlight.charStart, panelHighlight.charEnd);
      return;
    }
    lastSyncedFindHighlightRef.current = null;
    if (!el || !focusOnSelectRef.current) return;
    el.focus();
    const end = el.value.length;
    el.setSelectionRange(end, end);
    focusOnSelectRef.current = false;
  }, [busy, correctionRulesHighlight, findReplaceHighlight, focusOnSelectRef, selected, textareaRef]);

  useEffect(() => {
    if (selected) return;
    focusOnSelectRef.current = false;
  }, [focusOnSelectRef, selected]);
}
