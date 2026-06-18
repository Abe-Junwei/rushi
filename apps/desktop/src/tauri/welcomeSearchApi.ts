import { invoke } from "@tauri-apps/api/core";

export type WelcomeFileSearchHit = {
  project_id: string;
  project_name: string;
  file_id: string;
  file_name: string;
  updated_at_ms: number;
  matched_field: string;
};

export type WelcomeContentSearchHit = {
  project_id: string;
  project_name: string;
  file_id: string;
  file_name: string;
  segment_idx: number;
  start_sec: number;
  end_sec: number;
  snippet: string;
  char_start: number;
  char_end: number;
};

export async function welcomeSearchFiles(
  query: string,
  limit?: number,
): Promise<WelcomeFileSearchHit[]> {
  return invoke<WelcomeFileSearchHit[]>("welcome_search_files", { query, limit });
}

export async function welcomeSearchContent(
  query: string,
  limit?: number,
): Promise<WelcomeContentSearchHit[]> {
  return invoke<WelcomeContentSearchHit[]>("welcome_search_content", { query, limit });
}
