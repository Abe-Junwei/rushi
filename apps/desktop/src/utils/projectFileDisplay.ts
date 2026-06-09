/** Shared labels for project file rows (welcome sidebar + project hub + welcome view). */

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
