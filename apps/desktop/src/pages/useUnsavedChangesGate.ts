import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  ensureAppWindowCloseGuardRegistered,
  setAppWindowCloseGuardBridge,
} from "../services/appWindowCloseGuard";
import { segmentDraftStore } from "../hooks/useSegmentDraftStore";

export type UnsavedGateIntent = "app-quit" | "navigate";

export interface UnsavedChangesGateApi {
  closeGateOpen: boolean;
  closeGateIntent: UnsavedGateIntent;
  stayAfterCloseAttempt: () => void;
  discardUnsavedAndClose: () => Promise<void>;
  saveAndClose: () => Promise<void>;
  requestNavigateWithUnsavedCheck: (onProceed: () => void) => void;
}

export interface UnsavedChangesGateDeps {
  hasUnsavedSegmentChanges: () => boolean;
  saveSegments: () => Promise<boolean>;
  setError: (msg: string) => void;
}

export function useUnsavedChangesGate(deps: UnsavedChangesGateDeps): UnsavedChangesGateApi {
  const { hasUnsavedSegmentChanges, saveSegments, setError } = deps;
  const closeAfterSaveRef = useRef(false);
  const [closeGateOpen, setCloseGateOpen] = useState(false);
  const [closeGateIntent, setCloseGateIntent] = useState<UnsavedGateIntent>("app-quit");
  const navigateProceedRef = useRef<(() => void) | null>(null);
  const hasUnsavedRef = useRef(hasUnsavedSegmentChanges);
  hasUnsavedRef.current = hasUnsavedSegmentChanges;

  const openUnsavedNavigateGate = useCallback((onProceed: () => void) => {
    navigateProceedRef.current = onProceed;
    setCloseGateIntent("navigate");
    setCloseGateOpen(true);
  }, []);

  const requestNavigateWithUnsavedCheck = useCallback(
    (onProceed: () => void) => {
      if (!hasUnsavedSegmentChanges()) {
        onProceed();
        return;
      }
      openUnsavedNavigateGate(onProceed);
    },
    [hasUnsavedSegmentChanges, openUnsavedNavigateGate],
  );

  const requestAppClose = useCallback(async () => {
    closeAfterSaveRef.current = true;
    setCloseGateOpen(false);
    navigateProceedRef.current = null;
    try {
      await getCurrentWindow().destroy();
    } catch (e) {
      closeAfterSaveRef.current = false;
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [setError]);

  const stayAfterCloseAttempt = useCallback(() => {
    setCloseGateOpen(false);
    navigateProceedRef.current = null;
  }, []);

  const finishNavigateAfterDiscard = useCallback(() => {
    segmentDraftStore.resetAll();
    setCloseGateOpen(false);
    const proceed = navigateProceedRef.current;
    navigateProceedRef.current = null;
    proceed?.();
  }, []);

  const discardUnsavedAndClose = useCallback(async () => {
    if (closeGateIntent === "navigate") {
      finishNavigateAfterDiscard();
      return;
    }
    segmentDraftStore.resetAll();
    await requestAppClose();
  }, [closeGateIntent, finishNavigateAfterDiscard, requestAppClose]);

  const saveAndClose = useCallback(async () => {
    const saved = await saveSegments();
    if (!saved) return;
    if (closeGateIntent === "navigate") {
      setCloseGateOpen(false);
      const proceed = navigateProceedRef.current;
      navigateProceedRef.current = null;
      proceed?.();
      return;
    }
    await requestAppClose();
  }, [closeGateIntent, requestAppClose, saveSegments]);

  useEffect(() => {
    ensureAppWindowCloseGuardRegistered();
    setAppWindowCloseGuardBridge({
      hasUnsaved: () => hasUnsavedRef.current(),
      onBlocked: () => {
        navigateProceedRef.current = null;
        setCloseGateIntent("app-quit");
        setCloseGateOpen(true);
      },
      isClosingAfterSave: () => closeAfterSaveRef.current,
    });
    return () => setAppWindowCloseGuardBridge(null);
  }, []);

  return {
    closeGateOpen,
    closeGateIntent,
    stayAfterCloseAttempt,
    discardUnsavedAndClose,
    saveAndClose,
    requestNavigateWithUnsavedCheck,
  };
}
