import { fetchAppBuildInfo } from "../tauri/appInfoApi";
import { logRuntimeParity } from "./runtimeParity";

function shortPathState(path: string | null | undefined): "present" | "missing" {
  return path && path.trim().length > 0 ? "present" : "missing";
}

/** One-shot release parity evidence emitted before React mounts. */
export async function logRuntimeParityBootstrap(): Promise<void> {
  try {
    const info = await fetchAppBuildInfo();
    logRuntimeParity(
      "startup",
      `profile=${info.shellProfile} platform=${info.platformOs}-${info.platformArch}`,
    );
    logRuntimeParity(
      "bundle",
      `asr_shell_managed=${info.asrShellManaged} bundled_sidecar_build=${info.bundledSidecarBuild ? "present" : "missing"}`,
      info.asrShellManaged && !info.bundledSidecarBuild ? "WARN" : "INFO",
    );
    logRuntimeParity(
      "project",
      `app_data_root=${shortPathState(info.appDataRoot)} db_path=${shortPathState(info.dbPath)}`,
      !info.appDataRoot || !info.dbPath ? "WARN" : "INFO",
    );
    logRuntimeParity("asr", `shell_managed=${info.asrShellManaged}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logRuntimeParity("startup", `bootstrap_failed=${msg.slice(0, 120)}`, "WARN");
  }
}
