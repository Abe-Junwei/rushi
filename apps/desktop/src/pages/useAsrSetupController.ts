import { useState, type MutableRefObject } from "react";
import type { RefreshAsrRuntimeOptions } from "./asrRuntimeRefreshOptions";
import { isTauriRuntime } from "../config/env";
import type { AsrSetupOutcome, AsrSetupReport, AsrSetupStep } from "../services/asr/asrSetupContract";
import type { LocalRuntimeDiagnose } from "../services/localRuntime/localRuntimeContract";
import { initialSetupSteps } from "./asrSetupState";
import { useAsrOneClickPrepare } from "./useAsrOneClickPrepare";
import { useAsrSetupDiagnose } from "./useAsrSetupDiagnose";
import { useAsrSetupHealthFlow } from "./useAsrSetupHealthFlow";
import { useLocalRuntimeSetupSupport } from "./useLocalRuntimeSetupSupport";

export interface AsrSetupControllerApi {
  setupReport: AsrSetupReport | null;
  localRuntimeDiag: LocalRuntimeDiagnose | null;
  setupSteps: AsrSetupStep[];
  setupBusy: boolean;
  diagnoseBusy: boolean;
  setupMessage: string;
  setupOutcome: AsrSetupOutcome;
  portConflict: boolean;
  refreshSetupDiagnose: (options?: {
    resetSteps?: boolean;
    touchUi?: boolean;
  }) => Promise<AsrSetupReport | null>;
  refreshLocalRuntimeDiagnose: () => Promise<LocalRuntimeDiagnose | null>;
  downloadLocalRuntime: () => Promise<void>;
  cancelLocalRuntime: () => Promise<void>;
  revalidateLocalRuntime: () => Promise<void>;
  clearLocalRuntime: () => Promise<void>;
  restorePreviousLocalRuntime: () => Promise<void>;
  runOneClickAsrPrepare: () => Promise<void>;
  acceptForeignPortService: () => Promise<void>;
}

export function useAsrSetupController(deps: {
  refreshAsrHealth: () => Promise<void>;
  refreshAsrRuntimeInfo: (options?: RefreshAsrRuntimeOptions) => Promise<void>;
  prepareDefaultFunasrModel: (options?: import("./usePrepareModelController").PrepareDefaultModelOptions) => Promise<void>;
  getSetupSelection: () => import("../services/asr/localAsrSetupModelStep").LocalAsrSetupSelectionContext;
  prepareOverlayRef?: MutableRefObject<import("./asrSetupState").StepsFromReportOptions | null>;
}): AsrSetupControllerApi {
  const tauriRuntime = isTauriRuntime();
  const [setupReport, setSetupReport] = useState<AsrSetupReport | null>(null);
  const [setupSteps, setSetupSteps] = useState<AsrSetupStep[]>(initialSetupSteps());
  const [setupBusy, setSetupBusy] = useState(false);
  const [diagnoseBusy, setDiagnoseBusy] = useState(false);
  const [setupMessage, setSetupMessage] = useState("");
  const [setupOutcome, setSetupOutcome] = useState<AsrSetupOutcome>("idle");
  const [portConflictAcknowledged, setPortConflictAcknowledged] = useState(false);
  const portConflict = setupReport?.portStatus === "foreign" && !portConflictAcknowledged;

  const {
    localRuntimeDiag,
    refreshLocalRuntimeDiagnose,
    downloadLocalRuntime,
    cancelLocalRuntime,
    revalidateLocalRuntime,
    clearLocalRuntime,
    restorePreviousLocalRuntime,
    ensureLocalRuntimeInstalled,
  } = useLocalRuntimeSetupSupport({
    tauriRuntime,
    refreshEnvironmentDiagnostics: deps.refreshAsrRuntimeInfo,
    setSetupSteps,
    setSetupMessage,
    setSetupOutcome,
  });

  const { refreshSetupDiagnose } = useAsrSetupDiagnose({
    tauriRuntime,
    refreshLocalRuntimeDiagnose,
    setSetupReport,
    setSetupSteps,
    setDiagnoseBusy,
    setPortConflictAcknowledged,
    setSetupMessage,
    setSetupOutcome,
    prepareOverlayRef: deps.prepareOverlayRef,
  });

  const { pollUntilHealth, acceptForeignPortService } = useAsrSetupHealthFlow({
    deps,
    refreshSetupDiagnose: (options?: { resetSteps?: boolean; touchUi?: boolean }) =>
      refreshSetupDiagnose({ resetSteps: false, touchUi: false, ...options }),
    markPortConflictAcknowledged: () => setPortConflictAcknowledged(true),
    setSetupBusy,
    setSetupSteps,
    setSetupMessage,
    setSetupOutcome,
  });

  const { runOneClickAsrPrepare } = useAsrOneClickPrepare({
    tauriRuntime,
    deps,
    refreshSetupDiagnose,
    refreshLocalRuntimeDiagnose,
    ensureLocalRuntimeInstalled,
    pollUntilHealth,
    setSetupBusy,
    setPortConflictAcknowledged,
    setSetupSteps,
    setSetupMessage,
    setSetupOutcome,
  });

  return {
    setupReport,
    localRuntimeDiag,
    setupSteps,
    setupBusy,
    diagnoseBusy,
    setupMessage,
    setupOutcome,
    portConflict,
    refreshSetupDiagnose,
    refreshLocalRuntimeDiagnose,
    downloadLocalRuntime,
    cancelLocalRuntime,
    revalidateLocalRuntime,
    clearLocalRuntime,
    restorePreviousLocalRuntime,
    runOneClickAsrPrepare,
    acceptForeignPortService,
  };
}
