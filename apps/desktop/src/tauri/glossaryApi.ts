import { invoke } from "@tauri-apps/api/core";

export interface GlossaryTermDto {
  id: number;
  term: string;
  created_at_ms: number;
}

export async function glossaryList(): Promise<GlossaryTermDto[]> {
  return invoke<GlossaryTermDto[]>("glossary_list");
}

export async function glossaryAdd(term: string): Promise<GlossaryTermDto> {
  return invoke<GlossaryTermDto>("glossary_add", { term });
}

export async function glossaryDelete(id: number): Promise<void> {
  return invoke<void>("glossary_delete", { id });
}
