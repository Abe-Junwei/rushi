// @vitest-environment jsdom

import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { EditorWaveformPeaksStage } from "./EditorWaveformPeaksStage";
import { WaveformSelectionChromeViewProvider } from "../../hooks/WaveformSelectionChromeViewContext";
import { readCspLayoutRulesForElement } from "../../utils/cspElementLayout";
import { clearAllCspScopeRulesForTests } from "../../utils/cspNonceStyleRegistry";
import {
  resetTranscriptProjectionForTests,
  seedTranscriptProjectionForTests,
} from "./core/transcriptProjection";

function createController() {
  return {
    busy: false,
    currentFileId: "file-1",
    segments: [
      { uid: "a", idx: 0, start_sec: 0, end_sec: 2, text: "a" },
      { uid: "b", idx: 1, start_sec: 2, end_sec: 4, text: "b" },
    ],
    selectedIdx: 0,
    selectionLo: 0,
    selectionHi: 0,
    selectionCount: 1,
    isContiguousSelection: true,
    selectedIndices: new Set<number>([0]),
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
    subscribePlayheadFrame: () => () => {},
    formatMediaTime: (sec: number) => `${sec}`,
    clientXToTimeSec: (clientX: number) => clientX / 40,
    selectSegmentAt: vi.fn(),
    focusSegmentAfterWaveformCreate: vi.fn(),
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

function wrapPeaksStage(ui: ReactElement, controller = createController()) {
  return (
    <WaveformSelectionChromeViewProvider
      input={{
        fileId: controller.currentFileId,
        selectedIdx: controller.selectedIdx,
        selectionLo: controller.selectionLo,
        selectionHi: controller.selectionHi,
        selectionCount: controller.selectionCount,
        isContiguousSelection: controller.isContiguousSelection,
        selectedIndices: controller.selectedIndices,
        segmentCount: controller.segments.length,
      }}
      filterActive={false}
      filteredIndices={controller.segments.map((_, idx) => idx)}
    >
      {ui}
    </WaveformSelectionChromeViewProvider>
  );
}

describe("EditorWaveformPeaksStage", () => {
  afterEach(() => {
    clearAllCspScopeRulesForTests();
    resetTranscriptProjectionForTests();
  });

  it("keeps WaveSurfer host at viewport width and overlay at timeline width", () => {
    const { container } = render(
      wrapPeaksStage(
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
      ),
    );

    const waveLayer = container.querySelector(".waveform-timeline-wave-layer");
    const overlayLayer = container.querySelector(".waveform-timeline-overlay-layer");

    expect(waveLayer).toBeInstanceOf(HTMLElement);
    expect(overlayLayer).toBeInstanceOf(HTMLElement);
    expect((waveLayer as HTMLElement).className).toContain("absolute");
    expect((waveLayer as HTMLElement).className).not.toContain("sticky");
    expect((waveLayer as HTMLElement).className).toContain("h-0");
    expect(readCspLayoutRulesForElement(waveLayer as HTMLElement)).toContain("width: 800px");
    expect(readCspLayoutRulesForElement(overlayLayer as HTMLElement)).toContain("width: 2400px");
    expect(container.querySelector("[data-ws2b-viewport-peaks-canvas]")).toBeInstanceOf(
      HTMLElement,
    );
    expect(container.querySelector("[data-ws2b-played-tint]")).toBeInstanceOf(HTMLElement);
    expect(container.querySelector("[data-ws2b-played-tint]")?.className).toContain(
      "waveform-viewport-played-tint",
    );
    const waveSurferPreview = container.querySelector('[role="img"]')?.parentElement?.parentElement;
    expect(waveSurferPreview).toBeInstanceOf(HTMLElement);
    expect((waveSurferPreview as HTMLElement).className).toContain("opacity-0");
    expect(readCspLayoutRulesForElement(waveSurferPreview as HTMLElement)).toContain("width: 1px");
    expect(readCspLayoutRulesForElement(waveSurferPreview as HTMLElement)).toContain("height: 1px");

    const pinShell = container.querySelector(".waveform-viewport-playhead")?.parentElement?.parentElement;
    expect(pinShell).toBeInstanceOf(HTMLElement);
    expect((pinShell as HTMLElement).className).toContain("h-0");
    expect((pinShell as HTMLElement).className).toContain("absolute");
    expect((pinShell as HTMLElement).className).not.toContain("sticky");
    expect(readCspLayoutRulesForElement(pinShell as HTMLElement)).toContain("width: 800px");
  });

  it("positions playback controls from CM6 projection before React selectedIdx catches up", () => {
    seedTranscriptProjectionForTests({
      primaryIdx: 1,
      selectedSet: new Set([1]),
      rangeAnchor: 1,
      lineCount: 2,
    });
    const controller = createController();

    const { container } = render(
      wrapPeaksStage(
      <EditorWaveformPeaksStage
        controller={controller as never}
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
      ),
    );

    const overlay = container.querySelector(".region-action-overlay");
    expect(overlay).toBeInstanceOf(HTMLElement);
    const rules = readCspLayoutRulesForElement(overlay as HTMLElement) ?? "";
    expect(rules).toContain("left:");
    expect(rules).not.toContain("display: none");
  });
});
