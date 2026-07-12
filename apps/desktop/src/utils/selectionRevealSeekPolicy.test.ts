import { describe, expect, it } from "vitest";
import {
  shouldRevealOnSegmentSelect,
  shouldSeekAfterSegmentSelect,
  shouldSeekOnSegmentSelect,
} from "./selectionRevealSeekPolicy";

describe("selectionRevealSeekPolicy", () => {
  it("waveform and list click sources seek; listKeyboard never seeks", () => {
    expect(shouldSeekOnSegmentSelect("waveform")).toBe(true);
    expect(shouldSeekOnSegmentSelect("waveformKeyboard")).toBe(true);
    expect(shouldSeekOnSegmentSelect("list")).toBe(true);
    expect(shouldSeekOnSegmentSelect("listAdvance")).toBe(true);
    expect(shouldSeekOnSegmentSelect("listKeyboard")).toBe(false);
    expect(shouldSeekOnSegmentSelect("contextMenu")).toBe(false);
    expect(shouldSeekOnSegmentSelect("multiSelect")).toBe(false);
  });

  it("list seek uses react primary when CM6 projection already matches target", () => {
    expect(
      shouldSeekAfterSegmentSelect({
        source: "list",
        idx: 3,
        projectionPrimaryIdx: 3,
        reactPrimaryIdx: 0,
      }),
    ).toBe(true);
    expect(
      shouldSeekAfterSegmentSelect({
        source: "list",
        idx: 3,
        projectionPrimaryIdx: 3,
        reactPrimaryIdx: 3,
      }),
    ).toBe(false);
  });

  it("waveform seek still keys off projection primary", () => {
    expect(
      shouldSeekAfterSegmentSelect({
        source: "waveform",
        idx: 3,
        projectionPrimaryIdx: 3,
        reactPrimaryIdx: 0,
      }),
    ).toBe(false);
    expect(
      shouldSeekAfterSegmentSelect({
        source: "waveform",
        idx: 3,
        projectionPrimaryIdx: 1,
        reactPrimaryIdx: 1,
      }),
    ).toBe(true);
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
