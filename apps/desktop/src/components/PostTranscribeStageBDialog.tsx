import { ENV_NAV } from "../config/environmentNavCopy";
import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY } from "../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import type { PostTranscribeStageBDialogState } from "../pages/usePostTranscribeStageBController";
import { isLocalLoopbackLlmConfig } from "../services/postprocess/postprocessRuntimeContract";
import { describeStageBPreviewSummary, describeStageBProgress } from "../services/postprocess/postTranscribeStageB";
import { CompactFloatingDialog } from "./CompactFloatingDialog";
import { FloatingPanelSegmentList } from "./FloatingPanelSegmentList";
import {
  FLOATING_PANEL_COMPACT_MIN_HEIGHT,
  resolveStageBPreviewFitHeight,
  resolveStageBConsentFitHeight,
  resolveStageBEmptyFitHeight,
} from "./floatingPanelSegmentListLayout";
import { FloatingPanelSegmentRow } from "./FloatingPanelSegmentRow";
import { PanelAsyncProgress } from "./PanelAsyncProgress";
import { readFloatingPanelViewport } from "./floatingPanelViewport";
import {
  FloatingPanelDialogFooter,
  FloatingPanelDialogHeader,
  FloatingPanelDialogListRegion,
} from "./FloatingPanelDialogLayout";
import { highlightTextByDiff } from "../utils/textDiff";

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

function PendingStageAHint({ message }: { message: string }) {
  return (
    <p
      className={`rounded-md bg-zen-saffron/10 px-3 py-2 ${PANEL_TYPOGRAPHY.dialogBody} text-notion-text`}
    >
      {message}
    </p>
  );
}

function PackTruncationHint({ message }: { message: string }) {
  return (
    <p
      className={`rounded-md bg-notion-callout-bg px-3 py-2 ${PANEL_TYPOGRAPHY.dialogBody} text-notion-text-muted`}
    >
      {message}
    </p>
  );
}

function StageBLoadingPanel({
  done,
  total,
  providerLabel,
  pendingStageAHint,
  onCancel,
}: {
  done: number;
  total: number;
  providerLabel: string;
  pendingStageAHint: string | null;
  onCancel: () => void;
}) {
  const progress = describeStageBProgress({ done, total });
  return (
    <div className="space-y-3">
      {pendingStageAHint ? <PendingStageAHint message={pendingStageAHint} /> : null}
      <PanelAsyncProgress
        mode="determinate"
        title="正在生成标点与改字候选…"
        stepDetail={progress.detail}
        providerLabel={providerLabel}
        done={progress.stepDone}
        total={progress.stepTotal}
        percent={progress.percent}
        onCancel={onCancel}
        cancelDisabled={false}
      />
    </div>
  );
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
  const previewSummary = preview ? describeStageBPreviewSummary(preview.changes.length) : null;

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

  /** 标题栏 ×：与底部「取消」一致，loading 中也可中止任务 */
  const handleTitleClose = () => {
    handleDismiss();
  };

  /** 遮罩点击不关闭：loading 防误触；结果阶段须显式点按钮或标题栏 ×。 */
  const handleOverlayClose = () => {};

  return (
    <CompactFloatingDialog
      id={POST_TRANSCRIBE_STAGE_B_PANEL_ID}
      title={resolveStageBDialogTitle(state)}
      open={open}
      onClose={handleTitleClose}
      onOverlayClose={handleOverlayClose}
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
            <>
              <FloatingPanelDialogHeader>
                {pendingHint ? <PendingStageAHint message={pendingHint} /> : null}
                <p className={PANEL_TYPOGRAPHY.dialogBody}>
                  将对当前文件最多 {state.segmentCount} 条有正文的语段请求标点与改字候选（按「{ENV_NAV.llm}」发送；一次请求合并标点与词表有据改字）。正文不会在未经确认的情况下被改写；不会合并或拆分语段。
                </p>
              </FloatingPanelDialogHeader>
              <FloatingPanelDialogFooter justify="end">
                <button type="button" className={CONTROL_BTN_SECONDARY} disabled={busy} onClick={handleTitleClose}>
                  取消
                </button>
                <button type="button" className={CONTROL_BTN_PRIMARY} disabled={busy} onClick={onConfirmConsent}>
                  我已知晓，继续
                </button>
              </FloatingPanelDialogFooter>
            </>
          ) : null}

          {state.phase === "loading" ? (
            <StageBLoadingPanel
              done={state.done}
              total={state.total}
              providerLabel={state.providerLabel}
              pendingStageAHint={state.pendingStageAHint}
              onCancel={onCancel}
            />
          ) : null}

          {state.phase === "empty" ? (
            <>
              <FloatingPanelDialogHeader>
                {pendingHint ? <PendingStageAHint message={pendingHint} /> : null}
                {packTruncationHint ? <PackTruncationHint message={packTruncationHint} /> : null}
                <p className={PANEL_TYPOGRAPHY.dialogBody}>
                  {state.stepError
                    ? state.stepError
                    : "LLM 未对当前语段提出可写回的标点或改字建议。"}
                </p>
              </FloatingPanelDialogHeader>
              <FloatingPanelDialogFooter justify="end">
                <button type="button" className={CONTROL_BTN_SECONDARY} onClick={handleTitleClose}>
                  关闭
                </button>
              </FloatingPanelDialogFooter>
            </>
          ) : null}

          {preview ? (
            <>
              <FloatingPanelDialogHeader>
                {pendingHint ? <PendingStageAHint message={pendingHint} /> : null}
                {packTruncationHint ? <PackTruncationHint message={packTruncationHint} /> : null}
                {previewSummary ? (
                  <div className="space-y-1">
                    <p className={PANEL_TYPOGRAPHY.dialogBody}>{previewSummary.headline}</p>
                    <p className={`${PANEL_TYPOGRAPHY.meta} text-notion-text-muted`}>{previewSummary.hint}</p>
                  </div>
                ) : null}
                {preview.dropDetail ? (
                  <p
                    className={`rounded-md bg-zen-saffron/10 px-3 py-2 ${PANEL_TYPOGRAPHY.dialogBody} text-notion-text`}
                  >
                    {preview.droppedUngroundedOps > 0
                      ? `已忽略 ${preview.droppedUngroundedOps} 条建议。`
                      : null}
                    {preview.dropDetail}
                  </p>
                ) : null}
                {preview.stepError ? (
                  <p
                    className={`rounded-md bg-zen-saffron/10 px-3 py-2 ${PANEL_TYPOGRAPHY.dialogBody} text-notion-text`}
                  >
                    {preview.stepError} 已成功批次的候选仍可确认写回。
                  </p>
                ) : null}
              </FloatingPanelDialogHeader>
              <FloatingPanelDialogListRegion className="mt-3">
                <FloatingPanelSegmentList rowCount={preview.changes.length} fillAvailable>
                  {preview.changes.map((ch) => {
                    const checked = preview.selectedSegmentIdxs.includes(ch.segmentIdx);
                    const focused = previewFocusSegmentIdx === ch.segmentIdx;
                    const highlighted = highlightTextByDiff(ch.afterText, ch.diff);
                    const isHomophoneGuess = ch.evidenceSummary?.includes("同音推测") ?? false;
                    const changeLabel = isHomophoneGuess
                      ? "同音推测"
                      : ch.punctuateTouched && ch.typoTouched
                        ? "标点+改字"
                        : ch.punctuateTouched
                          ? "标点"
                          : "改字";
                    return (
                      <li key={ch.uid || String(ch.segmentIdx)} className="list-none">
                        <FloatingPanelSegmentRow
                          segmentNumber={ch.segmentNumber}
                          timeLabel={ch.timeLabel}
                          suffix={changeLabel}
                          active={focused}
                          disabled={busy}
                          onClick={() => onFocusSegment(ch.segmentIdx)}
                          trailing={
                            <input
                              type="checkbox"
                              className="h-3.5 w-3.5 shrink-0 accent-zen-saffron"
                              checked={checked}
                              disabled={busy}
                              aria-label={`包含语段 ${ch.segmentNumber}`}
                              onClick={(e) => e.stopPropagation()}
                              onChange={() => onToggleSegment(ch.segmentIdx)}
                            />
                          }
                        >
                          <div className="min-w-0 space-y-1">
                            {ch.evidenceSummary ? (
                              <p className="truncate text-[11px] text-notion-text-muted">
                                依据：{ch.evidenceSummary}
                              </p>
                            ) : null}
                            <p className="truncate text-sm text-notion-text-muted line-through decoration-notion-text-light/70">
                              {ch.beforeText}
                            </p>
                            <p className="truncate text-sm text-notion-text">
                              {highlighted.map((part, idx) => (
                                <span
                                  key={`${idx}-${part.text}`}
                                  className={part.highlight ? "rounded bg-zen-saffron/20" : ""}
                                >
                                  {part.text}
                                </span>
                              ))}
                            </p>
                          </div>
                        </FloatingPanelSegmentRow>
                      </li>
                    );
                  })}
                </FloatingPanelSegmentList>
              </FloatingPanelDialogListRegion>
              <FloatingPanelDialogFooter>
                <p className={`${PANEL_TYPOGRAPHY.dialogBody} text-notion-text-muted`}>
                  将写回 {preview.selectedSegmentIdxs.length} / {preview.changes.length} 条语段
                </p>
                <div className="flex shrink-0 items-center gap-2">
                  {preview.provider ? (
                    <span className={`${PANEL_TYPOGRAPHY.meta} text-notion-text-muted`}>
                      {preview.provider}
                    </span>
                  ) : null}
                  <button type="button" className={CONTROL_BTN_SECONDARY} disabled={busy} onClick={handleTitleClose}>
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
              </FloatingPanelDialogFooter>
            </>
          ) : null}
    </CompactFloatingDialog>
  );
}
