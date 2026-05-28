import type { SegmentDto } from "../tauri/projectTypes";

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
  insertSegmentFromTimeRange: (startSec: number, endSec: number) => void;
  splitAtSelection: () => void;
  splitAtPlayhead: (timeSec: number) => void;
  mergeWithNext: () => void;
  mergeWithPrev: () => void;
  insertSegmentAfter: (idx: number) => void;
  deleteSegmentAt: (idx: number) => void;
};
