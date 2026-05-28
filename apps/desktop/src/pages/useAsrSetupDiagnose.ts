import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { AsrSetupOutcome, AsrSetupReport, AsrSetupStep } from "../services/asr/asrSetupContract";
import type { LocalRuntimeDiagnose } from "../services/localRuntime/localRuntimeContract";
import * as asrSetupApi from "../tauri/asrSetupApi";
import { initialSetupSteps, outcomeFromReport, patchStep, stepsFromReport } from "./asrSetupState";

export function useAsrSetupDiagnose(args: {
  tauriRuntime: boolean;
  refreshLocalRuntimeDiagnose: () => Promise<LocalRuntimeDiagnose | null>;
  setSetupReport: Dispatch<SetStateAction<AsrSetupReport | null>>;
  setSetupSteps: Dispatch<SetStateAction<AsrSetupStep[]>>;
  setDiagnoseBusy: Dispatch<SetStateAction<boolean>>;
  setPortConflictAcknowledged: Dispatch<SetStateAction<boolean>>;
  setSetupMessage: Dispatch<SetStateAction<string>>;
  setSetupOutcome: Dispatch<SetStateAction<AsrSetupOutcome>>;
}) {
  const {
    tauriRuntime,
    refreshLocalRuntimeDiagnose,
    setSetupReport,
    setSetupSteps,
    setDiagnoseBusy,
    setPortConflictAcknowledged,
    setSetupMessage,
    setSetupOutcome,
  } = args;

  const refreshSetupDiagnose = useCallback(
    async (options?: {
      resetSteps?: boolean;
      /** When false, do not reset wizard message/outcome (used during one-click prepare). */
      touchUi?: boolean;
    }): Promise<AsrSetupReport | null> => {
      if (!tauriRuntime) {
        setSetupMessage("浏览器预览无法运行环境诊断，请在桌面应用中使用。");
        setSetupOutcome("error");
        setSetupReport(null);
        return null;
      }

      const resetSteps = options?.resetSteps !== false;
      const touchUi = options?.touchUi !== false;
      setDiagnoseBusy(true);
      if (touchUi) {
        setPortConflictAcknowledged(false);
        setSetupMessage("");
        setSetupOutcome("idle");
      }
      if (resetSteps) {
        setSetupSteps(
          patchStep(initialSetupSteps(), "diagnose", {
            status: "running",
            detail: "正在读取本机环境…",
          }),
        );
      }

      try {
        const [report] = await Promise.all([
          asrSetupApi.asrSetupDiagnose(),
          refreshLocalRuntimeDiagnose(),
        ]);
        setSetupReport(report);
        if (touchUi) {
          setSetupMessage(report.blockingIssue ?? "");
          setSetupOutcome(outcomeFromReport(report));
        }
        if (resetSteps) {
          setSetupSteps(stepsFromReport(report));
        }
        return report;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        setSetupMessage(
          `诊断失败：${msg}。若刚更新代码，请完全退出并重新运行 desktop:dev 以加载新 Tauri 命令。`,
        );
        setSetupOutcome("error");
        setSetupReport(null);
        if (resetSteps) {
          setSetupSteps(
            patchStep(initialSetupSteps(), "diagnose", {
              status: "error",
              detail: msg.slice(0, 120),
            }),
          );
        }
        return null;
      } finally {
        setDiagnoseBusy(false);
      }
    },
    [
      refreshLocalRuntimeDiagnose,
      setDiagnoseBusy,
      setPortConflictAcknowledged,
      setSetupMessage,
      setSetupOutcome,
      setSetupReport,
      setSetupSteps,
      tauriRuntime,
    ],
  );

  return { refreshSetupDiagnose };
}
