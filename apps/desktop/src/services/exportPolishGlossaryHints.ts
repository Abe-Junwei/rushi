import type { GlossaryTermDto } from "../tauri/glossaryApi";

/** 与 Rust `GLOSSARY_CANONICAL_LIMIT`（`lexicon_pack.rs`）一致，避免 prompt 过长。 */
const MAX_HINT_TERMS = 200;

/** 供 export_polish prompt 注入的词表 canonical 摘要（专名/术语，供 LLM 参考写法）。 */
export function buildExportPolishGlossaryHints(terms: GlossaryTermDto[]): string {
  const names = terms
    .map((t) => t.term.trim())
    .filter((term) => term.length > 0);
  const unique = Array.from(new Set(names)).sort();
  if (unique.length === 0) return "";
  return unique
    .slice(0, MAX_HINT_TERMS)
    .map((term) => `- ${term}`)
    .join("\n");
}
