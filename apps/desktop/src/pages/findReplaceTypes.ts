import type { MutableRefObject, Dispatch, SetStateAction } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import type {
  FindMatchListItem,
  ReplaceAllPreviewRow,
} from "../services/editor/segmentFindReplace";

/** 与 `FindReplaceDialog` 面板根节点 id 一致 */
export const FIND_REPLACE_PANEL_ID = "find-replace-v2";

export function isFindReplacePanelOpen(): boolean {
  return typeof document !== "undefined" && document.getElementById(FIND_REPLACE_PANEL_ID) != null;
}

export type FindReplaceDialogState =
  | { phase: "closed" }
  | {
      phase: "panel";
      findText: string;
      replaceText: string;
      activeMatchIndex: number;
      matchCount: number;
      searchCommitted: boolean;
      resultItems: FindMatchListItem[];
    }
  | {
      phase: "replaceAllPreview";
      findText: string;
      replaceText: string;
      rows: ReplaceAllPreviewRow[];
      matchCount: number;
    };

export type UseFindReplaceControllerArgs = {
  busy: boolean;
  currentFileId: string | null;
  segments: SegmentDto[];
  segmentsRef: MutableRefObject<SegmentDto[]>;
  selectedIdx: number;
  flushSegmentTextDrafts: () => void;
  setSelectedIdx: Dispatch<SetStateAction<number>>;
  updateSegmentText: (idx: number, text: string) => void;
  setSegments: Dispatch<SetStateAction<SegmentDto[]>>;
  pushUndo: () => void;
  saveSegments: (options?: {
    quiet?: boolean;
    countHits?: boolean;
    explicitPairs?: import("../tauri/fileApi").CorrectionExplicitPair[];
  }) => Promise<boolean>;
};

export type FindReplaceControllerApi = {
  canFindReplace: boolean;
  findReplaceBlockReason: string | null;
  findReplaceDialog: FindReplaceDialogState;
  openFindReplace: (initialFind?: string, initialReplace?: string) => void;
  findReplaceEditorHighlight: {
    segmentIdx: number;
    charStart: number;
    charEnd: number;
  } | null;
  findReplaceReplaceAndNext: () => void;
  closeFindReplace: () => void;
  setFindReplaceFindText: (value: string) => void;
  setFindReplaceReplaceText: (value: string) => void;
  findReplaceRunSearch: () => void;
  findReplaceSelectMatch: (globalIndex: number) => void;
  findReplaceGoNext: () => void;
  findReplaceGoPrev: () => void;
  findReplaceCurrent: () => void;
  findReplaceRequestReplaceAll: () => void;
  findReplaceConfirmReplaceAll: () => Promise<void>;
  findReplaceCancelReplaceAllPreview: () => void;
};
