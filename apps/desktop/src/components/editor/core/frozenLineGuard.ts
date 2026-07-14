import { EditorState } from "@codemirror/state";
import { segmentMetaField } from "./segmentMetaField";
import { transcriptStructureEditAnnotation } from "./transcriptEditorKeymap";

/**
 * Reject user text edits that touch frozen segment lines.
 * Structure transactions (annotated) may still rewrite the doc.
 */
export const transcriptFrozenLineGuard = EditorState.transactionFilter.of((tr) => {
  if (!tr.docChanged) return tr;
  if (tr.annotation(transcriptStructureEditAnnotation)) return tr;
  const meta = tr.startState.field(segmentMetaField, false);
  if (!meta || meta.length === 0) return tr;
  let blocked = false;
  tr.changes.iterChangedRanges((fromA, toA) => {
    if (blocked) return;
    const fromLine = tr.startState.doc.lineAt(fromA).number - 1;
    const toLine = tr.startState.doc.lineAt(Math.max(fromA, toA - 1)).number - 1;
    for (let i = fromLine; i <= toLine; i++) {
      if (meta[i]?.frozen) {
        blocked = true;
        return;
      }
    }
  });
  return blocked ? [] : tr;
});
