import { useCallback, useMemo, useRef, useState } from "react";
import * as fileApi from "../tauri/fileApi";
import { pushBatchTranscribeSummaryActivity } from "../services/ui/pushActivity";
import { toast } from "../services/ui/toast";
import {
  applyBatchQueueStop,
  initialBatchQueueItems,
  listBatchTranscribableFiles,
  patchBatchQueueItem,
  shouldSkipBatchTranscribe,
  summarizeBatchQueue,
  type BatchQueueItem,
} from "../services/batchTranscribeQueue";
import type { FileSummary } from "../tauri/projectTypes";
import type { BusyReason } from "./useProjectCrudController";
import type { ExecuteTranscribeOptions, ExecuteTranscribeResult } from "./useTranscribeJobExecute";
import type { LocalTranscribePreflight } from "./transcribeJobHelpers";

export type BatchTranscribeQueueControllerApi = {
  batchQueueOpen: boolean;
  batchQueueItems: BatchQueueItem[];
  batchTranscribeRunning: boolean;
  batchTranscribableCount: number;
  canStartBatchTranscribe: boolean;
  startBatchTranscribe: () => Promise<void>;
  cancelBatchTranscribe: () => Promise<void>;
  closeBatchQueueDialog: () => void;
};

type Deps = {
  projectId: string | null | undefined;
  projectName?: string | null;
  projectFiles: FileSummary[] | undefined;
  busy: boolean;
  hasUnsavedSegmentChanges: () => boolean;
  beginBusy: (reason: BusyReason) => void;
  endBusy: () => void;
  openFileWrapped: (fileId: string) => Promise<void>;
  executeTranscribeForBatch: (opts: ExecuteTranscribeOptions) => Promise<ExecuteTranscribeResult>;
  cancelTranscribe: () => void | Promise<void>;
  localTranscribePreflight: LocalTranscribePreflight;
  transcribeSource: "local" | "online";
  setError: (msg: string) => void;
  refreshProjectHub: (projectId: string) => Promise<void>;
};

export function useBatchTranscribeQueueController(deps: Deps): BatchTranscribeQueueControllerApi {
  const [batchQueueOpen, setBatchQueueOpen] = useState(false);
  const [batchQueueItems, setBatchQueueItems] = useState<BatchQueueItem[]>([]);
  const [batchTranscribeRunning, setBatchTranscribeRunning] = useState(false);

  const cancelRequestedRef = useRef(false);
  const runningRef = useRef(false);
  const idleWaitersRef = useRef<Array<() => void>>([]);

  runningRef.current = batchTranscribeRunning;

  const batchTranscribableCount = useMemo(
    () => listBatchTranscribableFiles(deps.projectFiles ?? []).length,
    [deps.projectFiles],
  );

  const canStartBatchTranscribe =
    batchTranscribableCount > 0 && !deps.busy && !deps.hasUnsavedSegmentChanges();

  const closeBatchQueueDialog = useCallback(() => {
    if (!batchTranscribeRunning) {
      setBatchQueueOpen(false);
    }
  }, [batchTranscribeRunning]);

  const finishBatchRun = useCallback(() => {
    setBatchTranscribeRunning(false);
    deps.endBusy();
    const waiters = idleWaitersRef.current;
    idleWaitersRef.current = [];
    for (const resolve of waiters) resolve();
  }, [deps]);

  const cancelBatchTranscribe = useCallback(async () => {
    if (!runningRef.current) return;
    cancelRequestedRef.current = true;
    await deps.cancelTranscribe();
    if (!runningRef.current) return;
    await new Promise<void>((resolve) => {
      idleWaitersRef.current.push(resolve);
    });
  }, [deps]);

  const startBatchTranscribe = useCallback(async () => {
    const projectId = deps.projectId;
    if (!projectId) return;
    if (deps.busy) {
      toast.error("当前有任务进行中，请稍后再试。");
      return;
    }
    if (deps.hasUnsavedSegmentChanges()) {
      toast.error("请先保存当前语段修改，再开始批量转写。");
      return;
    }
    if (deps.transcribeSource === "local") {
      const block = deps.localTranscribePreflight();
      if (block) {
        deps.setError(block);
        return;
      }
    }

    const seed = initialBatchQueueItems(deps.projectFiles ?? []);
    if (seed.length === 0) return;

    cancelRequestedRef.current = false;
    setBatchQueueItems(seed);
    setBatchQueueOpen(true);
    setBatchTranscribeRunning(true);
    deps.beginBusy("batch_transcribe");

    let workingItems = seed;
    let stopped = false;
    try {
      for (const item of seed) {
        if (cancelRequestedRef.current) {
          stopped = true;
          break;
        }

        workingItems = patchBatchQueueItem(workingItems, item.fileId, { status: "running" });
        setBatchQueueItems([...workingItems]);

        try {
          const detail = await fileApi.loadFile(item.fileId);
          if (cancelRequestedRef.current) {
            stopped = true;
            break;
          }
          if (shouldSkipBatchTranscribe(detail.segments)) {
            workingItems = patchBatchQueueItem(workingItems, item.fileId, {
              status: "skipped",
              detail: "已有语段，已跳过",
            });
            setBatchQueueItems([...workingItems]);
            continue;
          }

          await deps.openFileWrapped(item.fileId);
          if (cancelRequestedRef.current) {
            stopped = true;
            break;
          }
          const result = await deps.executeTranscribeForBatch({
            batchChild: true,
            fileId: item.fileId,
            suppressUserToasts: true,
          });
          if (cancelRequestedRef.current) {
            stopped = true;
            break;
          }
          if (!result.ok) {
            workingItems = patchBatchQueueItem(workingItems, item.fileId, {
              status: "failed",
              detail: result.message,
            });
            setBatchQueueItems([...workingItems]);
            continue;
          }
          workingItems = patchBatchQueueItem(workingItems, item.fileId, { status: "done" });
          setBatchQueueItems([...workingItems]);
        } catch (e) {
          if (cancelRequestedRef.current) {
            stopped = true;
            break;
          }
          const message = e instanceof Error ? e.message : String(e);
          workingItems = patchBatchQueueItem(workingItems, item.fileId, {
            status: "failed",
            detail: message,
          });
          setBatchQueueItems([...workingItems]);
        }
      }

      if (stopped) {
        workingItems = applyBatchQueueStop(workingItems);
        setBatchQueueItems([...workingItems]);
        const summary = summarizeBatchQueue(workingItems);
        pushBatchTranscribeSummaryActivity({
          projectId,
          projectLabel: deps.projectName?.trim() || projectId,
          done: summary.done,
          skipped: summary.skipped,
          failed: summary.failed,
          stopped: true,
          failedFiles: workingItems.filter((row) => row.status === "failed"),
          onOpenProjectHub: () => void deps.refreshProjectHub(projectId),
        });
        await deps.refreshProjectHub(projectId);
      } else {
        const summary = summarizeBatchQueue(workingItems);
        pushBatchTranscribeSummaryActivity({
          projectId,
          projectLabel: deps.projectName?.trim() || projectId,
          done: summary.done,
          skipped: summary.skipped,
          failed: summary.failed,
          stopped: false,
          failedFiles: workingItems.filter((row) => row.status === "failed"),
          onOpenProjectHub: () => void deps.refreshProjectHub(projectId),
        });
        await deps.refreshProjectHub(projectId);
      }
    } finally {
      cancelRequestedRef.current = false;
      finishBatchRun();
    }
  }, [deps, finishBatchRun]);

  return {
    batchQueueOpen,
    batchQueueItems,
    batchTranscribeRunning,
    batchTranscribableCount,
    canStartBatchTranscribe,
    startBatchTranscribe,
    cancelBatchTranscribe,
    closeBatchQueueDialog,
  };
}
