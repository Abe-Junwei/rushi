import {
  STT_ONLINE_ASSEMBLYAI_DEFAULT_BASE_URL,
  STT_ONLINE_DASHSCOPE_DEFAULT_TRANSCRIBE_URL,
  STT_ONLINE_OPENAI_DEFAULT_TRANSCRIBE_URL,
} from "./constants";
import { resolveShellNativeSttAdapterId } from "./nativeAdapters";

/** 与 Tauri `stt_native` 内置默认端点一致（HTTP/HTTPS）。 */
export const STT_ONLINE_PRESET_TRANSCRIBE_URLS: Readonly<Partial<Record<string, string>>> = {
  openai: STT_ONLINE_OPENAI_DEFAULT_TRANSCRIBE_URL,
  assemblyai: STT_ONLINE_ASSEMBLYAI_DEFAULT_BASE_URL,
  "dashscope-asr": STT_ONLINE_DASHSCOPE_DEFAULT_TRANSCRIBE_URL,
  deepgram: "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true",
};

const PRESET_ENDPOINT_DISPLAY: Readonly<Partial<Record<string, string>>> = {
  ...STT_ONLINE_PRESET_TRANSCRIBE_URLS,
};

/** 仅「自定义代理」需用户自行填写转写 URL。 */
export function sttOnlineProviderEndpointUserConfigurable(providerId: string): boolean {
  return providerId === "custom-proxy";
}

/** 壳内直连厂商均使用预置端点（含 OpenAI / AssemblyAI）。 */
export function sttOnlineProviderUsesPresetEndpoint(providerId: string): boolean {
  return resolveShellNativeSttAdapterId(providerId) != null;
}

/** 供 Tauri bridge 使用的 HTTPS 预置 URL。 */
export function resolveSttOnlinePresetTranscribeUrl(providerId: string): string | null {
  const preset = STT_ONLINE_PRESET_TRANSCRIBE_URLS[providerId]?.trim();
  return preset || null;
}

/** 设置页只读展示。 */
export function resolveSttOnlinePresetEndpointDisplay(providerId: string): string | null {
  if (sttOnlineProviderEndpointUserConfigurable(providerId)) return null;
  const display = PRESET_ENDPOINT_DISPLAY[providerId]?.trim();
  if (display) return display;
  if (sttOnlineProviderUsesPresetEndpoint(providerId)) {
    return "（由桌面壳按厂商协议预置）";
  }
  return null;
}

/**
 * 厂商网关仅接受 POST，GET 探测会误报 400。
 * 此类厂商在「探测连接」时仅校验凭证是否已填。
 */
export function sttOnlineProviderUsesCredentialsOnlyProbe(providerId: string): boolean {
  if (providerId === "custom-proxy") return false;
  if (
    providerId === "openai" ||
    providerId === "assemblyai" ||
    providerId === "dashscope-asr" ||
    providerId === "deepgram"
  ) {
    return false;
  }
  return sttOnlineProviderUsesPresetEndpoint(providerId);
}

/** @deprecated 使用 sttOnlineProviderUsesPresetEndpoint */
export function sttOnlineProviderAllowsEmptyEndpoint(providerId: string): boolean {
  return sttOnlineProviderUsesPresetEndpoint(providerId) || sttOnlineProviderEndpointUserConfigurable(providerId);
}
