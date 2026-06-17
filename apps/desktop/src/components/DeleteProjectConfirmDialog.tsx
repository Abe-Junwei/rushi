import { CONTROL_BTN_DANGER, CONTROL_BTN_SECONDARY } from "../config/controlStyles";
import { COMPACT_DIALOG_LAYOUT, PANEL_TYPOGRAPHY } from "../config/typography";
import { DialogOverlay } from "./DialogOverlay";

type DeleteProjectConfirmDialogProps = {
  open: boolean;
  projectName: string | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeleteProjectConfirmDialog({
  open,
  projectName,
  busy,
  onCancel,
  onConfirm,
}: DeleteProjectConfirmDialogProps) {
  if (!open || !projectName) return null;

  return (
    <DialogOverlay
      open={open}
      layer="modal"
      onBackdropMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
      onEscapeClose={onCancel}
      canEscapeClose={() => !busy}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-project-title"
        aria-describedby="delete-project-desc"
        className={COMPACT_DIALOG_LAYOUT.card}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={COMPACT_DIALOG_LAYOUT.stack}>
          <h2 id="delete-project-title" className={COMPACT_DIALOG_LAYOUT.title}>
            删除项目
          </h2>
          <p id="delete-project-desc" className={PANEL_TYPOGRAPHY.dialogBody}>
            确定删除「{projectName}」？项目内全部文件、语段与本地音频副本将一并移除，此操作不可撤销。
          </p>
          <div className={COMPACT_DIALOG_LAYOUT.actionRow}>
            <button type="button" className={CONTROL_BTN_SECONDARY} disabled={busy} onClick={onCancel}>
              取消
            </button>
            <button type="button" className={CONTROL_BTN_DANGER} disabled={busy} onClick={onConfirm}>
              确认删除
            </button>
          </div>
        </div>
      </div>
    </DialogOverlay>
  );
}
