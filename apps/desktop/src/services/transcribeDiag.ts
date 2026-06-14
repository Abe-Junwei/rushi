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

export const TRANSCRIBE_EMPTY_OUTPUT_ERROR_CODES = new Set([
  "transcribe_stub_no_output",
  "transcribe_empty_output",
]);

function isStubTranscribeEngine(engine?: string): boolean {
  const eng = (engine ?? "").toLowerCase();
  return eng === "stub" || eng.includes("stub");
}

/** 侧车任务「成功」但无语段时，合成 TRN-DIAG 失败快照供横幅展示。 */
export function buildTranscribeEmptyOutcomeDiag(
  base: TranscribeTimelineSnapshot | null | undefined,
  opts: { fileId: string; engine?: string; primaryHint?: string },
): TranscribeTimelineSnapshot {
  const stub = isStubTranscribeEngine(opts.engine);
  const now = Date.now();
  return {
    schemaVersion: base?.schemaVersion ?? 1,
    fileId: opts.fileId,
    source: base?.source ?? "local",
    jobId: base?.jobId,
    startedAtMs: base?.startedAtMs ?? now,
    endedAtMs: base?.endedAtMs ?? now,
    outcome: "failed",
    failedStage: "transcribe",
    errorCode: stub ? "transcribe_stub_no_output" : "transcribe_empty_output",
    errorMessage: "转写未产出可用语段",
    suggestedAction: stub
      ? "请在「环境 → 本机 ASR」完成模型准备并「应用并重启侧车」后重试。"
      : "请确认音频含清晰人声，或查看应用数据目录下的 desktop.log 后重试。",
    transcribeTimeline: base?.transcribeTimeline ?? [],
    warnings: base?.warnings,
    windowIndex: base?.windowIndex,
    windowCount: base?.windowCount,
  };
}

export function transcribeFailureBannerTitle(diag: TranscribeTimelineSnapshot): string {
  if (diag.errorCode && TRANSCRIBE_EMPTY_OUTPUT_ERROR_CODES.has(diag.errorCode)) {
    return "转写未产出结果";
  }
  if (diag.outcome === "failed") {
    return `转写失败（${stageLabelZh(diag.failedStage)}）`;
  }
  return "转写提示";
}

export function shouldShowTranscribeEnvAction(diag: TranscribeTimelineSnapshot): boolean {
  return (
    diag.failedStage === "preflight" ||
    diag.errorCode === "preflight_not_ready" ||
    diag.errorCode === "sidecar_connect" ||
    diag.errorCode === "sidecar_crash" ||
    diag.errorCode === "transcribe_stub_no_output"
  );
}

export function formatTranscribeDiagSummary(
  snap: TranscribeTimelineSnapshot | null | undefined,
): string[] {
  if (!snap) return [];
  const lines: string[] = [];
  if (snap.errorCode && TRANSCRIBE_EMPTY_OUTPUT_ERROR_CODES.has(snap.errorCode)) {
    lines.push("任务已结束，但未写入任何可用语段。");
    if (snap.errorCode) {
      lines.push(`错误码：${snap.errorCode}`);
    }
  } else if (snap.outcome === "failed") {
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
