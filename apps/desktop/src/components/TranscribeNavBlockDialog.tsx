import { PANEL_TYPOGRAPHY } from "../config/typography";
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
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="transcribe-nav-block-title"
        aria-describedby="transcribe-nav-block-desc"
        className="w-full max-w-md rounded-md border border-notion-divider bg-notion-bg px-6 py-5 font-sans antialiased shadow-lg"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h2 id="transcribe-nav-block-title" className="text-[18px] font-semibold leading-[1.4] text-notion-text">
          转写进行中
        </h2>
        <p id="transcribe-nav-block-desc" className={`mt-2 ${PANEL_TYPOGRAPHY.dialogBody}`}>
          当前文件正在转写。离开将中断任务，已完成的语段可能尚未全部写回。
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="inline-flex h-8 items-center justify-center rounded-md border border-notion-border bg-notion-bg px-3 text-[12px] font-medium text-notion-text-muted transition-colors hover:bg-notion-sidebar-hover hover:text-notion-text disabled:opacity-40"
            disabled={busy}
            onClick={onStay}
          >
            继续转写
          </button>
          <button
            type="button"
            className="inline-flex h-8 items-center justify-center rounded-md border-0 bg-zen-cinnabar px-3 text-[12px] font-medium text-white transition-colors hover:bg-zen-cinnabar/90 disabled:opacity-40"
            disabled={busy}
            onClick={onStopAndLeave}
          >
            停止并离开
          </button>
        </div>
      </div>
    </DialogOverlay>
  );
}
