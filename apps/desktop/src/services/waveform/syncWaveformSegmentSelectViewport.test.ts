// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  syncWaveformSegmentSelectPreviewViewport,
  syncWaveformSegmentSelectReveal,
  syncWaveformSegmentSelectSeek,
  syncWaveformSegmentSelectViewport,
} from "./syncWaveformSegmentSelectViewport";
import {
  armFileViewRestore,
  clearFileViewRestore,
  markFileViewRestorePlayheadApplied,
} from "../fileViewStateBridge";

function makeTimeline() {
  return {
    suppressPlaybackFollowForSelectionSeek: vi.fn(),
    wfApiRef: { current: { seek: vi.fn() } },
    viewportFit: { revealSegmentInViewport: vi.fn() },
  };
}

describe("syncWaveformSegmentSelectViewport", () => {
  const seg = { start_sec: 10, end_sec: 12 };

  beforeEach(() => {
    clearFileViewRestore();
    markFileViewRestorePlayheadApplied(0);
  });

  afterEach(() => {
    clearFileViewRestore();
    markFileViewRestorePlayheadApplied(0);
  });

  it("seek moves playhead to segment start", () => {
    const tl = makeTimeline();
    syncWaveformSegmentSelectSeek(tl, seg);
    expect(tl.suppressPlaybackFollowForSelectionSeek).toHaveBeenCalledOnce();
    expect(tl.wfApiRef.current.seek).toHaveBeenCalledWith(10);
    expect(tl.viewportFit.revealSegmentInViewport).not.toHaveBeenCalled();
  });

  it("skips seek and reveal while file-view restore is pending", () => {
    armFileViewRestore("f1", {
      playheadSec: 42,
      selectedSegmentUid: "u",
      tierScrollLeftPx: 100,
      layoutPxPerSec: 64,
      updatedAtMs: 1,
    });
    const tl = makeTimeline();
    syncWaveformSegmentSelectSeek(tl, seg);
    syncWaveformSegmentSelectReveal(tl, seg);
    expect(tl.wfApiRef.current.seek).not.toHaveBeenCalled();
    expect(tl.viewportFit.revealSegmentInViewport).not.toHaveBeenCalled();
  });

  it("reveal centers segment without seek", () => {
    const tl = makeTimeline();
    syncWaveformSegmentSelectReveal(tl, seg);
    expect(tl.viewportFit.revealSegmentInViewport).toHaveBeenCalledWith(seg);
    expect(tl.wfApiRef.current.seek).not.toHaveBeenCalled();
  });

  it("viewport sync seeks then reveals under one suppress", () => {
    const tl = makeTimeline();
    syncWaveformSegmentSelectViewport(tl, seg);
    expect(tl.suppressPlaybackFollowForSelectionSeek).toHaveBeenCalledOnce();
    expect(tl.wfApiRef.current.seek).toHaveBeenCalledWith(10);
    expect(tl.viewportFit.revealSegmentInViewport).toHaveBeenCalledWith(seg);
    expect(tl.wfApiRef.current.seek.mock.invocationCallOrder[0]).toBeLessThan(
      tl.viewportFit.revealSegmentInViewport.mock.invocationCallOrder[0],
    );
  });

  it("preview viewport sync seeks then reveals after playhead publish", () => {
    const tl = makeTimeline();
    syncWaveformSegmentSelectPreviewViewport(tl, seg);
    expect(tl.wfApiRef.current.seek).toHaveBeenCalledWith(10);
    expect(tl.viewportFit.revealSegmentInViewport).toHaveBeenCalledWith(seg);
    expect(tl.wfApiRef.current.seek.mock.invocationCallOrder[0]).toBeLessThan(
      tl.viewportFit.revealSegmentInViewport.mock.invocationCallOrder[0],
    );
  });

  it("seek via dispatchTransportIntent when segmentIdx provided", () => {
    const dispatch = vi.fn(async () => {});
    const tl = {
      suppressPlaybackFollowForSelectionSeek: vi.fn(),
      wfApiRef: { current: { seek: vi.fn(), dispatchTransportIntent: dispatch } },
      viewportFit: { revealSegmentInViewport: vi.fn() },
    };
    syncWaveformSegmentSelectSeek(tl, seg, { segmentIdx: 3 });
    expect(tl.suppressPlaybackFollowForSelectionSeek).toHaveBeenCalledOnce();
    expect(dispatch).toHaveBeenCalledWith({
      kind: "selectSegmentTransport",
      idx: 3,
      source: "waveform",
      seekPolicy: "segmentStart",
    });
    expect(tl.wfApiRef.current.seek).not.toHaveBeenCalled();
  });

  it("forwards list source on selectSegmentTransport intent", () => {
    const dispatch = vi.fn(async () => {});
    const tl = {
      suppressPlaybackFollowForSelectionSeek: vi.fn(),
      wfApiRef: { current: { seek: vi.fn(), dispatchTransportIntent: dispatch } },
      viewportFit: { revealSegmentInViewport: vi.fn() },
    };
    syncWaveformSegmentSelectSeek(tl, seg, { segmentIdx: 2, source: "list" });
    expect(dispatch).toHaveBeenCalledWith({
      kind: "selectSegmentTransport",
      idx: 2,
      source: "list",
      seekPolicy: "segmentStart",
    });
  });
});
