import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY } from "../config/controlStyles";
import { COMPACT_DIALOG_LAYOUT, PANEL_TYPOGRAPHY } from "../config/typography";
import { DialogOverlay } from "./DialogOverlay";

type MoveProjectFileConfirmDialogProps = {
  open: boolean;
  fileName: string | null;
  destProjectName: string | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function MoveProjectFileConfirmDialog({
  open,
  fileName,
  destProjectName,
  busy,
  onCancel,
  onConfirm,
}: MoveProjectFileConfirmDialogProps) {
  if (!open || !fileName || !destProjectName) return null;

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
        aria-labelledby="move-project-file-title"
        aria-describedby="move-project-file-desc"
        className={COMPACT_DIALOG_LAYOUT.card}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={COMPACT_DIALOG_LAYOUT.stack}>
          <h2 id="move-project-file-title" className={COMPACT_DIALOG_LAYOUT.title}>
            移动到其他项目
          </h2>
          <p id="move-project-file-desc" className={PANEL_TYPOGRAPHY.dialogBody}>
            将「{fileName}」移动到「{destProjectName}」？语段与音频会一并带走。
          </p>
          <div className={COMPACT_DIALOG_LAYOUT.actionRow}>
            <button type="button" className={CONTROL_BTN_SECONDARY} disabled={busy} onClick={onCancel}>
              取消
            </button>
            <button type="button" className={CONTROL_BTN_PRIMARY} disabled={busy} onClick={onConfirm}>
              确认移动
            </button>
          </div>
        </div>
      </div>
    </DialogOverlay>
  );
}
