import { PANEL_TYPOGRAPHY } from "../config/typography";
import { OVERLAY_SCRIM_LAYER } from "../config/overlayStyles";
import { usesBundledAsrModelStack } from "../services/asr/bundledModelJobPresentation";
import { CompactConfirmDialog } from "./CompactConfirmDialog";

const PANEL_ID = "clear-asr-model-cache-v4";
const DEFAULT_WIDTH = 360;
const FALLBACK_HEIGHT = 232;

type Props = {
  open: boolean;
  busy: boolean;
  totalBytes: number | null;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ClearAsrCacheConfirmDialog({ open, busy, totalBytes, onCancel, onConfirm }: Props) {
  const sizeHint =
    totalBytes != null && totalBytes > 0
      ? usesBundledAsrModelStack()
        ? `当前缓存约 ${formatBytes(totalBytes)}。清除后下次启动会从安装包重新复制内置模型。`
        : `当前缓存约 ${formatBytes(totalBytes)}。清除后需重新「一键准备」。`
      : usesBundledAsrModelStack()
        ? "当前未检测到已复制的模型；清除后下次启动会从安装包重新复制。"
        : "当前未检测到已下载的模型权重；将仅整理应用数据目录下的 models/ 结构。";

  return (
    <CompactConfirmDialog
      id={PANEL_ID}
      title="清除模型缓存"
      open={open}
      busy={busy}
      onCancel={onCancel}
      onConfirm={onConfirm}
      confirmLabel="确认清除"
      busyConfirmLabel="清理中…"
      confirmVariant="danger"
      fallbackHeight={FALLBACK_HEIGHT}
      defaultWidth={DEFAULT_WIDTH}
      bounds={{ minWidth: 280, minHeight: 200, maxWidthCap: 420 }}
      persistState
      panelZIndex={120}
      overlayClassName={`${OVERLAY_SCRIM_LAYER} z-[115]`}
    >
      <p className={PANEL_TYPOGRAPHY.dialogBody}>
        将删除应用数据目录中的 FunASR / ModelScope 模型缓存，不会删除数据库或项目文件。
        {usesBundledAsrModelStack() ? " 清除后重启应用会重新从安装包复制内置 Paraformer。" : ""}
      </p>
      <p
        className={`rounded-lg border border-notion-divider bg-notion-callout-bg px-3 py-2 ${PANEL_TYPOGRAPHY.dialogBody}`}
      >
        {sizeHint}
      </p>
    </CompactConfirmDialog>
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
