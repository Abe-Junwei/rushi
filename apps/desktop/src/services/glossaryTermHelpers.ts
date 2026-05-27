import type { GlossaryTermDto } from "../tauri/glossaryApi";

export type GlossaryEditorDraft = {
  term: string;
  aliases: string;
  domain: string;
  note: string;
  hotwordEnabled: boolean;
};

export type GlossaryHotwordFilter = "all" | "enabled" | "disabled";

export const EMPTY_GLOSSARY_DRAFT: GlossaryEditorDraft = {
  term: "",
  aliases: "",
  domain: "",
  note: "",
  hotwordEnabled: true,
};

export function glossaryDraftFromTerm(row: GlossaryTermDto): GlossaryEditorDraft {
  return {
    term: row.term,
    aliases: row.aliases ?? "",
    domain: row.domain ?? "",
    note: row.note ?? "",
    hotwordEnabled: row.hotword_enabled !== false,
  };
}

function rowMatchesHotwordFilter(row: GlossaryTermDto, filter: GlossaryHotwordFilter): boolean {
  if (filter === "enabled") return row.hotword_enabled !== false;
  if (filter === "disabled") return row.hotword_enabled === false;
  return true;
}

/** Client-side search + hotword filter. */
export function applyGlossaryFilters(
  terms: GlossaryTermDto[],
  query: string,
  hotwordFilter: GlossaryHotwordFilter,
): GlossaryTermDto[] {
  const q = query.trim().toLowerCase();
  return terms.filter((row) => {
    if (!rowMatchesHotwordFilter(row, hotwordFilter)) return false;
    if (!q) return true;
    const haystack = [row.term, row.aliases, row.domain, row.note]
      .filter(Boolean)
      .join("\n")
      .toLowerCase();
    return haystack.includes(q);
  });
}

/** @deprecated use applyGlossaryFilters */
export function filterGlossaryTerms(terms: GlossaryTermDto[], query: string): GlossaryTermDto[] {
  return applyGlossaryFilters(terms, query, "all");
}

export function countHotwordEnabledTerms(terms: GlossaryTermDto[]): number {
  return terms.filter((row) => row.hotword_enabled !== false).length;
}

export function countHiddenSelectedTerms(checkedIds: Set<number>, visibleIds: Set<number>): number {
  let hidden = 0;
  for (const id of checkedIds) {
    if (!visibleIds.has(id)) hidden += 1;
  }
  return hidden;
}

export function selectedGlossaryPreviewLabels(
  terms: GlossaryTermDto[],
  checkedIds: Set<number>,
  max = 3,
): string[] {
  const byId = new Map(terms.map((row) => [row.id, row.term]));
  const labels: string[] = [];
  for (const id of checkedIds) {
    const label = byId.get(id);
    if (label) labels.push(label);
    if (labels.length >= max) break;
  }
  return labels;
}

export function batchResultMessage(
  action: string,
  requested: number,
  affected: number,
): string {
  if (affected === requested) {
    return `${action} ${affected} 条术语。`;
  }
  return `${action} ${affected}/${requested} 条（${requested - affected} 条未找到或已变更）。`;
}

export function batchHotwordMessage(enabled: boolean, requested: number, affected: number): string {
  const verb = enabled ? "纳入热词" : "移出热词";
  if (affected === requested) {
    return `已将 ${affected} 条术语${verb}。`;
  }
  return `已将 ${affected}/${requested} 条术语${verb}（${requested - affected} 条未找到或已变更）。`;
}

function csvEscapeField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildGlossaryCsvExport(terms: GlossaryTermDto[]): string {
  const header = "term,aliases,domain,note,hotword_enabled,created_at_ms,updated_at_ms";
  const lines = terms.map((row) =>
    [
      csvEscapeField(row.term),
      csvEscapeField(row.aliases ?? ""),
      csvEscapeField(row.domain ?? ""),
      csvEscapeField(row.note ?? ""),
      row.hotword_enabled === false ? "0" : "1",
      String(row.created_at_ms),
      String(row.updated_at_ms ?? row.created_at_ms),
    ].join(","),
  );
  return [header, ...lines].join("\n");
}

export function glossaryDraftHasTerm(draft: GlossaryEditorDraft): boolean {
  return draft.term.trim().length > 0;
}
