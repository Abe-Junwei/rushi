import { CONTROL_BTN_DANGER, CONTROL_BTN_SECONDARY } from "../config/controlStyles";
import { COMPACT_DIALOG_LAYOUT, PANEL_TYPOGRAPHY } from "../config/typography";
import { DialogOverlay } from "./DialogOverlay";

export type TranscribeNavBlockMode = "single" | "batch";

type TranscribeNavBlockDialogProps = {
  open: boolean;
  stopping: boolean;
  mode?: TranscribeNavBlockMode;
  onStay: () => void;
  onStopAndLeave: () => void;
};

const COPY: Record<
  TranscribeNavBlockMode,
  { title: string; body: string; stay: string; stop: string }
> = {
  single: {
    title: "转写进行中",
    body: "当前文件正在转写。离开将中断任务，已完成的语段可能尚未全部写回。",
    stay: "继续转写",
    stop: "停止并离开",
  },
  batch: {
    title: "批量转写进行中",
    body: "批量转写尚未结束。停止将中断当前文件并跳过队列中剩余文件。",
    stay: "继续批量转写",
    stop: "停止并离开",
  },
};

export function TranscribeNavBlockDialog({
  open,
  stopping,
  mode = "single",
  onStay,
  onStopAndLeave,
}: TranscribeNavBlockDialogProps) {
  if (!open) return null;

  const copy = COPY[mode];

  return (
    <DialogOverlay
      open={open}
      layer="gate"
      onBackdropMouseDown={(e) => {
        if (e.target === e.currentTarget && !stopping) onStay();
      }}
      onEscapeClose={onStay}
      canEscapeClose={() => !stopping}
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
            {copy.title}
          </h2>
          <p id="transcribe-nav-block-desc" className={PANEL_TYPOGRAPHY.dialogBody}>
            {copy.body}
          </p>
          <div className={COMPACT_DIALOG_LAYOUT.actionRow}>
            <button
              type="button"
              className={CONTROL_BTN_SECONDARY}
              disabled={stopping}
              onClick={onStay}
            >
              {copy.stay}
            </button>
            <button
              type="button"
              className={CONTROL_BTN_DANGER}
              disabled={stopping}
              onClick={onStopAndLeave}
            >
              {stopping ? "正在停止…" : copy.stop}
            </button>
          </div>
        </div>
      </div>
    </DialogOverlay>
  );
}
