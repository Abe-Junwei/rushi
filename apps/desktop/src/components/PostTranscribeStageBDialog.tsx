import { isLocalLoopbackLlmConfig } from "../services/postprocess/postprocessRuntimeContract";
import type { PostTranscribeStageBDialogState } from "../pages/usePostTranscribeStageBController";
import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY } from "../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import { CompactFloatingDialog } from "./CompactFloatingDialog";
import { readFloatingPanelViewport } from "./floatingPanelViewport";
import { PostTranscribeStageBConsentPanel } from "./postTranscribeStageB/PostTranscribeStageBConsentPanel";
import { PostTranscribeStageBEmptyPanel } from "./postTranscribeStageB/PostTranscribeStageBEmptyPanel";
import { PostTranscribeStageBLoadingPanel } from "./postTranscribeStageB/PostTranscribeStageBLoadingPanel";
import { PostTranscribeStageBPreviewPanel } from "./postTranscribeStageB/PostTranscribeStageBPreviewPanel";

const POST_TRANSCRIBE_STAGE_B_PANEL_ID = "post-transcribe-stage-b-v1";

const STAGE_B_PANEL_DEFAULT_SIZE = { width: 480, height: 400 } as const;
/** consent 默认宽度（说明短，较预览略窄） */
const STAGE_B_CONSENT_DEFAULT_WIDTH = 480;

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
  const isConsent = state.phase === "consent";
  const isPreview = state.phase === "preview";
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

  const persistPhaseKey = state.phase;

  const handleDismiss = () => {
    onCancel();
  };

  const footer =
    state.phase === "consent" ? (
      <>
        <button type="button" className={CONTROL_BTN_SECONDARY} disabled={busy} onClick={handleDismiss}>
          取消
        </button>
        <button type="button" className={CONTROL_BTN_PRIMARY} disabled={busy} onClick={onConfirmConsent}>
          我已知晓，继续
        </button>
      </>
    ) : state.phase === "empty" ? (
      <button type="button" className={CONTROL_BTN_SECONDARY} onClick={handleDismiss}>
        关闭
      </button>
    ) : preview ? (
      <>
        <p className={`${PANEL_TYPOGRAPHY.dialogBody} text-notion-text-muted`}>
          将写回 {preview.selectedSegmentIdxs.length} / {preview.changes.length} 条语段
        </p>
        <div className="flex shrink-0 items-center gap-2">
          {preview.provider ? (
            <span className={`${PANEL_TYPOGRAPHY.meta} text-notion-text-muted`}>
              {preview.provider}
            </span>
          ) : null}
          <button type="button" className={CONTROL_BTN_SECONDARY} disabled={busy} onClick={handleDismiss}>
            取消
          </button>
          <button
            type="button"
            className={CONTROL_BTN_PRIMARY}
            disabled={busy || preview.selectedSegmentIdxs.length === 0}
            onClick={onConfirmWriteback}
          >
            确认写回
          </button>
        </div>
      </>
    ) : null;

  const footerJustify =
    state.phase === "consent" || state.phase === "empty"
      ? "end"
      : preview
        ? "between"
        : "end";

  return (
    <CompactFloatingDialog
      id={POST_TRANSCRIBE_STAGE_B_PANEL_ID}
      title={resolveStageBDialogTitle(state)}
      open={open}
      onClose={handleDismiss}
      onOverlayClose={() => {}}
      fallbackHeight={STAGE_B_PANEL_DEFAULT_SIZE.height}
      defaultWidth={isConsent ? STAGE_B_CONSENT_DEFAULT_WIDTH : STAGE_B_PANEL_DEFAULT_SIZE.width}
      minWidth={panelBounds.minWidth}
      minHeight={200}
      maxWidth={panelBounds.maxWidth}
      maxHeight={panelBounds.maxHeight}
      persistPhaseKey={persistPhaseKey}
      panelZIndex={111}
      persistState
      footer={footer}
      footerJustify={footerJustify}
      fitKind={isPreview ? "autoFit" : "staticFit"}
    >
      {state.phase === "consent" ? (
        <PostTranscribeStageBConsentPanel state={state} pendingHint={pendingHint} />
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
        />
      ) : null}

      {preview ? (
        <PostTranscribeStageBPreviewPanel
          preview={preview}
          busy={busy}
          previewFocusSegmentIdx={previewFocusSegmentIdx}
          pendingHint={pendingHint}
          packTruncationHint={packTruncationHint}
          onToggleSegment={onToggleSegment}
          onFocusSegment={onFocusSegment}
        />
      ) : null}
    </CompactFloatingDialog>
  );
}
