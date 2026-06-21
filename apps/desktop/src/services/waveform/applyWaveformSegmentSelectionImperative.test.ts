// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { applyWaveformSegmentSelectionImperative } from "./applyWaveformSegmentSelectionImperative";

describe("applyWaveformSegmentSelectionImperative", () => {
  it("toggles selected class on prev and next overlay nodes without mutating child handles", () => {
    const root = document.createElement("div");
    const prev = document.createElement("div");
    prev.setAttribute("data-segment-idx", "1");
    prev.className = "waveform-segment-region waveform-segment-region-selected";
    const prevHandle = document.createElement("span");
    prevHandle.className = "waveform-segment-handle waveform-segment-handle-start";
    prev.append(prevHandle);

    const next = document.createElement("div");
    next.setAttribute("data-segment-idx", "2");
    next.className = "waveform-segment-region";
    root.append(prev, next);

    applyWaveformSegmentSelectionImperative({
      overlayRoot: root,
      segments: [
        { uid: "a", idx: 0, start_sec: 0, end_sec: 1, text: "" },
        { uid: "b", idx: 1, start_sec: 1, end_sec: 2, text: "" },
        { uid: "c", idx: 2, start_sec: 2, end_sec: 3, text: "" },
      ],
      prevSelectedIdx: 1,
      nextSelectedIdx: 2,
    });

    expect(prev.classList.contains("waveform-segment-region-selected")).toBe(false);
    expect(prev.contains(prevHandle)).toBe(true);
    expect(next.classList.contains("waveform-segment-region-selected")).toBe(true);
  });
});
