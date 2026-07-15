import { useEffect } from "react";
import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY } from "../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import type { CorrectionRulesDialogState } from "../pages/useCorrectionRulesController";
import { CORRECTION_RULES_PANEL_ID, CORRECTION_RULES_LAYOUT_REV } from "../pages/correctionRulesPanelTypes";
import { resolveTextChangeRowDisplay } from "../services/editor/segmentChangePreview";
import { CorrectionRulesChangeText } from "./CorrectionRulesChangeText";
import { LexiconHealthPanel } from "./LexiconHealthPanel";
import { FloatingPanelSegmentList } from "./FloatingPanelSegmentList";
import { useFloatingPanelDetailsExpansion } from "../hooks/useFloatingPanelDetailsExpansion";
import { FloatingPanelSegmentRow } from "./FloatingPanelSegmentRow";
import { EDITOR_PREVIEW_PANEL_LIST_PADDING_CLASS, resolveEditorPreviewPanelBounds } from "./editorPreviewPanelLayout";
import { PanelAsyncProgress } from "./PanelAsyncProgress";
import { CompactFloatingDialog } from "./CompactFloatingDialog";
import {
  FloatingPanelDialogHeader,
  FloatingPanelDialogListRegion,
} from "./FloatingPanelDialogLayout";
import { CorrectionRulesReadOnlyHintsDetails } from "./CorrectionRulesReadOnlyHints";

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
  const isOpen = state.phase !== "closed";
  const { isDetailsExpanded, setDetailsExpanded } = useFloatingPanelDetailsExpansion();

  const handleClose = () => {
    if (!busy) onCancel();
  };

  const postTranscribe =
    (state.phase === "preview" || state.phase === "loading" || state.phase === "empty") &&
    state.trigger === "postTranscribe";
  const title = state.phase === "preview" ? "规则纠错预览" : "规则纠错";

  const preview = state.phase === "preview" ? state : null;
  const isEmpty = state.phase === "empty";
  const isLoading = state.phase === "loading";
  const selectedCount = preview?.selectedSegmentIdxs.length ?? 0;
  const totalCount = preview?.changes.length ?? 0;

  useEffect(() => {
    if (!preview || previewFocusSegmentIdx == null) return;
    const id = `correction-rules-preview-segment-${previewFocusSegmentIdx}`;
    window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ block: "nearest" });
    });
  }, [preview, previewFocusSegmentIdx]);

  const previewBounds = resolveEditorPreviewPanelBounds();
  const panelMaxHeight = previewBounds.maxHeight;

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

  const defaultPanelWidth = previewBounds.defaultWidth;
  const dialogFitKind = preview ? "autoFit" : "staticFit";
  const fallbackHeight = Math.min(
    isLoading ? 220 : isEmpty ? 280 : previewBounds.fallbackHeight,
    panelMaxHeight,
  );
  const persistPhaseKey =
    state.phase === "loading" ? "loading" : state.phase === "preview" ? "preview" : "empty";

  const previewFooter = preview ? (
    <>
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
    </>
  ) : null;

  const emptyFooter = isEmpty ? (
    <button type="button" className={CONTROL_BTN_SECONDARY} onClick={onCloseEmpty}>
      关闭
    </button>
  ) : null;

  return (
    <CompactFloatingDialog
      id={CORRECTION_RULES_PANEL_ID}
      title={title}
      open={isOpen}
      onClose={handleClose}
      fitKind={dialogFitKind}
      shellPreset="findReplace"
      fallbackHeight={fallbackHeight}
      defaultWidth={defaultPanelWidth}
      layoutRev={CORRECTION_RULES_LAYOUT_REV}
      minWidth={previewBounds.minWidth}
      maxWidth={previewBounds.maxWidth}
      maxHeight={panelMaxHeight}
      persistPhaseKey={persistPhaseKey}
      persistState
      rootClassName="gap-2"
      footer={previewFooter ?? emptyFooter ?? undefined}
      footerJustify={preview ? "between" : "end"}
    >
      {isLoading ? (
        <PanelAsyncProgress mode="spinner" message="正在加载稳定纠错规则…" />
      ) : null}
      {isEmpty ? (
        <FloatingPanelDialogHeader>
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
      ) : null}
      {preview ? (
        <>
          <FloatingPanelDialogHeader
            className={
              stableConflictMessage || hasReadOnlyHints || lexiconHealthLineCount > 0
                ? "max-h-44 min-h-0 overflow-y-auto overflow-x-hidden floating-panel-body-scroll"
                : undefined
            }
          >
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
                className={`rounded-md bg-accent-action/10 px-3 py-2 ${PANEL_TYPOGRAPHY.dialogBody} text-notion-text`}
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
          <FloatingPanelDialogListRegion
            fitToContent
            autoFitListCap="generous"
            className={`min-h-0 ${EDITOR_PREVIEW_PANEL_LIST_PADDING_CLASS}`}
          >
            <FloatingPanelSegmentList rowCount={totalCount}>
              {preview.changes.map((ch) => {
                const checked = preview.selectedSegmentIdxs.includes(ch.segmentIdx);
                const focused = previewFocusSegmentIdx === ch.segmentIdx;
                const rowDisplay = resolveTextChangeRowDisplay(ch.beforeText, ch.afterText, { focused });
                return (
                  <li
                    key={ch.segmentIdx}
                    id={`correction-rules-preview-segment-${ch.segmentIdx}`}
                    className="list-none"
                  >
                    <FloatingPanelSegmentRow
                      segmentNumber={ch.segmentNumber}
                      timeLabel={ch.startTimeLabel}
                      suffix={`${ch.replacementCount}处`}
                      bodyLayout={focused ? "wrap" : "truncate"}
                      active={focused}
                      disabled={busy}
                      onClick={() => onFocusSegment(ch.segmentIdx)}
                      trailing={
                        <input
                          type="checkbox"
                          className="h-3.5 w-3.5 shrink-0 accent-accent-action"
                          checked={checked}
                          disabled={busy}
                          aria-label={`包含语段 ${ch.segmentNumber}`}
                          onClick={(e) => e.stopPropagation()}
                          onChange={() => onToggleSegment(ch.segmentIdx)}
                        />
                      }
                    >
                      <CorrectionRulesChangeText
                        variant={rowDisplay.variant}
                        beforeText={rowDisplay.beforeText}
                        afterText={rowDisplay.afterText}
                        beforeHighlights={rowDisplay.beforeHighlights}
                        afterHighlights={rowDisplay.afterHighlights}
                      />
                    </FloatingPanelSegmentRow>
                  </li>
                );
              })}
            </FloatingPanelSegmentList>
          </FloatingPanelDialogListRegion>
        </>
      ) : null}
    </CompactFloatingDialog>
  );
}
