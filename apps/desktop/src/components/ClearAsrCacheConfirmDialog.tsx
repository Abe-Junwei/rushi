import { createPortal } from "react-dom";
import { CONTROL_BTN_DANGER_COMPACT, CONTROL_BTN_SECONDARY } from "../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import { FloatingPanelTemplate } from "./PanelTemplate";
import { FLOATING_PANEL_DIALOG_BODY_PADDING_CLASS } from "./FloatingPanelDialogLayout";

const btnSecondary = CONTROL_BTN_SECONDARY;

/** 首次打开默认尺寸（按当前文案测算） */
const CLEAR_ASR_CACHE_DIALOG_DEFAULT = { width: 300, height: 300 } as const;
/** 允许拖放记忆；下限略小于默认，上限留给加宽加高 */
const CLEAR_ASR_CACHE_DIALOG_MIN = { width: 280, height: 276 } as const;
const CLEAR_ASR_CACHE_DIALOG_PANEL_ID = "clear-asr-model-cache-v2";

type Props = {
  open: boolean;
  busy: boolean;
  totalBytes: number | null;
  onCancel: () => void;
  onConfirm: () => void;
};

/** 可拖动 compactDialog；portal 外包 `.workspace` 以压平 WebKit 按钮阴影。 */
export function ClearAsrCacheConfirmDialog({ open, busy, totalBytes, onCancel, onConfirm }: Props) {
  if (!open || typeof document === "undefined") return null;

  const sizeHint =
    totalBytes != null && totalBytes > 0
      ? `当前缓存约 ${formatBytes(totalBytes)}。清除后需重新「下载当前模型」。`
      : "当前未检测到已下载的模型权重；将仅整理应用数据目录下的 models/ 结构。";

  const handleClose = () => {
    if (!busy) onCancel();
  };

  return createPortal(
    <div className="workspace">
      <FloatingPanelTemplate
        id={CLEAR_ASR_CACHE_DIALOG_PANEL_ID}
        title="清除模型缓存"
        preset="compactDialog"
        minWidth={CLEAR_ASR_CACHE_DIALOG_MIN.width}
        minHeight={CLEAR_ASR_CACHE_DIALOG_MIN.height}
        defaultSize={CLEAR_ASR_CACHE_DIALOG_DEFAULT}
        persistState
        onClose={handleClose}
      >
        <div className={`flex flex-col ${FLOATING_PANEL_DIALOG_BODY_PADDING_CLASS}`} role="alertdialog" aria-modal="true">
          <p className={PANEL_TYPOGRAPHY.dialogBody}>
            将删除应用数据目录中已下载的 FunASR / ModelScope 权重，不会删除数据库或项目文件。
          </p>
          <p className={`mt-2.5 rounded-lg border border-notion-divider bg-notion-callout-bg px-3 py-2 ${PANEL_TYPOGRAPHY.dialogBody}`}>
            {sizeHint}
          </p>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" className={btnSecondary} disabled={busy} onClick={handleClose}>
              取消
            </button>
            <button type="button" className={CONTROL_BTN_DANGER_COMPACT} disabled={busy} onClick={onConfirm}>
              {busy ? "清理中…" : "确认清除"}
            </button>
          </div>
        </div>
      </FloatingPanelTemplate>
    </div>,
    document.body,
  );
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  const digits = idx === 0 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[idx]}`;
}
