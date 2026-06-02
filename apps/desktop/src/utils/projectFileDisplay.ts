/** Shared labels for project file rows (welcome sidebar + project hub). */

export function formatProjectFileType(type: string): string {
  if (type === "text") return "文本";
  if (type === "paired") return "音视频";
  if (type === "audio_only") return "音频";
  return type;
}
