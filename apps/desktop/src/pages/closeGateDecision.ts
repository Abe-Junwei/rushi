import type { BusyReason } from "./useProjectCrudController";

export type NavigateGuardInput = {
  transcribeBusy: boolean;
  hasUnsaved: boolean;
};

export type NavigateGuardDecision =
  | { kind: "proceed" }
  | { kind: "transcribe-block" }
  | { kind: "unsaved-block" };

export function isTranscribeBusy(busy: boolean, busyReason: BusyReason | null): boolean {
  return busy && (busyReason === "transcribe" || busyReason === "batch_transcribe");
}

export function decideNavigateGuard(input: NavigateGuardInput): NavigateGuardDecision {
  if (input.transcribeBusy) return { kind: "transcribe-block" };
  if (input.hasUnsaved) return { kind: "unsaved-block" };
  return { kind: "proceed" };
}

export function shouldBlockAppClose(input: NavigateGuardInput): boolean {
  return input.transcribeBusy || input.hasUnsaved;
}

export type OpenFileDecisionInput = {
  currentFileId: string | null;
  targetFileId: string;
  hasUnsaved: boolean;
};

export type OpenFileDecision =
  | { kind: "open-direct" }
  | { kind: "open-guarded" }
  | { kind: "noop-same-file-dirty" };

export function decideOpenFile(input: OpenFileDecisionInput): OpenFileDecision {
  if (input.currentFileId && input.targetFileId !== input.currentFileId) {
    return { kind: "open-guarded" };
  }
  if (input.currentFileId === input.targetFileId && input.hasUnsaved) {
    return { kind: "noop-same-file-dirty" };
  }
  return { kind: "open-direct" };
}

export type LoadProjectDecisionInput = {
  currentProjectId: string | null;
  targetProjectId: string;
  hasUnsaved: boolean;
  currentFileId: string | null;
};

export type LoadProjectDecision =
  | { kind: "load-direct" }
  | { kind: "load-guarded" }
  | { kind: "load-same-project-refresh" };

/** Close Gate：换项目 / 同项目 refresh 路由。 */
export function decideLoadProject(input: LoadProjectDecisionInput): LoadProjectDecision {
  if (input.currentProjectId !== input.targetProjectId) {
    return { kind: "load-guarded" };
  }
  if (input.hasUnsaved && input.currentFileId) {
    return { kind: "load-same-project-refresh" };
  }
  return { kind: "load-direct" };
}
