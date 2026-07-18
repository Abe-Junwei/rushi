import type { MutableRefObject } from "react";
import { Compartment, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { SegmentDto } from "../../../tauri/projectTypes";
import {
  transcriptEditorRowMetrics,
  TRANSCRIPT_EDITOR_LINE_PADDING_LEFT,
  TRANSCRIPT_EDITOR_META_CONTENT_GAP,
  TRANSCRIPT_EDITOR_PLAY_SIZE,
} from "../../../utils/segmentLayout";
import { transcriptEditorCoreExtensions } from "./transcriptEditorCoreExtensions";
import {
  selectSegmentCommand,
  shouldConsumeTranscriptContentMousedown,
} from "./selectionCommands";
import { createOnDocChangedBridge, applyProjectedTextDiff } from "./onDocChanged";
import {
  createTranscriptEditorKeymap,
  transcriptLineCountGuard,
} from "./transcriptEditorKeymap";
import { transcriptFrozenLineGuard } from "./frozenLineGuard";
import { transcriptPointerScrollGuard } from "./transcriptPointerScrollGuard";
import { segmentMetaField } from "./segmentMetaField";
import { primarySegmentIdx, transcriptMultiSelectionField } from "./selectionField";
import { readTranscriptEditorSelectionText } from "./textEditCommands";
import { createTranscriptTextDragClamp } from "./transcriptTextDragClamp";
import { transcriptSelectionIsSingleLine } from "./transcriptClipboard";
import { shouldApplyContextMenuSelection } from "../../../services/selection/segmentContextMenuSelection";
import { resolveTranscriptSegmentIdxAtPointer } from "./resolveTranscriptSegmentIdxAtPointer";

export function buildTranscriptAppearanceTheme(args: {
  fontPx: number;
  fontFamily: string;
  fontWeight: 500 | 700;
  fontItalic: boolean;
  metaGutterWidthPx: number;
}): Extension {
  // CM 列表单行：紧凑 padding；波形 lane 卡仍用 `computeSegmentLaneRowPx`。
  const { lineHeight, linePadPx: linePad, minLinePx: minLine } = transcriptEditorRowMetrics(
    args.fontPx,
  );
  return EditorView.theme({
    "&": {
      height: "100%",
      fontSize: `${args.fontPx}px`,
      fontFamily: args.fontFamily,
      fontWeight: String(args.fontWeight),
      fontStyle: args.fontItalic ? "italic" : "normal",
      letterSpacing: "0.005em",
      color: "var(--notion-text)",
      backgroundColor: "var(--notion-bg)",
      "--cm-meta-gutter-width": `${args.metaGutterWidthPx}px`,
      // Keep in sync with `.cm-transcript-stage-gutter` minWidth (stageGutter.ts).
      "--cm-stage-gutter-width": "6.75rem",
      // Play control in the meta↔text seam (metaGutter paddingRight + overlay size).
      "--cm-transcript-play-size": TRANSCRIPT_EDITOR_PLAY_SIZE,
      "--cm-transcript-line-pad": `${linePad}px`,
      "--cm-transcript-min-line-px": `${minLine}px`,
      "--cm-transcript-meta-content-gap": TRANSCRIPT_EDITOR_META_CONTENT_GAP,
    },
    ".cm-scroller": {
      overflow: "auto",
      fontFamily: "inherit",
      // Left/meta unchanged; trailing inset for stage/annotation breathing room.
      padding: "0.75rem 0.7rem 0.75rem 0.75rem",
      boxSizing: "border-box",
      backgroundColor: "transparent",
    },
    // !important: CM6 `&light .cm-gutters` is more specific than plain theme selectors.
    ".cm-gutters": {
      backgroundColor: "transparent !important",
      border: "0 solid transparent !important",
      margin: "0",
      padding: "0",
    },
    ".cm-gutters-before": {
      borderRightWidth: "0 !important",
      backgroundColor: "transparent !important",
    },
    ".cm-gutters-after": {
      borderLeftWidth: "0 !important",
      backgroundColor: "transparent !important",
    },
    ".cm-content": {
      padding: "0.12rem 0 0.42rem 0",
      caretColor: "var(--accent-action-strong)",
      // Same compositing base as gutters — avoid white plate under translucent fills.
      backgroundColor: "transparent",
    },
    ".cm-line": {
      paddingTop: `${linePad}px`,
      paddingBottom: `${linePad}px`,
      // Play control + symmetric gaps (meta paddingRight · play · gap · text).
      paddingLeft: TRANSCRIPT_EDITOR_LINE_PADDING_LEFT,
      // Breath before the stage column (keep modest — wide stage minWidth already gaps).
      paddingRight: "0.4rem",
      minHeight: `${minLine}px`,
      lineHeight: String(lineHeight),
      fontWeight: "inherit",
      boxSizing: "border-box",
      borderRadius: "0",
    },
    // Single paint source for the row: line fill + shadows under transparent gutters.
    // Do not also paint gutters via :has(marker) — that lagged one frame behind line
    // decorations on ↑↓ and left the previous row's caps lit (visible jitter).
    ".cm-transcript-primary-line, .cm-transcript-in-selection-line, .cm-transcript-playback-focus, .cm-transcript-hover-line": {
      transition: "none",
    },
    ".cm-transcript-hover-line": {
      // Match legacy `hover:bg-notion-sidebar/35` on `.seg-row-shell`.
      backgroundColor: "color-mix(in srgb, var(--notion-sidebar) 35%, transparent)",
      boxShadow: [
        "calc(-1 * var(--cm-meta-gutter-width, 6rem)) 0 0 0 color-mix(in srgb, var(--notion-sidebar) 35%, transparent)",
        "var(--cm-stage-gutter-width, 6.75rem) 0 0 0 color-mix(in srgb, var(--notion-sidebar) 35%, transparent)",
      ].join(", "),
    },
    ".cm-line.cm-transcript-line-resize-host": {
      position: "relative",
    },
    ".cm-transcript-row-height-resize": {
      position: "absolute",
      left: "0",
      right: "0",
      bottom: "0",
      height: "12px",
      zIndex: "4",
      cursor: "row-resize",
      touchAction: "none",
      userSelect: "none",
      pointerEvents: "auto",
    },
    ".cm-transcript-primary-line": {
      backgroundColor: "var(--segment-fill-selected-list)",
      boxShadow: [
        "calc(-1 * var(--cm-meta-gutter-width, 6rem)) 0 0 0 var(--segment-fill-selected-list)",
        "var(--cm-stage-gutter-width, 6.75rem) 0 0 0 var(--segment-fill-selected-list)",
      ].join(", "),
    },
    ".cm-transcript-in-selection-line": {
      backgroundColor: "var(--segment-fill-in-selection-list)",
      boxShadow: [
        "calc(-1 * var(--cm-meta-gutter-width, 6rem)) 0 0 0 var(--segment-fill-in-selection-list)",
        "var(--cm-stage-gutter-width, 6.75rem) 0 0 0 var(--segment-fill-in-selection-list)",
      ].join(", "),
    },
    // Same fill as primary — playback-focus only drives icon/class, not a second wash.
    ".cm-transcript-primary-line.cm-transcript-playback-focus": {
      backgroundColor: "var(--segment-fill-selected-list)",
      boxShadow: [
        "calc(-1 * var(--cm-meta-gutter-width, 6rem)) 0 0 0 var(--segment-fill-selected-list)",
        "var(--cm-stage-gutter-width, 6.75rem) 0 0 0 var(--segment-fill-selected-list)",
      ].join(", "),
    },
    ".cm-transcript-playback-focus": {
      backgroundColor: "var(--transcript-playback-focus-fill)",
      boxShadow: [
        "calc(-1 * var(--cm-meta-gutter-width, 6rem)) 0 0 0 var(--transcript-playback-focus-fill)",
        "var(--cm-stage-gutter-width, 6.75rem) 0 0 0 var(--transcript-playback-focus-fill)",
      ].join(", "),
    },
  });
}

export function buildTranscriptEditorCoreExtensions(args: {
  fontPx: number;
  fontFamily: string;
  fontWeight: 500 | 700;
  fontItalic: boolean;
  metaGutterWidthPx: number;
  appearanceCompartment: Compartment;
  latestSegmentsRef: React.MutableRefObject<readonly SegmentDto[]>;
  applyingFromBridgeRef: React.MutableRefObject<boolean>;
  updateSegmentTextRef: React.MutableRefObject<(idx: number, text: string) => void>;
  onSelectSegmentRef: React.MutableRefObject<
    ((idx: number, opts?: { shiftKey?: boolean; toggle?: boolean }) => void) | undefined
  >;
  onToggleSegmentPlayRef: React.MutableRefObject<((idx: number) => void) | undefined>;
  onToggleSegmentLoopRef: React.MutableRefObject<((idx: number) => void) | undefined>;
  onOpenSegmentAnnotationDialogRef?: React.MutableRefObject<
    ((idx: number) => void) | undefined
  >;
  busyRef: React.MutableRefObject<boolean>;
  onOpenContextMenuRef?: React.MutableRefObject<
    | ((args: {
        x: number;
        y: number;
        segmentIdx: number;
        pointerTimeSec: number;
        selectionText: string;
      }) => void)
    | undefined
  >;
  rowHeightDragFromDomRef: React.MutableRefObject<
    ((target: HTMLElement, event: PointerEvent) => void) | undefined
  >;
}): Extension[] {
  const bridgePrimaryMoved = (idx: number, opts: { shiftKey?: boolean; toggle?: boolean }) => {
    // Transitional P3→P5: CM6 owns selection SoT; bridge keeps SC1/waveform seek alive
    // until P5 ports waveform to transcriptProjection. Remove with onSelectSegment prop.
    args.onSelectSegmentRef.current?.(idx, opts);
  };

  const segmentTransportHandlersRef: MutableRefObject<{
    onToggleSegmentPlay?: (idx: number) => void;
  }> = {
    current: {
      onToggleSegmentPlay: (idx) => args.onToggleSegmentPlayRef.current?.(idx),
    },
  };

  return [
    ...transcriptEditorCoreExtensions({
      withProjection: true,
      rowHeightDragFromDomRef: args.rowHeightDragFromDomRef,
      segmentTransportHandlersRef,
      metaGutter: {
        onSelectSegment: (idx, opts) => bridgePrimaryMoved(idx, opts),
      },
      stageGutter: {
        onOpenSegmentAnnotationDialog: (idx) =>
          args.onOpenSegmentAnnotationDialogRef?.current?.(idx),
        isBusy: () => args.busyRef.current,
      },
    }),
    transcriptLineCountGuard,
    transcriptFrozenLineGuard,
    transcriptPointerScrollGuard,
    createTranscriptEditorKeymap({
      onPrimaryMoved: (idx, opts) => bridgePrimaryMoved(idx, opts),
    }),
    createOnDocChangedBridge({
      debounceMs: 48,
      onTextLineProjected: (idx, text) => {
        args.applyingFromBridgeRef.current = true;
        try {
          args.updateSegmentTextRef.current(idx, text);
        } finally {
          window.setTimeout(() => {
            args.applyingFromBridgeRef.current = false;
          }, 0);
        }
      },
      onTextLinesProjected: (projected) => {
        args.applyingFromBridgeRef.current = true;
        try {
          applyProjectedTextDiff({
            baseline: args.latestSegmentsRef.current,
            projected,
            updateSegmentText: (idx, text) => args.updateSegmentTextRef.current(idx, text),
          });
        } finally {
          window.setTimeout(() => {
            args.applyingFromBridgeRef.current = false;
          }, 0);
        }
      },
    }),
    args.appearanceCompartment.of(
      buildTranscriptAppearanceTheme({
        fontPx: args.fontPx,
        fontFamily: args.fontFamily,
        fontWeight: args.fontWeight,
        fontItalic: args.fontItalic,
        metaGutterWidthPx: args.metaGutterWidthPx,
      }),
    ),
    EditorView.contentAttributes.of({
      autocorrect: "off",
      autocapitalize: "off",
      spellcheck: "false",
    }),
    EditorView.lineWrapping,
    // Clamp same-segment text drag to the mousedown doc line (blocks cross-segment spill).
    ...createTranscriptTextDragClamp(),
    EditorView.domEventHandlers({
      mousedown(event, view) {
        if (args.busyRef.current) return true;
        const pointerIdx = resolveTranscriptSegmentIdxAtPointer(
          view,
          event.clientX,
          event.clientY,
          event.target,
        );
        const idx =
          pointerIdx ??
          (event.button === 0
            ? (() => {
                const pos = view.posAtCoords(
                  { x: event.clientX, y: event.clientY },
                  false,
                );
                return pos == null ? null : view.state.doc.lineAt(pos).number - 1;
              })()
            : null);
        if (idx == null) return false;
        const pos =
          view.posAtCoords({ x: event.clientX, y: event.clientY }, false) ??
          view.state.doc.line(idx + 1).from;
        const toggle = event.metaKey || event.ctrlKey;
        const shiftKey = event.shiftKey;
        const primary = primarySegmentIdx(view.state);
        const multi = view.state.field(transcriptMultiSelectionField);

        // Right/middle button: preserve multi-select when the target is already
        // in the set (mousedown runs before contextmenu and would otherwise collapse).
        if (event.button !== 0) {
          event.preventDefault();
          const currentSelection = view.state.selection.main;
          // Right-click inside an existing text selection must not collapse it
          // (mousedown runs before contextmenu) — otherwise 复制/剪切 always see "".
          const clickWithinTextSelection =
            !currentSelection.empty &&
            pos != null &&
            pos >= currentSelection.from &&
            pos <= currentSelection.to;
          if (
            !clickWithinTextSelection &&
            shouldApplyContextMenuSelection({
              segmentIdx: idx,
              isIndexInSelection: (i) => multi.selectedSet.has(i),
              selectionCount: multi.selectedSet.size,
            })
          ) {
            selectSegmentCommand(view, idx, { scrollIntoView: false });
          }
          return true;
        }

        const frozen = Boolean(view.state.field(segmentMetaField, false)?.[idx]?.frozen);
        // Frozen rows are selection-only: never enter text-edit caret placement.
        if (frozen && !shiftKey && !toggle) {
          event.preventDefault();
          selectSegmentCommand(view, idx, { scrollIntoView: false });
          bridgePrimaryMoved(idx, { toggle: false, shiftKey: false });
          return true;
        }
        // Same-row plain click: let CM place caret / drag-select text.
        if (
          !shouldConsumeTranscriptContentMousedown({
            clickedIdx: idx,
            primaryIdx: primary,
            shiftKey,
            toggle,
          })
        ) {
          return false;
        }
        // Switching segment (or multi-select): consume so listen-jump scroll
        // cannot extend a native drag-select across lines while the button is down.
        event.preventDefault();
        selectSegmentCommand(view, idx, {
          toggle,
          shiftKey,
          // Transport / follow own reveal; avoid scrolling mid-mousedown.
          scrollIntoView: false,
          caretPos: shiftKey || toggle ? undefined : pos,
        });
        bridgePrimaryMoved(idx, { toggle, shiftKey });
        return true;
      },
      contextmenu(event, view) {
        if (args.busyRef.current) return true;
        const open = args.onOpenContextMenuRef?.current;
        if (!open) return false;
        event.preventDefault();
        const lineIdx =
          resolveTranscriptSegmentIdxAtPointer(
            view,
            event.clientX,
            event.clientY,
            event.target,
          ) ??
          Math.max(0, Math.min(view.state.doc.lines - 1, primarySegmentIdx(view.state)));
        // Copy/cut only support a single-segment range (see transcriptClipboard);
        // a cross-segment drag-selection must not offer them since it would no-op.
        const selectionText = transcriptSelectionIsSingleLine(view)
          ? readTranscriptEditorSelectionText(view)
          : "";
        const meta = view.state.field(segmentMetaField);
        const pointerTimeSec = meta[lineIdx]?.startSec ?? 0;
        open({
          x: event.clientX,
          y: event.clientY,
          segmentIdx: lineIdx,
          pointerTimeSec,
          selectionText,
        });
        return true;
      },
    }),
  ];
}
