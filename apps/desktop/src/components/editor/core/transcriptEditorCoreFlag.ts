/**
 * Feature flag for CM6 transcript editor core.
 * P9a+: **always on** (legacy textarea list removed). localStorage key retained for diagnostics only.
 */
export const TRANSCRIPT_EDITOR_CORE_FLAG_KEY = "rushi.dev.transcriptEditorCore";

/** Always enabled after P9a (textarea virtual list deleted). */
export function readTranscriptEditorCoreEnabled(): boolean {
  return true;
}

/** No-op write — core is permanently on. Kept for test call-site compatibility. */
export function writeTranscriptEditorCoreEnabled(_enabled: boolean): void {
  void _enabled;
}

/** Test-only no-op — core cannot be disabled after P9a. */
export function setTranscriptEditorCoreEnabledForTests(_enabled: boolean | null): void {
  void _enabled;
}
