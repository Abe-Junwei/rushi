import { CheckCircle2, Circle, CircleAlert, Loader2, MinusCircle } from "lucide-react";
import { useMemo } from "react";
import { CONTROL_BTN_DANGER, CONTROL_BTN_SECONDARY } from "../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import { CompactFloatingDialog } from "./CompactFloatingDialog";
import { FloatingPanelDialogHeader } from "./FloatingPanelDialogLayout";
import type { BatchQueueItem } from "../services/batchTranscribeQueue";
import { summarizeBatchQueue } from "../services/batchTranscribeQueue";
import type { TranscribeProgress } from "../pages/transcribePreviewState";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

const PANEL_ID = "batch-transcribe-queue-v1";
const DEFAULT_WIDTH = 400;
const FALLBACK_HEIGHT = 360;
/** w-4 icon column + gap-2.5 — matches PANEL_TYPOGRAPHY.navDescription */
const BATCH_QUEUE_DETAIL_INDENT_CLASS = "pl-[26px]";

function statusIcon(status: BatchQueueItem["status"]) {
  switch (status) {
    case "running":
      return (
        <Loader2
          className={`${LUCIDE_ICON_SIZE_SM} animate-spin text-accent-action`}
          strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
          aria-hidden
        />
      );
    case "done":
      return (
        <CheckCircle2
          className={`${LUCIDE_ICON_SIZE_SM} text-accent-action`}
          strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
          aria-hidden
        />
      );
    case "failed":
      return (
        <CircleAlert
          className={`${LUCIDE_ICON_SIZE_SM} text-zen-cinnabar`}
          strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
          aria-hidden
        />
      );
    case "skipped":
      return (
        <MinusCircle
          className={`${LUCIDE_ICON_SIZE_SM} text-notion-text-muted`}
          strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
          aria-hidden
        />
      );
    default:
      return (
        <Circle
          className={`${LUCIDE_ICON_SIZE_SM} text-notion-text-muted/50`}
          strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
          aria-hidden
        />
      );
  }
}

function statusLabel(status: BatchQueueItem["status"]): string {
  switch (status) {
    case "running":
      return "转写中";
    case "done":
      return "完成";
    case "failed":
      return "失败";
    case "skipped":
      return "跳过";
    default:
      return "等待";
  }
}

function BatchQueueListItem({ item }: { item: BatchQueueItem }) {
  const detail = item.detail ?? statusLabel(item.status);

  return (
    <li className="rounded-md bg-notion-sidebar/50 px-2 py-1.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="flex w-4 shrink-0 items-center justify-center" aria-hidden>
          {statusIcon(item.status)}
        </span>
        <p className="m-0 min-w-0 flex-1 truncate text-title font-medium leading-[1.4] text-notion-text">
          {item.fileName}
        </p>
      </div>
      <p className={`m-0 mt-0.5 ${BATCH_QUEUE_DETAIL_INDENT_CLASS} ${PANEL_TYPOGRAPHY.meta}`}>
        {detail}
      </p>
    </li>
  );
}

type Props = {
  open: boolean;
  running: boolean;
  items: BatchQueueItem[];
  transcribeProgress: TranscribeProgress | null;
  onClose: () => void;
  onStop?: () => void;
};

export function BatchTranscribeQueueDialog({
  open,
  running,
  items,
  transcribeProgress,
  onClose,
  onStop,
}: Props) {
  const summary = summarizeBatchQueue(items);
  const estimatedFitHeight = useMemo(
    () => FALLBACK_HEIGHT + (summary.failed > 0 ? 36 : 0),
    [summary.failed],
  );

  return (
    <CompactFloatingDialog
      id={PANEL_ID}
      title="批量转写"
      open={open}
      onClose={() => {
        if (!running) onClose();
      }}
      fallbackHeight={FALLBACK_HEIGHT}
      estimatedFitHeight={estimatedFitHeight}
      layoutRev={items.length + (summary.failed > 0 ? 100 : 0)}
      defaultWidth={DEFAULT_WIDTH}
      bounds={{ minWidth: 320, minHeight: 280, maxWidthCap: 480 }}
      persistState
      footer={
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          {running && onStop ? (
            <button type="button" className={CONTROL_BTN_DANGER} onClick={onStop}>
              停止批量转写
            </button>
          ) : null}
          <button
            type="button"
            className={CONTROL_BTN_SECONDARY}
            disabled={running}
            onClick={onClose}
          >
            {running ? "转写进行中…" : "关闭"}
          </button>
        </div>
      }
    >
      <FloatingPanelDialogHeader>
        <p className="m-0 text-body text-notion-text-muted">
          按列表顺序串行转写；已有语段的文件将自动跳过。转写进行中请勿切换项目或关闭应用。
        </p>
      </FloatingPanelDialogHeader>
      <p className={`m-0 ${PANEL_TYPOGRAPHY.meta} text-notion-text-muted`}>
        {running
          ? transcribeProgress
            ? `转写中 · 窗 ${transcribeProgress.windowIndex + 1}/${transcribeProgress.windowCount} · ${transcribeProgress.segmentsTotal} 语段`
            : "请勿切换项目或关闭应用。"
          : `完成 ${summary.done} · 跳过 ${summary.skipped} · 失败 ${summary.failed}`}
      </p>
      <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto" aria-live="polite">
        {items.map((item) => (
          <BatchQueueListItem key={item.fileId} item={item} />
        ))}
      </ul>
      {!running && summary.failed > 0 ? (
        <p className={`m-0 mt-2 ${PANEL_TYPOGRAPHY.meta} text-zen-cinnabar`}>
          部分文件转写失败；可在编辑器中单独重试。
        </p>
      ) : null}
    </CompactFloatingDialog>
  );
}
