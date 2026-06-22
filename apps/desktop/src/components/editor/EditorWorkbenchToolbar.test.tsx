/** @vitest-environment jsdom */
import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EditorWorkbenchToolbar } from "./EditorWorkbenchToolbar";
import { WaveformSelectionChromeViewProvider } from "../../hooks/WaveformSelectionChromeViewContext";

vi.mock("../WaveformZoomBar", () => ({
  WaveformZoomBar: () => <div data-testid="waveform-zoom-bar" />,
}));

vi.mock("../WaveformGlobalPlaybackSpeed", () => ({
  WaveformGlobalPlaybackSpeed: () => <div data-testid="playback-speed" />,
}));

vi.mock("../WaveformPlaybackScrollFollowMode", () => ({
  WaveformPlaybackScrollFollowModeControl: () => <div data-testid="scroll-follow" />,
}));

vi.mock("../WaveformPlaybackTime", () => ({
  WaveformPlaybackTime: () => <div data-testid="playback-time" />,
}));

function makeController() {
  return {
    busy: false,
    segments: [],
    selectedIdx: 0,
  } as never;
}

vi.mock("./EditorSegmentToolbarActions", () => ({
  EditorSegmentTranscribeActions: () => <div data-testid="edit-actions" />,
}));

vi.mock("./EditorSegmentListFilterMenu", () => ({
  EditorSegmentListFilterMenu: () => null,
}));

function makeSegmentFilter() {
  return {
    filter: {
      stages: {
        auto_transcribe: true,
        ai_revised: true,
        manual_transcribe: true,
        finalized: true,
      },
      annotation: "all" as const,
    },
    filteredIndices: [],
    isActive: false,
    toggleStage: vi.fn(),
    setAnnotation: vi.fn(),
    resetFilter: vi.fn(),
  };
}

function makeTx() {
  return {
    tierScrollRef: { current: null },
    tierScrollLive: {
      scrollLeftRef: { current: 0 },
      clientWidthRef: { current: 800 },
    },
    tierScrollLayout: {
      scrollLeftPx: 0,
      clientWidthPx: 800,
      scrollWidthPx: 1600,
    },
    isReady: true,
    isPlaying: false,
    mediaDurationSec: 120,
    currentTime: 0,
    globalPlaybackRate: 1,
    playbackScrollFollowMode: "edge",
    minimapEnabled: false,
    pxPerSec: 50,
    layoutIntent: undefined,
    togglePlay: vi.fn(),
    getDisplayPlayheadTimeSec: () => 0,
    subscribePlayheadFrame: undefined,
    formatMediaTime: (t: number) => String(t),
    setGlobalPlaybackRate: vi.fn(),
    setPlaybackScrollFollowMode: vi.fn(),
    setMinimapEnabled: vi.fn(),
    zoomToFitSelection: vi.fn(),
    zoomToFitAll: vi.fn(),
    resetZoomForMedia: vi.fn(),
    setPxPerSecFromSlider: vi.fn(),
  } as never;
}

function wrapToolbar(ui: ReactElement) {
  return (
    <WaveformSelectionChromeViewProvider
      input={{
        fileId: "f1",
        selectedIdx: 0,
        segmentCount: 0,
      }}
      filterActive={false}
      filteredIndices={[]}
    >
      {ui}
    </WaveformSelectionChromeViewProvider>
  );
}

describe("EditorWorkbenchToolbar", () => {
  it("uses compact solo layout when hasAudio is false", () => {
    const { container, queryByTestId } = render(
      wrapToolbar(
      <EditorWorkbenchToolbar
        controller={makeController()}
        tx={makeTx()}
        hasAudio={false}
        segmentFilter={makeSegmentFilter()}
      />,
      ),
    );

    expect(container.querySelector(".editor-workbench-toolbar--no-audio")).toBeTruthy();
    expect(container.querySelector(".editor-workbench-toolbar-track--no-audio")).toBeTruthy();
    expect(container.querySelector(".workbench-toolbar-center--solo")).toBeTruthy();
    expect(container.querySelector(".workbench-toolbar-left")).toBeNull();
    expect(container.querySelector(".workbench-toolbar-right")).toBeNull();
    expect(queryByTestId("waveform-zoom-bar")).toBeNull();
    expect(queryByTestId("playback-speed")).toBeNull();
  });

  it("renders transport and zoom when hasAudio is true", () => {
    const { container, getByTestId } = render(
      wrapToolbar(
      <EditorWorkbenchToolbar
        controller={makeController()}
        tx={makeTx()}
        hasAudio
        segmentFilter={makeSegmentFilter()}
      />,
      ),
    );

    expect(container.querySelector(".editor-workbench-toolbar--no-audio")).toBeNull();
    expect(container.querySelector(".workbench-toolbar-left")).toBeTruthy();
    expect(container.querySelector(".workbench-toolbar-right")).toBeTruthy();
    expect(getByTestId("waveform-zoom-bar")).toBeTruthy();
    expect(getByTestId("playback-speed")).toBeTruthy();
  });
});
