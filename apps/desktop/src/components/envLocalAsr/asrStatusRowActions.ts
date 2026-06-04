import type { AsrEnvStatusRow } from "../../services/asr/asrEnvStatus";

export type AsrStatusRowAction = {
  label: string;
  targetId: string;
};

export function resolveAsrStatusRowAction(
  row: AsrEnvStatusRow,
  health: string,
): AsrStatusRowAction | null {
  if (row.ok && !row.warn) return null;
  switch (row.id) {
    case "env":
      return {
        label: health === "error" ? "查看安装向导" : "查看维护",
        targetId: health === "error" ? "env-asr-setup" : "env-asr-utilities",
      };
    case "ffmpeg":
      return { label: "查看维护", targetId: "env-asr-utilities" };
    case "runtime":
    case "transcribe":
      return { label: "前往模型", targetId: "env-asr-models" };
    default:
      return null;
  }
}

export function scrollToEnvSection(targetId: string): void {
  document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
}
