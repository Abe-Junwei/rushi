/**
 * ASR-VOC-1: compose glossary hotwords preview + local/online vocabulary channel for transcribe UI.
 */

import {
  formatGlossaryHotwordsPreflightLine,
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
  glossaryBiasPreflightLineForProviderId,
  vocabularyChannelForProviderId,
  type SttOnlineVocabularyChannel,
} from "../stt/sttVocabularyBias";
import { readStorage } from "../stt/sttOnlineProviderContract/storage";
import {
  readExternalSttOnlineRuntimeConfigFromStorage,
} from "../stt/sttOnlineProviderContract/runtimeConfig";
import { isOnlineTranscribeReady } from "../stt/sttOnlineProviderContract/bridge";
import type { TranscribeSource } from "../stt/transcribeSource";
import { readStoredTranscribeSource } from "../stt/transcribeSource";

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

const EMPTY_GLOSSARY_HINT =
  "转写词汇表暂无纳入热词的词条，专名可能听错；请添加希望听成的正形并勾选「纳入下次转写（热词）」。";

function readLocalAsrHubModelIdFromStorage(): string {
  return resolveLocalAsrHubModelId(readStorage(LOCAL_ASR_HUB_MODEL_STORAGE_KEY));
}

function buildTranscribeVocabularyPreflightSummary(input: {
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

  const emptyGlossaryHint =
    input.hotwords && input.hotwords.enabledEntryCount === 0 ? EMPTY_GLOSSARY_HINT : null;

  return {
    hotwords: input.hotwords,
    isOnlineMode: input.isOnlineMode,
    localSkuLabel: input.isOnlineMode ? null : (entry?.label ?? hub),
    localHotwordNote: null,
    onlineProviderId,
    onlineChannel: input.isOnlineMode ? onlineChannel : "unsupported",
    onlineBiasLine:
      input.isOnlineMode && onlineProviderId
        ? glossaryBiasPreflightLineForProviderId(onlineProviderId)
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
    const hotwordLine = formatGlossaryHotwordsPreflightLine(summary.hotwords);
    if (hotwordLine) lines.push(hotwordLine);
  }

  if (summary.isOnlineMode) {
    if (summary.onlineBiasLine) lines.push(summary.onlineBiasLine);
  } else {
    if (summary.localSkuLabel) {
      lines.push(`本机 ${summary.localSkuLabel}：术语随转写提交。`);
    }
    if (summary.localHotwordNote) lines.push(summary.localHotwordNote);
  }

  return lines;
}

export async function loadTranscribeVocabularyPreflight(
  source: TranscribeSource = readStoredTranscribeSource(),
): Promise<TranscribeVocabularyPreflightSummary> {
  const raw = await glossaryHotwordsPreview();
  const hotwords = parseGlossaryHotwordsPreview(raw);
  const isOnlineMode = source === "online" && isOnlineTranscribeReady();
  const sttCfg = readExternalSttOnlineRuntimeConfigFromStorage();
  return buildTranscribeVocabularyPreflightSummary({
    hotwords,
    hubModelId: readLocalAsrHubModelIdFromStorage(),
    isOnlineMode,
    onlineProviderId: isOnlineMode ? sttCfg.selectedProviderId : null,
  });
}
