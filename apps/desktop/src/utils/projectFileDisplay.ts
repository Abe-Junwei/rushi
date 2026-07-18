/** Shared labels for project file rows (welcome sidebar + project hub + welcome view). */

import type { FileSummary } from "../tauri/projectTypes";

export type ProjectHubMetadataFields = {
  recorded_at?: string | null;
  subject?: string | null;
  narrator?: string | null;
};

/** Hub 主标题下副行：时间 · 主题 · 讲述人（仅展示已填项）。 */
export function formatProjectHubMetadataLine(fields: ProjectHubMetadataFields): string | null {
  const parts = [fields.recorded_at, fields.subject, fields.narrator]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function formatProjectFileType(type: string): string {
  if (type === "text") return "文本";
  if (type === "paired") return "音视频";
  if (type === "audio_only") return "音频";
  return type;
}

export function formatWorkspaceFileTime(ms: number): string {
  const d = new Date(ms);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const time = d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${month}月${day}日 ${time}`;
}

/** Format seconds as `1:05:30` / `12:03` / `0:45`. */
export function formatFileDurationSec(durationSec: number | null | undefined): string {
  if (durationSec == null || !Number.isFinite(durationSec) || durationSec <= 0) {
    return "时长未知";
  }
  const total = Math.round(durationSec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatImportSourceSize(bytes: number | null | undefined): string | null {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return null;
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) {
    const rounded = mb >= 10 ? Math.round(mb) : Math.round(mb * 10) / 10;
    return `${rounded} MB`;
  }
  const kb = bytes / 1024;
  if (kb >= 1) return `${Math.round(kb)} KB`;
  return `${Math.round(bytes)} B`;
}

export type HubFileRowLiveState =
  | { kind: "idle" }
  | { kind: "transcribing"; percent: number | null }
  | { kind: "queued" };

export type HubFileStageCounts = {
  draft: number;
  firstProof: number;
  finalized: number;
  total: number;
};

/**
 * Normalize stage buckets from FileSummary.
 * Always reconcile draft = total − 一校 − 定稿 so a stale/partial payload cannot show
 * 「有语段」with all-zero buckets or inflate draft independently of total.
 */
export function hubFileStageCounts(file: FileSummary): HubFileStageCounts {
  const total = Math.max(0, Math.floor(file.segment_count ?? 0));
  const firstProof = Math.min(total, Math.max(0, Math.floor(file.first_proof_count ?? 0)));
  const finalized = Math.min(
    total - firstProof,
    Math.max(0, Math.floor(file.finalized_count ?? 0)),
  );
  const draft = Math.max(0, total - firstProof - finalized);
  return { draft, firstProof, finalized, total };
}

/**
 * Hub / 欢迎页媒体类型标签。
 * Rushi 以口述音频为主：`paired` / `audio_only` 一律「音频」，不再用「音视频」
 * 或按是否已有语段切换标签（语段状态看下方进度条）。
 */
export function formatHubFileTypeLabel(file: FileSummary): string {
  if (file.file_type === "text") return "文本";
  return "音频";
}

/** Audio/meta line: type · duration · size? · 缺媒体? · [project?] · updated. */
export function formatHubFileAudioMetaLine(
  file: FileSummary,
  options?: { projectName?: string | null },
): string {
  const parts: string[] = [formatHubFileTypeLabel(file)];
  if (file.file_type !== "text") {
    parts.push(formatFileDurationSec(file.duration_sec));
  }
  const size = formatImportSourceSize(file.import_source_size);
  if (size) parts.push(size);
  if (file.media_missing) parts.push("缺媒体");
  const projectName = options?.projectName?.trim();
  if (projectName) parts.push(projectName);
  parts.push(formatWorkspaceFileTime(file.updated_at_ms));
  return parts.join(" · ");
}

export function formatHubFileEmptyProgressLabel(file: FileSummary): string {
  return file.file_type === "text" ? "无语段" : "未转录";
}

/** Non-zero stage buckets as `生稿 a · 一校 b · 定稿 c`. */
export function formatHubFileStageLegend(counts: HubFileStageCounts): string {
  const parts: string[] = [];
  if (counts.draft > 0) parts.push(`生稿 ${counts.draft}`);
  if (counts.firstProof > 0) parts.push(`一校 ${counts.firstProof}`);
  if (counts.finalized > 0) parts.push(`定稿 ${counts.finalized}`);
  return parts.length > 0 ? parts.join(" · ") : "未转录";
}

/** @deprecated Prefer HubFileStageMeter; kept for unit tests of empty/live copy. */
export function formatHubFileProgressMetaLine(
  file: FileSummary,
  live: HubFileRowLiveState = { kind: "idle" },
): string {
  if (live.kind === "transcribing") {
    if (live.percent != null && Number.isFinite(live.percent)) {
      return `转写中 · ${Math.round(live.percent)}%`;
    }
    return "转写中";
  }
  if (live.kind === "queued") return "排队中";
  const counts = hubFileStageCounts(file);
  if (counts.total <= 0) return formatHubFileEmptyProgressLabel(file);
  return formatHubFileStageLegend(counts);
}

/** Hub list: audio meta only; progress is rendered by HubFileStageMeter. */
export function hubFileRowMetaLines(file: FileSummary): string[] {
  return [formatHubFileAudioMetaLine(file)];
}
