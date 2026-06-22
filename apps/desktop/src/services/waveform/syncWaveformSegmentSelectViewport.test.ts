import { describe, expect, it, vi } from "vitest";
import {
  syncWaveformSegmentSelectPreviewViewport,
  syncWaveformSegmentSelectReveal,
  syncWaveformSegmentSelectSeek,
  syncWaveformSegmentSelectViewport,
} from "./syncWaveformSegmentSelectViewport";

function makeTimeline() {
  return {
    suppressPlaybackFollowForSelectionSeek: vi.fn(),
    wfApiRef: { current: { seek: vi.fn() } },
    viewportFit: { revealSegmentInViewport: vi.fn() },
  };
}

describe("syncWaveformSegmentSelectViewport", () => {
  const seg = { start_sec: 10, end_sec: 12 };

  it("seek moves playhead to segment start", () => {
    const tl = makeTimeline();
    syncWaveformSegmentSelectSeek(tl, seg);
    expect(tl.suppressPlaybackFollowForSelectionSeek).toHaveBeenCalledOnce();
    expect(tl.wfApiRef.current.seek).toHaveBeenCalledWith(10);
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

  it("seek notifies imperative playhead sync when provided", () => {
    const syncDisplayPlayheadAfterSeek = vi.fn();
    const tl = { ...makeTimeline(), syncDisplayPlayheadAfterSeek };
    syncWaveformSegmentSelectSeek(tl, seg);
    expect(syncDisplayPlayheadAfterSeek).toHaveBeenCalledWith(10);
    expect(syncDisplayPlayheadAfterSeek.mock.invocationCallOrder[0]).toBeGreaterThan(
      tl.wfApiRef.current.seek.mock.invocationCallOrder[0],
    );
  });

  it("preview viewport sync reveals before publishing playhead to avoid viewport-coordinate jump", () => {
    const syncDisplayPlayheadAfterSeek = vi.fn();
    const tl = { ...makeTimeline(), syncDisplayPlayheadAfterSeek };
    syncWaveformSegmentSelectPreviewViewport(tl, seg);
    expect(tl.wfApiRef.current.seek).toHaveBeenCalledWith(10);
    expect(tl.viewportFit.revealSegmentInViewport).toHaveBeenCalledWith(seg);
    expect(syncDisplayPlayheadAfterSeek).toHaveBeenCalledWith(10);
    expect(tl.viewportFit.revealSegmentInViewport.mock.invocationCallOrder[0]).toBeLessThan(
      syncDisplayPlayheadAfterSeek.mock.invocationCallOrder[0],
    );
  });
});
