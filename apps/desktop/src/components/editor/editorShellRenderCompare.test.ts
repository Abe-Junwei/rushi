import { describe, expect, it } from "vitest";
import type { ProjectControllerApi } from "../../pages/useProjectController";
import type { TranscriptionLayerApi } from "../../pages/useTranscriptionLayer";
import {
  editorWaveformPanePropsEqual,
  projectControllerShellRenderEqual,
  transcriptionLayerWaveformShellRenderEqual,
} from "./editorShellRenderCompare";

function makeController(overrides: Partial<{ selectedIdx: number; busy: boolean }> = {}) {
  return {
    busy: false,
    currentFileId: "f1",
    segments: [{ uid: "a", idx: 0, start_sec: 0, end_sec: 1, text: "a" }],
    selectedIdx: overrides.selectedIdx ?? 0,
    selectionLo: overrides.selectedIdx ?? 0,
    selectionHi: overrides.selectedIdx ?? 0,
    updateSegmentBounds: () => {},
    insertSegmentFromTimeRange: () => null,
    isIndexInSelection: () => false,
    clearMultiSelection: () => {},
  } as unknown as ProjectControllerApi;
}

function makeTx(overrides: Partial<{ currentTime: number; isPlaying: boolean }> = {}) {
  return {
    isReady: true,
    loadError: null,
    peaksError: null,
    isPlaying: overrides.isPlaying ?? false,
    isSelectedSegmentPlaying: false,
    playheadChromeMode: "segment" as const,
    segmentLoopPlayback: false,
    mediaDurationSec: 60,
    timelineWidthPx: 1200,
    waveformStageHeightPx: 120,
    waveformHeightPx: 120,
    waveformPaintedHeightPx: 120,
    waveformHeightDragging: false,
    waveformPeaksPhase: "ready",
    mountDeferTimedOut: false,
    minimapEnabled: false,
    peaksLoading: false,
    peakCacheGeneration: 0,
    pxPerSec: 40,
    playbackScrollFollowMode: "edge",
    tierScrollLayout: { scrollLeftPx: 0, clientWidthPx: 800 },
    segmentLaneLayout: { laneByIndex: [0], laneCount: 1, dominantSpanIndices: [] },
    currentTime: overrides.currentTime ?? 0,
    beginWaveformHeightDrag: () => {},
    focusWaveformShell: () => {},
    openSegmentContextMenuFromPointer: () => {},
    selectSegmentAt: () => {},
    dispatchWaveformSelectionGesture: () => false,
    selectSegmentIndices: () => {},
    seek: () => {},
    seekBlankToTime: () => {},
    playSegmentAtIndex: async () => {},
    handleToggleSelectedWaveformLoop: () => {},
    handleToggleSelectedWaveformPlay: () => {},
    centerTierAtClientX: () => {},
    userScrubScroll: () => {},
    minimapScrubScroll: () => {},
    exportMinimapPeaks: () => null,
    formatMediaTime: (t: number) => String(t),
    getDisplayPlayheadTimeSec: () => 0,
    subscribePlayheadFrame: () => () => {},
    clientXToTimeSec: () => 0,
    suppressPlaybackFollowForSelectionSeek: () => {},
  } as unknown as TranscriptionLayerApi;
}

describe("editorShellRenderCompare", () => {
  it("projectControllerShellRenderEqual ignores selectedIdx-only churn", () => {
    const a = makeController({ selectedIdx: 0 });
    const b = { ...a, selectedIdx: 9, selectionLo: 9, selectionHi: 9 };
    expect(projectControllerShellRenderEqual(a, b)).toBe(true);
  });

  it("projectControllerShellRenderEqual detects busy change", () => {
    const a = makeController();
    const b = makeController();
    (b as { busy: boolean }).busy = true;
    expect(projectControllerShellRenderEqual(a, b)).toBe(false);
  });

  it("transcriptionLayerWaveformShellRenderEqual ignores currentTime-only churn", () => {
    const a = makeTx({ currentTime: 0 });
    const b = { ...a, currentTime: 12.5 };
    expect(transcriptionLayerWaveformShellRenderEqual(a, b)).toBe(true);
  });

  it("transcriptionLayerWaveformShellRenderEqual detects isPlaying change", () => {
    expect(transcriptionLayerWaveformShellRenderEqual(makeTx({ isPlaying: false }), makeTx({ isPlaying: true }))).toBe(
      false,
    );
  });

  it("editorWaveformPanePropsEqual ignores SC1-only pair", () => {
    const controller = makeController({ selectedIdx: 1 });
    const tx = makeTx({ currentTime: 0 });
    expect(
      editorWaveformPanePropsEqual(
        { controller, tx },
        {
          controller: { ...controller, selectedIdx: 8, selectionLo: 8, selectionHi: 8 },
          tx: { ...tx, currentTime: 4.2 },
        },
      ),
    ).toBe(true);
  });
});
