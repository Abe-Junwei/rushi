import { correctionMemorySave } from "../tauri/correctionApi";
import {
  normalizeCorrectionLearnPair,
  shouldLearnInferredReplacement,
} from "./correctionInferPair";

export type ManualCorrectionMemoryValidation =
  | { ok: true; beforeText: string; afterText: string }
  | { ok: false; reason: string };

export function validateManualCorrectionMemoryPair(
  wrong: string,
  right: string,
): ManualCorrectionMemoryValidation {
  const trimmedWrong = wrong.trim();
  const trimmedRight = right.trim();
  if (!trimmedWrong) {
    return { ok: false, reason: "请先选中要更正的文本。" };
  }
  if (!trimmedRight) {
    return { ok: false, reason: "请输入正确形式。" };
  }
  if (trimmedWrong === trimmedRight) {
    return { ok: false, reason: "正确形式与选中文本相同。" };
  }
  const normalized = normalizeCorrectionLearnPair(trimmedWrong, trimmedRight);
  if (!normalized) {
    return { ok: false, reason: "仅标点或空白无法纳入记忆。" };
  }
  if (!shouldLearnInferredReplacement(trimmedWrong, trimmedRight)) {
    return { ok: false, reason: "该词对不符合纳入记忆规则（如单字替换）。" };
  }
  return {
    ok: true,
    beforeText: normalized.beforeText,
    afterText: normalized.afterText,
  };
}

export async function saveManualCorrectionMemoryPair(
  beforeText: string,
  afterText: string,
): Promise<void> {
  await correctionMemorySave({
    wrong: beforeText,
    right: afterText,
    acceptedAsRule: false,
  });
}
