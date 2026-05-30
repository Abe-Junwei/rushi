const PROGRESS_ABORT_WARN_PREFIX = "Progress tracking error:";

/** AbortError from cancelled WaveSurfer fetch / decode during remount or destroy. */
export function isWaveSurferAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "AbortError") return true;
  if (err instanceof Error && err.name === "AbortError") return true;
  return false;
}

let installed = false;

/**
 * WaveSurfer tracks fetch progress on a cloned Response body. When a load is
 * cancelled (destroy, remount, hot reload), that clone throws AbortError and
 * the library logs `Progress tracking error:` even though the main load is
 * handled — expected cleanup noise, not a user-facing failure.
 */
export function installWaveSurferProgressAbortWarnFilter(): void {
  if (installed || typeof console === "undefined") return;
  installed = true;
  const originalWarn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    if (
      args.length >= 2 &&
      args[0] === PROGRESS_ABORT_WARN_PREFIX &&
      isWaveSurferAbortError(args[1])
    ) {
      return;
    }
    originalWarn(...args);
  };
}
