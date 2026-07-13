import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY } from "../config/controlStyles";
import { COMPACT_DIALOG_LAYOUT, PANEL_TYPOGRAPHY } from "../config/typography";
import { DialogOverlay } from "./DialogOverlay";

type CopyProjectFileConfirmDialogProps = {
  open: boolean;
  fileName: string | null;
  destProjectName: string | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function CopyProjectFileConfirmDialog({
  open,
  fileName,
  destProjectName,
  busy,
  onCancel,
  onConfirm,
}: CopyProjectFileConfirmDialogProps) {
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
        aria-labelledby="copy-project-file-title"
        aria-describedby="copy-project-file-desc"
        className={COMPACT_DIALOG_LAYOUT.card}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={COMPACT_DIALOG_LAYOUT.stack}>
          <h2 id="copy-project-file-title" className={COMPACT_DIALOG_LAYOUT.title}>
            复制到其他项目
          </h2>
          <p id="copy-project-file-desc" className={PANEL_TYPOGRAPHY.dialogBody}>
            将「{fileName}」复制到「{destProjectName}」？将生成独立副本（语段与托管音频一并复制）。
          </p>
          <div className={COMPACT_DIALOG_LAYOUT.actionRow}>
            <button type="button" className={CONTROL_BTN_SECONDARY} disabled={busy} onClick={onCancel}>
              取消
            </button>
            <button type="button" className={CONTROL_BTN_PRIMARY} disabled={busy} onClick={onConfirm}>
              确认复制
            </button>
          </div>
        </div>
      </div>
    </DialogOverlay>
  );
}
