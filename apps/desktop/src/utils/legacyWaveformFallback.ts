import type { FileSummary } from "../tauri/projectTypes";

/** 仅在「当前为纯 text File、项目内另有音频 File」时提供波形切换（legacy 分裂数据）。Attach 成功后不应触发。 */
export function resolveLegacyWaveformFallbackFile(
  currentFileId: string | null,
  files: readonly FileSummary[] | undefined,
  hasAudioSrc: boolean,
): FileSummary | null {
  if (hasAudioSrc || !currentFileId || !files?.length) return null;
  const current = files.find((f) => f.id === currentFileId);
  if (!current || current.file_type !== "text") return null;
  return (
    files.find(
      (f) =>
        f.id !== currentFileId &&
        (f.file_type === "paired" || f.file_type === "audio_only"),
    ) ?? null
  );
}
