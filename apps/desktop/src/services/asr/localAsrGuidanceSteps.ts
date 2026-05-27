import type { AsrHealthState } from "../../pages/useAsrBridgeController";
import type { AsrHealthCapabilities } from "../../tauri/projectApi";
import {
  activeSkuModelCached,
  catalogEntryForHub,
  computeLocalAsrTranscribeReady,
  type LocalAsrCatalogStatusItem,
} from "./localAsrModelCatalog";

export function localAsrGuidanceSteps(input: {
  asrHealth: AsrHealthState;
  asrCaps: AsrHealthCapabilities | null;
  selectedHubModelId: string;
  catalogStatus: LocalAsrCatalogStatusItem[] | null;
}) {
  const { asrHealth, asrCaps, selectedHubModelId, catalogStatus } = input;
  const label = catalogEntryForHub(selectedHubModelId)?.label ?? "当前所选模型";
  const sidecarHub = asrCaps?.funasr_model_id ?? null;
  const sidecarCached = activeSkuModelCached(asrCaps, catalogStatus, sidecarHub);
  const { ready, sidecarMatchesSelection } = computeLocalAsrTranscribeReady({
    asrHealth,
    asrCaps,
    selectedHubModelId,
    catalogStatus,
  });

  const steps = [
    {
      label: "检测本机 ASR 服务",
      done: asrHealth === "ok",
      detail:
        asrHealth === "ok"
          ? "已读到 /health 响应。"
          : "先让本机 ASR 或安装包内侧车可达，再继续后续步骤。",
    },
    {
      label: "安装 FunASR 依赖",
      done: asrCaps?.funasr_import_ok === true,
      detail:
        asrCaps?.funasr_import_ok === true
          ? "FunASR 依赖已就绪。"
          : "若当前仍是 stub，请先安装依赖并重启 ASR。",
    },
    {
      label: `准备${label}`,
      done: ready,
      detail: !sidecarMatchesSelection
        ? `侧车仍在运行其他模型，请先在「转写模型」应用 ${label}。`
        : sidecarCached
          ? `${label} 与必需辅助模型已缓存。`
          : `建议预下载 ${label}，减少首次转写等待。`,
    },
  ];

  const nextAction =
    asrHealth !== "ok"
      ? "先点击“刷新状态”，若使用安装包侧车可再试“重试内置侧车”。"
      : asrCaps?.funasr_import_ok !== true
        ? "先安装 FunASR 依赖并重启 ASR。"
        : !sidecarMatchesSelection
          ? `请先在「转写模型」应用 ${label} 并重启侧车。`
          : !ready
            ? `建议现在预先下载 ${label}。`
            : "本机 ASR 已准备完毕，可直接用于转写。";

  return { steps, nextAction };
}
