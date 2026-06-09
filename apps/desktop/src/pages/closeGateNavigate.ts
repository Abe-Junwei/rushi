import type { MutableRefObject } from "react";
import { decideNavigateGuard, isTranscribeBusy } from "./closeGateDecision";
import type { BusyReason } from "./useProjectCrudController";
import type { SegmentDirtyStateApi } from "./useSegmentDirtyState";

type Proceed = () => void | Promise<void>;

export type CloseGateNavigateState = {
  setCloseGateOpen: (open: boolean) => void;
  setCloseGateIntent: (intent: "app-quit" | "navigate") => void;
  setTranscribeNavBlockOpen: (open: boolean) => void;
  navigateProceedRef: MutableRefObject<Proceed | null>;
};

export type CloseGateNavigateContext = {
  busy: boolean;
  busyReason: BusyReason | null;
  dirty: SegmentDirtyStateApi;
};

export function createCloseGateNavigateHandlers(
  state: CloseGateNavigateState,
  ctx: CloseGateNavigateContext,
) {
  function openUnsavedNavigateGate(onProceed: Proceed) {
    state.navigateProceedRef.current = onProceed;
    state.setCloseGateIntent("navigate");
    state.setCloseGateOpen(true);
  }

  function openTranscribeNavBlock(onProceed: Proceed) {
    state.navigateProceedRef.current = onProceed;
    state.setTranscribeNavBlockOpen(true);
  }

  function requestNavigateWithUnsavedCheck(onProceed: Proceed) {
    const decision = decideNavigateGuard({
      transcribeBusy: false,
      hasUnsaved: ctx.dirty.hasUnsavedSegmentChanges(),
    });
    if (decision.kind === "unsaved-block") {
      openUnsavedNavigateGate(onProceed);
      return;
    }
    void onProceed();
  }

  function requestNavigateWithGuards(onProceed: Proceed) {
    const decision = decideNavigateGuard({
      transcribeBusy: isTranscribeBusy(ctx.busy, ctx.busyReason),
      hasUnsaved: ctx.dirty.hasUnsavedSegmentChanges(),
    });
    if (decision.kind === "transcribe-block") {
      openTranscribeNavBlock(onProceed);
      return;
    }
    if (decision.kind === "unsaved-block") {
      openUnsavedNavigateGate(onProceed);
      return;
    }
    void onProceed();
  }

  function cancelTranscribeNavBlock() {
    state.setTranscribeNavBlockOpen(false);
    state.navigateProceedRef.current = null;
  }

  return {
    openUnsavedNavigateGate,
    openTranscribeNavBlock,
    requestNavigateWithUnsavedCheck,
    requestNavigateWithGuards,
    cancelTranscribeNavBlock,
  };
}
