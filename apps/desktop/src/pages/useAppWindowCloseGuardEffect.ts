import { useEffect, useRef } from "react";
import {
  ensureAppWindowCloseGuardRegistered,
  setAppWindowCloseGuardBridge,
} from "../services/appWindowCloseGuard";
import { isTranscribeBusy, shouldBlockAppClose } from "./closeGateDecision";
import type { BusyReason } from "./ProjectLifecycleApi";

type BridgeState = {
  busy: boolean;
  busyReason: BusyReason | null;
  hasUnsavedSegmentChanges: () => boolean;
};

type UseAppWindowCloseGuardEffectArgs = {
  bridgeStateRef: React.MutableRefObject<BridgeState>;
  closeAfterSaveRef: React.MutableRefObject<boolean>;
  onBlockedTranscribe: () => void;
  onBlockedUnsaved: () => void;
};

export function useAppWindowCloseGuardEffect(args: UseAppWindowCloseGuardEffectArgs): void {
  const { bridgeStateRef, closeAfterSaveRef, onBlockedTranscribe, onBlockedUnsaved } = args;

  const onBlockedTranscribeRef = useRef(onBlockedTranscribe);
  onBlockedTranscribeRef.current = onBlockedTranscribe;
  const onBlockedUnsavedRef = useRef(onBlockedUnsaved);
  onBlockedUnsavedRef.current = onBlockedUnsaved;

  useEffect(() => {
    ensureAppWindowCloseGuardRegistered();
    setAppWindowCloseGuardBridge({
      shouldBlockClose: () => {
        const s = bridgeStateRef.current;
        return shouldBlockAppClose({
          transcribeBusy: isTranscribeBusy(s.busy, s.busyReason),
          hasUnsaved: s.hasUnsavedSegmentChanges(),
        });
      },
      onBlocked: () => {
        const s = bridgeStateRef.current;
        if (isTranscribeBusy(s.busy, s.busyReason)) {
          onBlockedTranscribeRef.current();
          return;
        }
        onBlockedUnsavedRef.current();
      },
      isClosingAfterSave: () => closeAfterSaveRef.current,
    });
    return () => setAppWindowCloseGuardBridge(null);
  }, [bridgeStateRef, closeAfterSaveRef]);
}
