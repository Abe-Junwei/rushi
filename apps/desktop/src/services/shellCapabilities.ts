import { invoke } from "@tauri-apps/api/core";
import { isTauriRuntime } from "../config/env";

let shellManagesBundledSidecar: boolean | null = null;
let loadPromise: Promise<boolean> | null = null;

/** Rust truth: bundled sidecar lifecycle managed by shell (release default; dev when skip unset). */
export async function readShellManagesBundledSidecar(): Promise<boolean> {
  if (!isTauriRuntime()) {
    shellManagesBundledSidecar = false;
    return false;
  }
  if (shellManagesBundledSidecar != null) return shellManagesBundledSidecar;
  if (!loadPromise) {
    loadPromise = invoke<boolean>("asr_app_manages_bundled_sidecar")
      .then((v) => {
        shellManagesBundledSidecar = v;
        return v;
      })
      .catch(() => {
        shellManagesBundledSidecar = false;
        return false;
      });
  }
  return loadPromise;
}

/**
 * Sync read after {@link bootstrapShellCapabilities} (main.tsx).
 * Prefer this over `isPackagedDesktopApp()` for dev/release behavior branching.
 */
export function readShellManagesBundledSidecarSync(): boolean {
  if (!isTauriRuntime()) return false;
  return shellManagesBundledSidecar === true;
}

/** Call once before React mount so packagedOrDev / ASR hints use Rust truth. */
export async function bootstrapShellCapabilities(): Promise<void> {
  await readShellManagesBundledSidecar();
}
