import { useEffect } from "react";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import type { PostTranscribeStageBDialogState } from "../../pages/usePostTranscribeStageBController";
import { describeStageBPreviewSummary } from "../../services/postprocess/postTranscribeStageB";
import { resolveTextChangeRowDisplay } from "../../services/editor/segmentChangePreview";
import { CorrectionRulesChangeText } from "../CorrectionRulesChangeText";
import { FloatingPanelSegmentList } from "../FloatingPanelSegmentList";
import { FloatingPanelSegmentRow } from "../FloatingPanelSegmentRow";
import {
  FloatingPanelDialogHeader,
  FloatingPanelDialogListRegion,
} from "../FloatingPanelDialogLayout";
import { EDITOR_PREVIEW_PANEL_LIST_PADDING_CLASS } from "../editorPreviewPanelLayout";
import { PackTruncationHint, PendingStageAHint } from "./PostTranscribeStageBHints";

type PreviewState = Extract<PostTranscribeStageBDialogState, { phase: "preview" }>;

type Props = {
  preview: PreviewState;
  busy: boolean;
  previewFocusSegmentIdx: number | null;
  pendingHint: string | null;
  packTruncationHint: string | null;
  onToggleSegment: (segmentIdx: number) => void;
  onFocusSegment: (segmentIdx: number) => void;
};

export function PostTranscribeStageBPreviewPanel({
  preview,
  busy,
  previewFocusSegmentIdx,
  pendingHint,
  packTruncationHint,
  onToggleSegment,
  onFocusSegment,
}: Props) {
  const previewSummary = describeStageBPreviewSummary(preview.changes.length);
  const headerHintHeavy = Boolean(
    pendingHint || packTruncationHint || preview.dropDetail || preview.stepError,
  );

  useEffect(() => {
    if (previewFocusSegmentIdx == null) return;
    const id = `stage-b-preview-segment-${previewFocusSegmentIdx}`;
    window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ block: "nearest" });
    });
  }, [previewFocusSegmentIdx]);

  return (
    <>
      <FloatingPanelDialogHeader
        className={
          headerHintHeavy
            ? "max-h-44 min-h-0 overflow-y-auto overflow-x-hidden floating-panel-body-scroll"
            : undefined
        }
      >
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
            className={`rounded-md bg-accent-action/10 px-3 py-2 ${PANEL_TYPOGRAPHY.dialogBody} text-notion-text`}
          >
            {preview.droppedUngroundedOps > 0
              ? `已忽略 ${preview.droppedUngroundedOps} 条建议。`
              : null}
            {preview.dropDetail}
          </p>
        ) : null}
        {preview.stepError ? (
          <p
            className={`rounded-md bg-accent-action/10 px-3 py-2 ${PANEL_TYPOGRAPHY.dialogBody} text-notion-text`}
          >
            {preview.stepError} 已成功批次的候选仍可确认写回。
          </p>
        ) : null}
      </FloatingPanelDialogHeader>
      <FloatingPanelDialogListRegion
        fitToContent
        autoFitListCap="generous"
        className={`mt-3 min-h-0 ${EDITOR_PREVIEW_PANEL_LIST_PADDING_CLASS}`}
      >
        <FloatingPanelSegmentList rowCount={preview.changes.length}>
          {preview.changes.map((ch) => {
            const checked = preview.selectedSegmentIdxs.includes(ch.segmentIdx);
            const focused = previewFocusSegmentIdx === ch.segmentIdx;
            const rowDisplay = resolveTextChangeRowDisplay(ch.beforeText, ch.afterText, { focused });
            return (
              <li
                key={ch.uid || String(ch.segmentIdx)}
                id={`stage-b-preview-segment-${ch.segmentIdx}`}
                className="list-none"
              >
                <FloatingPanelSegmentRow
                  segmentNumber={ch.segmentNumber}
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
                  <div className="min-w-0 space-y-0.5">
                    {ch.evidenceSummary ? (
                      <p
                        className={`text-label text-notion-text-muted ${focused ? "whitespace-pre-wrap break-words" : "truncate"}`}
                        title={ch.evidenceSummary}
                      >
                        依据：{ch.evidenceSummary}
                      </p>
                    ) : null}
                    <CorrectionRulesChangeText
                      variant={rowDisplay.variant}
                      beforeText={rowDisplay.beforeText}
                      afterText={rowDisplay.afterText}
                      beforeHighlights={rowDisplay.beforeHighlights}
                      afterHighlights={rowDisplay.afterHighlights}
                    />
                  </div>
                </FloatingPanelSegmentRow>
              </li>
            );
          })}
        </FloatingPanelSegmentList>
      </FloatingPanelDialogListRegion>
    </>
  );
}
