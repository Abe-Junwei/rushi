import { CONTROL_BTN_SECONDARY } from "../config/controlStyles";
import { COMPACT_DIALOG_LAYOUT, PANEL_TYPOGRAPHY } from "../config/typography";
import { DialogOverlay } from "./DialogOverlay";
import type { FileSummary } from "../tauri/projectTypes";

type AttachImportTargetDialogProps = {
  open: boolean;
  candidates: FileSummary[];
  transcriptStem: string | null;
  onCancel: () => void;
  onSelect: (fileId: string) => void;
};

export function AttachImportTargetDialog({
  open,
  candidates,
  transcriptStem,
  onCancel,
  onSelect,
}: AttachImportTargetDialogProps) {
  if (!open) return null;

  return (
    <DialogOverlay
      open={open}
      layer="modal"
      onBackdropMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      onEscapeClose={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="attach-import-target-title"
        aria-describedby="attach-import-target-desc"
        className={COMPACT_DIALOG_LAYOUT.card}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className={COMPACT_DIALOG_LAYOUT.stack}>
          <h2 id="attach-import-target-title" className={COMPACT_DIALOG_LAYOUT.title}>
            选择要附加字幕的文件
          </h2>
          <p id="attach-import-target-desc" className={PANEL_TYPOGRAPHY.dialogBody}>
            {transcriptStem
              ? `文件名「${transcriptStem}」匹配到多个音频文件，请选择要替换字幕的目标。`
              : "匹配到多个音频文件，请选择要替换字幕的目标。"}
          </p>
          <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto">
            {candidates.map((file) => (
              <li key={file.id}>
                <button
                  type="button"
                  className={`${CONTROL_BTN_SECONDARY} w-full justify-start text-left`}
                  onClick={() => onSelect(file.id)}
                >
                  {file.name}
                </button>
              </li>
            ))}
          </ul>
          <div className={COMPACT_DIALOG_LAYOUT.actionRow}>
            <button type="button" className={CONTROL_BTN_SECONDARY} onClick={onCancel}>
              取消
            </button>
          </div>
        </div>
      </div>
    </DialogOverlay>
  );
}
