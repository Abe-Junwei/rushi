const STORAGE_KEY = "rushi.localAsr.speakerDiarization.v1";

export function getSpeakerDiarizationPreference(): boolean {
  try {
    return globalThis.localStorage?.getItem(STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}

export function setSpeakerDiarizationPreference(enabled: boolean): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    // Preference storage failure must not block ordinary transcription.
  }
}
