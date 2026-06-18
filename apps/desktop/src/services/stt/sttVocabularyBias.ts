/**
 * Glossary → online STT vocabulary mapping (ACC-STT-UNIFY U2).
 * Aligns with Rust `project::stt_vocabulary::SttVocabularyChannel`.
 */

import { getSttOnlineProviderDefinition } from "./sttOnlineProviderContract/definitions";

/** Mirrors Rust `SttVocabularyChannel` for UI / contracts. */
export type SttOnlineVocabularyChannel =
  | "openAiPrompt"
  | "assemblyAiKeyterms"
  | "deepgramKeywords"
  | "dashScopeVocabulary"
  | "xunfeiSpeedAsrHotword"
  | "genericMultipartHotwords"
  | "unsupported";

const CHANNEL_BY_PROVIDER_ID: Readonly<Record<string, SttOnlineVocabularyChannel>> = {
  openai: "openAiPrompt",
  assemblyai: "assemblyAiKeyterms",
  deepgram: "deepgramKeywords",
  "dashscope-asr": "dashScopeVocabulary",
  "iflytek-speed-asr": "xunfeiSpeedAsrHotword",
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
  xunfeiSpeedAsrHotword:
    "讯飞极速大模型热词（英文逗号分隔；单条 ≤16 字；≤200 条）",
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

const PREFLIGHT_BIAS_HINT: Readonly<Record<SttOnlineVocabularyChannel, string>> = {
  openAiPrompt: "在线 OpenAI：术语写入转写 prompt。",
  assemblyAiKeyterms: "在线 AssemblyAI：术语作为识别偏置提交。",
  deepgramKeywords: "在线 Deepgram：术语作为 keywords 提交。",
  dashScopeVocabulary: "在线百炼：术语同步为厂商热词表。",
  xunfeiSpeedAsrHotword: "在线讯飞极速大模型：术语将作为转写热词提交。",
  genericMultipartHotwords: "在线代理：术语随转写请求提交。",
  unsupported: "",
};

/** Plain-language line for transcribe confirm / in-progress banner. */
export function glossaryBiasPreflightLineForProviderId(providerId: string): string | null {
  const channel = vocabularyChannelForProviderId(providerId);
  if (channel === "unsupported") {
    const def = getSttOnlineProviderDefinition(providerId);
    const label = def?.label ?? providerId;
    return `「${label}」不支持术语表；专名可能听错，可手改或换支持引擎。`;
  }
  return PREFLIGHT_BIAS_HINT[channel];
}
