import type { AsrEnvStatusRow } from "../../services/asr/asrEnvStatus";

export type AsrStatusRowAction = {
  label: string;
  navigate: () => void;
};

export type AsrStatusRowActionContext = {
  health: string;
  /** Intentional idle recycle — prefer soft-wake over wizard/models. */
  sidecarIdleSleeping?: boolean;
  onRecoverSidecar?: () => void;
};

function scrollToEnvSection(targetId: string): void {
  document.getElementById(targetId)?.scrollIntoView({ block: "start" });
}

/** 展开「环境与维护 → 安装向导」并滚动到位（FFmpeg / 侧车修复入口）。 */
function openEnvSetupWizard(): void {
  const wizard = document.getElementById("env-asr-setup-wizard");
  if (wizard instanceof HTMLDetailsElement) {
    wizard.open = true;
  }
  scrollToEnvSection("env-asr-utilities");
}

function recoverOr(
  ctx: AsrStatusRowActionContext,
  fallback: AsrStatusRowAction,
): AsrStatusRowAction {
  if (ctx.onRecoverSidecar) {
    return { label: "恢复侧车", navigate: () => ctx.onRecoverSidecar?.() };
  }
  return fallback;
}

export function resolveAsrStatusRowAction(
  row: AsrEnvStatusRow,
  healthOrCtx: string | AsrStatusRowActionContext,
): AsrStatusRowAction | null {
  const ctx: AsrStatusRowActionContext =
    typeof healthOrCtx === "string" ? { health: healthOrCtx } : healthOrCtx;
  const { health, sidecarIdleSleeping } = ctx;

  if (row.ok && !row.warn) return null;

  if (sidecarIdleSleeping) {
    if (row.id === "env" || row.id === "ffmpeg" || row.id === "runtime" || row.id === "transcribe") {
      return recoverOr(ctx, {
        label: "打开安装向导",
        navigate: () => openEnvSetupWizard(),
      });
    }
    return null;
  }

  switch (row.id) {
    case "env":
      if (health === "error") {
        return {
          label: "打开安装向导",
          navigate: () => scrollToEnvSection("env-asr-setup"),
        };
      }
      return {
        label: "查看维护",
        navigate: () => scrollToEnvSection("env-asr-utilities"),
      };
    case "ffmpeg":
      return {
        label: "打开安装向导",
        navigate: () =>
          health === "error" ? scrollToEnvSection("env-asr-setup") : openEnvSetupWizard(),
      };
    case "runtime":
    case "transcribe":
      if (health === "error") {
        return recoverOr(ctx, {
          label: "打开安装向导",
          navigate: () => openEnvSetupWizard(),
        });
      }
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
