import { invoke } from "@tauri-apps/api/core";

export interface GlossaryTermDto {
  id: number;
  term: string;
  created_at_ms: number;
}

export async function p2GlossaryList(): Promise<GlossaryTermDto[]> {
  return invoke<GlossaryTermDto[]>("p2_glossary_list");
}

export async function p2GlossaryAdd(term: string): Promise<GlossaryTermDto> {
  return invoke<GlossaryTermDto>("p2_glossary_add", { term });
}

export async function p2GlossaryDelete(id: number): Promise<void> {
  return invoke<void>("p2_glossary_delete", { id });
}
