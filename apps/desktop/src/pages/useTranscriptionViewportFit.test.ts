// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { resolveViewportFitScrollPx } from "./useTranscriptionViewportFit";
import { useTranscriptionViewportFit } from "./useTranscriptionViewportFit";

describe("resolveViewportFitScrollPx", () => {
  it("centers selected segment after zoom", () => {
    const px = 100;
    const scroll = resolveViewportFitScrollPx({
      pending: {
        intent: { startSec: 10, endSec: 12 },
        pxPerSec: px,
      },
      durationSec: 120,
      viewportWidthPx: 800,
    });
    const tw = Math.ceil(120 * px);
    expect(scroll).toBe((10 / 120) * tw - (800 - (2 / 120) * tw) / 2);
    expect(scroll).toBeGreaterThanOrEqual(0);
    expect(scroll).toBeLessThanOrEqual(Math.max(0, tw - 800));
  });
});

describe("useTranscriptionViewportFit", () => {
  it("reveals selected segments with an immediate tier scroll, not smooth animation", () => {
    const tier = document.createElement("div");
    Object.defineProperty(tier, "clientWidth", { configurable: true, value: 800 });
    Object.defineProperty(tier, "scrollLeft", { configurable: true, value: 0 });
    const revealSelectionScroll = vi.fn();

    const { result } = renderHook(() =>
      useTranscriptionViewportFit({
        tierScrollRef: { current: tier },
        durationRef: { current: 120 },
        scrollApiRef: {
          current: {
            revealSelectionScroll,
          },
        },
        wfApiRef: { current: { cancelInFlightZoom: vi.fn() } as never },
        zoom: {
          setFitPxPerSec: vi.fn(),
          enterFitAllLayout: vi.fn(),
        },
        currentPxPerSec: 100,
        currentPxPerSecRef: { current: 100 },
        waveformReady: true,
        mediaUrl: "/audio.wav",
        getSelectedSegment: () => ({ start_sec: 10, end_sec: 12 }),
        playbackFollowSuppressUntilRef: { current: 0 },
      }),
    );

    act(() => {
      result.current.revealSegmentInViewport({ start_sec: 10, end_sec: 12 });
    });

    expect(revealSelectionScroll).toHaveBeenCalledWith(expect.any(Number), {});
  });
});
