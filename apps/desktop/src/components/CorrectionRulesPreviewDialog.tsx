import { createPortal } from "react-dom";
import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY } from "../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import type { CorrectionRulesDialogState } from "../pages/useCorrectionRulesController";
import { CORRECTION_RULES_PANEL_ID } from "../pages/correctionRulesPanelTypes";
import type { CorrectionRuleHintPair } from "../services/editor/correctionRuleHints";
import {
  CORRECTION_MEMORY_STABLE_HIT,
  type LearningCorrectionHint,
} from "../services/editor/learningCorrectionRuleHints";
import { CorrectionRulesChangeText } from "./CorrectionRulesChangeText";
import { FloatingPanelSegmentList } from "./FloatingPanelSegmentList";
import {
  CORRECTION_RULES_LOADING_BODY_PX,
  CORRECTION_RULES_PREVIEW_STATIC_BODY_PX,
  FLOATING_PANEL_COMPACT_MIN_HEIGHT,
  resolveCorrectionRulesEmptyFitHeight,
  resolveFloatingPanelCompactFitHeight,
  resolveFloatingPanelFitHeight,
} from "./floatingPanelSegmentListLayout";
import { FloatingPanelSegmentRow } from "./FloatingPanelSegmentRow";
import { readFloatingPanelViewport } from "./floatingPanelViewport";
import { PanelAsyncProgress } from "./PanelAsyncProgress";
import { FloatingPanelTemplate } from "./PanelTemplate";
import {
  FloatingPanelDialogFooter,
  FloatingPanelDialogHeader,
  FloatingPanelDialogListRegion,
  FloatingPanelDialogRoot,
  FloatingPanelDialogScroll,
} from "./FloatingPanelDialogLayout";

type Props = {
  state: CorrectionRulesDialogState;
  busy: boolean;
  stableConflictMessage: string | null;
  previewFocusSegmentIdx: number | null;
  onCancel: () => void;
  onConfirm: () => void;
  onCloseEmpty: () => void;
  onToggleSegment: (segmentIdx: number) => void;
  onFocusSegment: (segmentIdx: number) => void;
};

const READ_ONLY_HINT_META_CLASS =
  "w-[4.25rem] shrink-0 truncate text-left text-xs leading-4 tabular-nums text-notion-text-muted";

function ReadOnlyHintChangeLine({ beforeText, afterText }: { beforeText: string; afterText: string }) {
  return (
    <span className="min-w-0 flex-1 truncate whitespace-nowrap text-sm leading-snug text-notion-text">
      <span className="text-notion-text-muted line-through decoration-notion-text-light/70">{beforeText}</span>
      <span className="px-1 text-notion-text-light" aria-hidden>
        →
      </span>
      <span>{afterText}</span>
    </span>
  );
}

function ReadOnlyHintRow({
  meta,
  metaTitle,
  beforeText,
  afterText,
}: {
  meta: string;
  metaTitle?: string;
  beforeText: string;
  afterText: string;
}) {
  return (
    <li className="flex min-w-0 items-center gap-2 bg-notion-bg/50 px-3 py-1.5">
      <span className={READ_ONLY_HINT_META_CLASS} title={metaTitle}>
        {meta}
      </span>
      <ReadOnlyHintChangeLine beforeText={beforeText} afterText={afterText} />
    </li>
  );
}

function ReadOnlyHintGroupLabel({ children }: { children: string }) {
  return (
    <li
      className={`list-none bg-notion-callout-bg px-3 py-1 ${PANEL_TYPOGRAPHY.meta} font-medium text-notion-text-muted`}
      aria-hidden
    >
      {children}
    </li>
  );
}

function ReadOnlyHintsDetails({
  learningHints,
  transcribeHints,
}: {
  learningHints: LearningCorrectionHint[];
  transcribeHints: CorrectionRuleHintPair[];
}) {
  const count = learningHints.length + transcribeHints.length;
  if (!count) return null;

  const showGroupLabels = learningHints.length > 0 && transcribeHints.length > 0;

  return (
    <details className="shrink-0 rounded-md border border-notion-divider bg-notion-callout-bg">
      <summary
        className={`cursor-pointer list-none px-3 py-1.5 ${PANEL_TYPOGRAPHY.meta} font-medium text-notion-text marker:content-none [&::-webkit-details-marker]:hidden`}
      >
        只读提示（{count}）
        <span className="ml-1 font-normal text-notion-text-muted">· 预览不会写回</span>
      </summary>
      <ul className="m-0 max-h-36 list-none divide-y divide-notion-divider/80 overflow-y-auto border-t border-notion-divider">
        {learningHints.length > 0 ? (
          <>
            {showGroupLabels ? <ReadOnlyHintGroupLabel>纠错记忆（学习中）</ReadOnlyHintGroupLabel> : null}
            {learningHints.map((hint) => (
              <ReadOnlyHintRow
                key={`learning:${hint.beforeText}\u0000${hint.afterText}`}
                meta={`${hint.hitCount}/${CORRECTION_MEMORY_STABLE_HIT}`}
                metaTitle={`学习中，满 ${CORRECTION_MEMORY_STABLE_HIT} 次可升为稳定规则`}
                beforeText={hint.beforeText}
                afterText={hint.afterText}
              />
            ))}
          </>
        ) : null}
        {transcribeHints.length > 0 ? (
          <>
            {showGroupLabels ? <ReadOnlyHintGroupLabel>转写规则提示</ReadOnlyHintGroupLabel> : null}
            {transcribeHints.map((hint) => (
              <ReadOnlyHintRow
                key={`transcribe:${hint.beforeText}\u0000${hint.afterText}`}
                meta="转写"
                metaTitle="转写附带提示，本预览不会写回"
                beforeText={hint.beforeText}
                afterText={hint.afterText}
              />
            ))}
          </>
        ) : null}
      </ul>
    </details>
  );
}

export function CorrectionRulesPreviewDialog({
  state,
  busy,
  stableConflictMessage,
  previewFocusSegmentIdx,
  onCancel,
  onConfirm,
  onCloseEmpty,
  onToggleSegment,
  onFocusSegment,
}: Props) {
  if (state.phase === "closed" || typeof document === "undefined") return null;

  const handleClose = () => {
    if (!busy) onCancel();
  };

  const postTranscribe =
    (state.phase === "preview" || state.phase === "loading" || state.phase === "empty") &&
    state.trigger === "postTranscribe";
  const title = postTranscribe
    ? "规则纠错"
    : state.phase === "empty"
      ? "规则纠错"
      : state.phase === "preview"
        ? "规则纠错预览"
        : "规则纠错";

  const preview = state.phase === "preview" ? state : null;
  const isEmpty = state.phase === "empty";
  const isLoading = state.phase === "loading";
  const isCompactBody = isEmpty || isLoading;
  const selectedCount = preview?.selectedSegmentIdxs.length ?? 0;
  const totalCount = preview?.changes.length ?? 0;

  const viewport = readFloatingPanelViewport();
  const panelMargin = 16;
  const panelMaxHeight = Math.min(720, Math.max(300, viewport.height - panelMargin * 2));

  const hasReadOnlyHints =
    isEmpty &&
    state.readOnlyLearningHints.length + state.readOnlyTranscribeHints.length > 0;

  const contentFitHeight = preview
    ? resolveFloatingPanelFitHeight(CORRECTION_RULES_PREVIEW_STATIC_BODY_PX, totalCount)
    : isEmpty
      ? resolveCorrectionRulesEmptyFitHeight({
          hasReadOnlyHints,
          postTranscribeExtra: postTranscribe,
        })
      : isLoading
        ? resolveFloatingPanelCompactFitHeight(CORRECTION_RULES_LOADING_BODY_PX)
        : undefined;

  const defaultPanelHeight = Math.min(contentFitHeight ?? 400, panelMaxHeight);

  return createPortal(
    <div className="workspace">
      <FloatingPanelTemplate
        id={CORRECTION_RULES_PANEL_ID}
        title={title}
        preset="findReplace"
        minWidth={400}
        minHeight={isCompactBody ? FLOATING_PANEL_COMPACT_MIN_HEIGHT : 300}
        maxHeight={panelMaxHeight}
        defaultSize={{
          width: 520,
          height: defaultPanelHeight,
        }}
        contentFitHeight={contentFitHeight}
        panelZIndex={110}
        persistState
        onClose={handleClose}
      >
        <FloatingPanelDialogRoot className="gap-2">
          {state.phase === "loading" ? (
            <PanelAsyncProgress mode="spinner" message="正在加载稳定纠错规则…" />
          ) : null}
          {state.phase === "empty" ? (
            <>
              <FloatingPanelDialogScroll className="flex flex-col gap-2">
                <p className={`shrink-0 ${PANEL_TYPOGRAPHY.dialogBody}`}>
                  {postTranscribe
                    ? "转写已落库。当前没有可应用的稳定纠错规则（需命中 ≥3 次或已采纳），或语段中无匹配项。"
                    : "没有可用的稳定纠错规则（需命中 ≥3 次或已采纳），或当前语段中无匹配项。"}
                </p>
                <ReadOnlyHintsDetails
                  learningHints={state.readOnlyLearningHints}
                  transcribeHints={state.readOnlyTranscribeHints}
                />
                {postTranscribe ? (
                  <p className={`shrink-0 ${PANEL_TYPOGRAPHY.dialogBody} text-notion-text-muted`}>
                    可先用手动改正或查找替换继续改稿。
                  </p>
                ) : null}
              </FloatingPanelDialogScroll>
              <FloatingPanelDialogFooter justify="end">
                <button type="button" className={CONTROL_BTN_SECONDARY} onClick={onCloseEmpty}>
                  关闭
                </button>
              </FloatingPanelDialogFooter>
            </>
          ) : null}
          {preview ? (
            <>
              <FloatingPanelDialogHeader className="space-y-2">
                <p className={PANEL_TYPOGRAPHY.dialogBody}>
                  共 <span className="font-medium text-notion-text">{preview.ruleCount}</span> 条规则，
                  <span className="font-medium text-notion-text"> {totalCount}</span> 条语段有匹配
                  <span className="text-notion-text-muted"> · 点击行定位语段</span>
                </p>
                {stableConflictMessage ? (
                  <p
                    className={`rounded-md bg-zen-saffron/10 px-3 py-2 ${PANEL_TYPOGRAPHY.dialogBody} text-notion-text`}
                  >
                    {stableConflictMessage}
                  </p>
                ) : null}
                <ReadOnlyHintsDetails
                  learningHints={preview.readOnlyLearningHints}
                  transcribeHints={preview.readOnlyTranscribeHints}
                />
              </FloatingPanelDialogHeader>
              <FloatingPanelDialogListRegion>
                <FloatingPanelSegmentList rowCount={totalCount} fillAvailable>
                  {preview.changes.map((ch) => {
                    const checked = preview.selectedSegmentIdxs.includes(ch.segmentIdx);
                    const focused = previewFocusSegmentIdx === ch.segmentIdx;
                    return (
                      <li key={ch.segmentIdx} className="list-none">
                        <FloatingPanelSegmentRow
                          segmentNumber={ch.segmentNumber}
                          timeLabel={ch.startTimeLabel}
                          suffix={`${ch.replacementCount}处`}
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
                          <CorrectionRulesChangeText
                            variant="inline"
                            beforeText={ch.beforeText}
                            afterText={ch.afterText}
                            beforeHighlights={ch.beforeHighlights}
                            afterHighlights={ch.afterHighlights}
                          />
                        </FloatingPanelSegmentRow>
                      </li>
                    );
                  })}
                </FloatingPanelSegmentList>
              </FloatingPanelDialogListRegion>
              <FloatingPanelDialogFooter>
                <p className={`${PANEL_TYPOGRAPHY.dialogBody} text-notion-text-muted`}>
                  将写回 {selectedCount} / {totalCount} 条语段
                </p>
                <div className="flex shrink-0 gap-2">
                  <button type="button" className={CONTROL_BTN_SECONDARY} disabled={busy} onClick={handleClose}>
                    取消
                  </button>
                  <button
                    type="button"
                    className={CONTROL_BTN_PRIMARY}
                    disabled={busy || selectedCount === 0 || !!stableConflictMessage}
                    onClick={onConfirm}
                  >
                    确认写回
                  </button>
                </div>
              </FloatingPanelDialogFooter>
            </>
          ) : null}
        </FloatingPanelDialogRoot>
      </FloatingPanelTemplate>
    </div>,
    document.body,
  );
}
