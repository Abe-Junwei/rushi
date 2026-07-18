import { useEffect, useRef } from "react";
import type { MutableRefObject, RefObject } from "react";
import { Compartment, EditorSelection, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import type { SegmentDto } from "../../../tauri/projectTypes";
import { setDirectLayoutStyle } from "../../../utils/cspElementLayout";
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
import { TRANSCRIPT_META_WIDTH_DEFAULT } from "../editorTranscriptFontCatalogCore";
import {
  buildTranscriptAppearanceTheme,
  buildTranscriptEditorCoreExtensions,
} from "./transcriptEditorCoreMount";
import {
  dispatchTranscriptFilterVisible,
  dispatchTranscriptPanelHighlight,
  registerTranscriptEditorView,
} from "./transcriptEditorViewHandle";
import { shouldSkipTranscriptExternalStructureSync } from "./transcriptStructureBridgeGate";
import type { TranscriptPanelHighlight } from "./panelHighlightField";
import { setTranscriptFilterVisibleEffect, setTranscriptFilterCriteriaEffect, isTranscriptSegmentVisible } from "./filterLineVisibility";
import { segmentMetaField, setSegmentMetaEffect } from "./segmentMetaField";
import { segmentDtoToMeta } from "./structureCommands";
import {
  revealSegmentAfterStructureChange,
  readSegmentViewportAnchorOffsetPx,
} from "./revealSegmentAfterStructure";
import { setTranscriptScopedPlayingEffect } from "./scopedPlayingField";
import { setTranscriptSegmentLoopEffect } from "./segmentLoopField";
import { peekFileViewRestoreForFile } from "../../../services/fileViewStateBridge";
import { findSegmentIndexByUid } from "../../../pages/segmentListHelpers";
import {
  isDefaultSegmentListFilter,
  resolveTranscriptFilterVisibleSet,
  type SegmentListFilterState,
} from "../../../services/segmentListFilter";

function resolveFilterVisibleForCore(
  filterActive: boolean,
  filteredIndices: readonly number[],
  segmentCount: number,
): ReturnType<typeof resolveTranscriptFilterVisibleSet> {
  return resolveTranscriptFilterVisibleSet(filterActive, filteredIndices, segmentCount);
}

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
  updateSegmentText: (idx: number, text: string) => void;
  onSelectSegment?: (idx: number, opts?: { shiftKey?: boolean; toggle?: boolean }) => void;
  /** Primary-row play beside text — scoped segment play/stop. */
  onToggleSegmentPlay?: (idx: number) => void;
  /** Primary-row loop beside play — segment loop arm/disarm. */
  onToggleSegmentLoop?: (idx: number) => void;
  /** Click the annotation icon in the stage gutter to edit the segment note. */
  onOpenSegmentAnnotationDialog?: (idx: number) => void;
  /** Syncs play/stop icon on primary stage gutter. */
  isSelectedSegmentPlaying?: boolean;
  /** Syncs loop pressed state on primary stage gutter. */
  segmentLoopPlayback?: boolean;
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
  /** React filter criteria SoT — stored in CM for structure TX recompute. */
  filterCriteria?: SegmentListFilterState | null;
  listRef?: React.RefObject<HTMLDivElement | null>;
  className?: string;
  rowHeightDragFromDom?: (target: HTMLElement, event: PointerEvent) => void;
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
    updateSegmentText,
    onSelectSegment,
    onToggleSegmentPlay,
    onToggleSegmentLoop,
    onOpenSegmentAnnotationDialog,
    isSelectedSegmentPlaying = false,
    segmentLoopPlayback = false,
    onOpenContextMenu,
    panelHighlight = null,
    filterActive = false,
    filteredIndices = [],
    filterCriteria = null,
    listRef,
    className,
    rowHeightDragFromDom,
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
  const onToggleSegmentLoopRef = useRef(onToggleSegmentLoop);
  onToggleSegmentLoopRef.current = onToggleSegmentLoop;
  const onOpenSegmentAnnotationDialogRef = useRef(onOpenSegmentAnnotationDialog);
  onOpenSegmentAnnotationDialogRef.current = onOpenSegmentAnnotationDialog;
  const onOpenContextMenuRef = useRef(onOpenContextMenu);
  onOpenContextMenuRef.current = onOpenContextMenu;
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const rowHeightDragFromDomRef = useRef(rowHeightDragFromDom);
  rowHeightDragFromDomRef.current = rowHeightDragFromDom;

  const metaGutterWidthPx = computeTranscriptMetaGutterWidthPx(TRANSCRIPT_META_WIDTH_DEFAULT);

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
      onToggleSegmentLoopRef,
      onOpenSegmentAnnotationDialogRef,
      busyRef,
      onOpenContextMenuRef,
      rowHeightDragFromDomRef,
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
    // CM merge/split already mutated the doc + revealed; React publish must not
    // setState (wipes scrollTop) in the same turn.
    if (shouldSkipTranscriptExternalStructureSync()) return;

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
          m.uid !== (seg.uid ?? `idx-${i}`) ||
          Boolean(m.frozen) !== Boolean(seg.frozen) ||
          Boolean(m.hasAnnotation) !== Boolean(seg.annotation?.trim())
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

    // External structure/text sync (e.g. undo / React publish after merge).
    // Prefer P6/P7 CM6 commands for live edits — but when this path runs,
    // setState resets scrollTop while selection stays on primary (waveform
    // still highlights). Restore filter first, then one reveal.
    const prevPrimary = primarySegmentIdx(view.state);
    const prevMulti = getTranscriptMultiSelection(view.state);
    const oldMeta = view.state.field(segmentMetaField);
    const revealPrimary = Math.max(0, Math.min(prevPrimary < 0 ? 0 : prevPrimary, segments.length - 1));
    const survivingUid = prevPrimary >= 0 ? oldMeta[prevPrimary]?.uid : undefined;
    const samePrimarySurvives =
      survivingUid != null && segments[revealPrimary]?.uid === survivingUid;
    const priorAnchorOffsetPx =
      samePrimarySurvives && prevPrimary >= 0
        ? readSegmentViewportAnchorOffsetPx(view, prevPrimary)
        : undefined;
    view.setState(
      buildTranscriptEditorState(segments, {
        extensions: extensionsRef.current,
      }),
    );
    view.dom.setAttribute(TRANSCRIPT_EDITOR_CORE_ATTR, "1");
    view.contentDOM.setAttribute("aria-label", "语段正文");
    const lineCount = view.state.doc.lines;
    const criteria =
      filterCriteria && !isDefaultSegmentListFilter(filterCriteria) ? filterCriteria : null;
    const visible = resolveFilterVisibleForCore(filterActive, filteredIndices, segments.length);
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
        effects: [
          setTranscriptMultiSelectionEffect.of({ selectedSet, rangeAnchor }),
          setTranscriptFilterCriteriaEffect.of(criteria),
          setTranscriptFilterVisibleEffect.of(visible),
        ],
        scrollIntoView: false,
      });
      syncTranscriptProjectionFromView(view);
      // Only reveal when primary remains visible. Revealing a filter-collapsed
      // (0-height) primary fights manual scroll and looks like forced snap-back.
      if (isTranscriptSegmentVisible(view.state, primary)) {
        revealSegmentAfterStructureChange(view, primary, { priorAnchorOffsetPx });
      }
    } else {
      view.dispatch({
        effects: [
          setTranscriptFilterCriteriaEffect.of(criteria),
          setTranscriptFilterVisibleEffect.of(visible),
        ],
      });
      syncTranscriptProjectionFromView(view);
    }
  }, [segments, filterActive, filteredIndices, filterCriteria]);

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
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: setTranscriptSegmentLoopEffect.of(segmentLoopPlayback),
    });
  }, [segmentLoopPlayback]);

  useEffect(() => {
    dispatchTranscriptPanelHighlight(panelHighlight);
  }, [panelHighlight]);

  useEffect(() => {
    const criteria =
      filterCriteria && !isDefaultSegmentListFilter(filterCriteria) ? filterCriteria : null;
    const visible = resolveFilterVisibleForCore(filterActive, filteredIndices, segments.length);
    dispatchTranscriptFilterVisible(visible, criteria);
  }, [filterActive, filteredIndices, filterCriteria, segments.length]);

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
    </div>
  );
}
