/**
 * ASR-VOC-1: compose glossary hotwords preview + local/online vocabulary channel for transcribe UI.
 */

import {
  formatGlossaryHotwordsTranscribeSummary,
  parseGlossaryHotwordsPreview,
  type GlossaryHotwordsPreview,
} from "../glossaryHotwords";
import { glossaryHotwordsPreview } from "../../tauri/glossaryApi";
import {
  catalogEntryForHub,
  LOCAL_ASR_HUB_MODEL_STORAGE_KEY,
  resolveLocalAsrHubModelId,
} from "./localAsrModelCatalog";
import {
  glossaryBiasSummaryForProviderId,
  vocabularyChannelForProviderId,
  type SttOnlineVocabularyChannel,
} from "../stt/sttVocabularyBias";
import { readStorage } from "../stt/sttOnlineProviderContract/storage";
import {
  readExternalSttOnlineRuntimeConfigFromStorage,
} from "../stt/sttOnlineProviderContract/runtimeConfig";
import { tryBuildOnlineTranscribeBridgePayload } from "../stt/sttOnlineProviderContract";

export type TranscribeVocabularyPreflightSummary = {
  hotwords: GlossaryHotwordsPreview | null;
  isOnlineMode: boolean;
  localSkuLabel: string | null;
  localHotwordNote: string | null;
  onlineProviderId: string | null;
  onlineChannel: SttOnlineVocabularyChannel;
  onlineBiasLine: string | null;
  emptyGlossaryHint: string | null;
};

const SENSEVOICE_WEAK_HOTWORD_NOTE =
  "当前为 SenseVoice 轻量 SKU：热词参数会提交，但专名提升通常弱于 Paraformer 长音频；重要专名建议换模型或转写后改稿。";

export const EMPTY_GLOSSARY_TRANSCRIBE_HINT =
  "转写词汇表暂无纳入热词的词条，专名可能听错；请添加希望听成的正形并勾选「纳入下次转写（热词）」。";

const EMPTY_GLOSSARY_HINT = EMPTY_GLOSSARY_TRANSCRIBE_HINT;

export function readLocalAsrHubModelIdFromStorage(): string {
  return resolveLocalAsrHubModelId(readStorage(LOCAL_ASR_HUB_MODEL_STORAGE_KEY));
}

export function buildTranscribeVocabularyPreflightSummary(input: {
  hotwords: GlossaryHotwordsPreview | null;
  hubModelId: string;
  isOnlineMode: boolean;
  onlineProviderId: string | null;
}): TranscribeVocabularyPreflightSummary {
  const hub = resolveLocalAsrHubModelId(input.hubModelId);
  const entry = catalogEntryForHub(hub);
  const onlineProviderId = input.isOnlineMode ? (input.onlineProviderId?.trim() || null) : null;
  const onlineChannel = onlineProviderId
    ? vocabularyChannelForProviderId(onlineProviderId)
    : "unsupported";

  let localHotwordNote: string | null = null;
  if (!input.isOnlineMode && entry?.catalogId === "sensevoice-small") {
    const hasHotwords = (input.hotwords?.includedTermCount ?? 0) > 0;
    if (hasHotwords) localHotwordNote = SENSEVOICE_WEAK_HOTWORD_NOTE;
  }

  const emptyGlossaryHint =
    input.hotwords && input.hotwords.enabledEntryCount === 0 ? EMPTY_GLOSSARY_HINT : null;

  return {
    hotwords: input.hotwords,
    isOnlineMode: input.isOnlineMode,
    localSkuLabel: input.isOnlineMode ? null : (entry?.label ?? hub),
    localHotwordNote: input.isOnlineMode ? null : localHotwordNote,
    onlineProviderId,
    onlineChannel: input.isOnlineMode ? onlineChannel : "unsupported",
    onlineBiasLine:
      input.isOnlineMode && onlineProviderId
        ? glossaryBiasSummaryForProviderId(onlineProviderId)
        : null,
    emptyGlossaryHint,
  };
}

/** User-facing lines for overwrite dialog / toolbar (non-blocking). */
export function formatTranscribeVocabularyPreflightLines(
  summary: TranscribeVocabularyPreflightSummary,
): string[] {
  const lines: string[] = [];
  if (summary.emptyGlossaryHint) {
    lines.push(summary.emptyGlossaryHint);
  }

  if (summary.hotwords) {
    lines.push(formatGlossaryHotwordsTranscribeSummary(summary.hotwords));
  }

  if (summary.isOnlineMode) {
    if (summary.onlineBiasLine) lines.push(summary.onlineBiasLine);
  } else {
    if (summary.localSkuLabel) {
      lines.push(`本机模型：${summary.localSkuLabel}；术语经 multipart hotwords 提交。`);
    }
    if (summary.localHotwordNote) lines.push(summary.localHotwordNote);
  }

  return lines;
}

export async function loadTranscribeVocabularyPreflight(): Promise<TranscribeVocabularyPreflightSummary> {
  const raw = await glossaryHotwordsPreview();
  const hotwords = parseGlossaryHotwordsPreview(raw);
  const onlinePayload = tryBuildOnlineTranscribeBridgePayload();
  const isOnlineMode = onlinePayload != null;
  const sttCfg = readExternalSttOnlineRuntimeConfigFromStorage();
  return buildTranscribeVocabularyPreflightSummary({
    hotwords,
    hubModelId: readLocalAsrHubModelIdFromStorage(),
    isOnlineMode,
    onlineProviderId: isOnlineMode ? sttCfg.selectedProviderId : null,
  });
}

export function compactTranscribeVocabularyPreflightHint(lines: string[]): string | null {
  const trimmed = lines.map((l) => l.trim()).filter(Boolean);
  if (trimmed.length === 0) return null;
  return trimmed.join(" ");
}
