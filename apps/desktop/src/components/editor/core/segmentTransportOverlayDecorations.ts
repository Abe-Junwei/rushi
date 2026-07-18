import {
  RangeSetBuilder,
  StateField,
  type Extension,
  type EditorState,
} from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin, WidgetType } from "@codemirror/view";
import type { DecorationSet } from "@codemirror/view";
import type { MutableRefObject } from "react";
import {
  setTranscriptHoverSegmentEffect,
  transcriptHoverSegmentField,
} from "./hoverSegmentField";
import {
  primarySegmentIdx,
  setTranscriptMultiSelectionEffect,
  transcriptMultiSelectionField,
} from "./selectionField";
import {
  setTranscriptScopedPlayingEffect,
  transcriptScopedPlayingField,
} from "./scopedPlayingField";
import {
  isTranscriptSegmentVisible,
  transcriptFilterVisibilityField,
} from "./filterLineVisibility";

export const CM_SEGMENT_PLAY_ATTR = "data-cm-segment-play";
export const CM_SEGMENT_PLAY_IDX_ATTR = "data-cm-segment-play-idx";
/** Removed from text UI; kept exported so stale HMR chunks that re-export it do not crash Vite. */
export const CM_SEGMENT_LOOP_ATTR = "data-cm-segment-loop";

/** Quiet stroke glyphs — hover play control, not a loud filled transport pill. */
const PLAY_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 4v16l13 -8z"/></svg>';
const PAUSE_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>';

export type TranscriptSegmentTransportHandlers = {
  onToggleSegmentPlay?: (idx: number) => void;
};

class SegmentPlayOverlayWidget extends WidgetType {
  constructor(
    readonly segmentIdx: number,
    readonly playActive: boolean,
    private readonly handlersRef: MutableRefObject<TranscriptSegmentTransportHandlers>,
  ) {
    super();
  }

  eq(other: WidgetType): boolean {
    return (
      other instanceof SegmentPlayOverlayWidget &&
      other.segmentIdx === this.segmentIdx &&
      other.playActive === this.playActive
    );
  }

  toDOM(): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "cm-transcript-segment-play-overlay";
    wrap.setAttribute("contenteditable", "false");

    const playBtn = document.createElement("button");
    playBtn.type = "button";
    playBtn.className = [
      "cm-transcript-segment-play",
      this.playActive ? "cm-transcript-segment-play--active" : "",
    ]
      .filter(Boolean)
      .join(" ");
    playBtn.setAttribute(CM_SEGMENT_PLAY_ATTR, "1");
    playBtn.setAttribute(CM_SEGMENT_PLAY_IDX_ATTR, String(this.segmentIdx));
    const playLabel = this.playActive ? "暂停语段播放" : "播本语段（至段尾）";
    playBtn.title = playLabel;
    playBtn.setAttribute("aria-label", playLabel);
    playBtn.innerHTML = this.playActive ? PAUSE_ICON_SVG : PLAY_ICON_SVG;
    playBtn.addEventListener("mousedown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.handlersRef.current.onToggleSegmentPlay?.(this.segmentIdx);
    });

    wrap.append(playBtn);
    return wrap;
  }

  ignoreEvent(): boolean {
    return true;
  }
}

const hostDeco = Decoration.line({
  attributes: { class: "cm-transcript-line-play-host" },
});
const hostForcedDeco = Decoration.line({
  attributes: { class: "cm-transcript-line-play-host cm-transcript-line-play-host--forced" },
});

/**
 * Play control overflows left into the meta gutter (CM gutters z-index 200).
 * Geometry hit-test so clicks on the visible button still fire play even when
 * the event target is the gutter underneath.
 */
export function resolvePlayButtonIdxAtPoint(
  root: ParentNode,
  clientX: number,
  clientY: number,
): number | null {
  const buttons = root.querySelectorAll<HTMLElement>(`[${CM_SEGMENT_PLAY_ATTR}]`);
  for (const btn of buttons) {
    const opacity = Number.parseFloat(getComputedStyle(btn).opacity || "0");
    if (!(opacity > 0.05)) continue;
    const rect = btn.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    if (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    ) {
      continue;
    }
    const raw = btn.getAttribute(CM_SEGMENT_PLAY_IDX_ATTR);
    if (raw == null) continue;
    const idx = Number.parseInt(raw, 10);
    if (Number.isFinite(idx)) return idx;
  }
  return null;
}

/**
 * Always mount + opacity-gate (stage-gutter transport strategy).
 * Anchored between timestamp (meta) and text. Visibility uses row :hover and
 * `--forced` from hoverSegmentField (which includes left meta gutter).
 */
function buildPlayOverlayDecorations(
  state: EditorState,
  handlersRef: MutableRefObject<TranscriptSegmentTransportHandlers>,
): DecorationSet {
  const hoverIdx = state.field(transcriptHoverSegmentField);
  const primary = primarySegmentIdx(state);
  const scopedPlaying = state.field(transcriptScopedPlayingField);
  const builder = new RangeSetBuilder<Decoration>();
  const lineCount = state.doc.lines;
  for (let idx = 0; idx < lineCount; idx++) {
    if (!isTranscriptSegmentVisible(state, idx)) continue;
    const line = state.doc.line(idx + 1);
    const forced = hoverIdx === idx;
    const playActive = idx === primary && scopedPlaying;
    builder.add(line.from, line.from, forced ? hostForcedDeco : hostDeco);
    builder.add(
      line.from,
      line.from,
      Decoration.widget({
        widget: new SegmentPlayOverlayWidget(idx, playActive, handlersRef),
        side: -1,
        block: false,
      }),
    );
  }
  return builder.finish();
}

function createPlayButtonHitPlugin(
  handlersRef: MutableRefObject<TranscriptSegmentTransportHandlers>,
): Extension {
  return ViewPlugin.fromClass(
    class {
      private readonly onMouseDown: (event: MouseEvent) => void;

      constructor(private readonly view: EditorView) {
        this.onMouseDown = (event: MouseEvent) => {
          if (event.button !== 0) return;
          // Already handled by the button's own listener.
          if (
            event.target instanceof Element &&
            event.target.closest(`[${CM_SEGMENT_PLAY_ATTR}]`)
          ) {
            return;
          }
          const idx = resolvePlayButtonIdxAtPoint(
            this.view.contentDOM,
            event.clientX,
            event.clientY,
          );
          if (idx == null) return;
          event.preventDefault();
          event.stopPropagation();
          handlersRef.current.onToggleSegmentPlay?.(idx);
        };
        // Capture: run before meta-gutter mousedown (gutter z-index sits above content).
        this.view.dom.addEventListener("mousedown", this.onMouseDown, true);
      }

      destroy() {
        this.view.dom.removeEventListener("mousedown", this.onMouseDown, true);
      }
    },
  );
}

export function createTranscriptSegmentTransportOverlayExtensions(
  handlersRef: MutableRefObject<TranscriptSegmentTransportHandlers>,
): Extension[] {
  const field = StateField.define<DecorationSet>({
    create(state) {
      return buildPlayOverlayDecorations(state, handlersRef);
    },
    update(value, tr) {
      const hoverChanged = tr.effects.some((e) => e.is(setTranscriptHoverSegmentEffect));
      const hoverFieldChanged =
        tr.startState.field(transcriptHoverSegmentField) !==
        tr.state.field(transcriptHoverSegmentField);
      const scopedChanged =
        tr.effects.some((e) => e.is(setTranscriptScopedPlayingEffect)) ||
        tr.startState.field(transcriptScopedPlayingField) !==
          tr.state.field(transcriptScopedPlayingField);
      const primaryChanged = primarySegmentIdx(tr.startState) !== primarySegmentIdx(tr.state);
      const multiChanged = tr.effects.some((e) => e.is(setTranscriptMultiSelectionEffect));
      const multiFieldChanged =
        tr.startState.field(transcriptMultiSelectionField) !==
        tr.state.field(transcriptMultiSelectionField);
      const filterChanged =
        tr.startState.field(transcriptFilterVisibilityField) !==
        tr.state.field(transcriptFilterVisibilityField);
      if (
        hoverChanged ||
        hoverFieldChanged ||
        scopedChanged ||
        primaryChanged ||
        multiChanged ||
        multiFieldChanged ||
        filterChanged ||
        tr.docChanged
      ) {
        return buildPlayOverlayDecorations(tr.state, handlersRef);
      }
      return value;
    },
    provide: (f) => EditorView.decorations.from(f),
  });

  const theme = EditorView.theme({
    ".cm-line.cm-transcript-line-play-host": {
      position: "relative",
      overflow: "visible",
    },
    ".cm-transcript-segment-play-overlay": {
      position: "absolute",
      left: "0",
      top: "50%",
      width: "0",
      height: "0",
      zIndex: "5",
      overflow: "visible",
      pointerEvents: "none",
      boxSizing: "border-box",
    },
    ".cm-transcript-segment-play": {
      position: "absolute",
      left: "0",
      top: "0",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      boxSizing: "border-box",
      width: "2.25rem",
      height: "2.25rem",
      margin: "0",
      padding: "0",
      border: "1px solid color-mix(in srgb, var(--accent-action) 28%, var(--notion-divider))",
      borderRadius: "9999px",
      background: "color-mix(in srgb, var(--notion-bg) 88%, var(--accent-action))",
      color: "var(--accent-action)",
      boxShadow: "0 1px 4px color-mix(in srgb, var(--notion-text) 10%, transparent)",
      cursor: "pointer",
      opacity: "0",
      pointerEvents: "none",
      // Between timestamp (meta gutter) and copy.
      transform: "translate(calc(-100% - 0.15rem), -50%)",
      transition: "opacity 80ms ease-out, background-color 80ms ease-out, border-color 80ms ease-out",
    },
    ".cm-transcript-line-play-host:hover .cm-transcript-segment-play": {
      opacity: "0.94",
      pointerEvents: "auto",
    },
    // Content + left meta gutter hover (hoverSegmentField includes gutters).
    ".cm-transcript-line-play-host--forced .cm-transcript-segment-play": {
      opacity: "0.94",
      pointerEvents: "auto",
    },
    ".cm-transcript-segment-play--active": {
      opacity: "0.94",
      pointerEvents: "auto",
      borderColor: "color-mix(in srgb, var(--accent-action) 40%, var(--notion-divider))",
    },
    ".cm-transcript-segment-play:hover": {
      opacity: "1",
      background: "color-mix(in srgb, var(--notion-bg) 78%, var(--accent-action))",
      borderColor: "color-mix(in srgb, var(--accent-action) 45%, var(--notion-divider))",
    },
    ".cm-transcript-segment-play:focus-visible": {
      outline: "2px solid color-mix(in srgb, var(--accent-action) 40%, transparent)",
      outlineOffset: "2px",
      opacity: "1",
      pointerEvents: "auto",
    },
    ".cm-transcript-segment-play svg": {
      width: "1.125rem",
      height: "1.125rem",
      display: "block",
      pointerEvents: "none",
      flexShrink: "0",
      marginLeft: "0.07rem",
    },
    ".cm-transcript-segment-play--active svg": {
      marginLeft: "0",
    },
  });

  return [field, theme, createPlayButtonHitPlugin(handlersRef)];
}
