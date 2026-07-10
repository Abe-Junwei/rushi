import { vi } from "vitest";
import type { TranscriptionLayerInput } from "../pages/transcriptionLayerTypes";
import { readRecentSelectionLatencyProfileLines } from "../services/ui/selectionLatencyProfile";

export function makeSegments(count: number) {
  return Array.from({ length: count }, (_, idx) => ({
    uid: `seg-${idx}`,
    idx,
    start_sec: idx * 2,
    end_sec: idx * 2 + 1.5,
    text: `语段 ${idx + 1}`,
  }));
}

export function makeCtx(segmentCount: number, selectedIdx = 0): TranscriptionLayerInput {
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

export function makeTimeline(segmentCount: number) {
  const tier = document.createElement("div");
  const overlayRoot = document.createElement("div");
  overlayRoot.className = "waveform-timeline-overlay-layer";
  tier.appendChild(overlayRoot);
  return {
    timelineMetrics: { mediaDurationSec: segmentCount * 2 + 1.5 },
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

export function createScrollRoot(
  scrollTop: number,
  clientHeight: number,
  scrollHeight: number,
): HTMLDivElement {
  const el = document.createElement("div");
  let top = scrollTop;
  Object.defineProperty(el, "clientHeight", { configurable: true, value: clientHeight });
  Object.defineProperty(el, "scrollHeight", { configurable: true, value: scrollHeight });
  Object.defineProperty(el, "scrollTop", {
    configurable: true,
    get: () => top,
    set: (v: number) => {
      top = v;
    },
  });
  return el;
}

export function latestProfileLine(matcher: (line: string) => boolean): string {
  const lines = readRecentSelectionLatencyProfileLines().filter(matcher);
  const line = lines[lines.length - 1];
  if (!line) throw new Error("expected profile line");
  return line;
}
