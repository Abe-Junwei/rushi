import type { OnlineNativeAdapterId } from "./types";

/** 所选厂商是否由桌面壳内置 HTTP 直连（端点由应用预置）。 */
export function resolveShellNativeSttAdapterId(providerId: string): OnlineNativeAdapterId | null {
  switch (providerId) {
    case "openai":
      return "openaiAudio";
    case "assemblyai":
      return "assemblyai";
    case "dashscope-asr":
      return "dashscopeAsr";
    case "deepgram":
      return "deepgramListen";
    default:
      return null;
  }
}
