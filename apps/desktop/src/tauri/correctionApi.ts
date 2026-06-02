import { invoke } from "@tauri-apps/api/core";

export interface CorrectionRuleRow {
  wrong: string;
  right: string;
  hitCount: number;
  acceptedAsRule: boolean;
}

export interface GlossaryLearnPromptRow {
  afterText: string;
  hitCount: number;
  sampleBefore: string;
}

function parseRuleRow(raw: Record<string, unknown>): CorrectionRuleRow {
  return {
    wrong: String(raw.wrong ?? ""),
    right: String(raw.right ?? ""),
    hitCount: Number(raw.hitCount ?? raw.hit_count ?? 0),
    acceptedAsRule: Boolean(raw.acceptedAsRule ?? raw.accepted_as_rule),
  };
}

function parsePromptRow(raw: Record<string, unknown>): GlossaryLearnPromptRow {
  return {
    afterText: String(raw.afterText ?? raw.after_text ?? ""),
    hitCount: Number(raw.hitCount ?? raw.hit_count ?? 0),
    sampleBefore: String(raw.sampleBefore ?? raw.sample_before ?? ""),
  };
}

export async function correctionStableRulesList(): Promise<CorrectionRuleRow[]> {
  const rows = await invoke<Array<Record<string, unknown>>>("correction_stable_rules_list");
  return rows.map(parseRuleRow);
}

export async function correctionGlossaryLearnPrompts(): Promise<GlossaryLearnPromptRow[]> {
  const rows = await invoke<Array<Record<string, unknown>>>("correction_glossary_learn_prompts");
  return rows.map(parsePromptRow);
}
