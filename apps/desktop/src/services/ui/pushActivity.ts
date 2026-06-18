import type {
  ActivityFeedActionKind,
  ActivityFeedKind,
  ActivityFeedVariant,
} from "./activityFeed";
import { pushActivityFeedItem } from "./activityFeed";
import { showToast } from "./toast";

export type PushActivityAction = {
  label: string;
  kind: ActivityFeedActionKind;
  onClick?: () => void;
};

export type PushActivityInput = {
  variant: ActivityFeedVariant;
  message: string;
  kind?: ActivityFeedKind;
  projectId?: string;
  fileId?: string;
  fileLabel?: string;
  action?: PushActivityAction;
  /** 默认 true：同步弹出 toast；结构化事件若已由 toast 展示可设 false */
  showToast?: boolean;
};

export function pushActivity(input: PushActivityInput): string {
  const message = input.message.trim();
  if (!message) return "";

  const actionLabel = input.action?.label.trim();
  const id = pushActivityFeedItem({
    variant: input.variant,
    message,
    kind: input.kind ?? "generic",
    projectId: input.projectId,
    fileId: input.fileId,
    fileLabel: input.fileLabel,
    actionKind: input.action?.kind,
    ...(input.action && actionLabel
      ? { action: { label: actionLabel, onClick: input.action.onClick } }
      : {}),
  });

  if (input.showToast !== false) {
    showToast({
      variant: input.variant,
      message,
      skipFeedMirror: true,
      ...(input.action?.onClick && actionLabel
        ? { action: { label: actionLabel, onClick: input.action.onClick } }
        : {}),
    });
  }

  return id;
}

export function pushExportFailureActivity(input: {
  formatLabel: string;
  errorMessage: string;
  projectId: string;
  fileId: string | null;
  fileLabel: string;
}): string {
  const message = `${input.formatLabel}导出失败：${input.errorMessage.trim()}`;
  return pushActivity({
    variant: "error",
    kind: "export",
    message,
    projectId: input.projectId,
    fileId: input.fileId ?? undefined,
    fileLabel: input.fileLabel,
    action: input.fileId
      ? {
          label: "打开文件",
          kind: "open-file",
        }
      : undefined,
  });
}

export function pushTranscribeOutcomeActivity(input: {
  variant: "success" | "warning";
  message: string;
  projectId: string;
  fileId: string;
  fileLabel?: string;
  action?: PushActivityAction;
}): string {
  return pushActivity({
    variant: input.variant,
    kind: "transcribe",
    message: input.message,
    projectId: input.projectId,
    fileId: input.fileId,
    fileLabel: input.fileLabel,
    action: input.action,
  });
}

export function pushEditHistoryRestoreActivity(input: {
  projectId: string;
  fileId: string;
  fileLabel: string;
  message?: string;
}): string {
  return pushActivity({
    variant: "success",
    kind: "edit_history",
    message: input.message?.trim() || "已恢复到所选历史版本",
    projectId: input.projectId,
    fileId: input.fileId,
    fileLabel: input.fileLabel,
    action: { label: "查看文件", kind: "open-file" },
  });
}

export function pushBatchTranscribeFailedFileActivities(input: {
  projectId: string;
  failedFiles: readonly { fileId: string; fileName: string; detail?: string }[];
  maxItems?: number;
}): void {
  const cap = input.maxItems ?? 5;
  const slice = input.failedFiles.slice(0, cap);
  for (const file of [...slice].reverse()) {
    const detail = file.detail?.trim();
    pushActivity({
      variant: "error",
      kind: "batch_transcribe",
      message: detail ? `批量转写失败：${detail}` : "批量转写失败",
      projectId: input.projectId,
      fileId: file.fileId,
      fileLabel: file.fileName,
      action: { label: "打开文件", kind: "open-file" },
      showToast: false,
    });
  }
}

export function pushBatchTranscribeSummaryActivity(input: {
  projectId: string;
  projectLabel: string;
  done: number;
  skipped: number;
  failed: number;
  stopped: boolean;
  failedFiles?: readonly { fileId: string; fileName: string; detail?: string }[];
  onOpenProjectHub?: () => void;
}): string {
  if (input.failed > 0 && input.failedFiles && input.failedFiles.length > 0) {
    const actionableFailures = input.failedFiles.filter((row) => row.detail?.trim() !== "已停止");
    if (actionableFailures.length > 0) {
      pushBatchTranscribeFailedFileActivities({
        projectId: input.projectId,
        failedFiles: actionableFailures,
      });
    }
  }

  const { done, skipped, failed, stopped } = input;
  const message = stopped
    ? `批量转写已停止：${done} 成功，${skipped} 跳过，${failed} 失败`
    : `批量转写完成：${done} 成功，${skipped} 跳过，${failed} 失败`;
  return pushActivity({
    variant: stopped ? "warning" : failed > 0 ? "warning" : "success",
    kind: "batch_transcribe",
    message,
    projectId: input.projectId,
    fileLabel: input.projectLabel,
    action: input.onOpenProjectHub
      ? {
          label: "查看项目文件",
          kind: "open-project-hub",
          onClick: input.onOpenProjectHub,
        }
      : undefined,
  });
}
