import { CONTROL_BTN_DANGER, CONTROL_BTN_SECONDARY } from "../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import { DialogOverlay } from "./DialogOverlay";

type DeleteProjectFileConfirmDialogProps = {
  open: boolean;
  fileName: string | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeleteProjectFileConfirmDialog({
  open,
  fileName,
  busy,
  onCancel,
  onConfirm,
}: DeleteProjectFileConfirmDialogProps) {
  if (!open || !fileName) return null;

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
        aria-labelledby="delete-project-file-title"
        aria-describedby="delete-project-file-desc"
        className="w-full max-w-md rounded-md border border-notion-divider bg-notion-bg px-6 py-5 font-sans antialiased shadow-lg"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="delete-project-file-title" className="text-[18px] font-semibold leading-[1.4] text-notion-text">
          删除项目文件
        </h2>
        <p id="delete-project-file-desc" className={`mt-2 ${PANEL_TYPOGRAPHY.dialogBody}`}>
          确定删除「{fileName}」？本地音频副本与语段将一并移除，此操作不可撤销。
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" className={CONTROL_BTN_SECONDARY} disabled={busy} onClick={onCancel}>
            取消
          </button>
          <button type="button" className={CONTROL_BTN_DANGER} disabled={busy} onClick={onConfirm}>
            确认删除
          </button>
        </div>
      </div>
    </DialogOverlay>
  );
}
