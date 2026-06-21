import { PANEL_TYPOGRAPHY } from "../config/typography";
import { CompactConfirmDialog } from "./CompactConfirmDialog";

const PANEL_ID = "app-update-confirm-v1";
const DEFAULT_WIDTH = 400;
const FALLBACK_HEIGHT = 220;

type Props = {
  open: boolean;
  busy: boolean;
  version: string;
  notes?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function AppUpdateConfirmDialog({
  open,
  busy,
  version,
  notes,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <CompactConfirmDialog
      id={PANEL_ID}
      title="发现新版本"
      open={open}
      busy={busy}
      onCancel={onCancel}
      onConfirm={onConfirm}
      confirmLabel="下载并安装"
      busyConfirmLabel="安装中…"
      cancelLabel="稍后"
      fallbackHeight={FALLBACK_HEIGHT}
      defaultWidth={DEFAULT_WIDTH}
      bounds={{ minWidth: 320, minHeight: 200, maxWidthCap: 480 }}
      persistState={false}
    >
      <p className={PANEL_TYPOGRAPHY.dialogBody}>
        新版本 <strong className="font-medium">{version}</strong> 已发布。确认后将下载更新包、验签并安装，完成后应用会自动重启。
      </p>
      {notes ? (
        <p
          className={`rounded-lg border border-notion-divider bg-notion-callout-bg px-3 py-2 ${PANEL_TYPOGRAPHY.dialogBody}`}
        >
          {notes}
        </p>
      ) : null}
    </CompactConfirmDialog>
  );
}
