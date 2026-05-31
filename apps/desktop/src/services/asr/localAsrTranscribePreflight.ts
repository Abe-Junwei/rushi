import {
  computeLocalAsrTranscribeReady,
  type LocalAsrTranscribeReadyInput,
} from "./localAsrModelCatalog";

export type LocalAsrTranscribePreflightInput = LocalAsrTranscribeReadyInput & {
  /** From GET / during health poll; false when sidecar lacks R3e-C async routes. */
  sidecarAsyncTranscribeCapable?: boolean;
};

export function localAsrTranscribePreflightMessage(
  input: LocalAsrTranscribePreflightInput,
): string | null {
  const { ready, sidecarMatchesSelection } = computeLocalAsrTranscribeReady(input);
  if (input.asrHealth !== "ok" || !input.asrCaps) {
    return "本机 ASR 未就绪：请先在「环境与 ASR」完成侧车启动与模型准备。";
  }
  if (input.sidecarAsyncTranscribeCapable === false) {
    return (
      "侧车版本过旧，不支持增量转写（缺少 POST /v1/transcribe/async）。" +
      "请在环境页「应用并重启侧车」，或执行 npm run asr:build-sidecar-unix 重建内置侧车。"
    );
  }
  if (ready) return null;
  if (!sidecarMatchesSelection) {
    return "所选模型与侧车当前模型不一致：请先在环境页「应用并重启侧车」后再拉取语段。";
  }
  return "所选模型尚未就绪：请先在环境页下载并完成当前模型的准备。";
}
