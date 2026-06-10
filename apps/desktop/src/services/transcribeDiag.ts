export type TranscribeTimelineEntry = {
  stage: string;
  startedAtMs: number;
  endedAtMs?: number;
  errorCode?: string;
  segmentIndex?: number;
  segmentTotal?: number;
};

export type TranscribeTimelineSnapshot = {
  schemaVersion: number;
  fileId: string;
  source: string;
  jobId?: string;
  startedAtMs: number;
  endedAtMs?: number;
  outcome: string;
  failedStage?: string;
  errorCode?: string;
  errorMessage?: string;
  suggestedAction?: string;
  transcribeTimeline: TranscribeTimelineEntry[];
  warnings?: string[];
  windowIndex?: number;
  windowCount?: number;
};

const STAGE_LABEL: Record<string, string> = {
  preflight: "准备",
  upload: "上传",
  transcribe: "转写",
  save: "保存",
};

export function stageLabelZh(stage: string | undefined): string {
  if (!stage) return "未知阶段";
  return STAGE_LABEL[stage] ?? stage;
}

export function formatTranscribeDiagSummary(
  snap: TranscribeTimelineSnapshot | null | undefined,
): string[] {
  if (!snap) return [];
  const lines: string[] = [];
  if (snap.outcome === "failed") {
    lines.push(`转写失败于「${stageLabelZh(snap.failedStage)}」阶段`);
    if (snap.errorCode) {
      lines.push(`错误码：${snap.errorCode}`);
    }
  } else if (snap.outcome === "success" && (snap.warnings?.length ?? 0) > 0) {
    lines.push("转写已完成，但有提示需要留意");
  }
  if (snap.windowCount && snap.windowCount > 0) {
    const idx = snap.windowIndex ?? snap.windowCount;
    lines.push(`分窗进度：第 ${idx}/${snap.windowCount} 窗`);
  }
  if (snap.suggestedAction) {
    lines.push(snap.suggestedAction);
  }
  return lines;
}
