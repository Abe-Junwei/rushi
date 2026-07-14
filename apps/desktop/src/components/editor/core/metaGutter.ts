import { gutter, GutterMarker, EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";
import { formatTranscriptTimestamp } from "../../segmentRow/segmentRowFormatting";
import { segmentMetaField, type SegmentMeta } from "./segmentMetaField";
import {
  primarySegmentIdx,
  transcriptMultiSelectionField,
  transcriptMultiSelectionEqual,
} from "./selectionField";
import { selectSegmentCommand } from "./selectionCommands";
import { transcriptPlaybackFocusField } from "./playbackFocusField";
import { transcriptGutterChromeBaseTheme } from "./transcriptGutterChromeTheme";
import { shouldApplyContextMenuSelection } from "../../../services/selection/segmentContextMenuSelection";
import {
  isTranscriptSegmentVisible,
  transcriptFilterVisibilityChanged,
} from "./filterLineVisibility";

export type TranscriptRowSelectionKind = "primary" | "in" | "playback" | null;

/** Left meta gutter width — full legacy meta column (stage lives in the after gutter). */
export function computeTranscriptMetaGutterWidthPx(segmentMetaWidthPx: number): number {
  return Math.max(80, Math.round(segmentMetaWidthPx));
}

export class TranscriptMetaMarker extends GutterMarker {
  constructor(
    readonly indexLabel: string,
    readonly timeLabel: string,
    readonly selectionKind: TranscriptRowSelectionKind,
    /** True when this row is the current playback-focus line (may coexist with primary). */
    readonly isPlaybackFocus: boolean = false,
    /** Frozen primary uses a muted accent bar instead of saffron. */
    readonly frozen: boolean = false,
  ) {
    super();
  }

  /** @deprecated use selectionKind; kept for existing tests */
  get highlighted(): boolean {
    return this.selectionKind != null || this.isPlaybackFocus;
  }

  eq(other: TranscriptMetaMarker): boolean {
    return (
      this.indexLabel === other.indexLabel &&
      this.timeLabel === other.timeLabel &&
      this.selectionKind === other.selectionKind &&
      this.isPlaybackFocus === other.isPlaybackFocus &&
      this.frozen === other.frozen
    );
  }

  toDOM(): HTMLElement {
    const el = document.createElement("div");
    const kindClass =
      this.selectionKind === "primary" && this.isPlaybackFocus
        ? "cm-transcript-meta-marker--primary-playback"
        : this.selectionKind === "primary"
          ? "cm-transcript-meta-marker--primary"
          : this.selectionKind === "in"
            ? "cm-transcript-meta-marker--in-selection"
            : this.selectionKind === "playback"
              ? "cm-transcript-meta-marker--playback"
              : "";
    el.className = [
      "cm-transcript-meta-marker",
      kindClass,
      this.frozen ? "cm-transcript-meta-marker--frozen" : "",
    ]
      .filter(Boolean)
      .join(" ");
    el.title = `${this.indexLabel} ${this.timeLabel}`;

    // Frozen rows omit the left accent bar (selection is the soft callout wash only).
    if (this.selectionKind === "primary" && !this.frozen) {
      const bar = document.createElement("span");
      bar.className = "cm-transcript-meta-accent";
      bar.setAttribute("aria-hidden", "true");
      el.append(bar);
    }

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
  onSelectSegment?: (idx: number, opts: { shiftKey?: boolean; toggle?: boolean }) => void;
};

/** Pure marker builder (also used by tests). Left gutter = index + timestamp only. */
export function buildTranscriptMetaMarker(
  meta: SegmentMeta | undefined,
  idx: number,
  opts: {
    highlighted?: boolean;
    selectionKind?: TranscriptRowSelectionKind;
    isPlaybackFocus?: boolean;
  } = {},
): TranscriptMetaMarker | null {
  if (!meta) return null;
  const selectionKind =
    opts.selectionKind ?? (opts.highlighted ? "primary" : null);
  return new TranscriptMetaMarker(
    `${idx + 1}.`,
    formatTranscriptTimestamp(meta.startSec),
    selectionKind,
    opts.isPlaybackFocus === true,
    Boolean(meta.frozen),
  );
}

function selectionKindForIdx(
  idx: number,
  primary: number,
  selectedSet: ReadonlySet<number>,
  playbackIdx: number | null,
): TranscriptRowSelectionKind {
  if (idx === primary) return "primary";
  if (selectedSet.has(idx)) return "in";
  if (playbackIdx != null && playbackIdx === idx) return "playback";
  return null;
}

/**
 * Product meta gutter: index + timestamp in the CM6 viewport (legacy left column).
 * Stage chip lives in {@link createTranscriptStageGutter} (side after).
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
      // Filter-hidden lines collapse via display:none; keep gutter empty so
      // zero-height marker DOM does not overflow and stack onto visible rows.
      if (!isTranscriptSegmentVisible(view.state, idx)) return null;
      const primary = primarySegmentIdx(view.state);
      const multi = view.state.field(transcriptMultiSelectionField);
      const playbackIdx = view.state.field(transcriptPlaybackFocusField);
      return buildTranscriptMetaMarker(view.state.field(segmentMetaField)[idx], idx, {
        selectionKind: selectionKindForIdx(
          idx,
          primary,
          multi.selectedSet,
          playbackIdx,
        ),
        isPlaybackFocus: playbackIdx != null && playbackIdx === idx,
      });
    },
    lineMarkerChange(update) {
      const lineCountChanged = update.startState.doc.lines !== update.state.doc.lines;
      const primaryChanged =
        primarySegmentIdx(update.startState) !== primarySegmentIdx(update.state);
      return (
        lineCountChanged ||
        primaryChanged ||
        transcriptFilterVisibilityChanged(update) ||
        update.startState.field(segmentMetaField) !== update.state.field(segmentMetaField) ||
        !transcriptMultiSelectionEqual(
          update.startState.field(transcriptMultiSelectionField),
          update.state.field(transcriptMultiSelectionField),
        ) ||
        update.startState.field(transcriptPlaybackFocusField) !==
          update.state.field(transcriptPlaybackFocusField)
      );
    },
    initialSpacer: () => new TranscriptMetaMarker("1.", "00:00:00", null),
    domEventHandlers: {
      mousedown(view, line, event) {
        const mouse = event as MouseEvent;
        const idx = view.state.doc.lineAt(line.from).number - 1;
        const multi = view.state.field(transcriptMultiSelectionField);
        if (mouse.button !== 0) {
          mouse.preventDefault();
          if (
            shouldApplyContextMenuSelection({
              segmentIdx: idx,
              isIndexInSelection: (i) => multi.selectedSet.has(i),
              selectionCount: multi.selectedSet.size,
            })
          ) {
            selectSegmentCommand(view, idx, { scrollIntoView: false });
            opts.onSelectSegment?.(idx, { toggle: false, shiftKey: false });
          }
          return true;
        }
        const toggle = mouse.metaKey || mouse.ctrlKey;
        const shiftKey = mouse.shiftKey;
        selectSegmentCommand(view, idx, { toggle, shiftKey, scrollIntoView: false });
        opts.onSelectSegment?.(idx, { toggle, shiftKey });
        return true;
      },
    },
  });
}

/** Notion/Zen-aligned left meta gutter (width via --cm-meta-gutter-width). */
export const transcriptMetaGutterTheme = EditorView.theme({
  ".cm-gutters": {
    backgroundColor: "transparent",
    border: "none",
    margin: "0",
  },
  ".cm-transcript-meta-gutter": {
    width: "var(--cm-meta-gutter-width, 8.25rem)",
    minWidth: "var(--cm-meta-gutter-width, 8.25rem)",
    paddingRight: "0",
    marginRight: "0",
    boxSizing: "border-box",
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: "0.75rem",
    fontVariantNumeric: "tabular-nums",
  },
  ".cm-transcript-meta-gutter .cm-gutterElement": {
    padding: "0",
    display: "flex",
    alignItems: "stretch",
    boxSizing: "border-box",
    // Selection wash lives only on .cm-line (+ box-shadow). Gutter caps used to
    // paint via :has(marker) and lagged one frame behind ↑↓ selection moves.
    backgroundColor: "transparent",
    transition: "none",
  },
  ".cm-transcript-meta-marker": {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    justifyContent: "flex-start",
    gap: "0.25rem",
    boxSizing: "border-box",
    flex: "1 1 auto",
    alignSelf: "stretch",
    width: "100%",
    height: "100%",
    minHeight: "100%",
    // Accent bar 4px + 5px gap before index/time.
    padding:
      "var(--cm-transcript-line-pad, 1rem) 0.75rem var(--cm-transcript-line-pad, 1rem) 9px",
    lineHeight: "1.2",
    cursor: "cell",
    color: "var(--notion-text-light)",
    borderRadius: "0",
    backgroundColor: "transparent",
    transition: "none",
  },
  ".cm-transcript-meta-accent": {
    position: "absolute",
    left: "0",
    top: "0",
    bottom: "0",
    width: "4px",
    borderRadius: "0.375rem 0 0 0.375rem",
    backgroundColor: "var(--accent-action)",
    pointerEvents: "none",
  },
  ".cm-transcript-meta-marker--primary": {
    color: "var(--notion-text-muted)",
  },
  ".cm-transcript-meta-marker--primary-playback": {
    color: "var(--notion-text-muted)",
  },
  ".cm-transcript-meta-marker--in-selection": {
    color: "var(--notion-text-muted)",
  },
  ".cm-transcript-meta-marker--playback": {
    color: "var(--notion-text-muted)",
  },
  ".cm-transcript-meta-index, .cm-transcript-meta-time": {
    fontWeight: "500",
    letterSpacing: "0.01em",
    fontSize: "var(--text-label, 0.75rem)",
  },
});

export const transcriptMetaGutterExtensions = (
  opts: TranscriptMetaGutterOptions = {},
): Extension[] => [
  transcriptGutterChromeBaseTheme,
  createTranscriptMetaGutter(opts),
  transcriptMetaGutterTheme,
];
