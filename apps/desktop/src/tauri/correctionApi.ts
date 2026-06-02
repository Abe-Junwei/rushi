import { invoke } from "@tauri-apps/api/core";

export interface CorrectionRuleRow {
  wrong: string;
  right: string;
  hitCount: number;
  acceptedAsRule: boolean;
}

export interface CorrectionMemoryEntryRow {
  wrong: string;
  right: string;
  hitCount: number;
  acceptedAsRule: boolean;
  updatedAtMs: number;
  isStable: boolean;
}

export interface GlossaryLearnPromptRow {
  afterText: string;
  hitCount: number;
  sampleBefore: string;
}

export type CorrectionMemorySavePayload = {
  wrong: string;
  right: string;
  acceptedAsRule: boolean;
  replaceWrong?: string;
  replaceRight?: string;
};

function readStr(raw: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = raw[key];
    if (typeof v === "string") return v;
  }
  return "";
}

function parseRuleRow(raw: Record<string, unknown>): CorrectionRuleRow {
  return {
    wrong: readStr(raw, "wrong"),
    right: readStr(raw, "right"),
    hitCount: Number(raw.hitCount ?? raw.hit_count ?? 0),
    acceptedAsRule: Boolean(raw.acceptedAsRule ?? raw.accepted_as_rule),
  };
}

function parseMemoryEntryRow(raw: Record<string, unknown>): CorrectionMemoryEntryRow {
  const hitCount = Number(raw.hitCount ?? raw.hit_count ?? 0);
  const acceptedAsRule = Boolean(raw.acceptedAsRule ?? raw.accepted_as_rule);
  return {
    wrong: readStr(raw, "wrong"),
    right: readStr(raw, "right"),
    hitCount,
    acceptedAsRule,
    updatedAtMs: Number(raw.updatedAtMs ?? raw.updated_at_ms ?? 0),
    isStable: Boolean(raw.isStable ?? raw.is_stable ?? (acceptedAsRule || hitCount >= 2)),
  };
}

function parsePromptRow(raw: Record<string, unknown>): GlossaryLearnPromptRow {
  return {
    afterText: readStr(raw, "afterText", "after_text"),
    hitCount: Number(raw.hitCount ?? raw.hit_count ?? 0),
    sampleBefore: readStr(raw, "sampleBefore", "sample_before"),
  };
}

export async function correctionStableRulesList(): Promise<CorrectionRuleRow[]> {
  const rows = await invoke<Array<Record<string, unknown>>>("correction_stable_rules_list");
  return rows.map(parseRuleRow);
}

export async function correctionMemoryList(): Promise<CorrectionMemoryEntryRow[]> {
  const rows = await invoke<Array<Record<string, unknown>>>("correction_memory_list");
  return rows.map(parseMemoryEntryRow);
}

export async function correctionMemorySave(payload: CorrectionMemorySavePayload): Promise<void> {
  await invoke("correction_memory_save", { payload });
}

export async function correctionMemoryDelete(wrong: string, right: string): Promise<void> {
  await invoke("correction_memory_delete", { wrong, right });
}

export async function correctionAcceptRule(beforeText: string, afterText: string): Promise<void> {
  await invoke("correction_accept_rule", { beforeText, afterText });
}

export async function correctionGlossaryLearnPrompts(): Promise<GlossaryLearnPromptRow[]> {
  const rows = await invoke<Array<Record<string, unknown>>>("correction_glossary_learn_prompts");
  return rows.map(parsePromptRow);
}

/** LEX-MINE-1: stable memory not yet in glossary (hit≥2 or accepted). */
export async function correctionGlossaryMineCandidates(): Promise<GlossaryLearnPromptRow[]> {
  const rows = await invoke<Array<Record<string, unknown>>>("correction_glossary_mine_candidates");
  return rows.map(parsePromptRow);
}
