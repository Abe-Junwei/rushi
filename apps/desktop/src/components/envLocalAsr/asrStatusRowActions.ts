import { isPackagedDesktopApp } from "../../config/env";
import type { AsrEnvStatusRow } from "../../services/asr/asrEnvStatus";

export type AsrStatusRowAction = {
  label: string;
  navigate: () => void;
};

export function scrollToEnvSection(targetId: string): void {
  document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** 展开「环境与维护 → 安装向导」并滚动到位（FFmpeg / 侧车修复入口）。 */
export function openEnvSetupWizard(): void {
  const wizard = document.getElementById("env-asr-setup-wizard");
  if (wizard instanceof HTMLDetailsElement) {
    wizard.open = true;
  }
  scrollToEnvSection("env-asr-utilities");
}

export function resolveAsrStatusRowAction(
  row: AsrEnvStatusRow,
  health: string,
): AsrStatusRowAction | null {
  if (row.ok && !row.warn) return null;
  switch (row.id) {
    case "env":
      return {
        label: health === "error" ? "查看安装向导" : "查看维护",
        navigate: () =>
          scrollToEnvSection(health === "error" ? "env-asr-setup" : "env-asr-utilities"),
      };
    case "ffmpeg":
      return {
        label: isPackagedDesktopApp() ? "一键准备" : "修复侧车",
        navigate: () =>
          health === "error" ? scrollToEnvSection("env-asr-setup") : openEnvSetupWizard(),
      };
    case "runtime":
    case "transcribe":
      return { label: "前往模型", navigate: () => scrollToEnvSection("env-asr-models") };
    default:
      return null;
  }
}

/** 展开「高级诊断」并滚动到环境与维护区（手动安装说明入口）。 */
export function openEnvManualSetupGuide(): void {
  const advanced = document.getElementById("env-asr-advanced-diagnostics");
  if (advanced instanceof HTMLDetailsElement) {
    advanced.open = true;
  }
  scrollToEnvSection("env-asr-utilities");
}
