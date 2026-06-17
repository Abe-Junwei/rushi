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
import type { SegmentDto } from "../tauri/projectApi";
import * as p1 from "../tauri/projectApi";
import { publishSegmentTextBulkMutation } from "./flushSegmentTextDrafts";

type FinishTranscribeSuccessArgs = {
  fileId: string;
  out: p1.RunTranscribeOutcome;
  projectId: string;
  segmentsRef: React.MutableRefObject<SegmentDto[]>;
  setSegments: React.Dispatch<React.SetStateAction<SegmentDto[]>>;
  setCurrent: (detail: p1.ProjectDetail) => void;
  resetMutationHistory: () => void;
  openFileWrapped: (fileId: string) => Promise<void>;
  onTranscribeSuccess?: (out: p1.RunTranscribeOutcome) => void;
  transcribeStartedAtMs: number;
  setTranscribeWarnings: (warnings: string[]) => void;
  setTranscribeFailureDiag: (diag: TranscribeTimelineSnapshot | null) => void;
  setTranscribeHints: (hints: string[]) => void;
  setError: (msg: string) => void;
};

export async function finishTranscribeSuccess(args: FinishTranscribeSuccessArgs): Promise<void> {
  const {
    fileId,
    out,
    projectId,
    segmentsRef,
    setSegments,
    setCurrent,
    resetMutationHistory,
    openFileWrapped,
    onTranscribeSuccess,
    transcribeStartedAtMs,
    setTranscribeWarnings,
    setTranscribeFailureDiag,
    setTranscribeHints,
    setError,
  } = args;

  resetMutationHistory();
  const projectDetail = await p1.projectLoad(projectId);
  setCurrent(projectDetail);
  const segments = out.detail.segments;
  publishSegmentTextBulkMutation(segmentsRef, setSegments, segments);
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
    if (userHints.length > 0) {
      pushTranscribeHintsToToast([presentation.summary, userHints[0]]);
    } else {
      pushTranscribeHintsToToast([presentation.summary]);
    }
  } else {
    setTranscribeFailureDiag(null);
    setTranscribeHints([...userHints, ...diagLines]);
    pushTranscribeDeliveryModeToast(presentation);
    syncOnboardingTranscribe();
  }
}
