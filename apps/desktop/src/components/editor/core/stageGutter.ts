import { gutter, GutterMarker, EditorView } from "@codemirror/view";
import type { EditorState, Extension, TransactionSpec } from "@codemirror/state";
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
import { transcriptPlaybackFocusField } from "./playbackFocusField";
import { shouldApplyContextMenuSelection } from "../../../services/selection/segmentContextMenuSelection";
import {
  isTranscriptSegmentVisible,
  transcriptFilterVisibilityChanged,
} from "./filterLineVisibility";

/**
 * Stage + annotation mark icons — one stroke system, always `currentColor`.
 * Glyphs mirror PRODUCT_ICON (Bot / Wand2 / PenLine / CircleCheck / MessageSquare).
 * Chip + annotation share grayscale `--cm-stage-affordance` (no plate / no per-stage hue).
 */
const ICON_STROKE =
  'fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"';

function transcriptGutterIconSvg(innerPaths: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" ${ICON_STROKE} aria-hidden="true">${innerPaths}</svg>`;
}

/** Compact stage set — readable at 12px (机转 / AI改 / 手改 / 一校 / 定稿). */
const STAGE_ICON_SVG: Record<string, string> = {
  // Bot — ASR / machine
  auto_transcribe: transcriptGutterIconSvg(
    '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>',
  ),
  // Wand2 — AI rewrite (same semantic as PRODUCT_ICON.stageAiRevised / aiRefine)
  ai_revised: transcriptGutterIconSvg(
    '<path d="m21.64 3.64-1.28-1.28a1.21 1.21 0 0 0-1.72 0L2.36 18.64a1.21 1.21 0 0 0 0 1.72l1.28 1.28a1.2 1.2 0 0 0 1.72 0L21.64 5.36a1.2 1.2 0 0 0 0-1.72"/><path d="m14 7 3 3"/><path d="M5 6v4"/><path d="M19 14v4"/><path d="M10 2v2"/><path d="M7 8H3"/><path d="M21 16h-4"/><path d="M11 3H9"/>',
  ),
  // PenLine — manual edit
  manual_transcribe: transcriptGutterIconSvg(
    '<path d="M12 20h9"/><path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/>',
  ),
  // EyeCheck — first proof (校阅过目；对齐 PRODUCT_ICON.stageFirstProof)
  first_proof: transcriptGutterIconSvg(
    '<path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0"/><path d="M11.102 17.957c-3.204 -.307 -5.904 -2.294 -8.102 -5.957c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6a19.5 19.5 0 0 1 -.663 1.032"/><path d="M15 19l2 2l4 -4"/>',
  ),
  // CircleCheck — finalized (stronger “sealed” read than bare check)
  finalized: transcriptGutterIconSvg(
    '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  ),
};

/** MessageSquare — annotation present (ambient glyph; matches PRODUCT_ICON.segmentAnnotation). */
const ANNOTATION_DOC_ICON_SVG = transcriptGutterIconSvg(
  '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
);

export const CM_SEGMENT_ANNOTATION_ATTR = "data-cm-segment-annotation";

export class TranscriptStageMarker extends GutterMarker {
  constructor(
    readonly stageMod: string,
    readonly label: string,
    readonly tooltip: string,
    readonly selectionKind: TranscriptRowSelectionKind = null,
    /** True when this row is the current playback-focus line (may coexist with primary). */
    readonly isPlaybackFocus: boolean = false,
    /** Content-hover affordance (stage chip ink). */
    readonly rowHover: boolean = false,
    /** Show document icon to the right of the stage chip when the segment has a note. */
    readonly hasAnnotation: boolean = false,
  ) {
    super();
  }

  eq(other: TranscriptStageMarker): boolean {
    return (
      this.stageMod === other.stageMod &&
      this.label === other.label &&
      this.tooltip === other.tooltip &&
      this.selectionKind === other.selectionKind &&
      this.isPlaybackFocus === other.isPlaybackFocus &&
      this.rowHover === other.rowHover &&
      this.hasAnnotation === other.hasAnnotation
    );
  }

  toDOM(): HTMLElement {
    const wrap = document.createElement("div");
    const kindClass =
      this.selectionKind === "primary" && this.isPlaybackFocus
        ? "cm-transcript-stage-cell--primary-playback"
        : this.selectionKind === "primary"
          ? "cm-transcript-stage-cell--primary"
          : this.selectionKind === "in"
            ? "cm-transcript-stage-cell--in-selection"
            : this.selectionKind === "playback"
              ? "cm-transcript-stage-cell--playback"
              : "";
    wrap.className = [
      "cm-transcript-stage-cell",
      kindClass,
      this.rowHover ? "cm-transcript-stage-cell--row-hover" : "",
    ]
      .filter(Boolean)
      .join(" ");

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

    // Always reserve the annotation slot so the stage chip does not shift left
    // when a note appears (column width stays at the "has note" size).
    if (this.hasAnnotation) {
      const note = document.createElement("button");
      note.type = "button";
      note.className = "cm-transcript-annotation-icon";
      note.setAttribute(CM_SEGMENT_ANNOTATION_ATTR, "1");
      note.tabIndex = -1;
      note.title = "查看并编辑备注";
      note.setAttribute("aria-label", "查看并编辑备注");
      note.innerHTML = ANNOTATION_DOC_ICON_SVG;
      wrap.append(note);
    } else {
      const slot = document.createElement("span");
      slot.className = "cm-transcript-annotation-icon cm-transcript-annotation-icon--slot";
      slot.setAttribute("aria-hidden", "true");
      wrap.append(slot);
    }
    return wrap;
  }
}

export function buildTranscriptStageMarker(
  meta: SegmentMeta | undefined,
  opts: {
    selectionKind?: TranscriptRowSelectionKind;
    isPlaybackFocus?: boolean;
    rowHover?: boolean;
  } = {},
): TranscriptStageMarker | null {
  if (!meta?.stage) return null;
  const labels = resolveSegmentStageLabels(meta.stage, meta.finalizeVia);
  const stageMod = segmentStageChipModifier(meta.stage);
  return new TranscriptStageMarker(
    stageMod,
    labels.category,
    labels.tooltip,
    opts.selectionKind ?? null,
    opts.isPlaybackFocus === true,
    opts.rowHover === true,
    Boolean(meta.hasAnnotation),
  );
}

export type TranscriptStageGutterOptions = {
  onSelectSegment?: (idx: number, opts: { shiftKey?: boolean; toggle?: boolean }) => void;
  onOpenSegmentAnnotationDialog?: (idx: number) => void;
  isBusy?: () => boolean;
};

type StageGutterMousedownView = {
  state: EditorState;
  dispatch: (tr: TransactionSpec) => void;
};

/**
 * Pure gutter mousedown body (exported for focused tests — CM6 gutter row
 * hit-testing needs real layout, so DOM-dispatch tests are unreliable in jsdom).
 */
export function handleTranscriptStageGutterMousedown(
  view: StageGutterMousedownView,
  lineFrom: number,
  event: MouseEvent,
  opts: TranscriptStageGutterOptions,
): boolean {
  const target = event.target as HTMLElement | null;
  const idx = view.state.doc.lineAt(lineFrom).number - 1;
  if (event.button === 0 && target?.closest(`[${CM_SEGMENT_ANNOTATION_ATTR}]`)) {
    event.preventDefault();
    event.stopPropagation();
    if (!opts.isBusy?.()) {
      opts.onOpenSegmentAnnotationDialog?.(idx);
    }
    return true;
  }
  const multi = view.state.field(transcriptMultiSelectionField);
  if (event.button !== 0) {
    event.preventDefault();
    if (
      shouldApplyContextMenuSelection({
        segmentIdx: idx,
        isIndexInSelection: (i) => multi.selectedSet.has(i),
        selectionCount: multi.selectedSet.size,
      })
    ) {
      // CM6-local selection only — do not bridge to `onSelectSegment` (list
      // source) here, or right-click would seek/reveal and can even arm
      // global playback continuation on a non-primary row. `contextmenu`
      // in transcriptEditorCoreMount owns the React-side "contextMenu"
      // source re-select. See metaGutter.ts for the matching fix.
      selectSegmentCommand(view, idx, { scrollIntoView: false });
    }
    return true;
  }
  const toggle = event.metaKey || event.ctrlKey;
  const shiftKey = event.shiftKey;
  selectSegmentCommand(view, idx, { toggle, shiftKey, scrollIntoView: false });
  opts.onSelectSegment?.(idx, { toggle, shiftKey });
  return true;
}

/**
 * Trailing stage chip gutter (legacy SegmentRowStageBadge column parity).
 * Segment play/loop transport lives as a centered line overlay (see
 * `segmentTransportOverlayDecorations.ts`).
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
      if (!isTranscriptSegmentVisible(view.state, idx)) return null;
      const primary = primarySegmentIdx(view.state);
      const multi = view.state.field(transcriptMultiSelectionField);
      const hoverIdx = view.state.field(transcriptHoverSegmentField);
      const playbackIdx = view.state.field(transcriptPlaybackFocusField);
      const selectionKind: TranscriptRowSelectionKind =
        idx === primary
          ? "primary"
          : multi.selectedSet.has(idx)
            ? "in"
            : playbackIdx != null && playbackIdx === idx
              ? "playback"
              : null;
      return buildTranscriptStageMarker(view.state.field(segmentMetaField)[idx], {
        selectionKind,
        isPlaybackFocus: playbackIdx != null && playbackIdx === idx,
        rowHover: hoverIdx === idx,
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
        update.startState.field(transcriptHoverSegmentField) !==
          update.state.field(transcriptHoverSegmentField) ||
        update.startState.field(transcriptPlaybackFocusField) !==
          update.state.field(transcriptPlaybackFocusField)
      );
    },
    initialSpacer: () =>
      new TranscriptStageMarker(
        "auto_transcribe",
        "机转",
        "自动转写",
      ),
    domEventHandlers: {
      mousedown(view, line, event) {
        return handleTranscriptStageGutterMousedown(view, line.from, event as MouseEvent, opts);
      },
    },
  });
}

export const transcriptStageGutterTheme = EditorView.theme({
  // Right stage column: always sized for chip + annotation slot (no layout shift).
  ".cm-transcript-stage-gutter": {
    // chip (≤4.5) + gap + annotation slot (1) + cell pad L/R ≈ 6.75
    minWidth: "6.75rem",
    paddingLeft: "0",
    paddingRight: "0.45rem",
    borderLeft: "none",
    marginLeft: "0",
    marginRight: "0",
  },
  ".cm-transcript-stage-gutter .cm-gutterElement": {
    padding: "0",
    margin: "0",
    display: "flex",
    alignItems: "stretch",
    boxSizing: "border-box",
    // Same as meta: selection wash is .cm-line box-shadow only (no lagged :has fill).
    backgroundColor: "transparent",
    transition: "none",
  },
  /** Row ambient ink — stage mark + annotation share one grayscale token. */
  ".cm-transcript-stage-cell": {
    display: "flex",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: "0.25rem",
    boxSizing: "border-box",
    alignSelf: "stretch",
    height: "100%",
    minHeight: "100%",
    width: "100%",
    // Left: breath from copy. Right: clearer pane-edge inset.
    padding:
      "var(--cm-transcript-line-pad, 1rem) 0.85rem var(--cm-transcript-line-pad, 1rem) 0.3rem",
    borderRadius: "0",
    backgroundColor: "transparent",
    transition: "none",
    "--cm-stage-affordance":
      "color-mix(in srgb, var(--notion-text-light) 55%, var(--notion-text-muted))",
  },
  ".cm-transcript-stage-cell--row-hover, .cm-transcript-stage-cell:hover": {
    "--cm-stage-affordance":
      "color-mix(in srgb, var(--notion-text-light) 35%, var(--notion-text-muted))",
  },
  ".cm-transcript-stage-cell--primary, .cm-transcript-stage-cell--primary-playback": {
    "--cm-stage-affordance":
      "color-mix(in srgb, var(--notion-text-muted) 72%, var(--notion-text))",
  },
  ".cm-transcript-stage-cell--in-selection, .cm-transcript-stage-cell--playback": {
    "--cm-stage-affordance":
      "color-mix(in srgb, var(--notion-text-light) 35%, var(--notion-text-muted))",
  },
  // Stage mark: flat icon + label — grayscale ink shared with annotation.
  ".cm-transcript-stage-chip": {
    display: "inline-flex",
    boxSizing: "border-box",
    alignItems: "center",
    gap: "0.1875rem",
    height: "1.375rem",
    minHeight: "1.375rem",
    maxWidth: "4.5rem",
    padding: "0",
    margin: "0",
    border: "0",
    borderRadius: "0",
    background: "transparent",
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    fontSize: "var(--text-label, 0.75rem)",
    fontWeight: "500",
    lineHeight: "1",
    letterSpacing: "-0.01em",
    overflow: "hidden",
    flexShrink: "0",
    cursor: "default",
    color: "var(--cm-stage-affordance)",
    opacity: "0.92",
    transition: "color 120ms ease, opacity 120ms ease",
  },
  ".cm-transcript-stage-chip__icon": {
    display: "inline-flex",
    flexShrink: "0",
    alignItems: "center",
    justifyContent: "center",
    width: "0.875rem",
    height: "0.875rem",
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
  ".cm-transcript-annotation-icon": {
    display: "inline-flex",
    flexShrink: "0",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    width: "1rem",
    height: "1.375rem",
    minHeight: "1.375rem",
    margin: "0",
    padding: "0",
    border: "0",
    background: "transparent",
    color: "var(--cm-stage-affordance)",
    opacity: "0.92",
    pointerEvents: "auto",
    cursor: "pointer",
    transition: "color 120ms ease, opacity 120ms ease",
  },
  // Invisible spacer — same box as the real icon so chip position stays put.
  ".cm-transcript-annotation-icon--slot": {
    opacity: "0",
    pointerEvents: "none",
    cursor: "default",
    visibility: "hidden",
  },
  ".cm-transcript-annotation-icon svg": {
    width: "0.75rem",
    height: "0.75rem",
    display: "block",
    pointerEvents: "none",
  },
  ".cm-transcript-annotation-icon:hover": {
    color: "var(--accent-action)",
    opacity: "1",
  },
  ".cm-transcript-annotation-icon:focus-visible": {
    outline: "2px solid color-mix(in srgb, var(--accent-action) 45%, transparent)",
    outlineOffset: "1px",
    color: "var(--accent-action)",
    opacity: "1",
  },
});

export const transcriptStageGutterExtensions = (
  opts: TranscriptStageGutterOptions = {},
): Extension[] => [createTranscriptStageGutter(opts), transcriptStageGutterTheme];
