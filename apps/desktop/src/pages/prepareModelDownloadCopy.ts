import {
  packagedOrDev,
  packagedOrDevArray,
  prepareModelFunasrMissingTipsDev,
  prepareModelFunasrMissingTipsManaged,
  prepareModelScopeMissingTipsDev,
  prepareModelScopeMissingTipsManaged,
} from "../services/packagedUserHints";
import { normalizePrepareModelErrorCode } from "./prepareModelResume";

export type PrepareModelFailureCopy = {
  headline: string;
  tips: string[];
};

function commonRetryTips(): string[] {
  return [
    "再次点击「下载当前模型」重试（ModelScope 下载支持断点续传，可多试几次）。",
    "点「重新检测 ASR」确认服务仍在本机运行。",
    "若多次失败：检查网络/代理/VPN，或更换网络后再试。",
  ];
}

/**
 * Maps rushi-asr `error_code` / HTTP `detail` strings to short Chinese guidance.
 */
export function describePrepareModelFailure(code: string): PrepareModelFailureCopy {
  const c = normalizePrepareModelErrorCode(code);
  if (c === "funasr_not_installed") {
    return {
      headline: "当前 ASR 进程未加载 FunASR（或缺少依赖）。",
      tips: packagedOrDevArray(prepareModelFunasrMissingTipsDev, prepareModelFunasrMissingTipsManaged),
    };
  }
  if (c === "modelscope_not_installed") {
    return {
      headline: "缺少 ModelScope 客户端，无法拉取模型权重。",
      tips: [
        ...packagedOrDevArray(prepareModelScopeMissingTipsDev, prepareModelScopeMissingTipsManaged),
        ...commonRetryTips(),
      ],
    };
  }
  if (c === "model_prepare_disk_full") {
    return {
      headline: "磁盘剩余空间不足，无法写入模型缓存。",
      tips: [
        "清理系统盘或应用数据盘，至少留出数 GB 余量（策略建议预留约 5GB 总预算）。",
        "点「打开应用数据目录」查看 models 占用，必要时删除旧缓存后再试。",
        ...commonRetryTips(),
      ],
    };
  }
  if (c === "model_prepare_incomplete") {
    return {
      headline: "模型下载未完整落盘，缓存目录里仍是半成品。",
      tips: [
        "先结束当前转写/下载，再删除对应模型缓存目录后重新点「下载当前模型」。",
        "若仍复现：检查网络/VPN，避免在下载过程中中断 rushi-asr 进程。",
        ...commonRetryTips(),
      ],
    };
  }
  if (c === "vad_prepare_incomplete") {
    return {
      headline: "辅助 VAD 模型未完整落盘，当前仍不能稳定转写。",
      tips: [
        "删除对应 VAD 缓存目录后重新点「下载当前模型」，让主模型与辅助模型一起补齐。",
        "若多次复现：检查网络/VPN，避免在下载过程中中断 rushi-asr 进程。",
        ...commonRetryTips(),
      ],
    };
  }
  if (c === "model_manifest_path_missing") {
    return {
      headline: "已启用模型 manifest 校验，但找不到校验清单文件。",
      tips: [
        "若设置了 RUSHI_MODEL_VERIFY_MANIFEST，请确认路径正确且进程可读。",
        "不需要校验时，可在启动 ASR 的环境中移除此变量。",
      ],
    };
  }
  if (c.includes("sha256_mismatch") || c.includes("manifest_")) {
    return {
      headline: "模型文件与 manifest 校验不一致。",
      tips: [
        "若使用固定 manifest 发布，请核对 SHA256 是否与当前缓存文件一致。",
        "开发环境可删除对应缓存目录后重新下载，或更新 manifest。",
      ],
    };
  }
  if (c === "client_timeout") {
    return {
      headline: "下载等待超过 15 分钟仍未完成。",
      tips: [
        "大文件在网络较慢时可能超时；请换更稳定网络后重试（支持断点续传）。",
        "确认未休眠/断网；必要时在终端直接观察 ASR 日志。",
        ...commonRetryTips(),
      ],
    };
  }
  if (c === "model_prepare_network_error") {
    return {
      headline: "模型下载因网络中断失败（已保留已下载部分，可续传）。",
      tips: [
        "请先稳定 VPN/代理（建议全程保持同一网络），再点「下载当前模型」。",
        "若进度长时间不动：点「取消下载」后重新点「下载当前模型」。",
        "ModelScope 会跳过已落盘文件，不会从零开始。",
        ...commonRetryTips(),
      ],
    };
  }
  if (c === "fetch_failed") {
    return {
      headline: "无法连接本机 ASR 侧车（8741）。",
      tips: [
        packagedOrDev(
          "确认侧车已启动：npm run desktop:dev（自动拉起）或 npm run asr:dev。",
          "请在「环境 → 本机 ASR」点「一键准备本机 ASR」或「重试内置侧车」。",
        ),
        packagedOrDev(
          "终端执行：curl -sf http://127.0.0.1:8741/health 应有 JSON 返回。",
          "点「刷新状态」确认侧车 /health 正常。",
        ),
        packagedOrDev(
          "若磁盘已有模型但仍显示未缓存：侧车可能未绑定应用模型目录，请用上述命令重启侧车。",
          "若磁盘已有模型但仍显示未缓存：请点「一键准备本机 ASR」后再「刷新状态」。",
        ),
        ...commonRetryTips(),
      ],
    };
  }
  if (c.startsWith("http_")) {
    return {
      headline: `请求失败（${c}）。`,
      tips: commonRetryTips(),
    };
  }
  return {
    headline: `模型准备失败（${c.length > 120 ? `${c.slice(0, 120)}…` : c}）。`,
    tips: commonRetryTips(),
  };
}
