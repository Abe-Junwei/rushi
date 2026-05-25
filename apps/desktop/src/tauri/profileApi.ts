import { invoke } from "@tauri-apps/api/core";
import type { SettingsProfileV1 } from "../services/profile/profileContract";

export async function exportSettingsProfile(profile: SettingsProfileV1): Promise<string | null> {
  return await invoke<string | null>("export_settings_profile", { profile });
}

export async function importSettingsProfile(): Promise<SettingsProfileV1 | null> {
  return await invoke<SettingsProfileV1 | null>("import_settings_profile");
}
