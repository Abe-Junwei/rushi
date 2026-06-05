import { createPortal } from "react-dom";
import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY } from "../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import type { PostTranscribeStageBDialogState } from "../pages/usePostTranscribeStageBController";
import { describeStageBProgress } from "../services/postprocess/postTranscribeStageB";
import { PanelAsyncProgress } from "./PanelAsyncProgress";
import { readFloatingPanelViewport } from "./floatingPanelViewport";
import { FloatingPanelTemplate } from "./PanelTemplate";
import { highlightTextByDiff } from "../utils/textDiff";

export const POST_TRANSCRIBE_STAGE_B_PANEL_ID = "post-transcribe-stage-b-v1";

const STAGE_B_PANEL_DEFAULT_SIZE = { width: 560, height: 480 } as const;

function resolveStageBPanelBounds() {
  const margin = 24;
  const { width: vw, height: vh } = readFloatingPanelViewport();
  return {
    minWidth: 400,
    minHeight: 320,
    maxWidth: Math.min(720, Math.max(400, vw - margin * 2)),
    maxHeight: Math.min(640, Math.max(320, vh - margin * 2)),
  };
}

function resolveStageBDialogTitle(state: PostTranscribeStageBDialogState): string {
  if (state.phase === "blocked") return "智能改稿不可用";
  if (state.phase === "consent") return "将语段发送至云端 LLM";
  if (state.phase === "loading") return "智能改稿";
  if (state.phase === "preview") return "智能改稿预览";
  return "智能改稿";
}

function StageBLoadingPanel({
  done,
  total,
  punctuateSteps,
  onCancel,
  cancelDisabled,
}: {
  done: number;
  total: number;
  punctuateSteps: number;
  onCancel: () => void;
  cancelDisabled: boolean;
}) {
  const progress = describeStageBProgress({ done, total, punctuateSteps });
  return (
    <PanelAsyncProgress
      mode="determinate"
      title="正在生成标点与改字候选…"
      stepLabel={progress.phaseLabel}
      stepDetail={progress.detail}
      done={done}
      total={total}
      percent={progress.percent}
      onCancel={onCancel}
      cancelDisabled={cancelDisabled}
    />
  );
}

type Props = {
  state: PostTranscribeStageBDialogState;
  busy: boolean;
  onCancel: () => void;
  onDismissBlocked: () => void;
  onConfirmConsent: () => void;
  onConfirmWriteback: () => void;
  onToggleSegment: (segmentIdx: number) => void;
};

export function PostTranscribeStageBDialog({
  state,
  busy,
  onCancel,
  onDismissBlocked,
  onConfirmConsent,
  onConfirmWriteback,
  onToggleSegment,
}: Props) {
  if (state.phase === "closed" || typeof document === "undefined") return null;

  const panelBounds = resolveStageBPanelBounds();
  const preview = state.phase === "preview" ? state : null;

  const handleClose = () => {
    if (busy) return;
    if (state.phase === "blocked") onDismissBlocked();
    else onCancel();
  };

  return createPortal(
    <div className="workspace">
      <FloatingPanelTemplate
        id={POST_TRANSCRIBE_STAGE_B_PANEL_ID}
        title={resolveStageBDialogTitle(state)}
        preset="compactDialog"
        minWidth={panelBounds.minWidth}
        minHeight={panelBounds.minHeight}
        maxWidth={panelBounds.maxWidth}
        maxHeight={panelBounds.maxHeight}
        defaultSize={STAGE_B_PANEL_DEFAULT_SIZE}
        panelZIndex={111}
        persistState
        onClose={handleClose}
      >
        <div className="flex h-full min-h-0 flex-col px-5 py-3">
          {state.phase === "blocked" ? (
            <>
              <p className={`shrink-0 ${PANEL_TYPOGRAPHY.dialogBody}`}>{state.reason}</p>
              <div className="mt-4 flex shrink-0 justify-end">
                <button type="button" className={CONTROL_BTN_SECONDARY} onClick={onDismissBlocked}>
                  关闭
                </button>
              </div>
            </>
          ) : null}

          {state.phase === "consent" ? (
            <>
              <p className={`shrink-0 ${PANEL_TYPOGRAPHY.dialogBody}`}>
                将对当前文件最多 {state.segmentCount} 条有正文的语段请求标点与改字候选（按「设置 → LLM
                配置」发送）。正文不会在未经确认的情况下被改写；不会合并或拆分语段。
              </p>
              <div className="mt-4 flex shrink-0 justify-end gap-2">
                <button type="button" className={CONTROL_BTN_SECONDARY} disabled={busy} onClick={handleClose}>
                  取消
                </button>
                <button type="button" className={CONTROL_BTN_PRIMARY} disabled={busy} onClick={onConfirmConsent}>
                  我已知晓，继续
                </button>
              </div>
            </>
          ) : null}

          {state.phase === "loading" ? (
            <StageBLoadingPanel
              done={state.done}
              total={state.total}
              punctuateSteps={state.punctuateSteps}
              onCancel={handleClose}
              cancelDisabled={busy}
            />
          ) : null}

          {state.phase === "empty" ? (
            <>
              <p className={`shrink-0 ${PANEL_TYPOGRAPHY.dialogBody}`}>
                {state.typoStepError
                  ? state.typoStepError
                  : "LLM 未对当前语段提出可写回的标点或改字建议。"}
              </p>
              <div className="mt-4 flex shrink-0 justify-end">
                <button type="button" className={CONTROL_BTN_SECONDARY} onClick={handleClose}>
                  关闭
                </button>
              </div>
            </>
          ) : null}

          {preview ? (
            <>
              <div className="shrink-0 space-y-2">
                <p className={PANEL_TYPOGRAPHY.dialogBody}>
                  共 {preview.changes.length} 条语段有候选（高亮为将改部分）。
                  {preview.provider ? ` · ${preview.provider}` : null}
                </p>
                {preview.rejectedBoundaryOps > 0 ? (
                  <p
                    className={`rounded-md bg-zen-saffron/10 px-3 py-2 ${PANEL_TYPOGRAPHY.dialogBody} text-notion-text`}
                  >
                    模型返回了 {preview.rejectedBoundaryOps} 条段界建议，已忽略；仅展示标点与改字候选。
                  </p>
                ) : null}
                {preview.typoStepError ? (
                  <p
                    className={`rounded-md bg-zen-saffron/10 px-3 py-2 ${PANEL_TYPOGRAPHY.dialogBody} text-notion-text`}
                  >
                    {preview.typoStepError} 标点候选仍可确认写回。
                  </p>
                ) : null}
              </div>
              <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto text-xs">
                {preview.changes.map((ch) => {
                  const checked = preview.selectedSegmentIdxs.includes(ch.segmentIdx);
                  const highlighted = highlightTextByDiff(ch.afterText, ch.diff);
                  return (
                    <div
                      key={ch.segmentIdx}
                      className={[
                        "rounded-md px-3 py-2.5",
                        checked ? "bg-notion-sidebar/80" : "bg-notion-sidebar/40 opacity-70",
                      ].join(" ")}
                    >
                      <label className="flex cursor-pointer items-start gap-2.5">
                        <span className="min-w-0 flex-1">
                          <span className="text-notion-text-muted">
                            <span className="font-semibold text-notion-text">语段 {ch.segmentNumber}</span>
                            <span className="mx-1.5">·</span>
                            <span className="tabular-nums">{ch.timeLabel}</span>
                            <span className="mx-1.5">·</span>
                            {ch.punctuateTouched && ch.typoTouched
                              ? "标点 + 改字"
                              : ch.punctuateTouched
                                ? "标点"
                                : "改字"}
                          </span>
                          <div className="mt-1.5 grid grid-cols-1 gap-2">
                            <pre className="whitespace-pre-wrap rounded bg-white/60 px-2 py-1.5 text-notion-text">
                              {ch.beforeText}
                            </pre>
                            <pre className="whitespace-pre-wrap rounded bg-white/60 px-2 py-1.5 text-notion-text">
                              {highlighted.map((part, idx) => (
                                <span
                                  key={`${idx}-${part.text}`}
                                  className={part.highlight ? "rounded bg-zen-saffron/20" : ""}
                                >
                                  {part.text}
                                </span>
                              ))}
                            </pre>
                          </div>
                        </span>
                        <input
                          type="checkbox"
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-zen-saffron"
                          checked={checked}
                          disabled={busy}
                          onChange={() => onToggleSegment(ch.segmentIdx)}
                        />
                      </label>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 flex shrink-0 items-center justify-between gap-2 border-t border-notion-divider pt-3">
                <p className={`${PANEL_TYPOGRAPHY.dialogBody} text-notion-text-muted`}>
                  将写回 {preview.selectedSegmentIdxs.length} / {preview.changes.length} 条语段
                </p>
                <div className="flex shrink-0 gap-2">
                  <button type="button" className={CONTROL_BTN_SECONDARY} disabled={busy} onClick={handleClose}>
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
              </div>
            </>
          ) : null}
        </div>
      </FloatingPanelTemplate>
    </div>,
    document.body,
  );
}
