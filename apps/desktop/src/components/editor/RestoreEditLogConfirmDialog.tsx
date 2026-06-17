import { PANEL_TYPOGRAPHY } from "../../config/typography";
import { CompactConfirmDialog } from "../CompactConfirmDialog";
import { summarizeHistoryHeadline } from "./useEditorEditHistory";
import type { EditLogEntryDto } from "../../tauri/projectApi";

const PANEL_ID = "restore-edit-log-confirm-v3";
const DEFAULT_WIDTH = 320;
const FALLBACK_HEIGHT = 248;

type Props = {
  open: boolean;
  busy: boolean;
  row: EditLogEntryDto | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export function RestoreEditLogConfirmDialog({ open, busy, row, onCancel, onConfirm }: Props) {
  if (!row) return null;

  const headline = summarizeHistoryHeadline(row.detail, row.kind);

  return (
    <CompactConfirmDialog
      id={PANEL_ID}
      title="恢复此版本"
      open={open}
      busy={busy}
      onCancel={onCancel}
      onConfirm={onConfirm}
      confirmLabel="确认恢复"
      busyConfirmLabel="恢复中…"
      fallbackHeight={FALLBACK_HEIGHT}
      defaultWidth={DEFAULT_WIDTH}
      bounds={{ minWidth: 280, minHeight: 208, maxWidthCap: 420 }}
      persistState
    >
      <p className={PANEL_TYPOGRAPHY.dialogBody}>
        将把当前文件的语段正文恢复到所选保存点。未保存的草稿修改将丢失。
      </p>
      <p className="rounded-lg border border-notion-divider bg-notion-callout-bg px-3 py-2 text-body leading-relaxed text-notion-text">
        {new Date(row.at_ms).toLocaleString()} — {headline}
      </p>
    </CompactConfirmDialog>
  );
}
