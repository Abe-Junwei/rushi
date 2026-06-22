// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTranscriptionLayerSelection } from "../pages/useTranscriptionLayerSelection";
import type { TranscriptionLayerInput } from "../pages/transcriptionLayerTypes";
import {
  computeSelectionProfileSyncPathMs,
  parseSelectionProfileLine,
  readRecentSelectionLatencyProfileLines,
  resetSelectionLatencyProfileForTests,
  SELECTION_PROFILE_BASELINE_SEGMENT_COUNT,
  SELECTION_PROFILE_CI_SYNC_PATH_MAX_MS,
  SELECTION_PROFILE_HAND_CHROME_MAX_MS,
  selectionProfileFlush,
  selectionProfileMeetsCiGate,
  selectionProfileMeetsHandChromeGate,
  setSelectionLatencyProfileEnabled,
} from "../services/ui/selectionLatencyProfile";

function makeSegments(count: number) {
  return Array.from({ length: count }, (_, idx) => ({
    uid: `seg-${idx}`,
    idx,
    start_sec: idx * 2,
    end_sec: idx * 2 + 1.5,
    text: `语段 ${idx + 1}`,
  }));
}

function makeCtx(segmentCount: number, selectedIdx = 0): TranscriptionLayerInput {
  const segments = makeSegments(segmentCount);
  return {
    projectId: "p1",
    fileId: "f1",
    mediaUrl: null,
    segments,
    selectedIdx,
    busy: false,
    selectionLo: selectedIdx,
    selectionHi: selectedIdx,
    selectionRangeAnchorIdx: selectedIdx,
    selectionCount: 1,
    isMultiSegmentSelection: false,
    isContiguousSelection: true,
    selectedIndicesArray: [selectedIdx],
    selectSegmentIndices: vi.fn(),
    requestDeleteSelectedIndices: vi.fn(),
    clearMultiSelection: vi.fn(),
    isIndexInSelection: () => true,
    selectSegmentAt: vi.fn(),
    selectSegmentRange: vi.fn(),
    undo: vi.fn(),
    redo: vi.fn(),
    updateSegmentBounds: vi.fn(),
    insertSegmentFromTimeRange: vi.fn(),
    splitAtSelection: vi.fn(),
    splitAtPlayhead: vi.fn(),
    mergeWithNext: vi.fn(),
    mergeWithPrev: vi.fn(),
    mergeWithNextAt: vi.fn(),
    mergeWithPrevAt: vi.fn(),
    mergeSegmentRange: vi.fn(),
    insertSegmentAfter: vi.fn(),
    deleteSegmentAt: vi.fn(),
    requestDeleteSelection: vi.fn(),
    confirmSegmentEditAndAdvance: vi.fn(() => Promise.resolve(true)),
    saveSegments: vi.fn(() => Promise.resolve(true)),
    triggerFindReplaceShortcut: vi.fn(),
    closeFile: vi.fn(),
    openEnvironment: vi.fn(),
    openSegmentAnnotationDialog: vi.fn(),
    openManualCorrectionMemoryDialog: vi.fn(),
  };
}

function makeTimeline() {
  const tier = document.createElement("div");
  const overlayRoot = document.createElement("div");
  overlayRoot.className = "waveform-timeline-overlay-layer";
  tier.appendChild(overlayRoot);
  return {
    timelineMetrics: { mediaDurationSec: segmentCountToDuration(SELECTION_PROFILE_BASELINE_SEGMENT_COUNT) },
    tierScrollRef: { current: tier },
    wfApiRef: {
      current: {
        seek: vi.fn(),
        clientXToTimeSec: vi.fn(() => 0),
      },
    },
    zoom: { layoutIntentRef: { current: "manual" as const } },
    viewportFit: {
      revealSegmentInViewport: vi.fn(),
      zoomToFitSegment: vi.fn(),
    },
    suppressPlaybackFollowForSelectionSeek: vi.fn(),
    overlayRoot,
  };
}

function segmentCountToDuration(count: number): number {
  return count * 2 + 1.5;
}

function seedOverlayNodes(overlayRoot: ParentNode, indices: number[]): void {
  for (const idx of indices) {
    const el = document.createElement("div");
    el.setAttribute("data-segment-idx", String(idx));
    el.className = "waveform-segment-region";
    overlayRoot.appendChild(el);
  }
}

function latestProfileLine(matcher: (line: string) => boolean): string {
  const lines = readRecentSelectionLatencyProfileLines().filter(matcher);
  const line = lines[lines.length - 1];
  if (!line) throw new Error("expected profile line");
  return line;
}

describe("selection chrome sync path perf (V-CI / F-SPLIT)", () => {
  beforeEach(() => {
    const data = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => data.set(key, value),
        removeItem: (key: string) => data.delete(key),
        clear: () => data.clear(),
      },
    });
    resetSelectionLatencyProfileForTests();
    setSelectionLatencyProfileEnabled(true);
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    resetSelectionLatencyProfileForTests();
    setSelectionLatencyProfileEnabled(false);
  });

  it(`V-CI: ${SELECTION_PROFILE_BASELINE_SEGMENT_COUNT}-seg waveform in-viewport syncPathTotal ≤ ${SELECTION_PROFILE_CI_SYNC_PATH_MAX_MS}ms`, () => {
    const segmentCount = SELECTION_PROFILE_BASELINE_SEGMENT_COUNT;
    const targetIdx = 68;
    const ctx = makeCtx(segmentCount, 0);
    const ctxRef = { current: ctx };
    const timeline = makeTimeline();
    seedOverlayNodes(timeline.overlayRoot, [0, targetIdx]);

    const listRoot = document.createElement("div");
    document.body.appendChild(listRoot);

    const { result } = renderHook(() =>
      useTranscriptionLayerSelection({
        ctx,
        ctxRef,
        timeline: timeline as never,
        waveformShellRef: { current: null },
        segmentListRef: { current: listRoot },
        setSelectedIdxUi: vi.fn(),
      }),
    );

    act(() => {
      result.current.selectSegmentAt(targetIdx, "waveform");
      selectionProfileFlush();
    });

    const parsed = parseSelectionProfileLine(
      latestProfileLine((line) => line.includes(`waveform idx=${targetIdx}`)),
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.spans.listScroll ?? 0).toBe(0);
    expect(Number(computeSelectionProfileSyncPathMs(parsed!.spans).toFixed(1))).toBe(parsed!.syncPathTotalMs);
    expect(selectionProfileMeetsCiGate(parsed!)).toBe(true);
    expect(selectionProfileMeetsHandChromeGate(parsed!)).toBe(true);
    expect(parsed!.spans.firstPaint ?? 0).toBeLessThanOrEqual(SELECTION_PROFILE_HAND_CHROME_MAX_MS);
    expect(parsed!.spans.listChrome ?? 0).toBeLessThanOrEqual(SELECTION_PROFILE_HAND_CHROME_MAX_MS);
  });

  it(`V-CI: ${SELECTION_PROFILE_BASELINE_SEGMENT_COUNT}-seg list click syncPathTotal ≤ ${SELECTION_PROFILE_CI_SYNC_PATH_MAX_MS}ms`, () => {
    const segmentCount = SELECTION_PROFILE_BASELINE_SEGMENT_COUNT;
    const targetIdx = 12;
    const ctx = makeCtx(segmentCount, 0);
    const ctxRef = { current: ctx };
    const timeline = makeTimeline();
    seedOverlayNodes(timeline.overlayRoot, [0, targetIdx]);

    const { result } = renderHook(() =>
      useTranscriptionLayerSelection({
        ctx,
        ctxRef,
        timeline: timeline as never,
        waveformShellRef: { current: null },
        segmentListRef: { current: null },
        setSelectedIdxUi: vi.fn(),
      }),
    );

    act(() => {
      result.current.selectSegmentAt(targetIdx, "list");
    });

    const parsed = parseSelectionProfileLine(
      latestProfileLine((line) => line.includes(`list idx=${targetIdx}`)),
    );
    expect(parsed).not.toBeNull();
    expect(selectionProfileMeetsCiGate(parsed!)).toBe(true);
    expect(selectionProfileMeetsHandChromeGate(parsed!)).toBe(true);
  });
});
