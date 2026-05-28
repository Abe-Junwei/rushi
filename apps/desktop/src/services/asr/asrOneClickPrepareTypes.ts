import type { Dispatch, SetStateAction } from "react";
import type { AsrSetupOutcome, AsrSetupReport, AsrSetupStep } from "./asrSetupContract";
import type { LocalAsrSetupSelectionContext } from "./localAsrSetupModelStep";
import type { LocalRuntimeDiagnose } from "../localRuntime/localRuntimeContract";

export type AsrOneClickPrepareDeps = {
  refreshAsrHealth: () => Promise<void>;
  refreshAsrRuntimeInfo: () => Promise<void>;
  prepareDefaultFunasrModel: (options?: import("../../pages/usePrepareModelController").PrepareDefaultModelOptions) => Promise<void>;
  getSetupSelection: () => LocalAsrSetupSelectionContext;
};

export type AsrOneClickPrepareCallbacks = {
  refreshSetupDiagnose: (options?: {
    resetSteps?: boolean;
    touchUi?: boolean;
  }) => Promise<AsrSetupReport | null>;
  refreshLocalRuntimeDiagnose: () => Promise<LocalRuntimeDiagnose | null>;
  ensureLocalRuntimeInstalled: (reason: "missing" | "repair") => Promise<boolean>;
  pollUntilHealth: () => Promise<boolean>;
  setSetupSteps: Dispatch<SetStateAction<AsrSetupStep[]>>;
  setSetupMessage: Dispatch<SetStateAction<string>>;
  setSetupOutcome: Dispatch<SetStateAction<AsrSetupOutcome>>;
};

export type AsrOneClickPrepareUi = Pick<
  AsrOneClickPrepareCallbacks,
  "setSetupSteps" | "setSetupMessage" | "setSetupOutcome"
>;

export type AsrOneClickPrepareContext = {
  report: AsrSetupReport;
  selection: LocalAsrSetupSelectionContext;
};
