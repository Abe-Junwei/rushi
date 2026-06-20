import { patchStep } from "../../pages/asrSetupState";
import {
  applyPortForeignBlocked,
  finishOneClickIfAlreadyReady,
} from "./asrOneClickPrepareReady";
import type {
  AsrOneClickPrepareCallbacks,
  AsrOneClickPrepareContext,
  AsrOneClickPrepareDeps,
  AsrOneClickPrepareUi,
} from "./asrOneClickPrepareTypes";

export async function runAsrOneClickPrepareDiagnose(
  deps: AsrOneClickPrepareDeps,
  cb: AsrOneClickPrepareCallbacks,
): Promise<AsrOneClickPrepareContext | null> {
  const { refreshSetupDiagnose, ensureLocalRuntimeInstalled, setSetupSteps, setSetupMessage, setSetupOutcome } =
    cb;
  const ui: AsrOneClickPrepareUi = { setSetupSteps, setSetupMessage, setSetupOutcome };

  setSetupSteps((steps) =>
    patchStep(steps, "diagnose", {
      status: "running",
      detail: "正在读取本机环境…",
    }),
  );
  const selection = deps.getSetupSelection();
  const firstReport = await refreshSetupDiagnose({
    resetSteps: false,
    touchUi: false,
    skipLocalRuntimeDiagnose: true,
  });
  if (!firstReport) {
    setSetupSteps((steps) => patchStep(steps, "diagnose", { status: "error", detail: "诊断失败" }));
    setSetupOutcome("error");
    return null;
  }
  let report = firstReport;

  setSetupSteps((steps) =>
    patchStep(steps, "diagnose", {
      status: "ok",
      detail: report.summaryLines[0] ?? "诊断完成",
    }),
  );

  if (report.sidecarIntegrity === "corrupt") {
    if (report.bundledAvailable) {
      setSetupSteps((steps) =>
        patchStep(steps, "diagnose", {
          status: "ok",
          detail: "将尝试重启内置侧车（不依赖应用数据 manifest）",
        }),
      );
    } else {
      const repaired = await ensureLocalRuntimeInstalled("repair");
      if (!repaired) return null;
      const refreshed = await refreshSetupDiagnose({ resetSteps: false, touchUi: false });
      if (!refreshed) {
        setSetupMessage("修复侧车后刷新诊断失败，请重试。");
        setSetupOutcome("error");
        return null;
      }
      report = refreshed;
    }
  }
  if (report.portStatus === "foreign") {
    if (report.health.healthReachable) {
      report = { ...report, portStatus: "rushi_asr" };
    } else if (report.blockingIssue) {
      applyPortForeignBlocked(ui, report);
      return null;
    }
  }
  if (await finishOneClickIfAlreadyReady(deps, ui, report, selection)) {
    return null;
  }
  if (!report.health.healthReachable && !report.bundledAvailable) {
    const installed = await ensureLocalRuntimeInstalled("missing");
    if (!installed) return null;
    const refreshed = await refreshSetupDiagnose({ resetSteps: false, touchUi: false });
    if (!refreshed) {
      setSetupMessage("下载安装侧车后刷新诊断失败，请重试。");
      setSetupOutcome("error");
      return null;
    }
    report = refreshed;
  }

  return { report, selection };
}
