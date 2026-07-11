import type { PrepareModelFailureCopy } from "./prepareModelDownloadCopy";
import type { BundledCopyPresentationSync } from "../services/asr/bundledAsrModelsSeedPrepare";

export type PrepareDefaultModelOptions = {
  /** When true, still call sidecar prepare even if UI shows cached (re-verify / resume). */
  force?: boolean;
  /** Internal: skip auto-resume after a network-sidecar failure. */
  skipAutoResume?: boolean;
};

export type PrepareProgressSetOptions = {
  allowDecrease?: boolean;
  monotonic?: boolean;
};

export interface PrepareModelApi {
  prepareModelBusy: boolean;
  prepareModelCancelling: boolean;
  prepareModelProgress: number;
  prepareModelFailure: PrepareModelFailureCopy | null;
  funasrInstallMessage: string;
  prepareDefaultFunasrModel: (options?: PrepareDefaultModelOptions) => Promise<void>;
  cancelPrepareModel: () => Promise<void>;
  bundledCopyPresentationSync: BundledCopyPresentationSync;
  setPrepareModelFailure: (v: PrepareModelFailureCopy | null) => void;
  setFunasrInstallMessage: (v: string) => void;
}
