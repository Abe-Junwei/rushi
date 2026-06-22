import { useRef } from "react";
import type { ProjectControllerApi } from "../pages/useProjectController";
import type { TranscriptionLayerInput } from "../pages/transcriptionLayerTypes";
import type { SegmentContextMenuOpen } from "../utils/segmentContextMenuModel";

type Args = {
  controller: ProjectControllerApi;
  openEnvironment: () => void;
  onOpenSegmentContextMenu: (menu: SegmentContextMenuOpen) => void;
};

/** Stable object identity — mutates fields in place so selectedIdx churn does not rebuild txInput. */
export function useStableTranscriptionLayerInput({
  controller: c,
  openEnvironment,
  onOpenSegmentContextMenu,
}: Args): TranscriptionLayerInput {
  const inputRef = useRef<TranscriptionLayerInput | null>(null);
  if (!inputRef.current) {
    inputRef.current = {
      projectId: null,
      fileId: null,
      mediaUrl: null,
      mediaDiskPath: null,
      segments: [],
      selectedIdx: 0,
      selectedIdxRef: c.selectedIdxRef,
      busy: false,
      selectionLo: 0,
      selectionHi: 0,
      selectionRangeAnchorIdx: 0,
      selectionCount: 0,
      isMultiSegmentSelection: false,
      isContiguousSelection: true,
      selectedIndicesArray: [],
      isIndexInSelection: () => false,
      selectSegmentAt: c.selectSegmentAt,
      selectSegmentRange: c.selectSegmentRange,
      selectSegmentIndices: c.selectSegmentIndices,
      clearMultiSelection: c.clearMultiSelection,
      requestDeleteSelectedIndices: c.requestDeleteSelectedIndices,
      undo: c.undo,
      redo: c.redo,
      updateSegmentBounds: c.updateSegmentBounds,
      insertSegmentFromTimeRange: c.insertSegmentFromTimeRange,
      splitAtSelection: c.splitAtSelection,
      splitAtPlayhead: c.splitAtPlayhead,
      mergeWithNext: c.mergeWithNext,
      mergeWithPrev: c.mergeWithPrev,
      mergeWithNextAt: c.mergeWithNextAt,
      mergeWithPrevAt: c.mergeWithPrevAt,
      mergeSegmentRange: c.mergeSegmentRange,
      insertSegmentAfter: c.insertSegmentAfter,
      deleteSegmentAt: c.deleteSegmentAt,
      requestDeleteSelection: c.requestDeleteSelection,
      confirmSegmentEditAndAdvance: c.confirmSegmentEditAndAdvance,
      saveSegments: c.saveSegments,
      triggerFindReplaceShortcut: c.triggerFindReplaceShortcut,
      closeFile: c.closeFile,
      openEnvironment,
      openSegmentAnnotationDialog: c.openSegmentAnnotationDialog,
      openManualCorrectionMemoryDialog: c.openManualCorrectionMemoryDialog,
      onOpenSegmentContextMenu,
    };
  }

  const input = inputRef.current;
  input.projectId = c.current?.id ?? null;
  input.fileId = c.currentFileId;
  input.mediaUrl = c.audioSrc;
  input.mediaDiskPath = c.audioStoragePath;
  input.segments = c.segments;
  input.selectedIdx = c.selectedIdx;
  input.selectedIdxRef = c.selectedIdxRef;
  input.busy = c.busy;
  input.selectionLo = c.selectionLo;
  input.selectionHi = c.selectionHi;
  input.selectionRangeAnchorIdx = c.selectionRangeAnchorIdx;
  input.selectionCount = c.selectionCount;
  input.isMultiSegmentSelection = c.isMultiSegmentSelection;
  input.isContiguousSelection = c.isContiguousSelection;
  input.selectedIndicesArray = c.selectedIndicesArray;
  input.isIndexInSelection = c.isIndexInSelection;
  input.selectSegmentAt = c.selectSegmentAt;
  input.selectSegmentRange = c.selectSegmentRange;
  input.selectSegmentIndices = c.selectSegmentIndices;
  input.clearMultiSelection = c.clearMultiSelection;
  input.requestDeleteSelectedIndices = c.requestDeleteSelectedIndices;
  input.undo = c.undo;
  input.redo = c.redo;
  input.updateSegmentBounds = c.updateSegmentBounds;
  input.insertSegmentFromTimeRange = c.insertSegmentFromTimeRange;
  input.splitAtSelection = c.splitAtSelection;
  input.splitAtPlayhead = c.splitAtPlayhead;
  input.mergeWithNext = c.mergeWithNext;
  input.mergeWithPrev = c.mergeWithPrev;
  input.mergeWithNextAt = c.mergeWithNextAt;
  input.mergeWithPrevAt = c.mergeWithPrevAt;
  input.mergeSegmentRange = c.mergeSegmentRange;
  input.insertSegmentAfter = c.insertSegmentAfter;
  input.deleteSegmentAt = c.deleteSegmentAt;
  input.requestDeleteSelection = c.requestDeleteSelection;
  input.confirmSegmentEditAndAdvance = c.confirmSegmentEditAndAdvance;
  input.saveSegments = c.saveSegments;
  input.triggerFindReplaceShortcut = c.triggerFindReplaceShortcut;
  input.closeFile = c.closeFile;
  input.openEnvironment = openEnvironment;
  input.openSegmentAnnotationDialog = c.openSegmentAnnotationDialog;
  input.openManualCorrectionMemoryDialog = c.openManualCorrectionMemoryDialog;
  input.onOpenSegmentContextMenu = onOpenSegmentContextMenu;

  return input;
}
