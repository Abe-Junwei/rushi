import { useCallback, useEffect, useMemo } from "react";
import { useOnboardingAutoSync } from "../hooks/useOnboardingAutoSync";
import { syncOnboardingExport } from "../services/onboarding/onboardingAutoSync";
import { registerDeliveryModeTranscribeAction } from "../services/deliveryModeTranscribeToast";
import { useDeliveryModeController } from "./useDeliveryModeController";
import { useProjectController } from "./useProjectController";
import { useProjectPanelWorkspaceNav } from "./useProjectPanelWorkspaceNav";
import {
  useProjectPanelEnvironmentShell,
  useProjectPanelExportShell,
} from "./useProjectPanelShellSupport";

/** Shell-level UI state and routing for the project workspace (not project domain logic). */
export function useProjectPanelShell() {
  const c = useProjectController();
  const deliveryMode = useDeliveryModeController();
  const nav = useProjectPanelWorkspaceNav(c);
  const envShell = useProjectPanelEnvironmentShell();

  useOnboardingAutoSync({ controller: c });

  /* eslint-disable react-hooks/exhaustive-deps -- deliveryMode is a stable controller; only openDeliveryMode method is used */
  useEffect(() => {
    registerDeliveryModeTranscribeAction(() => {
      syncOnboardingExport();
      deliveryMode.openDeliveryMode();
    });
    return () => registerDeliveryModeTranscribeAction(null);
  }, [deliveryMode.openDeliveryMode]);
  /* eslint-enable react-hooks/exhaustive-deps */

  const exportShell = useProjectPanelExportShell({
    busy: c.busy,
    flushSegmentTextDrafts: c.flushSegmentTextDrafts,
    deliveryModeOpen: deliveryMode.deliveryModeOpen,
    isIndexInSelection: c.isIndexInSelection,
    selectSegmentAt: c.selectSegmentAt,
    selectionCount: c.selectionCount,
    exportTxt: c.exportTxt,
    exportSrt: c.exportSrt,
    exportDocx: c.exportDocx,
    openDeliveryMode: deliveryMode.openDeliveryMode,
    setTranscribeFailureDiag: c.setTranscribeFailureDiag,
    setError: c.setError,
    cancelTranscribe: c.cancelTranscribe,
  });

  const notifyLlmRuntimeChanged = useCallback(() => {
    envShell.notifyLlmRuntimeChanged(c.bumpLlmRuntimeChanged);
  }, [c.bumpLlmRuntimeChanged, envShell]);

  const showTranscribeGlossaryLink = useMemo(
    () => c.transcribeVocabularyPreflightLines.some((line) => line.includes("暂无纳入热词")),
    [c.transcribeVocabularyPreflightLines],
  );

  return {
    c,
    deliveryMode,
    ...envShell,
    notifyLlmRuntimeChanged,
    showTranscribeGlossaryLink,
    ...exportShell,
    ...nav,
  };
}
