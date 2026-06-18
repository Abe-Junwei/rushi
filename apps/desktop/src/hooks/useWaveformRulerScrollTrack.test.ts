import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { readCspLayoutRulesForElement } from "../utils/cspElementLayout";
import {
  flushTierScrollFrameForTests,
  resetTierScrollFrameCoordinatorForTests,
  scheduleTierScrollFrame,
} from "../utils/tierScrollFrameCoordinator";
import { useWaveformRulerScrollTrack } from "./useWaveformRulerScrollTrack";

describe("useWaveformRulerScrollTrack", () => {
  it("applies translate3d on tier scroll", () => {
    const tier = document.createElement("div");
    tier.scrollLeft = 120;
    Object.defineProperty(tier, "clientWidth", { value: 800, configurable: true });
    document.body.appendChild(tier);

    const track = document.createElement("div");
    document.body.appendChild(track);

    const tierScrollRef = { current: tier };
    const scrollTrackRef = { current: track };

    renderHook(() =>
      useWaveformRulerScrollTrack({
        enabled: true,
        tierScrollRef,
        scrollTrackRef,
        timelineWidthPx: 3200,
      }),
    );

    expect(readCspLayoutRulesForElement(track)).toContain("translate3d(-120px, 0, 0)");

    tier.scrollLeft = 240;
    scheduleTierScrollFrame();
    flushTierScrollFrameForTests();
    expect(readCspLayoutRulesForElement(track)).toContain("translate3d(-240px, 0, 0)");

    resetTierScrollFrameCoordinatorForTests();
    tier.remove();
    track.remove();
  });
});
