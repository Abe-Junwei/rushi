import {
  CONTROL_BTN_DANGER,
  CONTROL_BTN_PRIMARY,
  CONTROL_BTN_SECONDARY,
  CONTROL_TEXTAREA,
} from "../config/controlStyles";
import { COMPACT_DIALOG_LAYOUT, PANEL_CONTROL_TYPOGRAPHY, PANEL_TYPOGRAPHY } from "../config/typography";
import type { SegmentAnnotationDialogState } from "../pages/useSegmentAnnotationController";
import type { SegmentDto } from "../tauri/projectApi";
import { formatSegmentAnnotationPreview } from "../utils/segmentAnnotation";
import { DialogOverlay } from "./DialogOverlay";

type Props = {
  state: SegmentAnnotationDialogState;
  segment: SegmentDto | null;
  segmentIdx: number;
  busy: boolean;
  onClose: () => void;
  onDraftChange: (value: string) => void;
  onSave: () => void;
  onClear: () => void;
};

function formatSegmentTimeRange(startSec: number, endSec: number): string {
  const fmt = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };
  return `${fmt(startSec)} – ${fmt(endSec)}`;
}

export function SegmentAnnotationDialog({
  state,
  segment,
  segmentIdx,
  busy,
  onClose,
  onDraftChange,
  onSave,
  onClear,
}: Props) {
  if (state.phase === "closed" || !segment || typeof document === "undefined") return null;

  const textPreview = segment.text.replace(/\s+/g, " ").trim();
  const truncatedText =
    textPreview.length > 120 ? `${textPreview.slice(0, 119)}…` : textPreview || "（空）";

  return (
    <DialogOverlay
      open
      layer="modal"
      onBackdropMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
      onEscapeClose={onClose}
      canEscapeClose={() => !busy}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="segment-annotation-title"
        className={COMPACT_DIALOG_LAYOUT.cardWide}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={COMPACT_DIALOG_LAYOUT.stack}>
          <h2 id="segment-annotation-title" className={COMPACT_DIALOG_LAYOUT.title}>
            {state.hadAnnotation ? "编辑备注" : "添加备注"}
          </h2>
          <p className={PANEL_TYPOGRAPHY.dialogBody}>
            语段 {segmentIdx + 1} · {formatSegmentTimeRange(segment.start_sec, segment.end_sec)}
          </p>
          <p
            className={`rounded-md bg-notion-sidebar/55 px-3 py-2 ${PANEL_TYPOGRAPHY.meta} text-notion-text-muted`}
          >
            {truncatedText}
          </p>

          <label className={`flex flex-col gap-1.5 ${PANEL_TYPOGRAPHY.dialogBody}`}>
            <span className={PANEL_TYPOGRAPHY.fieldLabel}>备注内容</span>
            <textarea
              className={`min-h-[120px] ${CONTROL_TEXTAREA} ${PANEL_CONTROL_TYPOGRAPHY.compactInput}`}
              value={state.draft}
              disabled={busy}
              autoFocus
              placeholder="背景说明、待核对项、引用来源等…"
              onChange={(e) => onDraftChange(e.target.value)}
            />
          </label>
          {state.hadAnnotation && state.draft.trim() ? (
            <p className={`${PANEL_TYPOGRAPHY.meta} text-notion-text-muted`}>
              预览：{formatSegmentAnnotationPreview(state.draft)}
            </p>
          ) : null}

          <div className={COMPACT_DIALOG_LAYOUT.actionRowSplit}>
            <div>
              {state.hadAnnotation ? (
                <button
                  type="button"
                  className={CONTROL_BTN_DANGER}
                  disabled={busy}
                  onClick={onClear}
                >
                  清除备注
                </button>
              ) : null}
            </div>
            <div className={COMPACT_DIALOG_LAYOUT.actionRowEnd}>
              <button type="button" className={CONTROL_BTN_SECONDARY} disabled={busy} onClick={onClose}>
                取消
              </button>
              <button type="button" className={CONTROL_BTN_PRIMARY} disabled={busy} onClick={onSave}>
                保存
              </button>
            </div>
          </div>
        </div>
      </div>
    </DialogOverlay>
  );
}
