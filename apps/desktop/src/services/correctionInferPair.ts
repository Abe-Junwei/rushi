import type { CorrectionExplicitPair } from "../tauri/fileApi";
import { graphemeCount, splitGraphemes } from "./text/grapheme";
import { collectLearnablePairsForSession, type LearnEditState } from "./learnEditDelta";

function isCjkChar(c: string): boolean {
  const code = c.codePointAt(0) ?? 0;
  return (
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x20000 && code <= 0x2a6df)
  );
}

/** 与 Rust `is_correction_punctuation` + 空白一致；不入库、仅用于剥离。 */
export function isCorrectionLearnNoiseChar(c: string): boolean {
  if (c.length === 0) return false;
  if (/^\s$/u.test(c)) return true;
  return /[，。！？；、,.!?;:：]/.test(c);
}

/** 从追踪 op / 显式对中去掉标点与空白，只保留要学的中文词面。 */
export function stripCorrectionLearnNoise(text: string): string {
  let out = "";
  for (const g of splitGraphemes(text)) {
    if (!isCorrectionLearnNoiseChar(g)) out += g;
  }
  return out;
}

/** 可入库词对；无有效词面时返回 null。 */
export function normalizeCorrectionLearnPair(
  removed: string,
  added: string,
): { beforeText: string; afterText: string } | null {
  const beforeText = stripCorrectionLearnNoise(removed.trim());
  const afterText = stripCorrectionLearnNoise(added.trim());
  if (!beforeText || !afterText || beforeText === afterText) return null;
  return { beforeText, afterText };
}

/** 与 Rust `should_learn_inferred_replacement` 对齐（显式/推断共用门槛）。 */
export function shouldLearnInferredReplacement(removed: string, added: string): boolean {
  const pair = normalizeCorrectionLearnPair(removed, added);
  if (!pair) return false;
  const { beforeText, afterText } = pair;

  const isLatinOnly = (s: string) => /^[A-Za-z]+$/.test(s);
  if (isLatinOnly(beforeText) || isLatinOnly(afterText)) return false;

  const maxSpan = 8;
  if (graphemeCount(beforeText) > maxSpan || graphemeCount(afterText) > maxSpan) return false;

  const rGlyphs = splitGraphemes(beforeText);
  const aGlyphs = splitGraphemes(afterText);
  const r0 = rGlyphs[0];
  const a0 = aGlyphs[0];
  if (
    rGlyphs.length === 1 &&
    aGlyphs.length === 1 &&
    r0 &&
    a0 &&
    isCjkChar(r0) &&
    isCjkChar(a0)
  ) {
    return false;
  }

  return true;
}

/** 「纳入记忆」：消费 beforeinput / DOM input / 程序化写入记录的 removed→inserted。 */
export function buildConfirmExplicitPairs(
  focusBaseline: string,
  liveText: string,
  learnState?: LearnEditState,
): CorrectionExplicitPair[] {
  return collectLearnablePairsForSession(learnState, focusBaseline, liveText);
}

/** 兼容：取第一组可学习对。 */
export function buildConfirmExplicitPair(
  focusBaseline: string,
  liveText: string,
  learnState?: LearnEditState,
): CorrectionExplicitPair | null {
  return buildConfirmExplicitPairs(focusBaseline, liveText, learnState)[0] ?? null;
}
