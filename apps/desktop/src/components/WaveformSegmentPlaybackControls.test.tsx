import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WaveformSegmentPlaybackControls } from "./WaveformSegmentPlaybackControls";
import { readCspLayoutRulesForElement } from "../utils/cspElementLayout";
import { clearAllCspScopeRulesForTests } from "../utils/cspNonceStyleRegistry";
import {
  flushTierScrollFrameForTests,
  resetTierScrollFrameCoordinatorForTests,
} from "../utils/tierScrollFrameCoordinator";
import type { SegmentDto } from "../tauri/projectApi";

/** 该 overlay 当前的 imperative CSP 布局规则文本（空表示未写入）。 */
function overlayCss(overlay: HTMLElement): string {
  return readCspLayoutRulesForElement(overlay) ?? "";
}

function makeTier(scrollWidth = 10_000, clientWidth = 500): HTMLDivElement {
  const el = document.createElement("div");
  Object.defineProperty(el, "scrollWidth", { configurable: true, value: scrollWidth });
  Object.defineProperty(el, "clientWidth", { configurable: true, value: clientWidth });
  return el;
}

/** 语段 10–20s 在 10000px / 100s 时间线上 = 1000–2000px。 */
function baseProps(scrollLeftPx: number) {
  const tier = makeTier();
  return {
    disabled: false,
    rulerBandHeightPx: 12,
    isPlaying: false,
    timelineWidthPx: 10_000,
    durationSec: 100,
    tierScrollRef: { current: tier as HTMLElement },
    tierScrollLive: {
      scrollLeftRef: { current: scrollLeftPx },
      clientWidthRef: { current: 500 },
    },
    tierScrollLayout: { scrollLeftPx, clientWidthPx: 500 },
    selectedSegment: { start_sec: 10, end_sec: 20 } as unknown as SegmentDto,
    segmentLoopPlayback: false,
    onToggleLoop: vi.fn(),
    onTogglePlay: vi.fn(),
  };
}

describe("WaveformSegmentPlaybackControls", () => {
  beforeEach(() => {
    resetTierScrollFrameCoordinatorForTests();
    clearAllCspScopeRulesForTests();
  });
  afterEach(() => {
    resetTierScrollFrameCoordinatorForTests();
    clearAllCspScopeRulesForTests();
  });

  it("positions the overlay imperatively for the visible segment on mount", () => {
    // 视口 1200–1700，语段 1000–2000 可见。
    const { container } = render(<WaveformSegmentPlaybackControls {...baseProps(1200)} />);
    const overlay = container.querySelector(".region-action-overlay") as HTMLElement;
    expect(overlay).toBeTruthy();

    const css = overlayCss(overlay);
    expect(css).toContain("left:");
    expect(css).toContain("width:");
    // bottom 单独写入一次（不随滚动重写）。
    expect(css).toContain("bottom:");
    expect(css).not.toContain("display: none");
  });

  it("hides the overlay on a scroll frame when the segment leaves the viewport (no re-render)", () => {
    const props = baseProps(1200);
    const { container } = render(<WaveformSegmentPlaybackControls {...props} />);
    const overlay = container.querySelector(".region-action-overlay") as HTMLElement;
    expect(overlayCss(overlay)).not.toContain("display: none");

    // 仅改 live ref（不改 props，不触发 React re-render），把语段滚出视口。
    props.tierScrollLive.scrollLeftRef.current = 6000;
    flushTierScrollFrameForTests();

    expect(overlayCss(overlay)).toContain("display: none");
  });

  it("re-shows the overlay when a later scroll frame brings the segment back", () => {
    const props = baseProps(6000);
    const { container } = render(<WaveformSegmentPlaybackControls {...props} />);
    const overlay = container.querySelector(".region-action-overlay") as HTMLElement;
    expect(overlayCss(overlay)).toContain("display: none");

    props.tierScrollLive.scrollLeftRef.current = 1200;
    flushTierScrollFrameForTests();

    const css = overlayCss(overlay);
    expect(css).toContain("left:");
    expect(css).not.toContain("display: none");
  });
});
