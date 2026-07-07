import { describe, expect, it, vi } from "vitest";
import { waveformAtomicSeek } from "./waveformAtomicSeek";

describe("waveformAtomicSeek", () => {
  it("delegates to wfApiRef.seek (atomic playhead sync runs inside wf.seek)", () => {
    const seek = vi.fn();
    const timeline = {
      wfApiRef: { current: { seek } },
    };

    waveformAtomicSeek(timeline, 12.5);

    expect(seek).toHaveBeenCalledWith(12.5);
  });
});
