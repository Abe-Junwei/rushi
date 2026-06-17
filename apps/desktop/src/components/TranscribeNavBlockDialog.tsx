import { CONTROL_BTN_DANGER, CONTROL_BTN_SECONDARY } from "../config/controlStyles";
import { COMPACT_DIALOG_LAYOUT, PANEL_TYPOGRAPHY } from "../config/typography";
import { DialogOverlay } from "./DialogOverlay";

type TranscribeNavBlockDialogProps = {
  open: boolean;
  busy: boolean;
  onStay: () => void;
  onStopAndLeave: () => void;
};

export function TranscribeNavBlockDialog({
  open,
  busy,
  onStay,
  onStopAndLeave,
}: TranscribeNavBlockDialogProps) {
  if (!open) return null;

  return (
    <DialogOverlay
      open={open}
      layer="gate"
      onBackdropMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onStay();
      }}
      onEscapeClose={onStay}
      canEscapeClose={() => !busy}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="transcribe-nav-block-title"
        aria-describedby="transcribe-nav-block-desc"
        className={COMPACT_DIALOG_LAYOUT.card}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={COMPACT_DIALOG_LAYOUT.stack}>
          <h2 id="transcribe-nav-block-title" className={COMPACT_DIALOG_LAYOUT.title}>
            转写进行中
          </h2>
          <p id="transcribe-nav-block-desc" className={PANEL_TYPOGRAPHY.dialogBody}>
            当前文件正在转写。离开将中断任务，已完成的语段可能尚未全部写回。
          </p>
          <div className={COMPACT_DIALOG_LAYOUT.actionRow}>
            <button type="button" className={CONTROL_BTN_SECONDARY} disabled={busy} onClick={onStay}>
              继续转写
            </button>
            <button type="button" className={CONTROL_BTN_DANGER} disabled={busy} onClick={onStopAndLeave}>
              停止并离开
            </button>
          </div>
        </div>
      </div>
    </DialogOverlay>
  );
}
