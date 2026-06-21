import { invoke } from "@tauri-apps/api/core";
import type { SettingsProfile } from "../services/profile/profileContract";

export async function exportSettingsProfile(profile: SettingsProfile): Promise<string | null> {
  return await invoke<string | null>("export_settings_profile", { profile });
}

export async function importSettingsProfile(): Promise<SettingsProfile | null> {
  return await invoke<SettingsProfile | null>("import_settings_profile");
}
