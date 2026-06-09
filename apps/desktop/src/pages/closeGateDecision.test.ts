import { describe, expect, it } from "vitest";
import {
  decideLoadProject,
  decideNavigateGuard,
  decideOpenFile,
  shouldBlockAppClose,
} from "./closeGateDecision";

describe("closeGateDecision", () => {
  it("transcribe busy blocks before unsaved", () => {
    expect(
      decideNavigateGuard({ transcribeBusy: true, hasUnsaved: true }),
    ).toEqual({ kind: "transcribe-block" });
  });

  it("unsaved blocks navigate when not transcribing", () => {
    expect(decideNavigateGuard({ transcribeBusy: false, hasUnsaved: true })).toEqual({
      kind: "unsaved-block",
    });
  });

  it("app close blocked when transcribe or unsaved", () => {
    expect(shouldBlockAppClose({ transcribeBusy: true, hasUnsaved: false })).toBe(true);
    expect(shouldBlockAppClose({ transcribeBusy: false, hasUnsaved: true })).toBe(true);
    expect(shouldBlockAppClose({ transcribeBusy: false, hasUnsaved: false })).toBe(false);
  });

  it("openFile: same file with dirty is noop", () => {
    expect(
      decideOpenFile({
        currentFileId: "f1",
        targetFileId: "f1",
        hasUnsaved: true,
      }),
    ).toEqual({ kind: "noop-same-file-dirty" });
  });

  it("openFile: different file uses guarded navigate", () => {
    expect(
      decideOpenFile({
        currentFileId: "f1",
        targetFileId: "f2",
        hasUnsaved: false,
      }),
    ).toEqual({ kind: "open-guarded" });
  });

  it("loadProject: switching projects is guarded", () => {
    expect(
      decideLoadProject({
        currentProjectId: "p1",
        targetProjectId: "p2",
        hasUnsaved: false,
        currentFileId: "f1",
      }),
    ).toEqual({ kind: "load-guarded" });
  });

  it("loadProject: same project with unsaved editor refreshes list only", () => {
    expect(
      decideLoadProject({
        currentProjectId: "p1",
        targetProjectId: "p1",
        hasUnsaved: true,
        currentFileId: "f1",
      }),
    ).toEqual({ kind: "load-same-project-refresh" });
  });
});
