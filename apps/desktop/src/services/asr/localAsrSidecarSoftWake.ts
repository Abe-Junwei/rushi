import { asrSupervisorSnapshot } from "../../tauri/asrSetupApi";
import { tryStartBundledAsrSidecar } from "../../tauri/projectAsrMaintenanceApi";
import { idleStoppedAfterSuccess } from "./asrSupervisorPresentation";
import { pollLoopbackHealthUntil } from "./asrHealthSnapshot";

export type SoftWakeIdleSidecarResult =
  | { status: "skipped"; reason: "not_idle_sleep" | "no_supervisor" }
  | { status: "woke"; healthOk: boolean }
  | { status: "failed"; message: string };

/**
 * If supervisor reports intentional idle-stop, try_start bundled sidecar and poll /health.
 * Does not force-kill foreign listeners (unlike retryBundledAsrSidecar).
 */
export async function softWakeIdleSidecar(options?: {
  deadlineMs?: number;
}): Promise<SoftWakeIdleSidecarResult> {
  let snap;
  try {
    snap = await asrSupervisorSnapshot();
  } catch {
    return { status: "skipped", reason: "no_supervisor" };
  }
  if (!idleStoppedAfterSuccess(snap)) {
    return { status: "skipped", reason: "not_idle_sleep" };
  }
  try {
    await tryStartBundledAsrSidecar();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { status: "failed", message: message || "try_start_bundled_asr_sidecar failed" };
  }
  const caps = await pollLoopbackHealthUntil({
    deadlineMs: options?.deadlineMs ?? 60_000,
    intervalMs: 800,
    predicate: () => true,
  });
  return { status: "woke", healthOk: caps != null };
}
