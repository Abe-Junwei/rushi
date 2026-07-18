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
import { pushTranscribeOutcomeActivity } from "../services/ui/pushActivity";
import { pushTranscribeDeliveryModeToast } from "../services/deliveryModeTranscribeToast";
import { syncOnboardingTranscribe } from "../services/onboarding/onboardingAutoSync";
import { invalidateProjectFilesCaches } from "../services/projectFilesCacheBridge";
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
  invalidateProjectFilesCaches([projectId]);
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
      const fileLabel = projectDetail.files?.find((file) => file.id === fileId)?.name;
      const hint = userHints[0]?.trim();
      const message = hint ? `${presentation.summary} · ${hint}` : presentation.summary;
      pushTranscribeOutcomeActivity({
        variant: "warning",
        message,
        projectId,
        fileId,
        fileLabel,
        action: { label: "打开文件", kind: "open-file" },
      });
    }
    return false;
  }

  setTranscribeFailureDiag(null);
  setTranscribeHints([...userHints, ...diagLines]);
  if (!suppressUserToasts) {
    const fileLabel = projectDetail.files?.find((file) => file.id === fileId)?.name;
    pushTranscribeDeliveryModeToast(presentation, { projectId, fileId, fileLabel });
    syncOnboardingTranscribe();
  }
  return true;
}
