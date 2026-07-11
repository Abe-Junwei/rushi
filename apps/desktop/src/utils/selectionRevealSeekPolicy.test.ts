import { describe, expect, it } from "vitest";
import { shouldRevealOnSegmentSelect, shouldSeekOnSegmentSelect } from "./selectionRevealSeekPolicy";

describe("selectionRevealSeekPolicy", () => {
  it("waveform sources seek on segment select", () => {
    expect(shouldSeekOnSegmentSelect("waveform")).toBe(true);
    expect(shouldSeekOnSegmentSelect("waveformKeyboard")).toBe(true);
    expect(shouldSeekOnSegmentSelect("list")).toBe(false);
    expect(shouldSeekOnSegmentSelect("listAdvance")).toBe(false);
    expect(shouldSeekOnSegmentSelect("listKeyboard")).toBe(false);
  });

  it("list sources reveal even when CM6 already moved primary", () => {
    expect(
      shouldRevealOnSegmentSelect({
        source: "list",
        idxChanged: true,
      }),
    ).toBe(true);
    expect(
      shouldRevealOnSegmentSelect({
        source: "listAdvance",
        idxChanged: true,
      }),
    ).toBe(true);
    expect(
      shouldRevealOnSegmentSelect({
        source: "list",
        idxChanged: false,
      }),
    ).toBe(true);
    expect(
      shouldRevealOnSegmentSelect({
        source: "listAdvance",
        idxChanged: false,
      }),
    ).toBe(true);
  });

  it("listKeyboard reveals regardless of idx change", () => {
    expect(
      shouldRevealOnSegmentSelect({
        source: "listKeyboard",
        idxChanged: true,
      }),
    ).toBe(true);
    expect(
      shouldRevealOnSegmentSelect({
        source: "listKeyboard",
        idxChanged: false,
      }),
    ).toBe(true);
  });

  it("contextMenu and multiSelect never reveal", () => {
    expect(
      shouldRevealOnSegmentSelect({
        source: "contextMenu",
        idxChanged: true,
      }),
    ).toBe(false);
    expect(
      shouldRevealOnSegmentSelect({
        source: "multiSelect",
        idxChanged: true,
      }),
    ).toBe(false);
  });

  it("reveals waveform sources only when idx changes", () => {
    expect(
      shouldRevealOnSegmentSelect({
        source: "waveform",
        idxChanged: false,
      }),
    ).toBe(false);
    expect(
      shouldRevealOnSegmentSelect({
        source: "waveformKeyboard",
        idxChanged: true,
      }),
    ).toBe(true);
  });
});
