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
  /** Intent captured when opening the transcribe nav-block (app-quit vs in-app navigate). */
  transcribeBlockIntentRef: MutableRefObject<"app-quit" | "navigate">;
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
  function openUnsavedNavigateGate(onProceed: Proceed, intent: "app-quit" | "navigate" = "navigate") {
    state.navigateProceedRef.current = onProceed;
    state.setCloseGateIntent(intent);
    state.setCloseGateOpen(true);
  }

  function openTranscribeNavBlock(
    onProceed: Proceed,
    intent: "app-quit" | "navigate" = "navigate",
  ) {
    state.navigateProceedRef.current = onProceed;
    state.transcribeBlockIntentRef.current = intent;
    state.setTranscribeNavBlockOpen(true);
  }

  function requestNavigateWithUnsavedCheck(
    onProceed: Proceed,
    intent: "app-quit" | "navigate" = "navigate",
  ) {
    const decision = decideNavigateGuard({
      transcribeBusy: false,
      hasUnsaved: ctx.dirty.hasUnsavedSegmentChanges(),
    });
    if (decision.kind === "unsaved-block") {
      openUnsavedNavigateGate(onProceed, intent);
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
      openTranscribeNavBlock(onProceed, "navigate");
      return;
    }
    if (decision.kind === "unsaved-block") {
      openUnsavedNavigateGate(onProceed, "navigate");
      return;
    }
    void onProceed();
  }

  function cancelTranscribeNavBlock() {
    state.setTranscribeNavBlockOpen(false);
    state.navigateProceedRef.current = null;
    state.transcribeBlockIntentRef.current = "navigate";
  }

  function takeTranscribeBlockIntent(): "app-quit" | "navigate" {
    const intent = state.transcribeBlockIntentRef.current;
    state.transcribeBlockIntentRef.current = "navigate";
    return intent;
  }

  return {
    openUnsavedNavigateGate,
    openTranscribeNavBlock,
    requestNavigateWithUnsavedCheck,
    requestNavigateWithGuards,
    cancelTranscribeNavBlock,
    takeTranscribeBlockIntent,
  };
}
