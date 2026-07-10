import { gutter, GutterMarker, EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import { formatTranscriptTimestamp } from "../../segmentRow/segmentRowFormatting";
import { segmentMetaField, type SegmentMeta } from "./segmentMetaField";
import {
  primarySegmentIdx,
  transcriptMultiSelectionField,
} from "./selectionField";
import { selectSegmentCommand } from "./selectionCommands";

/** Match legacy SegmentTextListRow meta column width derivation. */
export function computeTranscriptMetaGutterWidthPx(segmentMetaWidthPx: number): number {
  return Math.max(44, Math.round((segmentMetaWidthPx - 10) / 2));
}

export class TranscriptMetaMarker extends GutterMarker {
  constructor(
    readonly indexLabel: string,
    readonly timeLabel: string,
    readonly highlighted: boolean,
  ) {
    super();
  }

  eq(other: TranscriptMetaMarker): boolean {
    return (
      this.indexLabel === other.indexLabel &&
      this.timeLabel === other.timeLabel &&
      this.highlighted === other.highlighted
    );
  }

  toDOM(): HTMLElement {
    const el = document.createElement("div");
    el.className = [
      "cm-transcript-meta-marker",
      this.highlighted ? "cm-transcript-meta-marker--active" : "",
    ]
      .filter(Boolean)
      .join(" ");
    el.title = `${this.indexLabel} ${this.timeLabel}`;

    const indexEl = document.createElement("span");
    indexEl.className = "cm-transcript-meta-index";
    indexEl.textContent = this.indexLabel;

    const timeEl = document.createElement("span");
    timeEl.className = "cm-transcript-meta-time";
    timeEl.textContent = this.timeLabel;

    el.append(indexEl, timeEl);
    return el;
  }
}

export type TranscriptMetaGutterOptions = {
  /**
   * Transitional P3→P5: bridge SC1/waveform when gutter selects a line.
   * Remove once waveform reads transcriptProjection only.
   */
  onSelectSegment?: (idx: number, opts: { shiftKey?: boolean; toggle?: boolean }) => void;
};

/** Pure marker builder (also used by tests). Left gutter = index + timestamp only. */
export function buildTranscriptMetaMarker(
  meta: SegmentMeta | undefined,
  idx: number,
  opts: { highlighted?: boolean } = {},
): TranscriptMetaMarker | null {
  if (!meta) return null;
  return new TranscriptMetaMarker(
    `${idx + 1}.`,
    formatTranscriptTimestamp(meta.startSec),
    opts.highlighted === true,
  );
}

/**
 * Product meta gutter: index + timestamp in the CM6 viewport (legacy left column).
 * Stage chip lives in {@link createTranscriptStageGutter} (side after).
 * Speaker / per-row height handle: deferred (no product speaker field; height is global font).
 */
export function createTranscriptMetaGutter(
  opts: TranscriptMetaGutterOptions = {},
): Extension {
  return gutter({
    class: "cm-transcript-meta-gutter",
    renderEmptyElements: true,
    lineMarker(view, line) {
      const lineNo = view.state.doc.lineAt(line.from).number;
      const idx = lineNo - 1;
      const primary = primarySegmentIdx(view.state);
      const multi = view.state.field(transcriptMultiSelectionField);
      const highlighted = idx === primary || multi.selectedSet.has(idx);
      return buildTranscriptMetaMarker(view.state.field(segmentMetaField)[idx], idx, {
        highlighted,
      });
    },
    lineMarkerChange(update) {
      return (
        update.docChanged ||
        update.selectionSet ||
        update.startState.field(segmentMetaField) !== update.state.field(segmentMetaField) ||
        update.startState.field(transcriptMultiSelectionField) !==
          update.state.field(transcriptMultiSelectionField)
      );
    },
    initialSpacer: () => new TranscriptMetaMarker("1.", "00:00:00", false),
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

/** Notion/Zen-aligned left meta gutter (width via --cm-meta-gutter-width). */
export const transcriptMetaGutterTheme = EditorView.theme({
  ".cm-transcript-meta-gutter": {
    width: "var(--cm-meta-gutter-width, 4.75rem)",
    minWidth: "var(--cm-meta-gutter-width, 4.75rem)",
    paddingRight: "0.35rem",
    boxSizing: "border-box",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: "0.75rem",
    fontVariantNumeric: "tabular-nums",
  },
  ".cm-transcript-meta-marker": {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "0.15rem",
    padding: "0.35rem 0.4rem 0.15rem 0.25rem",
    lineHeight: "1.2",
    cursor: "cell",
    color: "var(--color-notion-text-light, var(--notion-text-light, #9b9a97))",
  },
  ".cm-transcript-meta-marker--active": {
    color: "var(--color-notion-text-muted, var(--notion-text-muted, #787774))",
  },
  ".cm-transcript-meta-index, .cm-transcript-meta-time": {
    fontWeight: "500",
    letterSpacing: "0.01em",
  },
});

export const transcriptMetaGutterExtensions = (
  opts: TranscriptMetaGutterOptions = {},
): Extension[] => [createTranscriptMetaGutter(opts), transcriptMetaGutterTheme];
