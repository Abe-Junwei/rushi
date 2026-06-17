import { deriveTranscribeHints } from "../services/asrTranscribeHints";
import {
  buildTranscribeEmptyOutcomeDiag,
  formatTranscribeDiagSummary,
  type TranscribeTimelineSnapshot,
} from "../services/transcribeDiag";
import {
  countTranscribeCharacters,
  resolveTranscribeResultPresentation,
} from "../services/asr/transcribeResultToast";
import { pushTranscribeHintsToToast } from "../services/ui/toast";
import { pushTranscribeDeliveryModeToast } from "../services/deliveryModeTranscribeToast";
import { syncOnboardingTranscribe } from "../services/onboarding/onboardingAutoSync";
import * as p1 from "../tauri/projectApi";
import type { SegmentPublishApi } from "./segmentPublishApi";

type FinishTranscribeSuccessArgs = {
  fileId: string;
  out: p1.RunTranscribeOutcome;
  projectId: string;
  segmentPublish: SegmentPublishApi;
  setCurrent: (detail: p1.ProjectDetail) => void;
  resetMutationHistory: () => void;
  openFileWrapped: (fileId: string) => Promise<void>;
  onTranscribeSuccess?: (out: p1.RunTranscribeOutcome) => void;
  transcribeStartedAtMs: number;
  setTranscribeWarnings: (warnings: string[]) => void;
  setTranscribeFailureDiag: (diag: TranscribeTimelineSnapshot | null) => void;
  setTranscribeHints: (hints: string[]) => void;
  setError: (msg: string) => void;
  /** Batch queue: skip per-file delivery toasts and onboarding sync. */
  suppressUserToasts?: boolean;
};

/** `true` when segments were produced; `false` for empty outcome. */
export async function finishTranscribeSuccess(args: FinishTranscribeSuccessArgs): Promise<boolean> {
  const {
    fileId,
    out,
    projectId,
    segmentPublish,
    setCurrent,
    resetMutationHistory,
    openFileWrapped,
    onTranscribeSuccess,
    transcribeStartedAtMs,
    setTranscribeWarnings,
    setTranscribeFailureDiag,
    setTranscribeHints,
    setError,
    suppressUserToasts = false,
  } = args;

  resetMutationHistory();
  const projectDetail = await p1.projectLoad(projectId);
  setCurrent(projectDetail);
  const segments = out.detail.segments;
  segmentPublish.publishTextBulk(segments);
  onTranscribeSuccess?.(out);
  await openFileWrapped(fileId);
  setTranscribeWarnings(out.warnings ?? []);
  const diagSnap = out.transcribeTimeline ?? (await p1.getLastTranscribeTimeline().catch(() => null));
  const diagLines = formatTranscribeDiagSummary(diagSnap);
  const elapsedMs = Date.now() - transcribeStartedAtMs;
  const charCount = countTranscribeCharacters(segments);
  const userHints = deriveTranscribeHints(out.engine ?? "", out.warnings ?? [], segments);
  const presentation = resolveTranscribeResultPresentation({
    segmentCount: segments.length,
    charCount,
    elapsedMs,
  });
  const emptyOutcome = presentation.variant === "warning";

  if (emptyOutcome) {
    const failureDiag = buildTranscribeEmptyOutcomeDiag(diagSnap, {
      fileId,
      engine: out.engine,
      primaryHint: userHints[0],
    });
    setTranscribeFailureDiag(failureDiag);
    setError("转写未产出可用语段。");
    setTranscribeHints([...userHints, ...formatTranscribeDiagSummary(failureDiag), ...diagLines]);
    if (!suppressUserToasts) {
      if (userHints.length > 0) {
        pushTranscribeHintsToToast([presentation.summary, userHints[0]]);
      } else {
        pushTranscribeHintsToToast([presentation.summary]);
      }
    }
    return false;
  }

  setTranscribeFailureDiag(null);
  setTranscribeHints([...userHints, ...diagLines]);
  if (!suppressUserToasts) {
    pushTranscribeDeliveryModeToast(presentation);
    syncOnboardingTranscribe();
  }
  return true;
}
