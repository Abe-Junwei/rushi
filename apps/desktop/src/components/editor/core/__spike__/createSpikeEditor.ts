import { EditorView } from "@codemirror/view";
import type { SegmentDto } from "../../../../tauri/projectTypes";
import { buildSpikeEditorState } from "./buildSpikeEditorState";

/** CM6 exposes EDIT_CONTEXT at runtime; typings may lag behind. */
type EditorViewWithEditContext = typeof EditorView & { EDIT_CONTEXT?: boolean };

export type MountSpikeEditorOptions = {
  /**
   * When false, forces classic contenteditable path (recommended for WebView2 CJK IME spike).
   * See CodeMirror `EditorView.EDIT_CONTEXT`.
   */
  editContext?: boolean;
  /** Parent height for scroll viewport (px). */
  heightPx?: number;
};

/**
 * Mount a spike EditorView. Caller owns destroy via returned view.destroy().
 */
export function mountSpikeEditor(
  parent: HTMLElement,
  segments: readonly SegmentDto[],
  opts: MountSpikeEditorOptions = {},
): EditorView {
  const ViewCtor = EditorView as EditorViewWithEditContext;
  const prevEditContext = ViewCtor.EDIT_CONTEXT;
  if (opts.editContext === false) {
    ViewCtor.EDIT_CONTEXT = false;
  } else if (opts.editContext === true) {
    ViewCtor.EDIT_CONTEXT = true;
  }

  const heightPx = opts.heightPx ?? 480;
  const state = buildSpikeEditorState(segments, {
    extensions: [
      EditorView.theme({
        "&": { height: `${heightPx}px` },
        ".cm-scroller": { overflow: "auto" },
        ".cm-spike-active-line": {
          backgroundColor: "color-mix(in srgb, var(--accent-action) 18%, transparent)",
        },
        ".cm-spike-meta-gutter": {
          minWidth: "3.5rem",
          color: "var(--color-ink-muted, #6b6b6b)",
          fontSize: "0.75rem",
        },
        ".cm-spike-meta-time": {
          padding: "0 0.35rem",
          fontVariantNumeric: "tabular-nums",
        },
      }),
      EditorView.contentAttributes.of({
        autocorrect: "off",
        autocapitalize: "off",
        spellcheck: "false",
      }),
      EditorView.lineWrapping,
    ],
  });

  const view = new EditorView({ state, parent });

  // Restore global flag so other editors in the same page are not permanently affected.
  // Spike pages should mount one editor at a time when comparing EditContext on/off.
  ViewCtor.EDIT_CONTEXT = prevEditContext;

  return view;
}

/** Select the document line for segment index (0-based). */
export function spikeSelectSegmentLine(view: EditorView, segmentIdx: number): void {
  const lineNo = segmentIdx + 1;
  if (lineNo < 1 || lineNo > view.state.doc.lines) return;
  const line = view.state.doc.line(lineNo);
  view.dispatch({
    selection: { anchor: line.from },
    scrollIntoView: true,
  });
}
