import type { SegmentDto } from "../tauri/projectTypes";
import type { SegmentOverlapPolicy } from "../utils/segmentTimeRange";

/** Input context for transcription timeline + waveform layer. */
export type TranscriptionLayerInput = {
  projectId: string | null;
  fileId: string | null;
  mediaUrl: string | null;
  segments: SegmentDto[];
  selectedIdx: number;
  setSelectedIdx: (idx: number) => void;
  busy: boolean;
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
  insertSegmentAfter: (idx: number, mediaDurationSec?: number) => void;
  deleteSegmentAt: (idx: number) => void;
  confirmSegmentEditAndAdvance: (segmentIdx: number) => Promise<boolean>;
  onOpenSegmentContextMenu?: (menu: import("../utils/segmentContextMenuModel").SegmentContextMenuOpen) => void;
};
