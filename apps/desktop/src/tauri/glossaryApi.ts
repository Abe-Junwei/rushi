import { invoke } from "@tauri-apps/api/core";

export interface GlossaryTermDto {
  id: number;
  term: string;
  aliases: string;
  domain: string;
  note: string;
  created_at_ms: number;
  updated_at_ms: number;
  hotword_enabled: boolean;
}

export type GlossaryTermInput = {
  term: string;
  aliases?: string;
  domain?: string;
  note?: string;
  hotwordEnabled?: boolean;
};

export type GlossaryBatchResult = {
  requested: number;
  affected: number;
};

export type GlossaryImportResult = {
  parsed: number;
  added: number;
  skippedDup: number;
  skippedWrongForm: number;
};

function readBool(raw: Record<string, unknown>, camel: string, snake: string): boolean | undefined {
  const c = raw[camel];
  const s = raw[snake];
  if (c === true || c === 1) return true;
  if (c === false || c === 0) return false;
  if (s === true || s === 1) return true;
  if (s === false || s === 0) return false;
  return undefined;
}

export function parseGlossaryTermDto(raw: Record<string, unknown>): GlossaryTermDto {
  const hotword = readBool(raw, "hotwordEnabled", "hotword_enabled");
  return {
    id: Number(raw.id),
    term: typeof raw.term === "string" ? raw.term : "",
    aliases: typeof raw.aliases === "string" ? raw.aliases : "",
    domain: typeof raw.domain === "string" ? raw.domain : "",
    note: typeof raw.note === "string" ? raw.note : "",
    created_at_ms: Number(raw.created_at_ms ?? raw.createdAtMs ?? 0),
    updated_at_ms: Number(raw.updated_at_ms ?? raw.updatedAtMs ?? raw.created_at_ms ?? raw.createdAtMs ?? 0),
    hotword_enabled: hotword ?? true,
  };
}

function parseBatchResult(raw: unknown): GlossaryBatchResult {
  if (!raw || typeof raw !== "object") return { requested: 0, affected: 0 };
  const j = raw as Record<string, unknown>;
  return {
    requested: Number(j.requested ?? 0),
    affected: Number(j.affected ?? 0),
  };
}

export async function glossaryList(search?: string): Promise<GlossaryTermDto[]> {
  const rows = await invoke<Array<Record<string, unknown>>>("glossary_list", { search: search?.trim() || null });
  return rows.map(parseGlossaryTermDto);
}

export async function glossaryAdd(input: GlossaryTermInput): Promise<GlossaryTermDto> {
  const raw = await invoke<Record<string, unknown>>("glossary_add", {
    term: input.term,
    aliases: input.aliases ?? null,
    domain: input.domain ?? null,
    note: input.note ?? null,
    hotwordEnabled: input.hotwordEnabled ?? null,
  });
  return parseGlossaryTermDto(raw);
}

export async function glossaryAddBatch(
  terms: string[],
  hotwordEnabled = true,
): Promise<GlossaryImportResult> {
  return invoke<GlossaryImportResult>("glossary_add_batch", { terms, hotwordEnabled });
}

export async function glossaryUpdate(id: number, input: GlossaryTermInput): Promise<GlossaryTermDto> {
  const raw = await invoke<Record<string, unknown>>("glossary_update", {
    id,
    term: input.term,
    aliases: input.aliases ?? null,
    domain: input.domain ?? null,
    note: input.note ?? null,
    hotwordEnabled: input.hotwordEnabled ?? null,
  });
  return parseGlossaryTermDto(raw);
}

export async function glossaryDelete(id: number): Promise<void> {
  return invoke<void>("glossary_delete", { id });
}

export async function glossaryDeleteBatch(ids: number[]): Promise<GlossaryBatchResult> {
  const raw = await invoke<unknown>("glossary_delete_batch", { ids });
  return parseBatchResult(raw);
}

export async function glossarySetHotwordBatch(ids: number[], enabled: boolean): Promise<GlossaryBatchResult> {
  const raw = await invoke<unknown>("glossary_set_hotword_batch", { ids, enabled });
  return parseBatchResult(raw);
}

type RawImportResult = {
  parsed?: number;
  added?: number;
  skipped_dup?: number;
  skippedDup?: number;
  skipped_wrong_form?: number;
  skippedWrongForm?: number;
};

export function parseGlossaryImportResult(raw: unknown): GlossaryImportResult | null {
  if (!raw || typeof raw !== "object") return null;
  const j = raw as RawImportResult;
  return {
    parsed: typeof j.parsed === "number" ? j.parsed : 0,
    added: typeof j.added === "number" ? j.added : 0,
    skippedDup:
      typeof j.skippedDup === "number"
        ? j.skippedDup
        : typeof j.skipped_dup === "number"
          ? j.skipped_dup
          : 0,
    skippedWrongForm:
      typeof j.skippedWrongForm === "number"
        ? j.skippedWrongForm
        : typeof j.skipped_wrong_form === "number"
          ? j.skipped_wrong_form
          : 0,
  };
}

export async function glossaryImportFromFile(): Promise<GlossaryImportResult | null> {
  const raw = await invoke<unknown>("glossary_import_from_file");
  if (raw == null) return null;
  return parseGlossaryImportResult(raw);
}

export async function glossaryHotwordsPreview(): Promise<unknown> {
  return invoke<unknown>("glossary_hotwords_preview");
}
