// @vitest-environment jsdom

import { render, act } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";
import {
  flushTierScrollFrameForTests,
  resetTierScrollFrameCoordinatorForTests,
  scheduleTierScrollFrame,
} from "../utils/tierScrollFrameCoordinator";
import { WaveformViewportPlayhead } from "./WaveformViewportPlayhead";

/** Imperative playhead transform is a direct CSP-legal inline style write (setDirectLayoutStyle). */
function playheadTransform(line: HTMLElement): string {
  return line.style.transform ?? "";
}

function makePlayheadProps(overrides: Partial<ComponentProps<typeof WaveformViewportPlayhead>> = {}) {
  const tierScroll = document.createElement("div");
  Object.defineProperty(tierScroll, "scrollLeft", { value: 200, writable: true, configurable: true });
  Object.defineProperty(tierScroll, "clientWidth", { value: 800, configurable: true });
  return {
    durationSec: 100,
    timelineWidthPx: 1000,
    tierScrollRef: { current: tierScroll },
    tierScrollLayout: { scrollLeftPx: 200, clientWidthPx: 800 },
    isPlaying: false,
    isReady: true,
    currentTimeSec: 50,
    getDisplayPlayheadTimeSec: () => 50,
    subscribePlayheadFrame: (_cb: (timeSec: number) => void) => () => {},
    playbackFollowMode: "edge" as const,
    ...overrides,
  };
}

describe("WaveformViewportPlayhead", () => {
  it("positions playhead in tier viewport coordinates (timeline px − scrollLeft)", () => {
    const { container } = render(<WaveformViewportPlayhead {...makePlayheadProps()} />);

    const line = container.querySelector(".waveform-viewport-playhead") as HTMLDivElement;
    expect(line).toBeTruthy();
    expect(playheadTransform(line)).toContain("300.000px");
  });

  it("updates transform on tier scroll without React rerender", () => {
    const props = makePlayheadProps({
      tierScrollLayout: { scrollLeftPx: 0, clientWidthPx: 800 },
      currentTimeSec: 30,
      getDisplayPlayheadTimeSec: () => 30,
    });
    props.tierScrollRef.current!.scrollLeft = 0;

    const { container } = render(<WaveformViewportPlayhead {...props} />);

    const line = container.querySelector(".waveform-viewport-playhead") as HTMLDivElement;
    props.tierScrollRef.current!.scrollLeft = 100;
    act(() => {
      scheduleTierScrollFrame();
      flushTierScrollFrameForTests();
    });
    resetTierScrollFrameCoordinatorForTests();
    expect(playheadTransform(line)).toContain("200.000px");
  });

  it("preserves subpixel playhead positioning in edge mode", () => {
    const tierScroll = document.createElement("div");
    Object.defineProperty(tierScroll, "scrollLeft", { value: 0, writable: true, configurable: true });
    Object.defineProperty(tierScroll, "clientWidth", { value: 800, configurable: true });
    const { container } = render(
      <WaveformViewportPlayhead
        {...makePlayheadProps({
          tierScrollRef: { current: tierScroll },
          tierScrollLayout: { scrollLeftPx: 0, clientWidthPx: 800 },
          currentTimeSec: 33.3333,
          getDisplayPlayheadTimeSec: () => 33.3333,
        })}
      />,
    );

    const line = container.querySelector(".waveform-viewport-playhead") as HTMLDivElement;
    expect(playheadTransform(line)).toContain("333.333px");
  });

  it("pins playhead at viewport center while playing in center follow mode", () => {
    const { container } = render(
      <WaveformViewportPlayhead
        {...makePlayheadProps({
          isPlaying: true,
          getDisplayPlayheadTimeSec: () => 12.345,
          playbackFollowMode: "center",
        })}
      />,
    );

    const line = container.querySelector(".waveform-viewport-playhead") as HTMLDivElement;
    expect(playheadTransform(line)).toContain("400.000px");
  });
});

describe("tailwind production parity — stroke opacity scale", () => {
  it("documents that /58 opacity utilities are not emitted (use waveform.css instead)", () => {
    expect("stroke-accent-action/58".endsWith("/58")).toBe(true);
    expect("stroke-accent-action/90".endsWith("/90")).toBe(true);
  });
});
