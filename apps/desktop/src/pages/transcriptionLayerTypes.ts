import type { SegmentDto } from "../tauri/projectTypes";
import type { SegmentOverlapPolicy } from "../utils/segmentTimeRange";

/** Input context for transcription timeline + waveform layer. */
export type TranscriptionLayerInput = {
  projectId: string | null;
  fileId: string | null;
  mediaUrl: string | null;
  segments: SegmentDto[];
  selectedIdx: number;
  busy: boolean;
  selectionLo: number;
  selectionHi: number;
  selectionCount: number;
  isMultiSegmentSelection: boolean;
  isContiguousSelection: boolean;
  selectedIndicesArray: number[];
  isIndexInSelection: (idx: number) => boolean;
  selectSegmentAt: (idx: number, opts?: { shiftKey?: boolean; toggle?: boolean }) => void;
  selectSegmentRange: (lo: number, hi: number) => void;
  selectSegmentIndices: (indices: number[], primaryIdx: number) => void;
  clearMultiSelection: () => void;
  requestDeleteSelectedIndices: (indices: number[]) => void;
  undo: () => void;
  redo: () => void;
  updateSegmentBounds: (idx: number, startSec: number, endSec: number, phase?: "live" | "commit") => void;
  insertSegmentFromTimeRange: (
    startSec: number,
    endSec: number,
    mediaDurationSec?: number,
    policy?: SegmentOverlapPolicy,
  ) => void;
  splitAtSelection: () => void;
  splitAtPlayhead: (timeSec: number) => void;
  mergeWithNext: () => void;
  mergeWithPrev: () => void;
  mergeWithNextAt: (idx: number) => void;
  mergeWithPrevAt: (idx: number) => void;
  mergeSegmentRange: (lo: number, hi: number) => void;
  insertSegmentAfter: (idx: number, mediaDurationSec?: number) => void;
  deleteSegmentAt: (idx: number) => void;
  requestDeleteSelection: (lo: number, hi: number) => void;
  confirmSegmentEditAndAdvance: (segmentIdx: number) => Promise<boolean>;
  saveSegments: (options?: { quiet?: boolean; countHits?: boolean }) => Promise<boolean>;
  triggerFindReplaceShortcut: () => void;
  closeFile: () => void;
  openEnvironment: () => void;
  openSegmentAnnotationDialog: (segmentIdx: number) => void;
  openManualCorrectionMemoryDialog: (wrong: string) => void;
  onOpenSegmentContextMenu?: (menu: import("../utils/segmentContextMenuModel").SegmentContextMenuOpen) => void;
};
