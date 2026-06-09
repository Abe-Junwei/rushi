import { createPortal } from "react-dom";
import { CONTROL_BTN_PRIMARY, CONTROL_BTN_SECONDARY } from "../../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import { FloatingPanelTemplate } from "../PanelTemplate";
import { FLOATING_PANEL_DIALOG_BODY_PADDING_CLASS } from "../FloatingPanelDialogLayout";
import { summarizeHistoryHeadline } from "./useEditorEditHistory";
import type { EditLogEntryDto } from "../../tauri/projectApi";

const PANEL_ID = "restore-edit-log-confirm-v1";
const DEFAULT_SIZE = { width: 320, height: 248 } as const;
const MIN_SIZE = { width: 280, height: 208 } as const;

type Props = {
  open: boolean;
  busy: boolean;
  row: EditLogEntryDto | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export function RestoreEditLogConfirmDialog({ open, busy, row, onCancel, onConfirm }: Props) {
  if (!open || !row || typeof document === "undefined") return null;

  const headline = summarizeHistoryHeadline(row.detail, row.kind);
  const handleClose = () => {
    if (!busy) onCancel();
  };

  return createPortal(
    <div className="workspace">
      <FloatingPanelTemplate
        id={PANEL_ID}
        title="恢复此版本"
        preset="compactDialog"
        minWidth={MIN_SIZE.width}
        minHeight={MIN_SIZE.height}
        defaultSize={DEFAULT_SIZE}
        persistState
        onClose={handleClose}
      >
        <div className={`flex flex-col ${FLOATING_PANEL_DIALOG_BODY_PADDING_CLASS}`} role="alertdialog" aria-modal="true">
          <p className={PANEL_TYPOGRAPHY.dialogBody}>
            将把当前文件的语段正文恢复到所选保存点。未保存的草稿修改将丢失。
          </p>
          <p className="mt-2.5 rounded-lg border border-notion-divider bg-notion-callout-bg px-3 py-2 text-[12px] leading-relaxed text-notion-text">
            {new Date(row.at_ms).toLocaleString()} — {headline}
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" className={CONTROL_BTN_SECONDARY} disabled={busy} onClick={handleClose}>
              取消
            </button>
            <button type="button" className={CONTROL_BTN_PRIMARY} disabled={busy} onClick={onConfirm}>
              {busy ? "恢复中…" : "确认恢复"}
            </button>
          </div>
        </div>
      </FloatingPanelTemplate>
    </div>,
    document.body,
  );
}
