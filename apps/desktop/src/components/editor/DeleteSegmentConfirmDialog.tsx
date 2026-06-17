import { createPortal } from "react-dom";
import { CONTROL_BTN_DANGER, CONTROL_BTN_SECONDARY } from "../../config/controlStyles";
import { overlayScrimCentered } from "../../config/overlayStyles";
import { useDialogEscapeClose } from "../../hooks/useDialogEscapeClose";
import { COMPACT_DIALOG_LAYOUT, PANEL_TYPOGRAPHY } from "../../config/typography";
import { DELETE_SEGMENT_WITH_TEXT_CONFIRM } from "../../services/segmentConfirmEligible";
import { editorShortcutMenuHint } from "../../utils/editorShortcutMenuHint";

type Props = {
  open: boolean;
  deleteCount?: number;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeleteSegmentConfirmDialog({ open, deleteCount = 1, onCancel, onConfirm }: Props) {
  useDialogEscapeClose(open, onCancel);

  if (!open || typeof document === "undefined") return null;

  const title = deleteCount > 1 ? `删除 ${deleteCount} 条语段` : "删除语段";
  const undoHint = editorShortcutMenuHint("edit.undo");
  const body =
    deleteCount > 1
      ? `将删除选中的 ${deleteCount} 条语段及其正文，此操作可撤销（${undoHint}）。`
      : DELETE_SEGMENT_WITH_TEXT_CONFIRM;

  return createPortal(
    <div
      className={overlayScrimCentered("z-[100]")}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-segment-title"
        aria-describedby="delete-segment-desc"
        className={COMPACT_DIALOG_LAYOUT.card}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={COMPACT_DIALOG_LAYOUT.stack}>
          <h2 id="delete-segment-title" className={COMPACT_DIALOG_LAYOUT.title}>
            {title}
          </h2>
          <p id="delete-segment-desc" className={PANEL_TYPOGRAPHY.dialogBody}>
            {body}
          </p>
          <div className={COMPACT_DIALOG_LAYOUT.actionRow}>
            <button type="button" className={CONTROL_BTN_SECONDARY} onClick={onCancel}>
              取消
            </button>
            <button type="button" className={CONTROL_BTN_DANGER} onClick={onConfirm}>
              确认删除
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
