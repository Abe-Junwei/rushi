import { isDefaultBundledAsrTarget } from "../../config/env";

/** Release 默认 SKU：随包 seed/copy，不走 ModelScope 下载。 */
export function usesBundledAsrModelStack(): boolean {
  return isDefaultBundledAsrTarget();
}

export type BundledModelJobPresentationInput = {
  progress?: number;
  /** App 首启 seed 遮罩 vs 环境页一键复制 */
  phaseLabel?: string;
};

export type BundledModelJobPresentation = {
  progress: number;
  progressLabel: string;
  wizardDetail: string;
  envBannerDetail: string;
  stageTitle: string;
  installMessage: string;
  blockReason: string;
  bannerTitle: string;
};

function clampPercent(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n)));
}

export function buildBundledModelJobPresentation(
  input: BundledModelJobPresentationInput = {},
): BundledModelJobPresentation {
  const progress = clampPercent(input.progress ?? 0);
  const base = input.phaseLabel?.trim() || "正在准备内置语音模型";
  const withPercent = progress > 0 ? `${base}… ${progress}%` : `${base}…`;
  const envBannerDetail =
    progress > 0
      ? `${base}（${progress}%），完成后方可转写。无需联网。`
      : `${base}，完成后方可转写。无需联网。`;

  return {
    progress,
    progressLabel: progress > 0 ? `复制中… ${progress}%` : "准备中…",
    wizardDetail: withPercent,
    envBannerDetail,
    stageTitle: base,
    installMessage: withPercent,
    blockReason: "正在从安装包复制内置语音模型，完成后方可转写。",
    bannerTitle: "本机 ASR · 正在准备内置模型",
  };
}

export function bundledCatalogProgressLabel(input: {
  modelsCached: boolean;
  modelsReady: boolean;
  progress: number;
  prepareBusy: boolean;
}): { label: string; tone: "success" | "muted" } {
  if (input.modelsReady && !input.prepareBusy) {
    return { label: "已就绪 · 100%", tone: "success" };
  }
  if (input.prepareBusy) {
    const p = buildBundledModelJobPresentation({ progress: input.progress });
    return { label: p.progressLabel, tone: "muted" };
  }
  if (input.modelsCached) {
    return { label: "已复制 · 100%", tone: "muted" };
  }
  if (input.progress > 0) {
    return { label: `复制暂停 · ${clampPercent(input.progress)}%`, tone: "muted" };
  }
  return { label: "待从安装包复制", tone: "muted" };
}
