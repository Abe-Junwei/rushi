import type { FileSummary } from "../tauri/projectTypes";
import type { SegmentDto } from "../tauri/projectApi";
import { segmentsHaveNonEmptyText } from "../pages/transcribeJobHelpers";

export type BatchQueueItemStatus = "pending" | "running" | "done" | "failed" | "skipped";

export type BatchQueueItem = {
  fileId: string;
  fileName: string;
  status: BatchQueueItemStatus;
  detail?: string;
};

export function isBatchTranscribableFile(file: FileSummary): boolean {
  return file.file_type === "paired" || file.file_type === "audio_only";
}

export function listBatchTranscribableFiles(files: FileSummary[]): FileSummary[] {
  return files.filter(isBatchTranscribableFile);
}

function sortBatchFilesNewestFirst(files: FileSummary[]): FileSummary[] {
  return [...files].sort((a, b) => b.updated_at_ms - a.updated_at_ms);
}

export function initialBatchQueueItems(files: FileSummary[]): BatchQueueItem[] {
  return sortBatchFilesNewestFirst(listBatchTranscribableFiles(files)).map((f) => ({
    fileId: f.id,
    fileName: f.name,
    status: "pending",
  }));
}

export function shouldSkipBatchTranscribe(segments: SegmentDto[]): boolean {
  return segmentsHaveNonEmptyText(segments);
}

export function summarizeBatchQueue(items: BatchQueueItem[]): {
  done: number;
  failed: number;
  skipped: number;
  pending: number;
} {
  let done = 0;
  let failed = 0;
  let skipped = 0;
  let pending = 0;
  for (const item of items) {
    if (item.status === "done") done += 1;
    else if (item.status === "failed") failed += 1;
    else if (item.status === "skipped") skipped += 1;
    else if (item.status === "pending" || item.status === "running") pending += 1;
  }
  return { done, failed, skipped, pending };
}

export function patchBatchQueueItem(
  items: BatchQueueItem[],
  fileId: string,
  patch: Pick<BatchQueueItem, "status" | "detail">,
): BatchQueueItem[] {
  return items.map((item) => (item.fileId === fileId ? { ...item, ...patch } : item));
}

/** User stopped batch: fail active row, skip pending rows. */
export function applyBatchQueueStop(items: BatchQueueItem[]): BatchQueueItem[] {
  return items.map((item) => {
    if (item.status === "running") {
      return { ...item, status: "failed", detail: "已停止" };
    }
    if (item.status === "pending") {
      return { ...item, status: "skipped", detail: "未处理（已停止）" };
    }
    return item;
  });
}
