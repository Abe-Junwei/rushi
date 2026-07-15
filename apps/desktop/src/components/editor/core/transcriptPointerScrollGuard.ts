import { EditorState } from "@codemirror/state";

/**
 * CM6 pointer/drag selection defaults to scrollIntoView, which yanks the list
 * after structure reveal already positioned the row (delete → click same line).
 */
export const transcriptPointerScrollGuard = EditorState.transactionFilter.of((tr) => {
  if (!tr.selection || tr.scrollIntoView === false) return tr;
  if (!tr.isUserEvent("select.pointer") && !tr.isUserEvent("select.drag")) return tr;
  if (tr.startState.doc.lines !== tr.state.doc.lines) return tr;
  const startLine = tr.startState.doc.lineAt(tr.startState.selection.main.head).number;
  const endLine = tr.state.doc.lineAt(tr.selection.main.head).number;
  if (startLine !== endLine) return tr;
  return { ...tr, scrollIntoView: false };
});
