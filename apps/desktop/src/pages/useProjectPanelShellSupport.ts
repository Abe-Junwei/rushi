import { useCallback, useEffect, useState } from "react";
import type { SegmentContextMenuOpen } from "../utils/segmentContextMenuModel";

export function useProjectPanelEnvironmentShell() {
  const [envOpen, setEnvOpen] = useState(false);
  const [focusLocalAsrSeq, setFocusLocalAsrSeq] = useState(0);
  const [focusLlmSeq, setFocusLlmSeq] = useState(0);
  const [llmUiEpoch, setLlmUiEpoch] = useState(0);

  const openEnvironment = useCallback(() => {
    setEnvOpen(true);
  }, []);

  const openAsrSettings = useCallback(() => {
    setFocusLlmSeq(0);
    setEnvOpen(true);
    setFocusLocalAsrSeq((n) => n + 1);
  }, []);

  const openLlmSettings = useCallback(() => {
    setFocusLocalAsrSeq(0);
    setEnvOpen(true);
    setFocusLlmSeq((n) => n + 1);
  }, []);

  useEffect(() => {
    if (envOpen) return;
    setFocusLocalAsrSeq(0);
    setFocusLlmSeq(0);
  }, [envOpen]);

  const notifyLlmRuntimeChanged = useCallback((bumpLlmRuntimeChanged: () => void) => {
    bumpLlmRuntimeChanged();
    setLlmUiEpoch((n) => n + 1);
  }, []);

  return {
    envOpen,
    setEnvOpen,
    focusLocalAsrSeq,
    focusLlmSeq,
    llmUiEpoch,
    openEnvironment,
    openAsrSettings,
    openLlmSettings,
    notifyLlmRuntimeChanged,
  };
}

export function useProjectPanelExportShell(args: {
  busy: boolean;
  flushSegmentTextDrafts: () => void;
  deliveryModeOpen: boolean;
  isIndexInSelection: (idx: number) => boolean;
  selectSegmentAt: (idx: number) => void;
  selectionCount: number;
  exportTxt: () => Promise<void>;
  exportSrt: () => Promise<void>;
  exportDocx: (mode: "verbatim" | "lecture" | "clean") => Promise<void>;
  openDeliveryMode: () => void;
  setTranscribeFailureDiag: (value: null) => void;
  setError: (value: string) => void;
  cancelTranscribe: () => Promise<void>;
}) {
  const [exportKey, setExportKey] = useState("");
  const [deliveryExportOpen, setDeliveryExportOpen] = useState(false);
  const [busyElapsedSec, setBusyElapsedSec] = useState(0);
  const [segmentCtxMenu, setSegmentCtxMenu] = useState<SegmentContextMenuOpen | null>(null);

  useEffect(() => {
    if (!deliveryExportOpen && !args.deliveryModeOpen) return;
    args.flushSegmentTextDrafts();
  }, [deliveryExportOpen, args.deliveryModeOpen, args.flushSegmentTextDrafts]);

  useEffect(() => {
    if (!args.busy) {
      setBusyElapsedSec(0);
      return;
    }
    const t0 = Date.now();
    const id = window.setInterval(() => {
      setBusyElapsedSec(Math.floor((Date.now() - t0) / 1000));
    }, 500);
    return () => window.clearInterval(id);
  }, [args.busy]);

  const openSegmentContextMenu = useCallback(
    (menu: SegmentContextMenuOpen) => {
      const preserveMulti = args.isIndexInSelection(menu.segmentIdx) && args.selectionCount > 1;
      if (!preserveMulti) {
        args.selectSegmentAt(menu.segmentIdx);
      }
      setSegmentCtxMenu(menu);
    },
    [args.isIndexInSelection, args.selectSegmentAt, args.selectionCount],
  );

  const onExportSelect = useCallback(
    (key: string) => {
      setExportKey("");
      switch (key) {
        case "txt":
          void args.exportTxt();
          break;
        case "srt":
          void args.exportSrt();
          break;
        case "docx_delivery":
          setDeliveryExportOpen(true);
          break;
        case "delivery_mode":
          args.openDeliveryMode();
          break;
        case "docx_verbatim":
          void args.exportDocx("verbatim");
          break;
        case "docx_lecture":
          void args.exportDocx("lecture");
          break;
        case "docx_clean":
          void args.exportDocx("clean");
          break;
        default:
          break;
      }
    },
    [args],
  );

  const dismissTranscribeDiag = useCallback(() => {
    args.setTranscribeFailureDiag(null);
    args.setError("");
  }, [args]);

  const cancelTranscribe = useCallback(() => {
    void args.cancelTranscribe();
  }, [args]);

  return {
    exportKey,
    deliveryExportOpen,
    setDeliveryExportOpen,
    busyElapsedSec,
    segmentCtxMenu,
    setSegmentCtxMenu,
    openSegmentContextMenu,
    onExportSelect,
    dismissTranscribeDiag,
    cancelTranscribe,
  };
}
