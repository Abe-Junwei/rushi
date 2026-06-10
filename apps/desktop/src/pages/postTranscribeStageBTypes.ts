import type { PostTranscribeStageBSegmentChange } from "../services/postprocess/postTranscribeStageB";

export type PostTranscribeStageBDialogState =
  | { phase: "closed" }
  | { phase: "consent"; segmentCount: number; pendingStageAHint: string | null }
  | {
      phase: "loading";
      done: number;
      total: number;
      providerLabel: string;
      pendingStageAHint: string | null;
    }
  | {
      phase: "preview";
      changes: PostTranscribeStageBSegmentChange[];
      selectedSegmentIdxs: number[];
      provider: string;
      droppedUngroundedOps: number;
      dropDetail: string | null;
      stepError: string | null;
      pendingStageAHint: string | null;
      packTruncationHint: string | null;
    }
  | {
      phase: "empty";
      stepError: string | null;
      pendingStageAHint: string | null;
      packTruncationHint: string | null;
    };

export const STAGE_B_CONSENT_KEY = "rushi:auto-punctuate-consent:v1";
