import { describe, expect, it, vi } from "vitest";
import { applyPeaksOrderedSeek, dispatchTransportIntent } from "./dispatchTransportIntent";
import type { TransportDispatchDeps } from "./dispatchTransportIntent";

function makeDeps(overrides: Partial<TransportDispatchDeps> = {}): TransportDispatchDeps {
  return {
    isReady: true,
    getDurationSec: () => 100,
    syncDisplayPlayheadAfterSeek: vi.fn(),
    commitSeekUi: vi.fn(),
    suppressPlaybackFollow: vi.fn(),
    media: {
      setTime: vi.fn(),
      play: vi.fn(async () => {}),
      pause: vi.fn(),
      isPlaying: () => false,
    },
    applySeek: vi.fn((_timeSec: number, opts?: { suppressFollow?: boolean }) => {
      if (opts?.suppressFollow) overrides.suppressPlaybackFollow?.();
    }),
    runPlaySegment: vi.fn(async () => {}),
    runToggleSegmentPlay: vi.fn(async () => {}),
    resolvePlayFromInput: (idx, fromSec) => {
      if (idx !== 0) return null;
      return {
        segment: { start_sec: 10, end_sec: 20 },
        displaySec: 15,
        authoritySec: 15,
        fromSec,
      };
    },
    ...overrides,
  };
}

describe("dispatchTransportIntent", () => {
  it("dispatches seek via applySeek with clamp", async () => {
    const applySeek = vi.fn();
    const deps = makeDeps({ applySeek, getDurationSec: () => 50 });
    await dispatchTransportIntent(
      { kind: "seek", timeSec: 80, source: "minimap", suppressFollow: true },
      deps,
    );
    expect(applySeek).toHaveBeenCalledWith(50, { suppressFollow: true });
  });

  it("no-ops when not ready", async () => {
    const applySeek = vi.fn();
    await dispatchTransportIntent(
      { kind: "seek", timeSec: 1, source: "blankTap" },
      makeDeps({ isReady: false, applySeek }),
    );
    expect(applySeek).not.toHaveBeenCalled();
  });

  it("resolves playSegment through resolveSegmentPlayFrom", async () => {
    const runPlaySegment = vi.fn(async () => {});
    await dispatchTransportIntent(
      { kind: "playSegment", idx: 0, fromSec: 12 },
      makeDeps({ runPlaySegment }),
    );
    expect(runPlaySegment).toHaveBeenCalledWith({
      idx: 0,
      playFrom: { kind: "seek", timeSec: 12 },
      loop: undefined,
    });
  });

  it("playSegment consumes sticky natural-end resume before resolving play-from", async () => {
    const runPlaySegment = vi.fn(async () => {});
    const resolveSegmentResumeFromSec = vi.fn((_idx: number, fromSec?: number) => {
      void fromSec;
      return 10;
    });
    await dispatchTransportIntent(
      { kind: "playSegment", idx: 0 },
      makeDeps({
        runPlaySegment,
        resolveSegmentResumeFromSec,
        resolvePlayFromInput: (_idx, fromSec) => ({
          segment: { start_sec: 10, end_sec: 20 },
          // Playhead frozen at segment end — without sticky resume this continues past end.
          displaySec: 20,
          authoritySec: 20,
          fromSec,
        }),
      }),
    );
    expect(resolveSegmentResumeFromSec).toHaveBeenCalledWith(0, undefined);
    expect(runPlaySegment).toHaveBeenCalledWith({
      idx: 0,
      playFrom: { kind: "seek", timeSec: 10 },
      loop: undefined,
    });
  });

  it("selectSegmentTransport does not consume sticky resume", async () => {
    const applySeek = vi.fn();
    const resolveSegmentResumeFromSec = vi.fn(() => 10);
    await dispatchTransportIntent(
      {
        kind: "selectSegmentTransport",
        idx: 0,
        source: "waveform",
        seekPolicy: "segmentStart",
      },
      makeDeps({ applySeek, resolveSegmentResumeFromSec }),
    );
    expect(resolveSegmentResumeFromSec).not.toHaveBeenCalled();
    expect(applySeek).toHaveBeenCalledWith(10, { suppressFollow: true });
  });

  it("selectSegmentTransport seeks segment start without reading SC2", async () => {
    const applySeek = vi.fn();
    await dispatchTransportIntent(
      {
        kind: "selectSegmentTransport",
        idx: 0,
        source: "waveform",
        seekPolicy: "segmentStart",
      },
      makeDeps({ applySeek }),
    );
    expect(applySeek).toHaveBeenCalledWith(10, { suppressFollow: true });
  });

  it("selectSegmentTransport none does not seek", async () => {
    const applySeek = vi.fn();
    await dispatchTransportIntent(
      {
        kind: "selectSegmentTransport",
        idx: 0,
        source: "list",
        seekPolicy: "none",
      },
      makeDeps({ applySeek }),
    );
    expect(applySeek).not.toHaveBeenCalled();
  });

  it("toggleSegmentPlay delegates", async () => {
    const runToggleSegmentPlay = vi.fn(async () => {});
    await dispatchTransportIntent({ kind: "toggleSegmentPlay" }, makeDeps({ runToggleSegmentPlay }));
    expect(runToggleSegmentPlay).toHaveBeenCalledTimes(1);
  });
});

describe("applyPeaksOrderedSeek", () => {
  it("syncs display before setTime and commits after setTime", async () => {
    const sync = vi.fn();
    const setTime = vi.fn();
    const commit = vi.fn();
    const t = await applyPeaksOrderedSeek({
      timeSec: 12,
      durationSec: 100,
      syncDisplayPlayheadAfterSeek: sync,
      setTime,
      commitSeekUi: commit,
    });
    expect(t).toBe(12);
    expect(sync).toHaveBeenCalledWith(12);
    expect(setTime).toHaveBeenCalledWith(12);
    expect(commit).toHaveBeenCalledWith(12);
    expect(sync.mock.invocationCallOrder[0]).toBeLessThan(setTime.mock.invocationCallOrder[0]);
    expect(setTime.mock.invocationCallOrder[0]).toBeLessThan(commit.mock.invocationCallOrder[0]);
  });
});
