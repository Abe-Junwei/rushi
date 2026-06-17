import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY } from "../../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import type { PostTranscribeStageBDialogState } from "../../pages/usePostTranscribeStageBController";
import { describeStageBPreviewSummary } from "../../services/postprocess/postTranscribeStageB";
import { FloatingPanelSegmentList } from "../FloatingPanelSegmentList";
import { FloatingPanelSegmentRow } from "../FloatingPanelSegmentRow";
import {
  FloatingPanelDialogFooter,
  FloatingPanelDialogHeader,
  FloatingPanelDialogListRegion,
} from "../FloatingPanelDialogLayout";
import { highlightTextByDiff } from "../../utils/textDiff";
import { PackTruncationHint, PendingStageAHint } from "./PostTranscribeStageBHints";

type PreviewState = Extract<PostTranscribeStageBDialogState, { phase: "preview" }>;

type Props = {
  preview: PreviewState;
  busy: boolean;
  previewFocusSegmentIdx: number | null;
  pendingHint: string | null;
  packTruncationHint: string | null;
  onCancel: () => void;
  onConfirmWriteback: () => void;
  onToggleSegment: (segmentIdx: number) => void;
  onFocusSegment: (segmentIdx: number) => void;
};

export function PostTranscribeStageBPreviewPanel({
  preview,
  busy,
  previewFocusSegmentIdx,
  pendingHint,
  packTruncationHint,
  onCancel,
  onConfirmWriteback,
  onToggleSegment,
  onFocusSegment,
}: Props) {
  const previewSummary = describeStageBPreviewSummary(preview.changes.length);

  return (
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
                      <p className="truncate text-label text-notion-text-muted">
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
          <button type="button" className={CONTROL_BTN_SECONDARY} disabled={busy} onClick={onCancel}>
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
  );
}
