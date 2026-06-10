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
  | "dashScopeVocabulary"
  | "genericMultipartHotwords"
  | "unsupported";

const CHANNEL_BY_PROVIDER_ID: Readonly<Record<string, SttOnlineVocabularyChannel>> = {
  openai: "openAiPrompt",
  assemblyai: "assemblyAiKeyterms",
  deepgram: "deepgramKeywords",
  "dashscope-asr": "dashScopeVocabulary",
  "custom-proxy": "genericMultipartHotwords",
};

const FIELD_HINT: Readonly<Record<SttOnlineVocabularyChannel, string>> = {
  openAiPrompt:
    "OpenAI 音频转写 `prompt`（≤224 字；按词条最近更新时间优先，超限截断）",
  assemblyAiKeyterms:
    "AssemblyAI `keyterms_prompt`（≤100 条；识别偏置，非 custom_spelling 转写后替换）",
  deepgramKeywords:
    "Deepgram URL `keywords` 参数（≤50 个；默认无强度 boost）",
  dashScopeVocabulary:
    "百炼 `speech-biasing` 热词表（vocabulary_id；单条非 ASCII ≤15 字或 ASCII ≤7 词；target_model=fun-asr）",
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
    return `「${label}」不支持术语偏置；可手改专名，或换 OpenAI / 百炼等支持厂商。`;
  }
  return `术语表 → ${glossaryBiasFieldHint(channel)}`;
}

/** Native adapter id when shell-direct; null for custom-proxy-only path. */
export function vocabularyNativeAdapterForProvider(providerId: string): string | null {
  return resolveShellNativeSttAdapterId(providerId);
}
