import { createPortal } from "react-dom";
import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY } from "../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import type { CorrectionRulesDialogState } from "../pages/useCorrectionRulesController";
import { CORRECTION_RULES_PANEL_ID } from "../pages/correctionRulesPanelTypes";
import { CorrectionRulesChangeText } from "./CorrectionRulesChangeText";
import { LexiconHealthPanel } from "./LexiconHealthPanel";
import { FloatingPanelSegmentList } from "./FloatingPanelSegmentList";
import { FLOATING_PANEL_COMPACT_MIN_HEIGHT } from "./floatingPanelSegmentListLayout";
import { mergeContentFitHeights, resolveMeasuredPanelFitHeight } from "./floatingPanelFitSections";
import { useFloatingPanelBodyMeasure } from "../hooks/useFloatingPanelBodyMeasure";
import { useFloatingPanelDetailsExpansion } from "../hooks/useFloatingPanelDetailsExpansion";
import { FloatingPanelSegmentRow } from "./FloatingPanelSegmentRow";
import { readFloatingPanelViewport } from "./floatingPanelViewport";
import { PanelAsyncProgress } from "./PanelAsyncProgress";
import { FloatingPanelTemplate } from "./PanelTemplate";
import {
  FloatingPanelDialogFooter,
  FloatingPanelDialogHeader,
  FloatingPanelDialogListRegion,
  FloatingPanelDialogRoot,
} from "./FloatingPanelDialogLayout";
import { CorrectionRulesReadOnlyHintsDetails } from "./CorrectionRulesReadOnlyHints";
import {
  resolveCorrectionRulesContentFitHeight,
  resolveCorrectionRulesDialogTitle,
} from "./correctionRulesPreviewLayout";

/** 预览区高度测算修正后 bump，丢弃偏矮的旧 phase 记忆。 */
const CORRECTION_RULES_PANEL_LAYOUT_REV = 5;

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
  const isOpen = state.phase !== "closed" && typeof document !== "undefined";
  const { isDetailsExpanded, setDetailsExpanded } = useFloatingPanelDetailsExpansion();
  const { bodyRef, bodyHeight } = useFloatingPanelBodyMeasure(isOpen);

  if (!isOpen) return null;

  const handleClose = () => {
    if (!busy) onCancel();
  };

  const postTranscribe =
    (state.phase === "preview" || state.phase === "loading" || state.phase === "empty") &&
    state.trigger === "postTranscribe";
  const title = resolveCorrectionRulesDialogTitle(state);

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
    (isEmpty &&
      state.readOnlyLearningHints.length + state.readOnlyTranscribeHints.length > 0) ||
    (preview != null &&
      preview.readOnlyLearningHints.length + preview.readOnlyTranscribeHints.length > 0);

  const lexiconHealth =
    state.phase === "empty" || state.phase === "preview" ? state.lexiconHealth : null;
  const lexiconHealthLineCount = lexiconHealth?.summaryLines.length ?? 0;
  const lexiconExpanded = isDetailsExpanded(
    "lexiconHealth",
    lexiconHealth?.hasActionableIssues ?? false,
  );
  const hintsExpanded = isDetailsExpanded("readOnlyHints", false);

  const estimatedFit = resolveCorrectionRulesContentFitHeight({
    state,
    hintsExpanded,
    lexiconExpanded,
    lexiconHealthLineCount,
    hasReadOnlyHints,
    previewTotalCount: totalCount,
  });

  const measuredFit = bodyHeight != null ? resolveMeasuredPanelFitHeight(bodyHeight) : null;
  const contentFitHeight = mergeContentFitHeights(estimatedFit, measuredFit);

  const defaultPanelHeight = Math.min(contentFitHeight ?? 400, panelMaxHeight);
  const persistPhaseKey =
    state.phase === "loading" ? "loading" : state.phase === "preview" ? "preview" : "empty";

  return createPortal(
    <div className="workspace">
      <FloatingPanelTemplate
        id={CORRECTION_RULES_PANEL_ID}
        title={title}
        preset="findReplace"
        minWidth={400}
        minHeight={isCompactBody ? FLOATING_PANEL_COMPACT_MIN_HEIGHT : 300}
        maxWidth={720}
        maxHeight={panelMaxHeight}
        defaultSize={{
          width: 520,
          height: defaultPanelHeight,
        }}
        contentFitHeight={contentFitHeight}
        persistPhaseKey={persistPhaseKey}
        layoutRev={CORRECTION_RULES_PANEL_LAYOUT_REV}
        panelZIndex={110}
        persistState
        onClose={handleClose}
      >
        <FloatingPanelDialogRoot className="gap-2" measureRef={bodyRef}>
          {state.phase === "loading" ? (
            <PanelAsyncProgress mode="spinner" message="正在加载稳定纠错规则…" />
          ) : null}
          {state.phase === "empty" ? (
            <>
              <FloatingPanelDialogHeader className="space-y-2">
                <p className={PANEL_TYPOGRAPHY.dialogBody}>
                  {postTranscribe
                    ? "转写已落库。当前没有可应用的稳定纠错规则（需命中 ≥3 次或已采纳），或语段中无匹配项。"
                    : "没有可用的稳定纠错规则（需命中 ≥3 次或已采纳），或当前语段中无匹配项。"}
                </p>
                <CorrectionRulesReadOnlyHintsDetails
                  learningHints={state.readOnlyLearningHints}
                  transcribeHints={state.readOnlyTranscribeHints}
                  expanded={hintsExpanded}
                  onExpandedChange={(open) => setDetailsExpanded("readOnlyHints", open)}
                />
                <LexiconHealthPanel
                  report={state.lexiconHealth}
                  expanded={lexiconExpanded}
                  onExpandedChange={(open) => setDetailsExpanded("lexiconHealth", open)}
                />
                {postTranscribe ? (
                  <p className={`${PANEL_TYPOGRAPHY.dialogBody} text-notion-text-muted`}>
                    可先用手动改正或查找替换继续改稿。
                  </p>
                ) : null}
              </FloatingPanelDialogHeader>
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
                  <span className="font-medium text-notion-text"> {totalCount}</span> 条语段有变更
                  {preview.hygieneTouchedCount > 0 ? (
                    <>
                      {" "}
                      <span className="text-notion-text-muted">
                        （含文本清洗 {preview.hygieneTouchedCount} 段）
                      </span>
                    </>
                  ) : null}
                  <span className="text-notion-text-muted"> · 点击行定位语段</span>
                </p>
                {stableConflictMessage ? (
                  <p
                    className={`rounded-md bg-zen-saffron/10 px-3 py-2 ${PANEL_TYPOGRAPHY.dialogBody} text-notion-text`}
                  >
                    {stableConflictMessage}
                  </p>
                ) : null}
                <LexiconHealthPanel
                  report={preview.lexiconHealth}
                  expanded={lexiconExpanded}
                  onExpandedChange={(open) => setDetailsExpanded("lexiconHealth", open)}
                />
                <CorrectionRulesReadOnlyHintsDetails
                  learningHints={preview.readOnlyLearningHints}
                  transcribeHints={preview.readOnlyTranscribeHints}
                  expanded={hintsExpanded}
                  onExpandedChange={(open) => setDetailsExpanded("readOnlyHints", open)}
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
