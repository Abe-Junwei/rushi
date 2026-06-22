let previewSyncedIdx = -1;
let previewSyncedSessionId: string | null = null;

export function markWaveformSegmentPreviewViewportSynced(idx: number, sessionId?: string): void {
  previewSyncedIdx = idx;
  previewSyncedSessionId = sessionId ?? null;
}

export function clearWaveformSegmentPreviewViewportSync(): void {
  previewSyncedIdx = -1;
  previewSyncedSessionId = null;
}

/** Pointerdown preview pending for idx (seek+reveal already applied). */
export function hasWaveformSegmentPreviewViewportSynced(idx: number): boolean {
  return previewSyncedIdx === idx;
}

/** True when pointerdown preview already ran seek+reveal for this idx/session (consume once). */
export function consumeWaveformSegmentPreviewViewportSync(
  idx: number,
  sessionId?: string,
): boolean {
  if (previewSyncedIdx !== idx) return false;
  if (
    previewSyncedSessionId != null &&
    sessionId != null &&
    previewSyncedSessionId !== sessionId
  ) {
    return false;
  }
  clearWaveformSegmentPreviewViewportSync();
  return true;
}

export function resetWaveformSegmentPreviewViewportSyncForTests(): void {
  clearWaveformSegmentPreviewViewportSync();
}
