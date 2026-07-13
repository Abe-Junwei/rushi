// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { armFileViewRestore, clearFileViewRestore } from "../services/fileViewStateBridge";
import { useFileViewStateRestoreEffect } from "./useFileViewStateRestoreEffect";

const getTranscriptEditorView = vi.fn();
const revealSegmentInScrollDOM = vi.fn();
const selectSegmentCommand = vi.fn();
const primarySegmentIdx = vi.fn();
const getTranscriptProjectionSnapshot = vi.fn();

vi.mock("../components/editor/core/transcriptEditorViewHandle", () => ({
  getTranscriptEditorView: () => getTranscriptEditorView(),
}));

vi.mock("../components/editor/core/revealSegment", () => ({
  revealSegmentInScrollDOM: (...args: unknown[]) => revealSegmentInScrollDOM(...args),
}));

vi.mock("../components/editor/core/selectionCommands", () => ({
  selectSegmentCommand: (...args: unknown[]) => selectSegmentCommand(...args),
}));

vi.mock("../components/editor/core/selectionField", () => ({
  primarySegmentIdx: (...args: unknown[]) => primarySegmentIdx(...args),
}));

vi.mock("../components/editor/core/transcriptProjection", () => ({
  getTranscriptProjectionSnapshot: () => getTranscriptProjectionSnapshot(),
}));

function makeTierEl(clientWidth = 300): HTMLDivElement {
  const el = document.createElement("div");
  Object.defineProperty(el, "clientWidth", {
    configurable: true,
    value: clientWidth,
  });
  return el;
}

function makeArgs(overrides: Partial<Parameters<typeof useFileViewStateRestoreEffect>[0]> = {}) {
  const tier = makeTierEl();
  return {
    fileId: "f1",
    mediaUrl: "asset://a.wav",
    mediaDurationSec: 100,
    layoutPxPerSec: 80,
    isReady: true,
    audioReady: true,
    segments: [
      { uid: "u0", idx: 0, start_sec: 0, end_sec: 1, text: "a" },
      { uid: "u1", idx: 1, start_sec: 12, end_sec: 14, text: "b" },
    ],
    setPxPerSec: vi.fn(),
    seek: vi.fn(),
    selectSegmentAt: vi.fn(),
    suppressPlaybackFollowForSelectionSeek: vi.fn(),
    syncDisplayPlayheadAfterSeek: vi.fn(),
    revealSegmentInViewport: vi.fn(),
    tierScrollRef: { current: tier },
    ...overrides,
  };
}

describe("useFileViewStateRestoreEffect", () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    vi.useFakeTimers();
    storage.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
      clear: () => storage.clear(),
    });
    clearFileViewRestore();
    getTranscriptEditorView.mockReset();
    revealSegmentInScrollDOM.mockReset();
    selectSegmentCommand.mockReset();
    primarySegmentIdx.mockReset();
    getTranscriptProjectionSnapshot.mockReset();
    primarySegmentIdx.mockReturnValue(0);
    getTranscriptProjectionSnapshot.mockReturnValue({ primaryIdx: 1 });
  });

  afterEach(() => {
    clearFileViewRestore();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("reveals the selected waveform segment after restored zoom", () => {
    armFileViewRestore("f1", {
      playheadSec: 13,
      selectedSegmentUid: "u1",
      tierScrollLeftPx: 420,
      layoutPxPerSec: 80,
      updatedAtMs: 1,
    });
    const args = makeArgs();

    renderHook(() => useFileViewStateRestoreEffect(args));

    expect(args.setPxPerSec).toHaveBeenCalledWith(80);
    expect(args.revealSegmentInViewport).toHaveBeenCalledWith({
      start_sec: 12,
      end_sec: 14,
    });
  });

  it("retries waveform reveal until the tier viewport has width", () => {
    armFileViewRestore("f1", {
      playheadSec: 13,
      selectedSegmentUid: "u1",
      tierScrollLeftPx: 420,
      layoutPxPerSec: 80,
      updatedAtMs: 1,
    });
    const tier = makeTierEl(0);
    const revealSegmentInViewport = vi.fn();
    const args = makeArgs({
      tierScrollRef: { current: tier },
      revealSegmentInViewport,
    });

    renderHook(() => useFileViewStateRestoreEffect(args));

    expect(revealSegmentInViewport).not.toHaveBeenCalled();

    Object.defineProperty(tier, "clientWidth", {
      configurable: true,
      value: 300,
    });
    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(revealSegmentInViewport).toHaveBeenCalledWith({
      start_sec: 12,
      end_sec: 14,
    });
  });

  it("retries selection until the CM6 view mounts and projection matches", () => {
    armFileViewRestore("f1", {
      playheadSec: 13,
      selectedSegmentUid: "u1",
      tierScrollLeftPx: 0,
      layoutPxPerSec: 80,
      updatedAtMs: 1,
    });
    getTranscriptEditorView.mockReturnValue(null);
    const args = makeArgs();

    renderHook(() => useFileViewStateRestoreEffect(args));

    expect(selectSegmentCommand).not.toHaveBeenCalled();

    const view = {
      state: { doc: { lines: 2 } },
      dispatch: vi.fn(),
      scrollDOM: document.createElement("div"),
    };
    getTranscriptEditorView.mockReturnValue(view);
    primarySegmentIdx.mockReturnValue(0);
    getTranscriptProjectionSnapshot.mockReturnValue({ primaryIdx: 0 });

    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(selectSegmentCommand).toHaveBeenCalled();
    expect(args.selectSegmentAt).toHaveBeenCalledWith(1);
    expect(revealSegmentInScrollDOM).toHaveBeenCalledWith(view, 1, { y: "center" });

    // Projection still wrong — keep re-asserting while pending.
    getTranscriptProjectionSnapshot.mockReturnValue({ primaryIdx: 1 });
    primarySegmentIdx.mockReturnValue(1);
    act(() => {
      vi.advanceTimersByTime(50);
    });
    expect(revealSegmentInScrollDOM).toHaveBeenCalled();
  });

  it("re-applies selection after a wipe while pending restore is alive", () => {
    armFileViewRestore("f1", {
      playheadSec: 13,
      selectedSegmentUid: "u1",
      tierScrollLeftPx: 0,
      layoutPxPerSec: 80,
      updatedAtMs: 1,
    });
    const view = {
      state: { doc: { lines: 2 } },
      dispatch: vi.fn(),
      scrollDOM: document.createElement("div"),
    };
    getTranscriptEditorView.mockReturnValue(view);
    primarySegmentIdx.mockReturnValue(1);
    getTranscriptProjectionSnapshot.mockReturnValue({ primaryIdx: 1 });
    const args = makeArgs();

    renderHook(() => useFileViewStateRestoreEffect(args));
    expect(revealSegmentInScrollDOM).toHaveBeenCalled();

    // Simulate remount wipe back to idx 0.
    primarySegmentIdx.mockReturnValue(0);
    getTranscriptProjectionSnapshot.mockReturnValue({ primaryIdx: 0 });
    selectSegmentCommand.mockClear();
    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(selectSegmentCommand).toHaveBeenCalled();
    expect(args.selectSegmentAt).toHaveBeenCalledWith(1);
  });

  it("seeks to the selected segment start, not the exact prior playhead", () => {
    armFileViewRestore("f1", {
      playheadSec: 13,
      selectedSegmentUid: "u1",
      tierScrollLeftPx: 0,
      layoutPxPerSec: 80,
      updatedAtMs: 1,
    });
    const args = makeArgs();

    const { rerender } = renderHook(
      (props: Parameters<typeof useFileViewStateRestoreEffect>[0]) =>
        useFileViewStateRestoreEffect(props),
      { initialProps: args },
    );

    expect(args.seek).toHaveBeenCalledWith(12);

    rerender({ ...args, isReady: false });
    rerender({ ...args, isReady: true });

    expect(args.seek).toHaveBeenCalledTimes(2);
    expect(args.seek).toHaveBeenLastCalledWith(12);
  });

  it("falls back to preroll playhead when no selected segment uid resolves", () => {
    armFileViewRestore("f1", {
      playheadSec: 10,
      selectedSegmentUid: null,
      tierScrollLeftPx: 0,
      layoutPxPerSec: 80,
      updatedAtMs: 1,
    });
    const args = makeArgs({ mediaDurationSec: 0 });

    const { rerender } = renderHook(
      (props: Parameters<typeof useFileViewStateRestoreEffect>[0]) =>
        useFileViewStateRestoreEffect(props),
      { initialProps: args },
    );

    expect(args.seek).not.toHaveBeenCalled();

    rerender({ ...args, mediaDurationSec: 100 });

    expect(args.seek).toHaveBeenCalledWith(9);
  });
});
