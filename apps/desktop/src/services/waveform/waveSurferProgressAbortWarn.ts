const PROGRESS_ABORT_WARN_PREFIX = "Progress tracking error:";
const CM_VIEWPORT_STABILIZE_WARN = "Viewport failed to stabilize";
const CM_MEASURE_LOOP_WARN = "Measure loop restarted more than 5 times";
/** Hot reload / HMR while a Tauri async command is still in flight. */
const TAURI_STALE_CALLBACK_WARN = "[TAURI] Couldn't find callback id";

/** AbortError from cancelled WaveSurfer fetch / decode during remount or destroy. */
export function isWaveSurferAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "AbortError") return true;
  if (err instanceof Error && err.name === "AbortError") return true;
  return false;
}

function isExpectedReloadNoise(args: unknown[]): boolean {
  if (
    args.length >= 2 &&
    args[0] === PROGRESS_ABORT_WARN_PREFIX &&
    isWaveSurferAbortError(args[1])
  ) {
    return true;
  }
  const head = args[0];
  return typeof head === "string" && head.startsWith(TAURI_STALE_CALLBACK_WARN);
}

let installed = false;
let uninstall: (() => void) | null = null;

/**
 * Suppress expected reload/cleanup console noise:
 * - WaveSurfer `Progress tracking error:` + AbortError (cancelled fetch clone)
 * - Tauri stale IPC callback after webview reload during an in-flight command
 *
 * Other warnings are forwarded via Reflect.apply. CM measure warnings are
 * prefixed `[codemirror]` so WKWebView stacks are not mistaken for this file.
 */
export function installWaveSurferProgressAbortWarnFilter(): void {
  if (installed || typeof console === "undefined") return;
  installed = true;
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    if (isExpectedReloadNoise(args)) return;
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
