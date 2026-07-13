import { describe, expect, it } from "vitest";
import { nextSegmentPlaybackPhase } from "./segmentPlaybackPhase";

describe("segmentPlaybackPhase", () => {
  it("transitions seeking → idle → playing → boundStop → loop", () => {
    let phase = nextSegmentPlaybackPhase("idle", "seekStart");
    expect(phase).toBe("seeking");
    phase = nextSegmentPlaybackPhase(phase, "seekDone");
    expect(phase).toBe("idle");
    phase = nextSegmentPlaybackPhase(phase, "play");
    expect(phase).toBe("playing");
    phase = nextSegmentPlaybackPhase(phase, "boundHit");
    expect(phase).toBe("boundStop");
    phase = nextSegmentPlaybackPhase(phase, "loopRestart");
    expect(phase).toBe("loop");
    phase = nextSegmentPlaybackPhase(phase, "reset");
    expect(phase).toBe("idle");
  });
});
