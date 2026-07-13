import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  armFileViewRestore,
  captureFileViewStateNow,
  clearFileViewRestore,
  peekFileViewRestoreForFile,
  registerFileViewStateCapture,
  scheduleClearFileViewRestoreWhenSettled,
  cancelScheduledFileViewRestoreClear,
  markFileViewRestorePlayheadApplied,
  shouldSuppressSegmentSelectSeekForFileViewRestore,
  FILE_VIEW_RESTORE_SETTLE_MS,
  FILE_VIEW_RESTORE_SELECT_SEEK_SUPPRESS_MS,
} from "./fileViewStateBridge";
import { shouldSkipMediaResetForFileViewRestore } from "../hooks/useFileViewStateRestoreEffect";

describe("fileViewStateBridge", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(performance, "now").mockReturnValue(0);
    clearFileViewRestore();
    markFileViewRestorePlayheadApplied(0);
    registerFileViewStateCapture(null);
  });

  afterEach(() => {
    cancelScheduledFileViewRestoreClear();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("captures via registered reader", () => {
    registerFileViewStateCapture(() => ({
      playheadSec: 3,
      selectedSegmentUid: "u1",
      tierScrollLeftPx: 40,
      layoutPxPerSec: 64,
    }));
    expect(captureFileViewStateNow()).toEqual({
      playheadSec: 3,
      selectedSegmentUid: "u1",
      tierScrollLeftPx: 40,
      layoutPxPerSec: 64,
    });
  });

  it("arms restore and skips media reset for matching file", () => {
    armFileViewRestore("f1", {
      playheadSec: 10,
      selectedSegmentUid: "u",
      tierScrollLeftPx: 100,
      layoutPxPerSec: 72,
      updatedAtMs: 1,
    });
    const pending = peekFileViewRestoreForFile("f1");
    expect(pending?.fileId).toBe("f1");
    expect(shouldSkipMediaResetForFileViewRestore(pending, "f1")).toBe(true);
    expect(shouldSkipMediaResetForFileViewRestore(pending, "f2")).toBe(false);
  });

  it("delays clear until settle so remount can re-seek", () => {
    armFileViewRestore("f1", {
      playheadSec: 10,
      selectedSegmentUid: "u",
      tierScrollLeftPx: 100,
      layoutPxPerSec: 72,
      updatedAtMs: 1,
    });
    const pending = peekFileViewRestoreForFile("f1");
    expect(pending).toBeTruthy();
    if (!pending) return;
    pending.scrollApplied = true;
    pending.seekApplied = true;
    scheduleClearFileViewRestoreWhenSettled("f1");
    expect(peekFileViewRestoreForFile("f1")).toBeTruthy();
    vi.advanceTimersByTime(FILE_VIEW_RESTORE_SETTLE_MS - 1);
    expect(peekFileViewRestoreForFile("f1")).toBeTruthy();
    vi.advanceTimersByTime(1);
    expect(peekFileViewRestoreForFile("f1")).toBeNull();
  });

  it("suppresses segment select seek while pending and after playhead apply", () => {
    expect(shouldSuppressSegmentSelectSeekForFileViewRestore()).toBe(false);
    armFileViewRestore("f1", {
      playheadSec: 10,
      selectedSegmentUid: "u",
      tierScrollLeftPx: 100,
      layoutPxPerSec: 72,
      updatedAtMs: 1,
    });
    expect(shouldSuppressSegmentSelectSeekForFileViewRestore()).toBe(true);

    markFileViewRestorePlayheadApplied();
    clearFileViewRestore();
    expect(shouldSuppressSegmentSelectSeekForFileViewRestore()).toBe(true);

    vi.mocked(performance.now).mockReturnValue(FILE_VIEW_RESTORE_SELECT_SEEK_SUPPRESS_MS);
    expect(shouldSuppressSegmentSelectSeekForFileViewRestore()).toBe(false);
  });
});
