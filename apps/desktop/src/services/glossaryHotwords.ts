/** Preview of glossary → ASR hotwords (from Tauri `glossary_hotwords_preview`). */

// Defensive fallback only; real maxChars comes from backend (glossary_hotwords.rs).
const _HOTWORDS_MAX_CHARS_FALLBACK = 12_000;

export type GlossaryHotwordsPreview = {
  enabledEntryCount: number;
  termCount: number;
  includedTermCount: number;
  droppedTermCount: number;
  joinedCharCount: number;
  submittedCharCount: number;
  maxChars: number;
  truncated: boolean;
  preview: string;
};

type RawPreview = {
  enabledEntryCount?: number;
  enabled_entry_count?: number;
  termCount?: number;
  includedTermCount?: number;
  droppedTermCount?: number;
  joinedCharCount?: number;
  submittedCharCount?: number;
  maxChars?: number;
  truncated?: boolean;
  preview?: string;
  term_count?: number;
  included_term_count?: number;
  dropped_term_count?: number;
  joined_char_count?: number;
  submitted_char_count?: number;
  max_chars?: number;
};

function readNum(camel: number | undefined, snake: number | undefined): number {
  if (typeof camel === "number") return camel;
  if (typeof snake === "number") return snake;
  return 0;
}

export function parseGlossaryHotwordsPreview(raw: unknown): GlossaryHotwordsPreview | null {
  if (!raw || typeof raw !== "object") return null;
  const j = raw as RawPreview;
  return {
    enabledEntryCount: readNum(j.enabledEntryCount, j.enabled_entry_count),
    termCount: readNum(j.termCount, j.term_count),
    includedTermCount: readNum(j.includedTermCount, j.included_term_count),
    droppedTermCount: readNum(j.droppedTermCount, j.dropped_term_count),
    joinedCharCount: readNum(j.joinedCharCount, j.joined_char_count),
    submittedCharCount: readNum(j.submittedCharCount, j.submitted_char_count),
    maxChars: readNum(j.maxChars, j.max_chars) || _HOTWORDS_MAX_CHARS_FALLBACK,
    truncated: j.truncated === true,
    preview: typeof j.preview === "string" ? j.preview : "",
  };
}

/** User-facing summary for the glossary page (HOT-UX / ASR-VOC-2d). */
export function formatGlossaryHotwordsTranscribeSummary(p: GlossaryHotwordsPreview | null): string {
  if (!p || p.termCount === 0) {
    if (p && p.enabledEntryCount === 0) {
      return "当前无词条纳入热词（0 个 token）；请在下方勾选「纳入下次转写（热词）」或新建词条。";
    }
    return "当前无热词 token 纳入转写；本机 ASR 拉取语段时不会附带 hotwords。";
  }
  const base = `下次「从 ASR 拉取语段」将提交 ${p.includedTermCount} 个热词 token（${p.enabledEntryCount} 条已纳入词条），约 ${p.submittedCharCount.toLocaleString()} 字符（上限 ${p.maxChars.toLocaleString()}）。`;
  if (!p.truncated) {
    return base;
  }
  return `${base} 另有 ${p.droppedTermCount} 个 token 因超出 12k 未纳入；转写结果中会出现 hotwords_truncated_12k 提示。`;
}
