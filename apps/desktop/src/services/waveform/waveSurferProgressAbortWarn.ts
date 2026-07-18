const PROGRESS_ABORT_WARN_PREFIX = "Progress tracking error:";
const CM_VIEWPORT_STABILIZE_WARN = "Viewport failed to stabilize";
const CM_MEASURE_LOOP_WARN = "Measure loop restarted more than 5 times";

/** AbortError from cancelled WaveSurfer fetch / decode during remount or destroy. */
export function isWaveSurferAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "AbortError") return true;
  if (err instanceof Error && err.name === "AbortError") return true;
  return false;
}

let installed = false;
let uninstall: (() => void) | null = null;

/**
 * WaveSurfer tracks fetch progress on a cloned Response body. When a load is
 * cancelled (destroy, remount, hot reload), that clone throws AbortError and
 * the library logs `Progress tracking error:` even though the main load is
 * handled — expected cleanup noise, not a user-facing failure.
 *
 * This wrapper only filters that WaveSurfer abort noise. Other warnings are
 * forwarded via Reflect.apply so DevTools attributes them to the real caller
 * (e.g. CodeMirror "Viewport failed to stabilize"), not this file.
 */
export function installWaveSurferProgressAbortWarnFilter(): void {
  if (installed || typeof console === "undefined") return;
  installed = true;
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    if (
      args.length >= 2 &&
      args[0] === PROGRESS_ABORT_WARN_PREFIX &&
      isWaveSurferAbortError(args[1])
    ) {
      return;
    }
    // WKWebView / some hosts still collapse stacks through the wrapper; tag CM
    // measure warnings so they are not mistaken for WaveSurfer abort noise.
    if (
      typeof args[0] === "string" &&
      (args[0] === CM_VIEWPORT_STABILIZE_WARN || args[0] === CM_MEASURE_LOOP_WARN)
    ) {
      Reflect.apply(originalWarn, console, [`[codemirror] ${args[0]}`, ...args.slice(1)]);
      return;
    }
    Reflect.apply(originalWarn, console, args);
  };
  uninstall = () => {
    console.warn = originalWarn;
    installed = false;
    uninstall = null;
  };
}

/** Test helper: restore console.warn after filter install. */
export function resetWaveSurferProgressAbortWarnFilterForTests(): void {
  uninstall?.();
}
