/**
 * Glossary → online STT vocabulary mapping (ACC-STT-UNIFY U2).
 * Aligns with Rust `project::stt_vocabulary::SttVocabularyChannel`.
 */

import { getSttOnlineProviderDefinition } from "./sttOnlineProviderContract/definitions";
import { resolveShellNativeSttAdapterId } from "./sttOnlineProviderContract/bridge";

/** Mirrors Rust `SttVocabularyChannel` for UI / contracts. */
export type SttOnlineVocabularyChannel =
  | "openAiPrompt"
  | "assemblyAiKeyterms"
  | "deepgramKeywords"
  | "genericMultipartHotwords"
  | "unsupported";

const CHANNEL_BY_PROVIDER_ID: Readonly<Record<string, SttOnlineVocabularyChannel>> = {
  openai: "openAiPrompt",
  assemblyai: "assemblyAiKeyterms",
  deepgram: "deepgramKeywords",
  "custom-proxy": "genericMultipartHotwords",
};

const FIELD_HINT: Readonly<Record<SttOnlineVocabularyChannel, string>> = {
  openAiPrompt:
    "OpenAI 音频转写 `prompt`（≤224 字；按词条最近更新时间优先，超限截断）",
  assemblyAiKeyterms:
    "AssemblyAI `keyterms_prompt`（≤100 条；识别偏置，非 custom_spelling 转写后替换）",
  deepgramKeywords:
    "Deepgram URL `keywords` 参数（≤50 个；默认无强度 boost）",
  genericMultipartHotwords: "代理 multipart `hotwords`（须兼容 Rushi 契约）",
  unsupported: "",
};

export function vocabularyChannelForProviderId(providerId: string): SttOnlineVocabularyChannel {
  return CHANNEL_BY_PROVIDER_ID[providerId] ?? "unsupported";
}

export function providerSupportsGlossaryBias(providerId: string): boolean {
  return vocabularyChannelForProviderId(providerId) !== "unsupported";
}

export function glossaryBiasFieldHint(channel: SttOnlineVocabularyChannel): string {
  return FIELD_HINT[channel];
}

/** For `TranscriptionProvider.supportsHotwordBias` and environment copy. */
export function supportsHotwordBiasForProviderId(providerId: string): boolean {
  return providerSupportsGlossaryBias(providerId);
}

/** One-line hint for glossary / online STT panels. */
export function glossaryBiasSummaryForProviderId(providerId: string): string | null {
  const channel = vocabularyChannelForProviderId(providerId);
  if (channel === "unsupported") {
    const def = getSttOnlineProviderDefinition(providerId);
    const label = def?.label ?? providerId;
    return `当前在线厂商「${label}」不支持将术语表传入识别 API；转写仍可进行，专名需手改或换 OpenAI / AssemblyAI / Deepgram。`;
  }
  return `术语表将映射为 ${glossaryBiasFieldHint(channel)}。`;
}

/** Native adapter id when shell-direct; null for custom-proxy-only path. */
export function vocabularyNativeAdapterForProvider(providerId: string): string | null {
  return resolveShellNativeSttAdapterId(providerId);
}
