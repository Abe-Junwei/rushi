import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { EditorWaveformPeaksStage } from "./EditorWaveformPeaksStage";
import { readCspLayoutRulesForElement } from "../../utils/cspElementLayout";
import { clearAllCspScopeRulesForTests } from "../../utils/cspNonceStyleRegistry";

function createController() {
  return {
    busy: false,
    segments: [],
    selectedIdx: -1,
    selectionLo: -1,
    selectionHi: -1,
    selectionCount: 0,
    isContiguousSelection: false,
    selectedIndices: new Set<number>(),
    isIndexInSelection: () => false,
    isMultiSegmentSelection: false,
    selectSegmentIndices: vi.fn(),
    clearMultiSelection: vi.fn(),
    updateSegmentBounds: vi.fn(),
    insertSegmentFromTimeRange: vi.fn(),
  };
}

function createTranscriptionLayer() {
  return {
    isReady: true,
    loadError: null,
    peaksError: null,
    mediaDurationSec: 60,
    timelineWidthPx: 2400,
    pxPerSec: 40,
    waveformShellRef: { current: null },
    waveformTimelineShellRef: { current: null },
    waveformStretchShellRef: { current: null },
    waveformStickyShellRef: { current: null },
    containerRef: { current: null },
    tierScrollRef: { current: null },
    tierScrollLive: {
      scrollLeftRef: { current: 0 },
      clientWidthRef: { current: 800 },
    },
    tierScrollLayout: {
      scrollLeftPx: 0,
      clientWidthPx: 800,
    },
    segmentLaneLayout: {
      laneByIndex: [],
      laneCount: 1,
      dominantSpanIndices: [],
    },
    currentTime: 0,
    isPlaying: false,
    isSelectedSegmentPlaying: false,
    segmentLoopPlayback: false,
    openSegmentContextMenuFromPointer: vi.fn(),
    focusWaveformShell: vi.fn(),
    getPlayheadTime: () => 0,
    getDisplayPlayheadTimeSec: () => 0,
    subscribePlayheadFrame: undefined,
    formatMediaTime: (sec: number) => `${sec}`,
    clientXToTimeSec: (clientX: number) => clientX / 40,
    selectSegmentAt: vi.fn(),
    revealSelectedSegmentInViewport: vi.fn(),
    playSegmentAtIndex: vi.fn(),
    seek: vi.fn(),
    handleToggleSelectedWaveformLoop: vi.fn(),
    handleToggleSelectedWaveformPlay: vi.fn(),
    seekFromTierClientX: vi.fn(),
    centerTierAtClientX: vi.fn(),
    setTierScrollPx: vi.fn(),
  };
}

describe("EditorWaveformPeaksStage", () => {
  afterEach(() => {
    clearAllCspScopeRulesForTests();
  });

  it("keeps timeline waveform and overlay layers at timeline width for pointer hit-testing", () => {
    const { container } = render(
      <EditorWaveformPeaksStage
        controller={createController() as never}
        tx={createTranscriptionLayer() as never}
        viewportWidthPx={800}
        peaksPaneHeightPx={120}
        peaksPaintedHeightPx={120}
        segmentLayoutHeightPx={120}
        waveformVerticalTransform={undefined}
        waveSurferPreviewLayerClass="w-full"
        waveformHeightPreviewActive={false}
        stripDisabled={false}
        tierScrollProps={{
          tierScrollRef: { current: null },
          tierScrollLive: {
            scrollLeftRef: { current: 0 },
            clientWidthRef: { current: 800 },
          },
          tierScrollLayout: {
            scrollLeftPx: 0,
            clientWidthPx: 800,
          },
        }}
      />,
    );

    const waveLayer = container.querySelector(".waveform-timeline-wave-layer");
    const overlayLayer = container.querySelector(".waveform-timeline-overlay-layer");

    expect(waveLayer).toBeInstanceOf(HTMLElement);
    expect(overlayLayer).toBeInstanceOf(HTMLElement);
    expect(readCspLayoutRulesForElement(waveLayer as HTMLElement)).toContain("width: 2400px");
    expect(readCspLayoutRulesForElement(overlayLayer as HTMLElement)).toContain("width: 2400px");
  });
});
