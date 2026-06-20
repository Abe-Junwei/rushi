import { initialSetupSteps, patchStep } from "../../pages/asrSetupState";
import { REFRESH_ASR_RUNTIME_LIGHT_DURING_PREPARE } from "../../pages/asrRuntimeRefreshOptions";
import { runAsrOneClickPrepareDiagnose } from "./asrOneClickPrepareDiagnose";
import { runAsrOneClickPrepareModelFlow } from "./asrOneClickPrepareModelFlow";
import { runAsrOneClickPrepareSidecarHealth } from "./asrOneClickPrepareSidecarHealth";
import type { AsrOneClickPrepareCallbacks, AsrOneClickPrepareDeps } from "./asrOneClickPrepareTypes";

export type { AsrOneClickPrepareCallbacks, AsrOneClickPrepareDeps } from "./asrOneClickPrepareTypes";

export async function runAsrOneClickPrepareFlow(
  deps: AsrOneClickPrepareDeps,
  cb: AsrOneClickPrepareCallbacks,
): Promise<void> {
  const { setSetupSteps, setSetupMessage, setSetupOutcome } = cb;

  setSetupSteps(initialSetupSteps());
  try {
    const ctx = await runAsrOneClickPrepareDiagnose(deps, cb);
    if (!ctx) return;

    const healthOk = await runAsrOneClickPrepareSidecarHealth(ctx.report, cb);
    if (!healthOk) return;

    await runAsrOneClickPrepareModelFlow(deps, cb, ctx);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    setSetupSteps((steps) =>
      patchStep(steps, "done", {
        status: "error",
        detail: "一键准备过程中出现未处理异常",
      }),
    );
    setSetupMessage(`一键准备失败：${msg}`);
    setSetupOutcome("error");
  } finally {
    await deps.refreshAsrRuntimeInfo(REFRESH_ASR_RUNTIME_LIGHT_DURING_PREPARE);
  }
}
