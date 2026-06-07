/** Shared labels for project file rows (welcome sidebar + project hub + welcome view). */

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
