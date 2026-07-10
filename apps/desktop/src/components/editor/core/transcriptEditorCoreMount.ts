import { Compartment, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { SegmentDto } from "../../../tauri/projectTypes";
import { computeSegmentLaneRowPx } from "../../../utils/segmentLayout";
import { transcriptEditorCoreExtensions } from "./transcriptEditorCoreExtensions";
import { selectSegmentCommand } from "./selectionCommands";
import { createOnDocChangedBridge, applyProjectedTextDiff } from "./onDocChanged";
import {
  createTranscriptEditorKeymap,
  transcriptLineCountGuard,
} from "./transcriptEditorKeymap";
import { segmentMetaField } from "./segmentMetaField";
import { primarySegmentIdx } from "./selectionField";
import { readTranscriptEditorSelectionText } from "./textEditCommands";

export function buildTranscriptAppearanceTheme(args: {
  fontPx: number;
  fontFamily: string;
  fontWeight: 500 | 700;
  fontItalic: boolean;
  metaGutterWidthPx: number;
}): Extension {
  const linePad = Math.max(4, Math.round(args.fontPx * 0.22));
  const minLine = Math.max(28, Math.round(computeSegmentLaneRowPx(args.fontPx) * 0.42));
  return EditorView.theme({
    "&": {
      height: "100%",
      fontSize: `${args.fontPx}px`,
      fontFamily: args.fontFamily,
      fontWeight: String(args.fontWeight),
      fontStyle: args.fontItalic ? "italic" : "normal",
      "--cm-meta-gutter-width": `${args.metaGutterWidthPx}px`,
    },
    ".cm-scroller": { overflow: "auto" },
    ".cm-content": { padding: "0.35rem 0.5rem 0.5rem 0" },
    ".cm-line": {
      paddingTop: `${linePad}px`,
      paddingBottom: `${linePad}px`,
      minHeight: `${minLine}px`,
    },
    ".cm-transcript-primary-line": {
      backgroundColor: "color-mix(in srgb, var(--color-saffron, #c45c26) 16%, transparent)",
    },
    ".cm-transcript-in-selection-line": {
      backgroundColor: "color-mix(in srgb, var(--color-saffron, #c45c26) 8%, transparent)",
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
}): Extension[] {
  const bridgePrimaryMoved = (idx: number, opts: { shiftKey?: boolean; toggle?: boolean }) => {
    // Transitional P3→P5: CM6 owns selection SoT; bridge keeps SC1/waveform seek alive
    // until P5 ports waveform to transcriptProjection. Remove with onSelectSegment prop.
    args.onSelectSegmentRef.current?.(idx, opts);
  };

  return [
    ...transcriptEditorCoreExtensions({
      withProjection: true,
      metaGutter: {
        onSelectSegment: (idx, opts) => bridgePrimaryMoved(idx, opts),
      },
    }),
    transcriptLineCountGuard,
    createTranscriptEditorKeymap({
      onPrimaryMoved: (idx, opts) => bridgePrimaryMoved(idx, opts),
    }),
    createOnDocChangedBridge({
      debounceMs: 48,
      onTextLinesProjected: (projected) => {
        args.applyingFromBridgeRef.current = true;
        try {
          applyProjectedTextDiff({
            baseline: args.latestSegmentsRef.current,
            projected,
            updateSegmentText: (idx, text) => args.updateSegmentTextRef.current(idx, text),
          });
        } finally {
          queueMicrotask(() => {
            args.applyingFromBridgeRef.current = false;
          });
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
    EditorView.domEventHandlers({
      mousedown(event, view) {
        if (args.busyRef.current) return true;
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
        if (pos == null) return false;
        const line = view.state.doc.lineAt(pos);
        const idx = line.number - 1;
        const toggle = event.metaKey || event.ctrlKey;
        const shiftKey = event.shiftKey;
        selectSegmentCommand(view, idx, { toggle, shiftKey });
        bridgePrimaryMoved(idx, { toggle, shiftKey });
        return false;
      },
      contextmenu(event, view) {
        if (args.busyRef.current) return true;
        const open = args.onOpenContextMenuRef?.current;
        if (!open) return false;
        event.preventDefault();
        const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
        const lineCount = view.state.doc.lines;
        const lineIdx =
          pos != null
            ? view.state.doc.lineAt(pos).number - 1
            : Math.max(0, Math.min(lineCount - 1, primarySegmentIdx(view.state)));
        const selectionText = readTranscriptEditorSelectionText(view);
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
