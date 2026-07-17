/**
 * Leaf module (no editor imports) so HMR / cycle graphs cannot leave the gate
 * export undefined inside TranscriptEditorCore effects.
 *
 * While gated, React→CM `setState` sync must not run: CM already applied the
 * structure mutation and revealed; setState wipes scrollTop.
 */

let structureBridgeSkipExternalSync = false;

/** Gate React→CM full remount around CM-sourced structure persist. */
export function runWithTranscriptStructureBridgeGate<T>(fn: () => T): T {
  structureBridgeSkipExternalSync = true;
  try {
    return fn();
  } finally {
    if (typeof window !== "undefined" && typeof window.setTimeout === "function") {
      window.setTimeout(() => {
        structureBridgeSkipExternalSync = false;
      }, 0);
    } else {
      structureBridgeSkipExternalSync = false;
    }
  }
}

export function shouldSkipTranscriptExternalStructureSync(): boolean {
  return structureBridgeSkipExternalSync;
}
