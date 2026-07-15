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
import { transcriptScopedPlayingField } from "./scopedPlayingField";
import { transcriptSegmentLoopField } from "./segmentLoopField";
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

/** Compact stage set — readable at 12px (机转 / AI改稿 / 手转 / 定稿). */
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
  // CircleCheck — finalized (stronger “sealed” read than bare check)
  finalized: transcriptGutterIconSvg(
    '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  ),
};

const PLAY_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
const STOP_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>';
const LOOP_ICON_SVG = transcriptGutterIconSvg(
  '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
);
/** MessageSquare — annotation present (ambient glyph; matches PRODUCT_ICON.segmentAnnotation). */
const ANNOTATION_DOC_ICON_SVG = transcriptGutterIconSvg(
  '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
);

export const CM_SEGMENT_PLAY_ATTR = "data-cm-segment-play";
export const CM_SEGMENT_LOOP_ATTR = "data-cm-segment-loop";
export const CM_SEGMENT_ANNOTATION_ATTR = "data-cm-segment-annotation";

export class TranscriptStageMarker extends GutterMarker {
  constructor(
    readonly stageMod: string,
    readonly label: string,
    readonly tooltip: string,
    readonly selectionKind: TranscriptRowSelectionKind = null,
    /** True when this row is the current playback-focus line (may coexist with primary). */
    readonly isPlaybackFocus: boolean = false,
    /**
     * Mount transport controls (opacity-gated). Visible on row hover / content hover /
     * scoped playing / loop arm — not primary-only.
     */
    readonly showSegmentPlay: boolean = false,
    readonly segmentPlayActive: boolean = false,
    /** Content-hover force-visible (gutter :hover also reveals via CSS). */
    readonly segmentPlayForced: boolean = false,
    /** Primary row with segment loop armed. */
    readonly segmentLoopActive: boolean = false,
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
      this.showSegmentPlay === other.showSegmentPlay &&
      this.segmentPlayActive === other.segmentPlayActive &&
      this.segmentPlayForced === other.segmentPlayForced &&
      this.segmentLoopActive === other.segmentLoopActive &&
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
      this.segmentPlayForced ? "cm-transcript-stage-cell--row-hover" : "",
    ]
      .filter(Boolean)
      .join(" ");

    if (this.showSegmentPlay) {
      const transportVisible = this.segmentPlayForced || this.segmentPlayActive || this.segmentLoopActive;
      const loopBtn = document.createElement("button");
      loopBtn.type = "button";
      loopBtn.className = [
        "cm-transcript-segment-transport",
        "cm-transcript-segment-loop",
        this.segmentPlayForced ? "cm-transcript-segment-transport--forced" : "",
        this.segmentLoopActive ? "cm-transcript-segment-transport--active" : "",
      ]
        .filter(Boolean)
        .join(" ");
      loopBtn.setAttribute(CM_SEGMENT_LOOP_ATTR, "1");
      loopBtn.tabIndex = transportVisible ? 0 : -1;
      const loopLabel = this.segmentLoopActive ? "关闭语段循环播放" : "开启语段循环播放";
      loopBtn.title = `${loopLabel}（⌘/Ctrl+L）`;
      loopBtn.setAttribute("aria-label", loopLabel);
      loopBtn.setAttribute("aria-pressed", this.segmentLoopActive ? "true" : "false");
      loopBtn.innerHTML = LOOP_ICON_SVG;
      wrap.append(loopBtn);

      const playBtn = document.createElement("button");
      playBtn.type = "button";
      playBtn.className = [
        "cm-transcript-segment-transport",
        "cm-transcript-segment-play",
        this.segmentPlayForced ? "cm-transcript-segment-transport--forced" : "",
        this.segmentPlayActive ? "cm-transcript-segment-transport--active" : "",
      ]
        .filter(Boolean)
        .join(" ");
      playBtn.setAttribute(CM_SEGMENT_PLAY_ATTR, "1");
      playBtn.tabIndex = transportVisible ? 0 : -1;
      const playLabel = this.segmentPlayActive
        ? "停止语段播放"
        : "播本语段（至段尾）";
      playBtn.title = playLabel;
      playBtn.setAttribute("aria-label", playLabel);
      playBtn.innerHTML = this.segmentPlayActive ? STOP_ICON_SVG : PLAY_ICON_SVG;
      wrap.append(playBtn);
    }

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

    if (this.hasAnnotation) {
      const note = document.createElement("span");
      note.className = "cm-transcript-annotation-icon";
      note.setAttribute(CM_SEGMENT_ANNOTATION_ATTR, "1");
      note.title = "有备注";
      note.setAttribute("aria-label", "有备注");
      note.innerHTML = ANNOTATION_DOC_ICON_SVG;
      wrap.append(note);
    }
    return wrap;
  }
}

export function buildTranscriptStageMarker(
  meta: SegmentMeta | undefined,
  opts: {
    selectionKind?: TranscriptRowSelectionKind;
    isPlaybackFocus?: boolean;
    showSegmentPlay?: boolean;
    segmentPlayActive?: boolean;
    segmentPlayForced?: boolean;
    segmentLoopActive?: boolean;
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
    opts.showSegmentPlay === true,
    opts.segmentPlayActive === true,
    opts.segmentPlayForced === true,
    opts.segmentLoopActive === true,
    Boolean(meta.hasAnnotation),
  );
}

export type TranscriptStageGutterOptions = {
  onSelectSegment?: (idx: number, opts: { shiftKey?: boolean; toggle?: boolean }) => void;
  onToggleSegmentPlay?: (idx: number) => void;
  onToggleSegmentLoop?: (idx: number) => void;
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
  if (target?.closest(`[${CM_SEGMENT_LOOP_ATTR}]`)) {
    event.preventDefault();
    event.stopPropagation();
    opts.onToggleSegmentLoop?.(idx);
    return true;
  }
  if (target?.closest(`[${CM_SEGMENT_PLAY_ATTR}]`)) {
    event.preventDefault();
    event.stopPropagation();
    opts.onToggleSegmentPlay?.(idx);
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
 * Segment transport sits beside text: hover-reveal on any row; stop/loop stay while armed.
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
      const scopedPlaying = view.state.field(transcriptScopedPlayingField);
      const segmentLoop = view.state.field(transcriptSegmentLoopField);
      const selectionKind: TranscriptRowSelectionKind =
        idx === primary
          ? "primary"
          : multi.selectedSet.has(idx)
            ? "in"
            : playbackIdx != null && playbackIdx === idx
              ? "playback"
              : null;
      const isPrimary = selectionKind === "primary";
      const segmentPlayActive = isPrimary && scopedPlaying;
      const segmentLoopActive = isPrimary && segmentLoop;
      return buildTranscriptStageMarker(view.state.field(segmentMetaField)[idx], {
        selectionKind,
        isPlaybackFocus: playbackIdx != null && playbackIdx === idx,
        // Always mount to reserve hit target; visibility via CSS + forced/active.
        showSegmentPlay: true,
        segmentPlayActive,
        segmentPlayForced: hoverIdx === idx,
        segmentLoopActive,
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
          update.state.field(transcriptPlaybackFocusField) ||
        update.startState.field(transcriptScopedPlayingField) !==
          update.state.field(transcriptScopedPlayingField) ||
        update.startState.field(transcriptSegmentLoopField) !==
          update.state.field(transcriptSegmentLoopField)
      );
    },
    initialSpacer: () =>
      new TranscriptStageMarker(
        "auto_transcribe",
        "机转",
        "自动转写",
        null,
        false,
        true,
      ),
    domEventHandlers: {
      mousedown(view, line, event) {
        return handleTranscriptStageGutterMousedown(view, line.from, event as MouseEvent, opts);
      },
    },
  });
}

export const transcriptStageGutterTheme = EditorView.theme({
  // Flush against content — avoid a blank seam between text highlight and stage chip.
  ".cm-transcript-stage-gutter": {
    // loop (1.75) + play (1.75) + gaps + chip max (6.5) + optional annotation (1.0) + cell pad ≈ 12.0
    minWidth: "12rem",
    paddingLeft: "0",
    paddingRight: "0.35rem",
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
    justifyContent: "flex-start",
    gap: "0.25rem",
    boxSizing: "border-box",
    alignSelf: "stretch",
    height: "100%",
    minHeight: "100%",
    width: "100%",
    padding:
      "var(--cm-transcript-line-pad, 1rem) 0.5rem var(--cm-transcript-line-pad, 1rem) 0.35rem",
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
  ".cm-transcript-segment-transport": {
    display: "inline-flex",
    flexShrink: "0",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    // Always reserve hit target so stage chip never shifts when controls appear.
    width: "1.75rem",
    height: "1.375rem",
    minHeight: "1.375rem",
    margin: "0",
    padding: "0",
    overflow: "hidden",
    border: "1px solid transparent",
    borderRadius: "0.375rem",
    background: "transparent",
    color: "var(--accent-action)",
    cursor: "pointer",
    opacity: "0",
    pointerEvents: "none",
    transition: "opacity 80ms ease-out, background-color 80ms ease-out, border-color 80ms ease-out",
  },
  // Gutter cell hover keeps the button clickable (mouse can leave the text).
  ".cm-transcript-stage-cell:hover .cm-transcript-segment-transport": {
    opacity: "1",
    pointerEvents: "auto",
    borderColor: "color-mix(in srgb, var(--accent-action) 28%, var(--notion-divider))",
    background: "color-mix(in srgb, var(--accent-action) 12%, transparent)",
  },
  ".cm-transcript-segment-transport--forced": {
    opacity: "1",
    pointerEvents: "auto",
    borderColor: "color-mix(in srgb, var(--accent-action) 28%, var(--notion-divider))",
    background: "color-mix(in srgb, var(--accent-action) 12%, transparent)",
  },
  ".cm-transcript-segment-transport:hover": {
    background: "color-mix(in srgb, var(--accent-action) 22%, transparent)",
  },
  ".cm-transcript-segment-transport--active": {
    opacity: "1",
    pointerEvents: "auto",
    background: "color-mix(in srgb, var(--accent-action) 22%, transparent)",
    borderColor: "color-mix(in srgb, var(--accent-action) 42%, var(--notion-divider))",
  },
  ".cm-transcript-segment-transport svg": {
    width: "0.75rem",
    height: "0.75rem",
    display: "block",
    pointerEvents: "none",
    flexShrink: "0",
  },
  // Stage mark: flat icon + label — grayscale ink shared with annotation.
  ".cm-transcript-stage-chip": {
    display: "inline-flex",
    boxSizing: "border-box",
    alignItems: "center",
    gap: "0.1875rem",
    height: "1.375rem",
    minHeight: "1.375rem",
    maxWidth: "6.5rem",
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
    pointerEvents: "none",
    transition: "color 120ms ease, opacity 120ms ease",
  },
  ".cm-transcript-annotation-icon svg": {
    width: "0.75rem",
    height: "0.75rem",
    display: "block",
  },
});

export const transcriptStageGutterExtensions = (
  opts: TranscriptStageGutterOptions = {},
): Extension[] => [createTranscriptStageGutter(opts), transcriptStageGutterTheme];
