import { EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";

/**
 * Kill CM6 default light gutter chrome:
 * `&light .cm-gutters` → #f5f5f5 background + borderRightWidth/borderLeftWidth 1px.
 * Those rules only yield to `EditorView.baseTheme` (same specificity) or !important.
 * They are the source of the vertical “细线/凹陷” between meta | text | stage.
 */
export const transcriptGutterChromeBaseTheme: Extension = EditorView.baseTheme({
  "&light .cm-gutters": {
    backgroundColor: "transparent",
    color: "inherit",
    border: "0px solid transparent",
    "&.cm-gutters-before": { borderRightWidth: "0" },
    "&.cm-gutters-after": { borderLeftWidth: "0" },
  },
  "&dark .cm-gutters": {
    backgroundColor: "transparent",
    color: "inherit",
    border: "0px solid transparent",
    "&.cm-gutters-before": { borderRightWidth: "0" },
    "&.cm-gutters-after": { borderLeftWidth: "0" },
  },
});
