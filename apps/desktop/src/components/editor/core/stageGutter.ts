import { gutter, GutterMarker, EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import {
  resolveSegmentStageLabels,
  segmentStageChipModifier,
} from "../../../services/segmentTextStage";
import { segmentMetaField, type SegmentMeta } from "./segmentMetaField";
import {
  primarySegmentIdx,
  transcriptMultiSelectionField,
  transcriptMultiSelectionEqual,
} from "./selectionField";
import { selectSegmentCommand } from "./selectionCommands";
import type { TranscriptRowSelectionKind } from "./metaGutter";
import { transcriptHoverSegmentField } from "./hoverSegmentField";

/** Compact Lucide-like strokes for stage chips (no React mount in gutter DOM). */
const STAGE_ICON_SVG: Record<string, string> = {
  auto_transcribe:
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></svg>',
  ai_revised:
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/></svg>',
  manual_transcribe:
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/></svg>',
  finalized:
    '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
};

export class TranscriptStageMarker extends GutterMarker {
  constructor(
    readonly stageMod: string,
    readonly label: string,
    readonly tooltip: string,
    readonly selectionKind: TranscriptRowSelectionKind = null,
  ) {
    super();
  }

  eq(other: TranscriptStageMarker): boolean {
    return (
      this.stageMod === other.stageMod &&
      this.label === other.label &&
      this.tooltip === other.tooltip &&
      this.selectionKind === other.selectionKind
    );
  }

  toDOM(): HTMLElement {
    const wrap = document.createElement("div");
    const kindClass =
      this.selectionKind === "primary"
        ? "cm-transcript-stage-cell--primary"
        : this.selectionKind === "in"
          ? "cm-transcript-stage-cell--in-selection"
          : this.selectionKind === "hover"
            ? "cm-transcript-stage-cell--hover"
            : "";
    wrap.className = ["cm-transcript-stage-cell", kindClass].filter(Boolean).join(" ");

    const el = document.createElement("span");
    el.className = [
      "cm-transcript-stage-chip",
      `cm-transcript-stage-chip--${this.stageMod}`,
    ].join(" ");
    el.title = this.tooltip;
    el.setAttribute("aria-label", this.tooltip);

    const icon = document.createElement("span");
    icon.className = "cm-transcript-stage-chip__icon";
    icon.innerHTML = STAGE_ICON_SVG[this.stageMod] ?? STAGE_ICON_SVG.auto_transcribe;

    const label = document.createElement("span");
    label.className = "cm-transcript-stage-chip__label";
    label.textContent = this.label;

    el.append(icon, label);
    wrap.append(el);
    return wrap;
  }
}

export function buildTranscriptStageMarker(
  meta: SegmentMeta | undefined,
  opts: { selectionKind?: TranscriptRowSelectionKind } = {},
): TranscriptStageMarker | null {
  if (!meta?.stage) return null;
  const labels = resolveSegmentStageLabels(meta.stage, meta.finalizeVia);
  const stageMod = segmentStageChipModifier(meta.stage);
  return new TranscriptStageMarker(
    stageMod,
    labels.category,
    labels.tooltip,
    opts.selectionKind ?? null,
  );
}

export type TranscriptStageGutterOptions = {
  onSelectSegment?: (idx: number, opts: { shiftKey?: boolean; toggle?: boolean }) => void;
};

/**
 * Trailing stage chip gutter (legacy SegmentRowStageBadge column parity).
 */
export function createTranscriptStageGutter(
  opts: TranscriptStageGutterOptions = {},
): Extension {
  return gutter({
    class: "cm-transcript-stage-gutter",
    side: "after",
    renderEmptyElements: true,
    lineMarker(view, line) {
      const idx = view.state.doc.lineAt(line.from).number - 1;
      const primary = primarySegmentIdx(view.state);
      const multi = view.state.field(transcriptMultiSelectionField);
      const hoverIdx = view.state.field(transcriptHoverSegmentField);
      const selectionKind: TranscriptRowSelectionKind =
        idx === primary
          ? "primary"
          : multi.selectedSet.has(idx)
            ? "in"
            : hoverIdx === idx
              ? "hover"
              : null;
      return buildTranscriptStageMarker(view.state.field(segmentMetaField)[idx], {
        selectionKind,
      });
    },
    lineMarkerChange(update) {
      const lineCountChanged = update.startState.doc.lines !== update.state.doc.lines;
      const primaryChanged =
        primarySegmentIdx(update.startState) !== primarySegmentIdx(update.state);
      return (
        lineCountChanged ||
        primaryChanged ||
        update.startState.field(segmentMetaField) !== update.state.field(segmentMetaField) ||
        !transcriptMultiSelectionEqual(
          update.startState.field(transcriptMultiSelectionField),
          update.state.field(transcriptMultiSelectionField),
        ) ||
        update.startState.field(transcriptHoverSegmentField) !==
          update.state.field(transcriptHoverSegmentField)
      );
    },
    initialSpacer: () =>
      new TranscriptStageMarker("auto_transcribe", "自动转写", "自动转写", null),
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
  // Flush against content — avoid a blank seam between text highlight and stage chip.
  ".cm-transcript-stage-gutter": {
    minWidth: "6.75rem",
    paddingLeft: "0",
    paddingRight: "0.35rem",
    borderLeft: "none",
    marginLeft: "0",
    marginRight: "0",
  },
  ".cm-transcript-stage-gutter .cm-gutterElement": {
    padding: "0",
    margin: "0",
  },
  ".cm-transcript-stage-cell": {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "flex-start",
    boxSizing: "border-box",
    minHeight: "100%",
    width: "100%",
    padding:
      "var(--cm-transcript-line-pad, 1rem) 0.5rem var(--cm-transcript-line-pad, 1rem) 0.35rem",
    borderRadius: "0",
  },
  ".cm-transcript-stage-cell--primary": {
    backgroundColor: "var(--segment-fill-selected-list)",
    borderRadius: "0 0.375rem 0.375rem 0",
  },
  ".cm-transcript-stage-cell--in-selection": {
    backgroundColor: "var(--segment-fill-in-selection-list)",
    borderRadius: "0 0.375rem 0.375rem 0",
  },
  ".cm-transcript-stage-cell--hover": {
    backgroundColor: "color-mix(in srgb, var(--notion-sidebar) 35%, transparent)",
    borderRadius: "0 0.375rem 0.375rem 0",
  },
  // Match legacy `.seg-row-stage-chip` (Notion pill + icon).
  ".cm-transcript-stage-chip": {
    display: "inline-flex",
    boxSizing: "border-box",
    alignItems: "center",
    gap: "0.25rem",
    height: "1.375rem",
    minHeight: "1.375rem",
    maxWidth: "6.5rem",
    padding: "0 0.5rem 0 0.3125rem",
    borderRadius: "9999px",
    border: "1px solid transparent",
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    fontSize: "var(--text-label, 0.75rem)",
    fontWeight: "500",
    lineHeight: "1",
    letterSpacing: "-0.01em",
    overflow: "hidden",
    flexShrink: "0",
    cursor: "cell",
  },
  ".cm-transcript-stage-chip__icon": {
    display: "inline-flex",
    flexShrink: "0",
    alignItems: "center",
    justifyContent: "center",
    width: "0.875rem",
    height: "0.875rem",
    opacity: "0.92",
  },
  ".cm-transcript-stage-chip__icon svg": {
    width: "0.75rem",
    height: "0.75rem",
    display: "block",
  },
  ".cm-transcript-stage-chip__label": {
    minWidth: "0",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  ".cm-transcript-stage-chip--auto_transcribe": {
    background: "var(--notion-callout-bg)",
    borderColor: "var(--notion-callout-border)",
    color: "var(--notion-text-muted)",
  },
  ".cm-transcript-stage-chip--ai_revised": {
    background: "color-mix(in srgb, var(--accent-action) 16%, var(--notion-bg))",
    borderColor: "color-mix(in srgb, var(--accent-action) 34%, var(--notion-divider))",
    color: "var(--accent-action)",
  },
  ".cm-transcript-stage-chip--manual_transcribe": {
    background: "color-mix(in srgb, var(--zen-status-warn) 14%, var(--notion-bg))",
    borderColor: "color-mix(in srgb, var(--zen-status-warn) 28%, var(--notion-divider))",
    color: "var(--zen-status-warn-action)",
  },
  ".cm-transcript-stage-chip--finalized": {
    background: "var(--zen-success-surface)",
    borderColor: "var(--zen-success-border)",
    color: "var(--zen-success)",
  },
});

export const transcriptStageGutterExtensions = (
  opts: TranscriptStageGutterOptions = {},
): Extension[] => [createTranscriptStageGutter(opts), transcriptStageGutterTheme];
