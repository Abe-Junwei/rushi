import { describe, expect, it, vi } from "vitest";
import {
  applyOverlayPointerUpIntent,
  applySegmentOverlayTap,
  resolveSegmentOverlayTap,
} from "./waveformSegmentOverlayActions";

describe("resolveSegmentOverlayTap", () => {
  const segment = { start_sec: 4, end_sec: 10 };

  it("selects (no seek-within) when preview synced on pointerdown and pointer is in segment middle", () => {
    expect(
      resolveSegmentOverlayTap({
        selectedIdx: 2,
        selectedIdxAtPointerDown: 0,
        viewportSyncedOnDown: true,
        segmentIdx: 2,
        pointerTimeSec: 9.5,
        segment,
      }),
    ).toEqual({ kind: "select", segmentIdx: 2 });
  });

  it("selects when preview synced on pointerdown and pointer is near segment start", () => {
    expect(
      resolveSegmentOverlayTap({
        selectedIdx: 2,
        selectedIdxAtPointerDown: 0,
        viewportSyncedOnDown: true,
        segmentIdx: 2,
        pointerTimeSec: 4.02,
        segment,
      }),
    ).toEqual({ kind: "select", segmentIdx: 2 });
  });

  it("selects when tapping a different segment", () => {
    expect(
      resolveSegmentOverlayTap({
        selectedIdx: 0,
        segmentIdx: 2,
        pointerTimeSec: 7,
        segment,
      }),
    ).toEqual({ kind: "select", segmentIdx: 2 });
  });

  it("selects when SC2 preview already matches but React SC1 is still on another segment", () => {
    expect(
      resolveSegmentOverlayTap({
        selectedIdx: 0,
        segmentIdx: 2,
        pointerTimeSec: 7,
        segment,
      }),
    ).toEqual({ kind: "select", segmentIdx: 2 });
  });

  it("selects when SC2 preview already synced viewport on pointerdown near segment start", () => {
    expect(
      resolveSegmentOverlayTap({
        selectedIdx: 2,
        selectedIdxAtPointerDown: 0,
        viewportSyncedOnDown: true,
        segmentIdx: 2,
        pointerTimeSec: 4.02,
        segment,
      }),
    ).toEqual({ kind: "select", segmentIdx: 2 });
  });

  it("selects when pointerdown SC1 differs even if live SC1 caught up before pointerup", () => {
    expect(
      resolveSegmentOverlayTap({
        selectedIdx: 2,
        selectedIdxAtPointerDown: 0,
        segmentIdx: 2,
        pointerTimeSec: 9.5,
        segment,
      }),
    ).toEqual({ kind: "select", segmentIdx: 2 });
  });

  it("seeks within when pointerdown primary already matched the tapped segment", () => {
    expect(
      resolveSegmentOverlayTap({
        selectedIdx: 0,
        selectedIdxAtPointerDown: 2,
        segmentIdx: 2,
        pointerTimeSec: 7.5,
        segment,
      }),
    ).toEqual({ kind: "seek-within", timeSec: 7.5 });
  });

  it("selects when pointerdown primary differs even if live SC1 already caught up", () => {
    expect(
      resolveSegmentOverlayTap({
        selectedIdx: 2,
        selectedIdxAtPointerDown: 0,
        viewportSyncedOnDown: false,
        segmentIdx: 2,
        pointerTimeSec: 7.5,
        segment,
      }),
    ).toEqual({ kind: "select", segmentIdx: 2 });
  });

  it("seeks within segment when tapping the selected segment", () => {
    expect(
      resolveSegmentOverlayTap({
        selectedIdx: 2,
        segmentIdx: 2,
        pointerTimeSec: 7.5,
        segment,
      }),
    ).toEqual({ kind: "seek-within", timeSec: 7.5 });
  });

  it("clamps seek-within to segment bounds", () => {
    expect(
      resolveSegmentOverlayTap({
        selectedIdx: 1,
        segmentIdx: 1,
        pointerTimeSec: 12,
        segment,
      }),
    ).toEqual({ kind: "seek-within", timeSec: 10 });
  });
});

describe("waveformSegmentOverlayActions", () => {
  it("applySegmentOverlayTap selects a new segment", () => {
    const onSelectSegmentAt = vi.fn();
    const seekToTime = vi.fn();
    applySegmentOverlayTap(
      {
        selectedIdx: 0,
        segmentIdx: 2,
        pointerTimeSec: 7,
        segment: { start_sec: 4, end_sec: 10 },
      },
      { onSelectSegmentAt, seekToTime },
    );
    expect(onSelectSegmentAt).toHaveBeenCalledWith(2);
    expect(seekToTime).not.toHaveBeenCalled();
  });

  it("applySegmentOverlayTap seeks when re-tapping selected segment", () => {
    const onSelectSegmentAt = vi.fn();
    const seekToTime = vi.fn();
    const suppressPlaybackFollowForSelectionSeek = vi.fn();
    applySegmentOverlayTap(
      {
        selectedIdx: 2,
        segmentIdx: 2,
        pointerTimeSec: 6,
        segment: { start_sec: 4, end_sec: 10 },
      },
      {
        onSelectSegmentAt,
        seekToTime,
        suppressPlaybackFollowForSelectionSeek,
      },
    );
    expect(onSelectSegmentAt).not.toHaveBeenCalled();
    expect(seekToTime).toHaveBeenCalledWith(6);
    expect(suppressPlaybackFollowForSelectionSeek.mock.invocationCallOrder[0]).toBeLessThan(
      seekToTime.mock.invocationCallOrder[0],
    );
  });

  it("applyOverlayPointerUpIntent dispatches select-segment via onSegmentPointerTap", () => {
    const suppress = vi.fn();
    const onSegmentPointerTap = vi.fn();
    applyOverlayPointerUpIntent(
      { kind: "select-segment", segmentIdx: 2, pointerTimeSec: 5 },
      {
        onSegmentPointerTap,
        onBoundsCommit: vi.fn(),
        seekToTime: vi.fn(),
      },
      suppress,
    );
    expect(suppress).toHaveBeenCalledOnce();
    expect(onSegmentPointerTap).toHaveBeenCalledWith(2, 5, undefined);
  });

  it("applyOverlayPointerUpIntent dispatches commit-bounds", () => {
    const onBoundsCommit = vi.fn();
    applyOverlayPointerUpIntent(
      { kind: "commit-bounds", segmentIdx: 1, startSec: 2, endSec: 4 },
      {
        onSegmentPointerTap: vi.fn(),
        onBoundsCommit,
        seekToTime: vi.fn(),
      },
      vi.fn(),
    );
    expect(onBoundsCommit).toHaveBeenCalledWith(1, 2, 4);
  });

  it("applyOverlayPointerUpIntent forwards overlapPolicy on create-range", () => {
    const onCreateRange = vi.fn();
    applyOverlayPointerUpIntent(
      { kind: "create-range", startSec: 1, endSec: 3, overlapPolicy: "allow" },
      {
        onSegmentPointerTap: vi.fn(),
        onBoundsCommit: vi.fn(),
        onCreateRange,
        seekToTime: vi.fn(),
      },
      vi.fn(),
    );
    expect(onCreateRange).toHaveBeenCalledWith(1, 3, { overlapPolicy: "allow" });
  });

  it("applyOverlayPointerUpIntent suppresses playback follow before blank seek", () => {
    const seekToTime = vi.fn();
    const suppressPlaybackFollowForSelectionSeek = vi.fn();
    applyOverlayPointerUpIntent(
      { kind: "seek-blank", timeSec: 8 },
      {
        onSegmentPointerTap: vi.fn(),
        onBoundsCommit: vi.fn(),
        seekToTime,
        suppressPlaybackFollowForSelectionSeek,
      },
      vi.fn(),
    );

    expect(suppressPlaybackFollowForSelectionSeek).toHaveBeenCalledOnce();
    expect(seekToTime).toHaveBeenCalledWith(8);
    expect(suppressPlaybackFollowForSelectionSeek.mock.invocationCallOrder[0]).toBeLessThan(
      seekToTime.mock.invocationCallOrder[0],
    );
  });
});
