import { useCallback, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { packagedOrDev } from "../services/packagedUserHints";
import type { AsrSetupOutcome, AsrSetupReport, AsrSetupStep } from "../services/asr/asrSetupContract";
import type { LocalRuntimeDiagnose } from "../services/localRuntime/localRuntimeContract";
import * as asrSetupApi from "../tauri/asrSetupApi";
import { initialSetupSteps, outcomeFromReport, patchStep, stepsFromReport, type StepsFromReportOptions } from "./asrSetupState";

type RefreshSetupDiagnoseOptions = {
  resetSteps?: boolean;
  touchUi?: boolean;
  skipLocalRuntimeDiagnose?: boolean;
};

type DiagnoseInflightOptions = {
  resetSteps: boolean;
  touchUi: boolean;
  skipLocalRuntimeDiagnose: boolean;
};

function normalizeDiagnoseOptions(options?: RefreshSetupDiagnoseOptions): DiagnoseInflightOptions {
  return {
    resetSteps: options?.resetSteps !== false,
    touchUi: options?.touchUi !== false,
    skipLocalRuntimeDiagnose: options?.skipLocalRuntimeDiagnose === true,
  };
}

function mergeDiagnoseOptions(
  current: DiagnoseInflightOptions,
  incoming?: RefreshSetupDiagnoseOptions,
): DiagnoseInflightOptions {
  if (!incoming) return current;
  const next = normalizeDiagnoseOptions(incoming);
  return {
    resetSteps: current.resetSteps && next.resetSteps,
    touchUi: current.touchUi && next.touchUi,
    skipLocalRuntimeDiagnose: current.skipLocalRuntimeDiagnose || next.skipLocalRuntimeDiagnose,
  };
}

export function useAsrSetupDiagnose(args: {
  tauriRuntime: boolean;
  refreshLocalRuntimeDiagnose: () => Promise<LocalRuntimeDiagnose | null>;
  setSetupReport: Dispatch<SetStateAction<AsrSetupReport | null>>;
  setSetupSteps: Dispatch<SetStateAction<AsrSetupStep[]>>;
  setDiagnoseBusy: Dispatch<SetStateAction<boolean>>;
  setPortConflictAcknowledged: Dispatch<SetStateAction<boolean>>;
  setSetupMessage: Dispatch<SetStateAction<string>>;
  setSetupOutcome: Dispatch<SetStateAction<AsrSetupOutcome>>;
  prepareOverlayRef?: MutableRefObject<StepsFromReportOptions | null>;
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
    prepareOverlayRef,
  } = args;

  const diagnoseInflightRef = useRef<Promise<AsrSetupReport | null> | null>(null);
  const diagnoseOptionsRef = useRef<DiagnoseInflightOptions>(normalizeDiagnoseOptions());

  const refreshSetupDiagnose = useCallback(
    async (options?: RefreshSetupDiagnoseOptions): Promise<AsrSetupReport | null> => {
      if (!tauriRuntime) {
        setSetupMessage("浏览器预览无法运行环境诊断，请在桌面应用中使用。");
        setSetupOutcome("error");
        setSetupReport(null);
        return null;
      }

      if (diagnoseInflightRef.current) {
        diagnoseOptionsRef.current = mergeDiagnoseOptions(diagnoseOptionsRef.current, options);
        return diagnoseInflightRef.current;
      }

      diagnoseOptionsRef.current = normalizeDiagnoseOptions(options);
      const { resetSteps, touchUi } = diagnoseOptionsRef.current;
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

      const inflight = (async (): Promise<AsrSetupReport | null> => {
        const runOptions = diagnoseOptionsRef.current;
        try {
          const [report] = await Promise.all([
            asrSetupApi.asrSetupDiagnose(),
            runOptions.skipLocalRuntimeDiagnose
              ? Promise.resolve(null)
              : refreshLocalRuntimeDiagnose(),
          ]);
          setSetupReport(report);
          if (runOptions.touchUi) {
            setSetupMessage(report.blockingIssue ?? "");
            setSetupOutcome(outcomeFromReport(report));
          }
          if (runOptions.resetSteps) {
            setSetupSteps(stepsFromReport(report, prepareOverlayRef?.current ?? undefined));
          }
          return report;
        } catch (error) {
          const msg = error instanceof Error ? error.message : String(error);
          setSetupMessage(
            `诊断失败：${msg}。${packagedOrDev(
              "若刚更新代码，请完全退出并重新运行 desktop:dev 以加载新 Tauri 命令。",
              "请完全退出应用后重新打开；仍失败请重新安装最新版本。",
            )}`,
          );
          setSetupOutcome("error");
          setSetupReport(null);
          if (runOptions.resetSteps) {
            setSetupSteps(
              patchStep(initialSetupSteps(), "diagnose", {
                status: "error",
                detail: msg.slice(0, 120),
              }),
            );
          }
          return null;
        } finally {
          diagnoseInflightRef.current = null;
          setDiagnoseBusy(false);
        }
      })();

      diagnoseInflightRef.current = inflight;
      return inflight;
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
      prepareOverlayRef,
    ],
  );

  return { refreshSetupDiagnose };
}
