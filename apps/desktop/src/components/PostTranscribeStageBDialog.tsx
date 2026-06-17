import { isLocalLoopbackLlmConfig } from "../services/postprocess/postprocessRuntimeContract";
import type { PostTranscribeStageBDialogState } from "../pages/usePostTranscribeStageBController";
import { CompactFloatingDialog } from "./CompactFloatingDialog";
import {
  FLOATING_PANEL_COMPACT_MIN_HEIGHT,
  resolveStageBPreviewFitHeight,
  resolveStageBConsentFitHeight,
  resolveStageBEmptyFitHeight,
} from "./floatingPanelSegmentListLayout";
import { readFloatingPanelViewport } from "./floatingPanelViewport";
import { PostTranscribeStageBConsentPanel } from "./postTranscribeStageB/PostTranscribeStageBConsentPanel";
import { PostTranscribeStageBEmptyPanel } from "./postTranscribeStageB/PostTranscribeStageBEmptyPanel";
import { PostTranscribeStageBLoadingPanel } from "./postTranscribeStageB/PostTranscribeStageBLoadingPanel";
import { PostTranscribeStageBPreviewPanel } from "./postTranscribeStageB/PostTranscribeStageBPreviewPanel";

const POST_TRANSCRIBE_STAGE_B_PANEL_ID = "post-transcribe-stage-b-v1";

const STAGE_B_PANEL_DEFAULT_SIZE = { width: 480, height: 400 } as const;
/** consent 默认宽度（说明短，较预览略窄） */
const STAGE_B_CONSENT_DEFAULT_WIDTH = 480;
/** loading 阶段 contentFitHeight：标题栏 + 进度区 + 取消按钮 */
const STAGE_B_LOADING_PANEL_HEIGHT = 308;

function resolveStageBPanelBounds() {
  const margin = 24;
  const { width: vw, height: vh } = readFloatingPanelViewport();
  return {
    minWidth: 400,
    minHeight: 320,
    maxWidth: Math.min(720, Math.max(400, vw - margin * 2)),
    maxHeight: Math.min(520, Math.max(320, vh - margin * 2)),
  };
}

function resolveStageBDialogTitle(state: PostTranscribeStageBDialogState): string {
  if (state.phase === "consent") {
    return isLocalLoopbackLlmConfig() ? "将语段发送至本机 LLM" : "将语段发送至 LLM";
  }
  if (state.phase === "loading") return "智能改稿";
  if (state.phase === "preview") return "智能改稿预览";
  return "智能改稿";
}

type Props = {
  state: PostTranscribeStageBDialogState;
  busy: boolean;
  previewFocusSegmentIdx: number | null;
  onCancel: () => void;
  onConfirmConsent: () => void;
  onConfirmWriteback: () => void;
  onToggleSegment: (segmentIdx: number) => void;
  onFocusSegment: (segmentIdx: number) => void;
};

export function PostTranscribeStageBDialog({
  state,
  busy,
  previewFocusSegmentIdx,
  onCancel,
  onConfirmConsent,
  onConfirmWriteback,
  onToggleSegment,
  onFocusSegment,
}: Props) {
  const open = state.phase !== "closed";
  const panelBounds = resolveStageBPanelBounds();
  const isLoading = state.phase === "loading";
  const isConsent = state.phase === "consent";
  const isEmpty = state.phase === "empty";
  const isPreview = state.phase === "preview";
  const isCompactBody = isConsent || isEmpty;
  const preview = isPreview ? state : null;
  const packTruncationHint =
    state.phase === "preview" || state.phase === "empty" ? state.packTruncationHint : null;
  const pendingHint =
    state.phase === "consent" ||
    state.phase === "loading" ||
    state.phase === "preview" ||
    state.phase === "empty"
      ? state.pendingStageAHint
      : null;

  const previewFitHeight = preview ? resolveStageBPreviewFitHeight(preview.changes.length) : undefined;

  const estimatedFit = isLoading
    ? STAGE_B_LOADING_PANEL_HEIGHT
    : isPreview
      ? previewFitHeight
      : isConsent
        ? resolveStageBConsentFitHeight(Boolean(pendingHint))
        : isEmpty
          ? resolveStageBEmptyFitHeight(Boolean(pendingHint), Boolean(packTruncationHint))
          : undefined;

  const persistPhaseKey = state.phase;

  const handleDismiss = () => {
    onCancel();
  };

  return (
    <CompactFloatingDialog
      id={POST_TRANSCRIBE_STAGE_B_PANEL_ID}
      title={resolveStageBDialogTitle(state)}
      open={open}
      onClose={handleDismiss}
      onOverlayClose={() => {}}
      fallbackHeight={STAGE_B_PANEL_DEFAULT_SIZE.height}
      estimatedFitHeight={estimatedFit ?? STAGE_B_PANEL_DEFAULT_SIZE.height}
      defaultWidth={isConsent ? STAGE_B_CONSENT_DEFAULT_WIDTH : STAGE_B_PANEL_DEFAULT_SIZE.width}
      minWidth={panelBounds.minWidth}
      minHeight={
        isLoading ? 240 : isCompactBody ? FLOATING_PANEL_COMPACT_MIN_HEIGHT : panelBounds.minHeight
      }
      maxWidth={panelBounds.maxWidth}
      maxHeight={panelBounds.maxHeight}
      persistPhaseKey={persistPhaseKey}
      panelZIndex={111}
      persistState
    >
      {state.phase === "consent" ? (
        <PostTranscribeStageBConsentPanel
          state={state}
          busy={busy}
          pendingHint={pendingHint}
          onCancel={handleDismiss}
          onConfirmConsent={onConfirmConsent}
        />
      ) : null}

      {state.phase === "loading" ? (
        <PostTranscribeStageBLoadingPanel
          done={state.done}
          total={state.total}
          providerLabel={state.providerLabel}
          pendingStageAHint={state.pendingStageAHint}
          onCancel={onCancel}
        />
      ) : null}

      {state.phase === "empty" ? (
        <PostTranscribeStageBEmptyPanel
          state={state}
          pendingHint={pendingHint}
          packTruncationHint={packTruncationHint}
          onClose={handleDismiss}
        />
      ) : null}

      {preview ? (
        <PostTranscribeStageBPreviewPanel
          preview={preview}
          busy={busy}
          previewFocusSegmentIdx={previewFocusSegmentIdx}
          pendingHint={pendingHint}
          packTruncationHint={packTruncationHint}
          onCancel={handleDismiss}
          onConfirmWriteback={onConfirmWriteback}
          onToggleSegment={onToggleSegment}
          onFocusSegment={onFocusSegment}
        />
      ) : null}
    </CompactFloatingDialog>
  );
}
