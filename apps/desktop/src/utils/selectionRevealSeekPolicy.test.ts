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

  it("list sources reveal when idx changes", () => {
    expect(
      shouldRevealOnSegmentSelect({
        source: "list",
        idxChanged: true,
        editorFocusGateOpen: false,
      }),
    ).toBe(true);
    expect(
      shouldRevealOnSegmentSelect({
        source: "listAdvance",
        idxChanged: true,
        editorFocusGateOpen: false,
      }),
    ).toBe(true);
  });

  it("listKeyboard reveals on idx change regardless of focus gate", () => {
    expect(
      shouldRevealOnSegmentSelect({
        source: "listKeyboard",
        idxChanged: true,
        editorFocusGateOpen: true,
      }),
    ).toBe(true);
    expect(
      shouldRevealOnSegmentSelect({
        source: "listKeyboard",
        idxChanged: true,
        editorFocusGateOpen: false,
      }),
    ).toBe(true);
    expect(
      shouldRevealOnSegmentSelect({
        source: "listKeyboard",
        idxChanged: false,
        editorFocusGateOpen: true,
      }),
    ).toBe(false);
  });

  it("contextMenu and multiSelect never reveal", () => {
    expect(
      shouldRevealOnSegmentSelect({
        source: "contextMenu",
        idxChanged: true,
        editorFocusGateOpen: false,
      }),
    ).toBe(false);
    expect(
      shouldRevealOnSegmentSelect({
        source: "multiSelect",
        idxChanged: true,
        editorFocusGateOpen: true,
      }),
    ).toBe(false);
  });

  it("reveals waveform sources only when idx changes", () => {
    expect(
      shouldRevealOnSegmentSelect({
        source: "waveform",
        idxChanged: false,
        editorFocusGateOpen: true,
      }),
    ).toBe(false);
    expect(
      shouldRevealOnSegmentSelect({
        source: "waveformKeyboard",
        idxChanged: true,
        editorFocusGateOpen: true,
      }),
    ).toBe(true);
  });
});
