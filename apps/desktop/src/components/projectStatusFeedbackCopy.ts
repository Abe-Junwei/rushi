import { ENV_NAV } from "../config/environmentNavCopy";
import type { TranscribeProgress } from "../pages/transcribePreviewState";
import type { BusyReason } from "../pages/useProjectController";
import { onlineTranscribeProviderShortLabel } from "../services/stt/onlineTranscribeProviderShortLabel";
import { readExternalSttOnlineRuntimeConfigFromStorage } from "../services/stt/sttOnlineProviderContract/runtimeConfig";
import type { TranscribeSource } from "../services/stt/transcribeSource";
import {
  estimateTranscribeRemainingSecs,
  formatApproxRemainingMinutes,
  transcribeDeterminateFraction,
} from "../utils/estimateTranscribeRemainingSecs";

export type BusyOverlayCopy = {
  title: string;
  /** 紧接标题的主说明（一行） */
  lead: string;
  /** 次要补充；可为空 */
  detail?: string;
  /** 0–1 determinate bar; null/undefined → indeterminate */
  progressValue?: number | null;
};

function onlineTranscribeProviderLabel(): string {
  const id = readExternalSttOnlineRuntimeConfigFromStorage().selectedProviderId;
  return onlineTranscribeProviderShortLabel(id);
}

function transcribeBusyCopy(
  source: TranscribeSource,
  progress: TranscribeProgress | null,
  elapsedSec = 0,
): BusyOverlayCopy {
  if (source === "online") {
    const vendor = onlineTranscribeProviderLabel();
    if (progress && progress.segmentsTotal > 0) {
      return {
        title: "在线转写中",
        lead: `已识别 ${progress.segmentsTotal} 条语段`,
        detail: "完成后写入列表",
      };
    }
    return {
      title: "在线转写中",
      lead: `${vendor} 云端识别`,
      detail: "完成后一次性写入语段；长音频可能需等待更久",
    };
  }

  if (progress && progress.windowCount > 1) {
    const progressValue = transcribeDeterminateFraction(
      progress.windowIndex,
      progress.windowCount,
    );
    const remainingLabel = formatApproxRemainingMinutes(
      estimateTranscribeRemainingSecs({
        windowIndex: progress.windowIndex,
        windowCount: progress.windowCount,
        elapsedSec,
      }),
    );
    const detailParts = [`已出 ${progress.segmentsTotal} 条语段`];
    if (remainingLabel) detailParts.push(remainingLabel);
    return {
      title: "本机转写中",
      lead: `第 ${progress.windowIndex}/${progress.windowCount} 段`,
      detail: detailParts.join(" · "),
      progressValue,
    };
  }
  if (progress && progress.segmentsTotal > 0) {
    return {
      title: "本机转写预览中",
      lead: `已出 ${progress.segmentsTotal} 条语段`,
      detail: "完成后自动保存",
    };
  }
  return {
    title: "本机转写中",
    lead: "语段将逐步出现在列表",
    detail: "长音频分段识别",
  };
}

export function transcribeCancelStoppingLabel(source: TranscribeSource): string {
  return source === "online" ? "正在停止…" : "正在停止…（当前段完成后结束）";
}

function formatExportPolishBatchLabel(batch: number, total: number): string {
  return `第 ${batch}/${total} 批`;
}

export function busyOverlayCopy(
  reason: BusyReason | null,
  transcribeProgress: TranscribeProgress | null,
  options?: {
    transcribeSource?: TranscribeSource;
    exportPolishProgress?: { batch: number; total: number };
    elapsedSec?: number;
  },
): BusyOverlayCopy {
  switch (reason) {
    case "transcribe":
      return transcribeBusyCopy(
        options?.transcribeSource ?? "local",
        transcribeProgress,
        options?.elapsedSec ?? 0,
      );
    case "save":
      return { title: "正在保存", lead: "写入本地数据库", detail: "请勿关闭应用" };
    case "create":
      return { title: "正在创建项目", lead: "复制音频并写入数据库" };
    case "load":
      return { title: "正在加载项目", lead: "读取语段与媒体", detail: "完整识别可能需数分钟" };
    case "import":
      return { title: "正在导入", lead: "请稍候" };
    case "delete":
      return { title: "正在删除项目", lead: "请稍候" };
    case "install_funasr":
      return {
        title: "正在安装",
        lead: "执行安装脚本",
        detail: `终端输出可在「${ENV_NAV.localAsr}」中查看`,
      };
    case "export":
      return {
        title: "正在导出内容包",
        lead: "打包中，请稍候",
      };
    case "export_docx":
      return {
        title: "正在导出 Word",
        lead: "写入文档",
      };
    case "export_polish": {
      const progress = options?.exportPolishProgress;
      if (progress && progress.total > 1) {
        return {
          title: "正在导出 Word",
          lead: formatExportPolishBatchLabel(progress.batch, progress.total),
          detail: "大模型润色中",
        };
      }
      return {
        title: "正在导出 Word",
        lead: "大模型润色并写入文档",
        detail: "处理可能需要数分钟",
      };
    }
    case "stage_b":
      return {
        title: "智能改稿处理中",
        lead: "请求 LLM 生成标点与改字候选",
        detail: "请勿切换文件或转写",
      };
    case "batch_transcribe":
      return {
        title: "批量转写进行中",
        lead: "串行处理项目内音频",
        detail: "请勿切换项目或关闭应用",
      };
    default:
      return { title: "处理中", lead: "请稍候" };
  }
}
