import { useCallback, useEffect, useMemo, useState } from "react";
import type { SegmentContextMenuOpen } from "../utils/segmentContextMenuModel";
import { useOnboardingAutoSync } from "../hooks/useOnboardingAutoSync";
import { registerDeliveryModeTranscribeAction } from "../services/deliveryModeTranscribeToast";
import { useDeliveryModeController } from "./useDeliveryModeController";
import { useProjectController } from "./useProjectController";
import { useProjectPanelWorkspaceNav } from "./useProjectPanelWorkspaceNav";

export type ProjectPanelShellApi = ReturnType<typeof useProjectPanelShell>;

/** Shell-level UI state and routing for the project workspace (not project domain logic). */
export function useProjectPanelShell() {
  const c = useProjectController();
  const deliveryMode = useDeliveryModeController();
  const nav = useProjectPanelWorkspaceNav(c);

  const [envOpen, setEnvOpen] = useState(false);
  const [focusLocalAsrSeq, setFocusLocalAsrSeq] = useState(0);
  const [focusLlmSeq, setFocusLlmSeq] = useState(0);
  const [llmUiEpoch, setLlmUiEpoch] = useState(0);
  const [exportKey, setExportKey] = useState("");
  const [deliveryExportOpen, setDeliveryExportOpen] = useState(false);
  const [busyElapsedSec, setBusyElapsedSec] = useState(0);
  const [segmentCtxMenu, setSegmentCtxMenu] = useState<SegmentContextMenuOpen | null>(null);

  useOnboardingAutoSync({ controller: c, asrChipOk: c.asrPresentation.chipOk });

  useEffect(() => {
    registerDeliveryModeTranscribeAction(deliveryMode.openDeliveryMode);
    return () => registerDeliveryModeTranscribeAction(null);
  }, [deliveryMode.openDeliveryMode]);

  useEffect(() => {
    if (!deliveryExportOpen && !deliveryMode.deliveryModeOpen) return;
    c.flushSegmentTextDrafts();
  }, [deliveryExportOpen, deliveryMode.deliveryModeOpen, c.flushSegmentTextDrafts]);

  useEffect(() => {
    if (!c.busy) {
      setBusyElapsedSec(0);
      return;
    }
    const t0 = Date.now();
    const id = window.setInterval(() => {
      setBusyElapsedSec(Math.floor((Date.now() - t0) / 1000));
    }, 500);
    return () => window.clearInterval(id);
  }, [c.busy]);

  const openEnvironment = useCallback(() => {
    setEnvOpen(true);
  }, []);

  const openAsrSettings = useCallback(() => {
    setEnvOpen(true);
    setFocusLocalAsrSeq((n) => n + 1);
  }, []);

  const openLlmSettings = useCallback(() => {
    setEnvOpen(true);
    setFocusLlmSeq((n) => n + 1);
  }, []);

  const notifyLlmRuntimeChanged = useCallback(() => {
    c.bumpLlmRuntimeChanged();
    setLlmUiEpoch((n) => n + 1);
  }, [c]);

  const showTranscribeGlossaryLink = useMemo(
    () => c.transcribeVocabularyPreflightLines.some((line) => line.includes("暂无纳入热词")),
    [c.transcribeVocabularyPreflightLines],
  );

  const openSegmentContextMenu = useCallback(
    (menu: SegmentContextMenuOpen) => {
      const preserveMulti = c.isIndexInSelection(menu.segmentIdx) && c.selectionCount > 1;
      if (!preserveMulti) {
        c.selectSegmentAt(menu.segmentIdx);
      }
      setSegmentCtxMenu(menu);
    },
    [c.isIndexInSelection, c.selectSegmentAt, c.selectionCount],
  );

  const onExportSelect = useCallback(
    (key: string) => {
      setExportKey("");
      switch (key) {
        case "txt":
          void c.exportTxt();
          break;
        case "srt":
          void c.exportSrt();
          break;
        case "docx_delivery":
          setDeliveryExportOpen(true);
          break;
        case "delivery_mode":
          deliveryMode.openDeliveryMode();
          break;
        case "docx_verbatim":
          void c.exportDocx("verbatim");
          break;
        case "docx_lecture":
          void c.exportDocx("lecture");
          break;
        case "docx_clean":
          void c.exportDocx("clean");
          break;
        default:
          break;
      }
    },
    [c, deliveryMode.openDeliveryMode],
  );

  const dismissTranscribeDiag = useCallback(() => {
    c.setTranscribeFailureDiag(null);
    c.setError("");
  }, [c]);

  const cancelTranscribe = useCallback(() => {
    void c.cancelTranscribe();
  }, [c]);

  return {
    c,
    deliveryMode,
    envOpen,
    setEnvOpen,
    focusLocalAsrSeq,
    focusLlmSeq,
    llmUiEpoch,
    exportKey,
    deliveryExportOpen,
    setDeliveryExportOpen,
    busyElapsedSec,
    segmentCtxMenu,
    setSegmentCtxMenu,
    openEnvironment,
    openAsrSettings,
    openLlmSettings,
    notifyLlmRuntimeChanged,
    showTranscribeGlossaryLink,
    openSegmentContextMenu,
    onExportSelect,
    dismissTranscribeDiag,
    cancelTranscribe,
    ...nav,
  };
}
