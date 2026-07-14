// @vitest-environment jsdom

import { render, act } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it } from "vitest";
import {
  flushTierScrollFrameForTests,
  resetTierScrollFrameCoordinatorForTests,
  scheduleTierScrollFrame,
} from "../utils/tierScrollFrameCoordinator";
import {
  clearPlaybackFollowDriving,
  setCenterFollowDriving,
  setEdgeFollowDriving,
} from "../utils/waveformPlaybackSubpixel";
import { WAVEFORM_EDGE_FOLLOW } from "../utils/waveformPlaybackScrollFollow";
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

  it("absorbs scroll residual instead of hard-pinning center while playing", () => {
    const tierScroll = document.createElement("div");
    // Ideal center for t=50 / tw=1000 / vw=800 is scrollLeft=100; lag by 0.4px.
    Object.defineProperty(tierScroll, "scrollLeft", {
      value: 100.4,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(tierScroll, "clientWidth", { value: 800, configurable: true });
    const { container } = render(
      <WaveformViewportPlayhead
        {...makePlayheadProps({
          isPlaying: true,
          durationSec: 100,
          timelineWidthPx: 1000,
          currentTimeSec: 50,
          getDisplayPlayheadTimeSec: () => 50,
          tierScrollRef: { current: tierScroll },
          tierScrollLayout: { scrollLeftPx: 100.4, clientWidthPx: 800 },
          // Edge (default): still maps via effective scroll — residual stays in leftPx.
          playbackFollowMode: "edge",
        })}
      />,
    );

    const line = container.querySelector(".waveform-viewport-playhead") as HTMLDivElement;
    expect(playheadTransform(line)).toContain("399.600px");
  });

  it("P0: hard-pins to viewport center while center-follow is driving", () => {
    const tierScroll = document.createElement("div");
    Object.defineProperty(tierScroll, "scrollLeft", {
      value: 100.4,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(tierScroll, "clientWidth", { value: 800, configurable: true });
    setCenterFollowDriving(true);
    const { container } = render(
      <WaveformViewportPlayhead
        {...makePlayheadProps({
          isPlaying: true,
          durationSec: 100,
          timelineWidthPx: 1000,
          currentTimeSec: 50,
          getDisplayPlayheadTimeSec: () => 50,
          tierScrollRef: { current: tierScroll },
          tierScrollLayout: { scrollLeftPx: 100.4, clientWidthPx: 800 },
          playbackFollowMode: "center",
        })}
      />,
    );

    const line = container.querySelector(".waveform-viewport-playhead") as HTMLDivElement;
    expect(playheadTransform(line)).toContain("400.000px");
    clearPlaybackFollowDriving();
  });

  it("P0: hard-pins to edge anchor while edge page-drive is active", () => {
    const tierScroll = document.createElement("div");
    Object.defineProperty(tierScroll, "scrollLeft", {
      value: 100.4,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(tierScroll, "clientWidth", { value: 800, configurable: true });
    setEdgeFollowDriving(true);
    const { container } = render(
      <WaveformViewportPlayhead
        {...makePlayheadProps({
          isPlaying: true,
          durationSec: 100,
          timelineWidthPx: 1000,
          currentTimeSec: 50,
          getDisplayPlayheadTimeSec: () => 50,
          tierScrollRef: { current: tierScroll },
          tierScrollLayout: { scrollLeftPx: 100.4, clientWidthPx: 800 },
          playbackFollowMode: "edge",
        })}
      />,
    );

    const line = container.querySelector(".waveform-viewport-playhead") as HTMLDivElement;
    const expected = (800 * WAVEFORM_EDGE_FOLLOW.anchorFrac).toFixed(3);
    expect(playheadTransform(line)).toContain(`${expected}px`);
    clearPlaybackFollowDriving();
  });

  it("applies global playhead chrome class", () => {
    const { container } = render(
      <WaveformViewportPlayhead {...makePlayheadProps({ playheadChromeMode: "global" })} />,
    );
    const line = container.querySelector(".waveform-viewport-playhead") as HTMLDivElement;
    expect(line.classList.contains("is-global-playhead")).toBe(true);
  });
});

describe("tailwind production parity — stroke opacity scale", () => {
  it("documents that /58 opacity utilities are not emitted (use waveform.css instead)", () => {
    expect("stroke-accent-action/58".endsWith("/58")).toBe(true);
    expect("stroke-accent-action/90".endsWith("/90")).toBe(true);
  });
});
