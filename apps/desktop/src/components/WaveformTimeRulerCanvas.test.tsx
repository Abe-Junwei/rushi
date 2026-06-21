// @vitest-environment jsdom

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  flushTierScrollFrameForTests,
  resetTierScrollFrameCoordinatorForTests,
  scheduleTierScrollFrame,
} from "../utils/tierScrollFrameCoordinator";
import { WaveformTimeRulerCanvas } from "./WaveformTimeRulerCanvas";

function makeTierScrollRef(input: { scrollLeft: number; clientWidth: number }) {
  const el = document.createElement("div");
  let scrollLeft = input.scrollLeft;
  Object.defineProperty(el, "scrollLeft", {
    configurable: true,
    get: () => scrollLeft,
    set: (value: number) => {
      scrollLeft = value;
    },
  });
  Object.defineProperty(el, "clientWidth", { configurable: true, value: input.clientWidth });
  return { current: el, setScrollLeft: (value: number) => {
    scrollLeft = value;
  } };
}

function mockCanvasContext() {
  const stroke = vi.fn();
  const fillText = vi.fn();
  const clearRect = vi.fn();
  const getContext = vi.spyOn(HTMLCanvasElement.prototype, "getContext");
  getContext.mockReturnValue({
    setTransform: vi.fn(),
    clearRect,
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke,
    fillText,
    strokeStyle: "",
    fillStyle: "",
    lineWidth: 1,
    font: "",
    textBaseline: "",
  } as unknown as CanvasRenderingContext2D);
  return { getContext, stroke, fillText, clearRect };
}

describe("WaveformTimeRulerCanvas", () => {
  afterEach(() => {
    resetTierScrollFrameCoordinatorForTests();
    cleanup();
  });

  it("paints embedded viewport ticks on a buffered canvas window", () => {
    const tierScrollRef = makeTierScrollRef({ scrollLeft: 1000, clientWidth: 500 });
    const { stroke, fillText, clearRect, getContext } = mockCanvasContext();

    const { container } = render(
      <WaveformTimeRulerCanvas
        durationSec={100}
        timelineWidthPx={2000}
        tierScrollRef={tierScrollRef}
        tierScrollLive={{
          scrollLeftRef: { current: 1000 },
          clientWidthRef: { current: 500 },
        }}
        tierScrollLayout={{ scrollLeftPx: 1000, clientWidthPx: 500 }}
        currentTimeSec={50}
        formatMediaTime={(sec) => `${sec}`}
        onCenterTierAtClientX={vi.fn()}
        onSetScrollLeftPx={vi.fn()}
      />,
    );

    const canvas = container.querySelector(".waveform-time-ruler-canvas") as HTMLCanvasElement;
    expect(canvas).toBeTruthy();
    expect(stroke).toHaveBeenCalled();
    expect(fillText).toHaveBeenCalled();
    expect(clearRect).toHaveBeenCalledWith(0, 0, 2000, 22);
    getContext.mockRestore();
  });

  it("skips canvas repaint on small tier scroll within painted buffer", () => {
    const tierScrollRef = makeTierScrollRef({ scrollLeft: 1000, clientWidth: 500 });
    const { clearRect, getContext } = mockCanvasContext();

    render(
      <WaveformTimeRulerCanvas
        durationSec={100}
        timelineWidthPx={2000}
        tierScrollRef={tierScrollRef}
        tierScrollLive={{
          scrollLeftRef: { current: 1000 },
          clientWidthRef: { current: 500 },
        }}
        tierScrollLayout={{ scrollLeftPx: 1000, clientWidthPx: 500 }}
        currentTimeSec={50}
        formatMediaTime={(sec) => `${sec}`}
        onCenterTierAtClientX={vi.fn()}
        onSetScrollLeftPx={vi.fn()}
      />,
    );

    clearRect.mockClear();
    tierScrollRef.current.scrollLeft = 1020;
    act(() => {
      scheduleTierScrollFrame();
      flushTierScrollFrameForTests();
    });
    expect(clearRect).not.toHaveBeenCalled();
    getContext.mockRestore();
  });

  it("repaints when tier scroll exits the painted buffer", () => {
    const tierScrollRef = makeTierScrollRef({ scrollLeft: 1000, clientWidth: 500 });
    const { clearRect, getContext } = mockCanvasContext();

    render(
      <WaveformTimeRulerCanvas
        durationSec={100}
        timelineWidthPx={20_000}
        tierScrollRef={tierScrollRef}
        tierScrollLive={{
          scrollLeftRef: { current: 1000 },
          clientWidthRef: { current: 500 },
        }}
        tierScrollLayout={{ scrollLeftPx: 1000, clientWidthPx: 500 }}
        currentTimeSec={50}
        formatMediaTime={(sec) => `${sec}`}
        onCenterTierAtClientX={vi.fn()}
        onSetScrollLeftPx={vi.fn()}
      />,
    );

    clearRect.mockClear();
    tierScrollRef.current.scrollLeft = 3600;
    act(() => {
      scheduleTierScrollFrame();
      flushTierScrollFrameForTests();
    });
    expect(clearRect).toHaveBeenCalled();
    getContext.mockRestore();
  });

  it("uses viewportWidthPx fallback when tier metrics are not ready", () => {
    const tierScrollRef = makeTierScrollRef({ scrollLeft: 0, clientWidth: 0 });
    const { clearRect, getContext } = mockCanvasContext();

    render(
      <WaveformTimeRulerCanvas
        durationSec={100}
        timelineWidthPx={2000}
        viewportWidthPx={640}
        tierScrollRef={tierScrollRef}
        tierScrollLive={{
          scrollLeftRef: { current: 0 },
          clientWidthRef: { current: 0 },
        }}
        tierScrollLayout={{ scrollLeftPx: 0, clientWidthPx: 0 }}
        currentTimeSec={0}
        formatMediaTime={(sec) => `${sec}`}
        onCenterTierAtClientX={vi.fn()}
        onSetScrollLeftPx={vi.fn()}
      />,
    );

    expect(clearRect).toHaveBeenCalledWith(0, 0, 2000, 22);
    getContext.mockRestore();
  });
});
