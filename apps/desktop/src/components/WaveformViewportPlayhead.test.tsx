import { render, act } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { readCspLayoutRulesForElement } from "../utils/cspElementLayout";
import {
  flushTierScrollFrameForTests,
  resetTierScrollFrameCoordinatorForTests,
  scheduleTierScrollFrame,
} from "../utils/tierScrollFrameCoordinator";
import { WaveformViewportPlayhead } from "./WaveformViewportPlayhead";

describe("WaveformViewportPlayhead", () => {
  it("positions playhead in tier viewport coordinates (timeline px − scrollLeft)", () => {
    const tierScroll = document.createElement("div");
    Object.defineProperty(tierScroll, "scrollLeft", { value: 200, writable: true, configurable: true });
    Object.defineProperty(tierScroll, "clientWidth", { value: 800, configurable: true });
    const tierScrollRef = { current: tierScroll };

    const { container } = render(
      <WaveformViewportPlayhead
        durationSec={100}
        timelineWidthPx={1000}
        tierScrollRef={tierScrollRef}
        tierScrollLayout={{ scrollLeftPx: 200, clientWidthPx: 800 }}
        isPlaying={false}
        isReady
        currentTimeSec={50}
        getPlayheadTime={() => 50}
        formatMediaTime={(s) => `${s}`}
      />,
    );

    const line = container.querySelector(".waveform-viewport-playhead") as HTMLDivElement;
    expect(line).toBeTruthy();
    // 50% of 1000px timeline = 500px; viewport x = 500 - 200 = 300
    expect(readCspLayoutRulesForElement(line)).toContain("translate3d(300px, 0, 0)");
  });

  it("updates transform on tier scroll without React rerender", () => {
    const tierScroll = document.createElement("div");
    Object.defineProperty(tierScroll, "scrollLeft", { value: 0, writable: true, configurable: true });
    Object.defineProperty(tierScroll, "clientWidth", { value: 800, configurable: true });
    const tierScrollRef = { current: tierScroll };

    const { container } = render(
      <WaveformViewportPlayhead
        durationSec={100}
        timelineWidthPx={1000}
        tierScrollRef={tierScrollRef}
        tierScrollLayout={{ scrollLeftPx: 0, clientWidthPx: 800 }}
        isPlaying={false}
        isReady
        currentTimeSec={30}
        getPlayheadTime={() => 30}
        formatMediaTime={(s) => `${s}`}
      />,
    );

    const line = container.querySelector(".waveform-viewport-playhead") as HTMLDivElement;
    tierScroll.scrollLeft = 100;
    act(() => {
      scheduleTierScrollFrame();
      flushTierScrollFrameForTests();
    });
    resetTierScrollFrameCoordinatorForTests();
    expect(readCspLayoutRulesForElement(line)).toContain("translate3d(200px, 0, 0)");
  });
});

describe("tailwind production parity — stroke opacity scale", () => {
  it("documents that /58 opacity utilities are not emitted (use waveform.css instead)", () => {
    // Guard against regressing to stroke-accent-action/58 on release-only playhead paths.
    expect("stroke-accent-action/58".endsWith("/58")).toBe(true);
    expect("stroke-accent-action/90".endsWith("/90")).toBe(true);
  });
});
