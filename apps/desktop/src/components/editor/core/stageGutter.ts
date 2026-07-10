import { gutter, GutterMarker, EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import {
  resolveSegmentStageLabels,
  segmentStageChipModifier,
} from "../../../services/segmentTextStage";
import { segmentMetaField, type SegmentMeta } from "./segmentMetaField";
import { selectSegmentCommand } from "./selectionCommands";

export class TranscriptStageMarker extends GutterMarker {
  constructor(
    readonly stageMod: string,
    readonly label: string,
    readonly tooltip: string,
  ) {
    super();
  }

  eq(other: TranscriptStageMarker): boolean {
    return (
      this.stageMod === other.stageMod &&
      this.label === other.label &&
      this.tooltip === other.tooltip
    );
  }

  toDOM(): HTMLElement {
    const el = document.createElement("span");
    el.className = [
      "cm-transcript-stage-chip",
      `cm-transcript-stage-chip--${this.stageMod}`,
    ].join(" ");
    el.title = this.tooltip;
    el.setAttribute("aria-label", this.tooltip);
    el.textContent = this.label;
    return el;
  }
}

export function buildTranscriptStageMarker(
  meta: SegmentMeta | undefined,
): TranscriptStageMarker | null {
  if (!meta?.stage) return null;
  const labels = resolveSegmentStageLabels(meta.stage, meta.finalizeVia);
  const stageMod = segmentStageChipModifier(meta.stage);
  return new TranscriptStageMarker(stageMod, labels.category, labels.tooltip);
}

export type TranscriptStageGutterOptions = {
  onSelectSegment?: (idx: number, opts: { shiftKey?: boolean; toggle?: boolean }) => void;
};

/**
 * Trailing stage chip gutter (legacy SegmentRowStageBadge column parity).
 * Annotation / draft-dot stay on P7.
 */
export function createTranscriptStageGutter(
  opts: TranscriptStageGutterOptions = {},
): Extension {
  return gutter({
    class: "cm-transcript-stage-gutter",
    side: "after",
    renderEmptyElements: false,
    lineMarker(view, line) {
      const idx = view.state.doc.lineAt(line.from).number - 1;
      return buildTranscriptStageMarker(view.state.field(segmentMetaField)[idx]);
    },
    lineMarkerChange(update) {
      return (
        update.docChanged ||
        update.startState.field(segmentMetaField) !== update.state.field(segmentMetaField)
      );
    },
    initialSpacer: () => new TranscriptStageMarker("auto_transcribe", "自动", "自动转写"),
    domEventHandlers: {
      mousedown(view, line, event) {
        const mouse = event as MouseEvent;
        const idx = view.state.doc.lineAt(line.from).number - 1;
        const toggle = mouse.metaKey || mouse.ctrlKey;
        const shiftKey = mouse.shiftKey;
        selectSegmentCommand(view, idx, { toggle, shiftKey });
        opts.onSelectSegment?.(idx, { toggle, shiftKey });
        return true;
      },
    },
  });
}

export const transcriptStageGutterTheme = EditorView.theme({
  ".cm-transcript-stage-gutter": {
    minWidth: "4.5rem",
    paddingLeft: "0.35rem",
  },
  ".cm-transcript-stage-chip": {
    display: "inline-flex",
    alignItems: "center",
    maxWidth: "4.25rem",
    marginTop: "0.35rem",
    padding: "0.1rem 0.35rem",
    borderRadius: "0.25rem",
    border: "1px solid var(--notion-divider, #e3e2e0)",
    fontSize: "0.65rem",
    fontWeight: "500",
    lineHeight: "1.2",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    cursor: "cell",
  },
  ".cm-transcript-stage-chip--auto_transcribe": {
    background: "var(--notion-callout-bg, #f1f1ef)",
    borderColor: "var(--notion-callout-border, #e3e2e0)",
    color: "var(--notion-text-muted, #787774)",
  },
  ".cm-transcript-stage-chip--ai_revised": {
    background: "color-mix(in srgb, var(--accent-action, #c45c26) 16%, var(--notion-bg, #fff))",
    borderColor: "color-mix(in srgb, var(--accent-action, #c45c26) 34%, var(--notion-divider, #e3e2e0))",
    color: "var(--accent-action, #c45c26)",
  },
  ".cm-transcript-stage-chip--manual_transcribe": {
    background: "color-mix(in srgb, var(--zen-status-warn, #cb912f) 14%, var(--notion-bg, #fff))",
    borderColor: "color-mix(in srgb, var(--zen-status-warn, #cb912f) 28%, var(--notion-divider, #e3e2e0))",
    color: "var(--zen-status-warn-action, #9a6700)",
  },
  ".cm-transcript-stage-chip--finalized": {
    background: "var(--zen-success-surface, #eef6ee)",
    borderColor: "var(--zen-success-border, #c7e0c7)",
    color: "var(--zen-success, #2f6b2f)",
  },
});

export const transcriptStageGutterExtensions = (
  opts: TranscriptStageGutterOptions = {},
): Extension[] => [createTranscriptStageGutter(opts), transcriptStageGutterTheme];
