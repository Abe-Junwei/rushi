import type { EditorView } from "@codemirror/view";
import type { SegmentDto } from "../../../tauri/projectTypes";
import { selectSegmentCommand, selectSegmentIndicesCommand, selectSegmentRangeCommand, type SelectSegmentOptions } from "./selectionCommands";
import { primarySegmentIdx } from "./selectionField";
import { readTranscriptEditorCoreEnabled } from "./transcriptEditorCoreFlag";
import {
  applyTranscriptSegmentsStructure,
  deleteSegmentAtCommand,
  deleteSegmentIndicesCommand,
  deleteSegmentRangeCommand,
  insertSegmentAtCommand,
  mergeSegmentRangeCommand,
  mergeWithNextCommand,
  mergeWithPrevCommand,
  segmentDtoToMeta,
  splitSegmentAtMidpointCommand,
  splitSegmentAtTimeCommand,
} from "./structureCommands";
import { setSegmentMetaEffect } from "./segmentMetaField";
import {
  applySegmentTextsBulkCommand,
  focusFindMatchCommand,
  replaceSegmentCharRangeCommand,
  replaceSegmentLineTextCommand,
} from "./textEditCommands";
import {
  setTranscriptPanelHighlightEffect,
  type TranscriptPanelHighlight,
} from "./panelHighlightField";
import {
  setTranscriptFilterCriteriaEffect,
  setTranscriptFilterVisibleEffect,
  type TranscriptFilterVisibleSet,
} from "./filterLineVisibility";
import type { SegmentListFilterState } from "../../../services/segmentListFilter";

let activeView: EditorView | null = null;

/** Register the live flag-on EditorView (one instance). Cleared on destroy. */
export function registerTranscriptEditorView(view: EditorView | null): void {
  activeView = view;
}

export function getTranscriptEditorView(): EditorView | null {
  return activeView;
}

export {
  runWithTranscriptStructureBridgeGate,
  shouldSkipTranscriptExternalStructureSync,
} from "./transcriptStructureBridgeGate";

/**
 * Dispatch selection into CM6 when the core flag is on and a view is mounted.
 * No-op when already at idx (avoids feedback loops from the SC1 bridge).
 */
export function dispatchTranscriptEditorSelection(
  idx: number,
  opts?: SelectSegmentOptions,
): boolean {
  if (!readTranscriptEditorCoreEnabled()) return false;
  const view = activeView;
  if (!view) return false;
  if (
    opts?.shiftKey !== true &&
    opts?.toggle !== true &&
    primarySegmentIdx(view.state) === idx
  ) {
    return false;
  }
  return selectSegmentCommand(view, idx, opts);
}

export function dispatchTranscriptEditorSelectionIndices(
  indices: Iterable<number>,
  primaryIdx: number,
  opts?: { scrollIntoView?: boolean },
): boolean {
  if (!readTranscriptEditorCoreEnabled()) return false;
  const view = activeView;
  if (!view) return false;
  return selectSegmentIndicesCommand(view, indices, primaryIdx, opts);
}

export function dispatchTranscriptEditorSelectionRange(
  lo: number,
  hi: number,
  opts?: { scrollIntoView?: boolean },
): boolean {
  if (!readTranscriptEditorCoreEnabled()) return false;
  const view = activeView;
  if (!view) return false;
  return selectSegmentRangeCommand(view, lo, hi, opts);
}

export type TranscriptStructureBaseline = readonly SegmentDto[];

function withView(run: (view: EditorView) => boolean): boolean {
  if (!readTranscriptEditorCoreEnabled()) return false;
  const view = activeView;
  if (!view) return false;
  return run(view);
}

export function dispatchTranscriptSplitAtMidpoint(
  baseline: TranscriptStructureBaseline,
  idx: number,
): boolean {
  return withView((view) => splitSegmentAtMidpointCommand(view, baseline, idx));
}

export function dispatchTranscriptSplitAtTime(
  baseline: TranscriptStructureBaseline,
  timeSec: number,
): boolean {
  return withView((view) => splitSegmentAtTimeCommand(view, baseline, timeSec));
}

export function dispatchTranscriptMergeWithNext(
  baseline: TranscriptStructureBaseline,
  idx: number,
): boolean {
  return withView((view) => mergeWithNextCommand(view, baseline, idx));
}

export function dispatchTranscriptMergeWithPrev(
  baseline: TranscriptStructureBaseline,
  idx: number,
): boolean {
  return withView((view) => mergeWithPrevCommand(view, baseline, idx));
}

export function dispatchTranscriptMergeRange(
  baseline: TranscriptStructureBaseline,
  lo: number,
  hi: number,
): boolean {
  return withView((view) => mergeSegmentRangeCommand(view, baseline, lo, hi));
}

export function dispatchTranscriptDeleteAt(
  baseline: TranscriptStructureBaseline,
  idx: number,
): boolean {
  return withView((view) => deleteSegmentAtCommand(view, baseline, idx));
}

export function dispatchTranscriptDeleteRange(
  baseline: TranscriptStructureBaseline,
  lo: number,
  hi: number,
): boolean {
  return withView((view) => deleteSegmentRangeCommand(view, baseline, lo, hi));
}

export function dispatchTranscriptDeleteIndices(
  baseline: TranscriptStructureBaseline,
  indices: readonly number[],
  prevPrimaryIdx: number,
): boolean {
  return withView((view) =>
    deleteSegmentIndicesCommand(view, baseline, indices, prevPrimaryIdx),
  );
}

export function dispatchTranscriptInsertAt(
  baseline: TranscriptStructureBaseline,
  insertAt: number,
  newSeg: SegmentDto,
): boolean {
  return withView((view) => insertSegmentAtCommand(view, baseline, insertAt, newSeg));
}

export function dispatchTranscriptReplaceCharRange(
  segmentIdx: number,
  charStart: number,
  findLen: number,
  replaceText: string,
): boolean {
  return withView((view) =>
    replaceSegmentCharRangeCommand(view, segmentIdx, charStart, findLen, replaceText),
  );
}

export function dispatchTranscriptReplaceLineText(
  segmentIdx: number,
  nextText: string,
): boolean {
  return withView((view) => replaceSegmentLineTextCommand(view, segmentIdx, nextText));
}

export function dispatchTranscriptApplyTextsBulk(
  updates: ReadonlyArray<{ segmentIdx: number; text: string }>,
): boolean {
  return withView((view) => applySegmentTextsBulkCommand(view, updates));
}

/** Replace full CM6 doc+meta from a SegmentDto[] snapshot (undo/redo, bulk restore). */
export function dispatchTranscriptApplySegments(
  nextSegments: readonly SegmentDto[],
  primaryIdx = 0,
): boolean {
  return withView((view) => applyTranscriptSegmentsStructure(view, nextSegments, primaryIdx));
}

/** Sync CM6 meta field from SegmentDto[] without rewriting doc text (bounds/stage). */
export function dispatchTranscriptSyncMetaFromSegments(
  segments: readonly SegmentDto[],
): boolean {
  return withView((view) => {
    if (view.state.doc.lines !== segments.length) return false;
    view.dispatch({
      effects: setSegmentMetaEffect.of(segments.map((s, i) => segmentDtoToMeta(s, i))),
    });
    return true;
  });
}

export function dispatchTranscriptFocusFindMatch(
  segmentIdx: number,
  charStart?: number,
  charEnd?: number,
): boolean {
  return withView((view) => focusFindMatchCommand(view, segmentIdx, charStart, charEnd));
}

export function dispatchTranscriptPanelHighlight(
  highlight: TranscriptPanelHighlight,
): boolean {
  return withView((view) => {
    view.dispatch({ effects: setTranscriptPanelHighlightEffect.of(highlight) });
    return true;
  });
}

export function dispatchTranscriptFilterVisible(
  visible: TranscriptFilterVisibleSet,
  criteria?: SegmentListFilterState | null,
): boolean {
  return withView((view) => {
    if (criteria !== undefined) {
      view.dispatch({
        effects: [
          setTranscriptFilterVisibleEffect.of(visible),
          setTranscriptFilterCriteriaEffect.of(criteria),
        ],
      });
    } else {
      view.dispatch({ effects: setTranscriptFilterVisibleEffect.of(visible) });
    }
    return true;
  });
}
