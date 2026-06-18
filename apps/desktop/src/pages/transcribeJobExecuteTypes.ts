import type { TranscribeSource } from "../services/stt/transcribeSource";
import type { ProjectDetail } from "../tauri/projectApi";
import * as p1 from "../tauri/projectApi";
import type { useProjectCloseGateController } from "./useProjectCloseGateController";
import type { useProjectEditorState } from "./useProjectEditorState";
import type { useProjectBusyState } from "./useProjectBusyState";
import type { useSegmentMutationController } from "./useSegmentMutationController";
import type { LocalTranscribePreflight } from "./transcribeJobHelpers";
import type { BusyReason } from "./useProjectCrudController";
import type { SegmentPublishApi } from "./segmentPublishApi";

export type ExecuteTranscribeOptions = {
  /** Parent holds `batch_transcribe` busy; skip inner begin/end busy. */
  batchChild?: boolean;
  /** Required for batch child when editor `currentFileId` may be stale. */
  fileId?: string;
  /** Batch queue: skip per-file delivery toasts. */
  suppressUserToasts?: boolean;
};

export type ExecuteTranscribeResult =
  | { ok: true }
  | { ok: false; message: string };

type CloseGate = Pick<
  ReturnType<typeof useProjectCloseGateController>,
  "openFileWrapped"
>;
type Editor = Pick<
  ReturnType<typeof useProjectEditorState>,
  "current" | "currentFileId" | "setCurrent"
>;
type Busy = Pick<ReturnType<typeof useProjectBusyState>, "busy" | "beginBusy" | "endBusy">;
type Mutations = Pick<ReturnType<typeof useSegmentMutationController>, "resetMutationHistory">;

export type TranscribeJobExecuteArgs = {
  busy: Busy["busy"];
  busyReason: BusyReason | null;
  beginBusy: Busy["beginBusy"];
  endBusy: Busy["endBusy"];
  current: Editor["current"];
  currentFileId: Editor["currentFileId"];
  segmentPublish: SegmentPublishApi;
  setCurrent: Editor["setCurrent"];
  setError: (msg: string) => void;
  closeGate: CloseGate;
  mutations: Mutations;
  localTranscribePreflight: LocalTranscribePreflight;
  transcribeSource: TranscribeSource;
  setTranscribeStartDialogOpen: (open: boolean) => void;
  clearScheduledAutoSave?: () => void;
  onTranscribeSuccess?: (out: p1.RunTranscribeOutcome) => void;
};

export type TranscribeJobExecuteApplyDetail = (d: ProjectDetail) => void;
