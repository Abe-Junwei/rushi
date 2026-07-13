import { useEffect, useRef } from "react";
import type { MutableRefObject, RefObject } from "react";
import { Compartment, EditorSelection, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { SegmentDto } from "../../../tauri/projectTypes";
import { setDirectLayoutStyle } from "../../../utils/cspElementLayout";
import { CspLayout } from "../../CspLayout";
import { buildTranscriptEditorState } from "./buildTranscriptEditorState";
import { syncTranscriptProjectionFromView } from "./transcriptProjection";
import { serializeTranscriptEditorState } from "./serializeTranscriptEditorState";
import { TRANSCRIPT_EDITOR_CORE_ATTR } from "./transcriptEditorDom";
import {
  primarySegmentIdx,
  getTranscriptMultiSelection,
  setTranscriptMultiSelectionEffect,
} from "./selectionField";
import { computeTranscriptMetaGutterWidthPx } from "./metaGutter";
import {
  buildTranscriptAppearanceTheme,
  buildTranscriptEditorCoreExtensions,
} from "./transcriptEditorCoreMount";
import {
  dispatchTranscriptFilterVisible,
  dispatchTranscriptPanelHighlight,
  registerTranscriptEditorView,
} from "./transcriptEditorViewHandle";
import type { TranscriptPanelHighlight } from "./panelHighlightField";
import { setTranscriptFilterVisibleEffect } from "./filterLineVisibility";
import { segmentMetaField, setSegmentMetaEffect } from "./segmentMetaField";
import { segmentDtoToMeta } from "./structureCommands";
import { setTranscriptScopedPlayingEffect } from "./scopedPlayingField";
import { peekFileViewRestoreForFile } from "../../../services/fileViewStateBridge";
import { findSegmentIndexByUid } from "../../../pages/segmentListHelpers";

export type TranscriptEditorCoreProps = {
  segments: readonly SegmentDto[];
  fileId: string | null;
  /** Host selection seed for file remount — read at mount time (openFile sets this before fileId). */
  initialPrimaryIdxRef?: RefObject<number | null | undefined> | MutableRefObject<number>;
  busy?: boolean;
  fontPx?: number;
  fontFamily?: string;
  fontWeight?: 500 | 700;
  fontItalic?: boolean;
  /** Legacy appearance meta width (full column); gutter uses derived half. */
  transcriptMetaWidthPx?: number;
  onMetaWidthPointerDown?: (e: React.PointerEvent<HTMLDivElement>) => void;
  updateSegmentText: (idx: number, text: string) => void;
  onSelectSegment?: (idx: number, opts?: { shiftKey?: boolean; toggle?: boolean }) => void;
  /** Primary-row play beside text — scoped segment play/stop. */
  onToggleSegmentPlay?: (idx: number) => void;
  /** Syncs play/stop icon on primary stage gutter. */
  isSelectedSegmentPlaying?: boolean;
  onOpenContextMenu?: (args: {
    x: number;
    y: number;
    segmentIdx: number;
    pointerTimeSec: number;
    selectionText: string;
  }) => void;
  /** Find/replace or correction-rules active span highlight. */
  panelHighlight?: TranscriptPanelHighlight;
  /** When filter active: visible segment indices; inactive → show all. */
  filterActive?: boolean;
  filteredIndices?: readonly number[];
  listRef?: React.RefObject<HTMLDivElement | null>;
  className?: string;
};

type EditorViewWithEditContext = typeof EditorView & { EDIT_CONTEXT?: boolean };

/**
 * Flag-on transcript list body: CM6 owns caret/focus/text.
 * Does not use per-row textarea / draft store / focus retry.
 */
export function TranscriptEditorCore(props: TranscriptEditorCoreProps) {
  const {
    segments,
    fileId,
    initialPrimaryIdxRef,
    busy = false,
    fontPx = 16,
    fontFamily = "inherit",
    fontWeight = 500,
    fontItalic = false,
    transcriptMetaWidthPx = 132,
    onMetaWidthPointerDown,
    updateSegmentText,
    onSelectSegment,
    onToggleSegmentPlay,
    isSelectedSegmentPlaying = false,
    onOpenContextMenu,
    panelHighlight = null,
    filterActive = false,
    filteredIndices = [],
    listRef,
    className,
  } = props;

  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const extensionsRef = useRef<Extension[]>([]);
  const appearanceCompartmentRef = useRef(new Compartment());
  const latestSegmentsRef = useRef(segments);
  latestSegmentsRef.current = segments;
  const applyingFromBridgeRef = useRef(false);
  const updateSegmentTextRef = useRef(updateSegmentText);
  updateSegmentTextRef.current = updateSegmentText;
  const onSelectSegmentRef = useRef(onSelectSegment);
  onSelectSegmentRef.current = onSelectSegment;
  const onToggleSegmentPlayRef = useRef(onToggleSegmentPlay);
  onToggleSegmentPlayRef.current = onToggleSegmentPlay;
  const onOpenContextMenuRef = useRef(onOpenContextMenu);
  onOpenContextMenuRef.current = onOpenContextMenu;
  const busyRef = useRef(busy);
  busyRef.current = busy;

  const metaGutterWidthPx = computeTranscriptMetaGutterWidthPx(transcriptMetaWidthPx);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const appearanceCompartment = appearanceCompartmentRef.current;
    const extensions = buildTranscriptEditorCoreExtensions({
      fontPx,
      fontFamily,
      fontWeight,
      fontItalic,
      metaGutterWidthPx,
      appearanceCompartment,
      latestSegmentsRef,
      applyingFromBridgeRef,
      updateSegmentTextRef,
      onSelectSegmentRef,
      onToggleSegmentPlayRef,
      busyRef,
      onOpenContextMenuRef,
    });
    extensionsRef.current = extensions;

    const segs = latestSegmentsRef.current;
    const pending = peekFileViewRestoreForFile(fileId);
    const fromRestore = pending
      ? findSegmentIndexByUid(segs, pending.state.selectedSegmentUid)
      : -1;
    const seedRaw = initialPrimaryIdxRef?.current;
    const seedFromRef = typeof seedRaw === "number" && Number.isFinite(seedRaw) ? seedRaw : 0;
    const seedIdx = fromRestore >= 0 ? fromRestore : seedFromRef;
    const state = buildTranscriptEditorState(segs, {
      extensions,
      initialPrimaryIdx: seedIdx,
    });
    const ViewCtor = EditorView as EditorViewWithEditContext;
    const prev = ViewCtor.EDIT_CONTEXT;
    ViewCtor.EDIT_CONTEXT = false;
    const view = new EditorView({ state, parent: host });
    ViewCtor.EDIT_CONTEXT = prev;

    view.dom.setAttribute(TRANSCRIPT_EDITOR_CORE_ATTR, "1");
    view.contentDOM.setAttribute("aria-label", "语段正文");
    viewRef.current = view;
    registerTranscriptEditorView(view);
    syncTranscriptProjectionFromView(view);

    return () => {
      registerTranscriptEditorView(null);
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remount on file only
  }, [fileId]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view || applyingFromBridgeRef.current) return;

    const current = serializeTranscriptEditorState(view.state);
    const lengthDrift = current.length !== segments.length;
    let textDrift = false;
    let metaDrift = false;
    if (!lengthDrift) {
      const cmMeta = view.state.field(segmentMetaField);
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        if ((seg?.text ?? "") !== (current[i]?.text ?? "")) {
          textDrift = true;
        }
        const m = cmMeta[i];
        if (
          !m ||
          !seg ||
          Math.abs(m.startSec - seg.start_sec) > 0.0005 ||
          Math.abs(m.endSec - seg.end_sec) > 0.0005 ||
          (m.stage ?? null) !== (seg.text_stage ?? null) ||
          (m.finalizeVia ?? null) !== (seg.finalize_via ?? null) ||
          m.uid !== (seg.uid ?? `idx-${i}`)
        ) {
          metaDrift = true;
        }
      }
    }
    if (!lengthDrift && !textDrift && metaDrift) {
      view.dispatch({
        effects: setSegmentMetaEffect.of(segments.map((s, i) => segmentDtoToMeta(s, i))),
      });
      return;
    }
    if (!lengthDrift && !textDrift) return;
    if (view.hasFocus && !lengthDrift) return;

    // External structure/text sync (e.g. undo). Prefer P6/P7 CM6 commands for live edits.
    const prevPrimary = primarySegmentIdx(view.state);
    const prevMulti = getTranscriptMultiSelection(view.state);
    view.setState(
      buildTranscriptEditorState(segments, {
        extensions: extensionsRef.current,
      }),
    );
    view.dom.setAttribute(TRANSCRIPT_EDITOR_CORE_ATTR, "1");
    view.contentDOM.setAttribute("aria-label", "语段正文");
    const lineCount = view.state.doc.lines;
    if (lineCount > 0) {
      const primary = Math.max(0, Math.min(prevPrimary < 0 ? 0 : prevPrimary, lineCount - 1));
      const selectedSet = new Set<number>();
      for (const idx of prevMulti.selectedSet) {
        if (idx >= 0 && idx < lineCount) selectedSet.add(idx);
      }
      if (selectedSet.size === 0) selectedSet.add(primary);
      const rangeAnchor = Math.max(0, Math.min(prevMulti.rangeAnchor, lineCount - 1));
      const line = view.state.doc.line(primary + 1);
      view.dispatch({
        selection: EditorSelection.single(line.from),
        effects: setTranscriptMultiSelectionEffect.of({ selectedSet, rangeAnchor }),
      });
    }
    syncTranscriptProjectionFromView(view);
    const visible =
      filterActive && filteredIndices.length > 0 && filteredIndices.length < segments.length
        ? new Set(filteredIndices)
        : filterActive && filteredIndices.length === 0
          ? new Set<number>()
          : null;
    view.dispatch({ effects: setTranscriptFilterVisibleEffect.of(visible) });
  }, [segments, filterActive, filteredIndices]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: appearanceCompartmentRef.current.reconfigure(
        buildTranscriptAppearanceTheme({
          fontPx,
          fontFamily,
          fontWeight,
          fontItalic,
          metaGutterWidthPx,
        }),
      ),
    });
    setDirectLayoutStyle(view.dom, {
      "--cm-meta-gutter-width": `${metaGutterWidthPx}px`,
      fontSize: `${fontPx}px`,
    });
  }, [fontPx, fontFamily, fontWeight, fontItalic, metaGutterWidthPx]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.contentDOM.contentEditable = busy ? "false" : "true";
  }, [busy]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: setTranscriptScopedPlayingEffect.of(isSelectedSegmentPlaying),
    });
  }, [isSelectedSegmentPlaying]);

  useEffect(() => {
    dispatchTranscriptPanelHighlight(panelHighlight);
  }, [panelHighlight]);

  useEffect(() => {
    const visible =
      filterActive && filteredIndices.length > 0 && filteredIndices.length < segments.length
        ? new Set(filteredIndices)
        : filterActive && filteredIndices.length === 0
          ? new Set<number>()
          : null;
    dispatchTranscriptFilterVisible(visible);
  }, [filterActive, filteredIndices, segments.length]);

  return (
    <div
      className={
        className ??
        "relative flex h-0 min-h-0 flex-1 overflow-hidden bg-notion-bg text-notion-text"
      }
      data-transcript-editor-core-host="1"
    >
      <div
        ref={(el) => {
          hostRef.current = el;
          if (listRef) listRef.current = el;
        }}
        className="h-full min-h-0 min-w-0 flex-1 overflow-hidden"
      />
      {onMetaWidthPointerDown ? (
        <CspLayout
          role="separator"
          aria-orientation="vertical"
          aria-label="拖拽调整语段信息列宽度"
          layout={{ left: metaGutterWidthPx }}
          className={[
            "absolute top-0 bottom-0 z-10 w-2.5 -translate-x-1/2 rounded-full",
            busy
              ? "cursor-not-allowed"
              : "cursor-col-resize hover:bg-accent-action/12",
          ].join(" ")}
          onPointerDown={onMetaWidthPointerDown}
        />
      ) : null}
    </div>
  );
}
