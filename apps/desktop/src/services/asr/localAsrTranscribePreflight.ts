import {
  computeLocalAsrTranscribeReady,
  type LocalAsrTranscribeReadyInput,
} from "./localAsrModelCatalog";

export function localAsrTranscribePreflightMessage(
  input: LocalAsrTranscribeReadyInput,
): string | null {
  const { ready, sidecarMatchesSelection } = computeLocalAsrTranscribeReady(input);
  if (ready) return null;
  if (input.asrHealth !== "ok" || !input.asrCaps) {
    return "本机 ASR 未就绪：请先在「环境与 ASR」完成侧车启动与模型准备。";
  }
  if (!sidecarMatchesSelection) {
    return "所选模型与侧车当前模型不一致：请先在环境页「应用并重启侧车」后再拉取语段。";
  }
  return "所选模型尚未就绪：请先在环境页下载并完成当前模型的准备。";
}
