// @vitest-environment jsdom

import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTranscriptionLayerSelection } from "../pages/useTranscriptionLayerSelection";
import type { TranscriptionLayerInput } from "../pages/transcriptionLayerTypes";
import {
  parseSelectionProfileLine,
  readRecentSelectionLatencyProfileLines,
  resetSelectionLatencyProfileForTests,
  SELECTION_PROFILE_BASELINE_SEGMENT_COUNT,
  SELECTION_PROFILE_CI_SYNC_PATH_MAX_MS,
  selectionProfileFlush,
  selectionProfileMeetsCiGate,
  setSelectionLatencyProfileEnabled,
} from "../services/ui/selectionLatencyProfile";
import {
  SEGMENT_LIST_VIRTUALIZE_MIN_COUNT,
  segmentListItemStridePx,
  segmentListRowMinHeightPx,
} from "../utils/segmentListVirtualWindow";
import { planEditorSegmentListSelectionScroll } from "../components/editor/planEditorSegmentListSelectionScroll";
import { useEditorSegmentListScroll } from "../components/editor/useEditorSegmentListScroll";
import type { MutableRefObject, RefObject } from "react";
import type { SegmentListFilterNavState } from "../utils/segmentListFilterNav";

/** Burst keyboard navigation: pure scroll plan + virtual window stay within CI budget. */
export const LIST_KEYBOARD_BURST_PLAN_MAX_MS = 15;
export const LIST_KEYBOARD_BURST_STEPS = 10;
export const LIST_KEYBOARD_BURST_SEGMENT_COUNT = 5000;
export const LIST_KEYBOARD_BURST_SC1_COMMIT_MAX_MS = 120;

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

function makeTimeline(segmentCount: number) {
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

function createScrollRoot(scrollTop: number, clientHeight: number, scrollHeight: number): HTMLDivElement {
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

function latestProfileLine(matcher: (line: string) => boolean): string {
  const lines = readRecentSelectionLatencyProfileLines().filter(matcher);
  const line = lines[lines.length - 1];
  if (!line) throw new Error("expected profile line");
  return line;
}

describe("list keyboard navigation burst perf (V-CI / LKB-1)", () => {
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
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    );
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    });
  });

  afterEach(() => {
    document.body.innerHTML = "";
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    resetSelectionLatencyProfileForTests();
    setSelectionLatencyProfileEnabled(false);
  });

  it(`LKB-1: ${LIST_KEYBOARD_BURST_SEGMENT_COUNT}-seg scroll plan burst ≤ ${LIST_KEYBOARD_BURST_PLAN_MAX_MS}ms per step`, () => {
    const rowMin = segmentListRowMinHeightPx(70);
    const stride = segmentListItemStridePx(rowMin);
    const displayCount = LIST_KEYBOARD_BURST_SEGMENT_COUNT;
    const scrollHeight = displayCount * stride;
    const root = createScrollRoot(0, 480, scrollHeight);

    let selectedDisplayIndex = 0;
    for (let step = 0; step < LIST_KEYBOARD_BURST_STEPS; step += 1) {
      selectedDisplayIndex += 17;
      const t0 = performance.now();
      const plan = planEditorSegmentListSelectionScroll({
        root,
        selectedDisplayIndex,
        selectedIdx: selectedDisplayIndex,
        rowMinHeightPx: rowMin,
        itemStridePx: stride,
        useVirtualList: displayCount >= SEGMENT_LIST_VIRTUALIZE_MIN_COUNT,
        source: "listKeyboard",
      });
      const elapsed = performance.now() - t0;
      expect(elapsed).toBeLessThanOrEqual(LIST_KEYBOARD_BURST_PLAN_MAX_MS);
      expect(plan.kind).toBe("write-scroll");
      if (plan.kind === "write-scroll") {
        root.scrollTop = plan.nextScrollTop;
      }
    }
  });

  it(`LKB-1: ${SELECTION_PROFILE_BASELINE_SEGMENT_COUNT}-seg listKeyboard syncPathTotal ≤ ${SELECTION_PROFILE_CI_SYNC_PATH_MAX_MS}ms`, () => {
    const segmentCount = SELECTION_PROFILE_BASELINE_SEGMENT_COUNT;
    const targetIdx = 42;
    const ctx = makeCtx(segmentCount, 0);
    const ctxRef = { current: ctx };
    const timeline = makeTimeline(segmentCount);

    const rowMin = segmentListRowMinHeightPx(70);
    const stride = segmentListItemStridePx(rowMin);
    const displayCount = segmentCount;
    const scrollHeight = displayCount * stride;
    const listRoot = createScrollRoot(0, 480, scrollHeight);
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
      result.current.selectSegmentAt(targetIdx, "listKeyboard");
      selectionProfileFlush();
    });

    const parsed = parseSelectionProfileLine(
      latestProfileLine((line) => line.includes(`listKeyboard idx=${targetIdx}`)),
    );
    expect(parsed).not.toBeNull();
    expect(selectionProfileMeetsCiGate(parsed!)).toBe(true);
  });

  it("LKB-1: virtual window includes selected row for each burst step", () => {
    const rowMin = segmentListRowMinHeightPx(70);
    const stride = segmentListItemStridePx(rowMin);
    const displayCount = LIST_KEYBOARD_BURST_SEGMENT_COUNT;
    const scrollHeight = displayCount * stride;
    const root = createScrollRoot(0, 480, scrollHeight);
    document.body.appendChild(root);

    const segmentListRef = { current: root } as RefObject<HTMLDivElement | null>;
    const filterNavRef = { current: { active: false, indices: [] } } as MutableRefObject<SegmentListFilterNavState>;
    const lastSegmentSelectSourceRef = { current: "listKeyboard" as const };

    const { result, rerender } = renderHook(
      (props: { selectedDisplayIndex: number; selectedIdx: number }) =>
        useEditorSegmentListScroll({
          segmentListRef,
          filterNavRef,
          filteredIndices: [],
          filterActive: false,
          displayCount,
          currentFileId: "file-a",
          transcriptRowHeightPx: 70,
          lastSegmentSelectSourceRef,
          selectedDisplayIndex: props.selectedDisplayIndex,
          selectedIdx: props.selectedIdx,
        }),
      { initialProps: { selectedDisplayIndex: 0, selectedIdx: 0 } },
    );

    for (let step = 1; step <= LIST_KEYBOARD_BURST_STEPS; step += 1) {
      const idx = step * 137;
      rerender({ selectedDisplayIndex: idx, selectedIdx: idx });
      const win = result.current.virtualWindow;
      expect(win.startIndex).toBeLessThanOrEqual(idx);
      expect(win.endIndex).toBeGreaterThan(idx);
    }
  });

  it("LKB-2: listKeyboard burst defers SC1 commit until keyup flush", () => {
    const segmentCount = SELECTION_PROFILE_BASELINE_SEGMENT_COUNT;
    const ctx = makeCtx(segmentCount, 0);
    const ctxRef = { current: ctx };
    const timeline = makeTimeline(segmentCount);
    const setSelectedIdxUi = vi.fn();

    const rowMin = segmentListRowMinHeightPx(70);
    const stride = segmentListItemStridePx(rowMin);
    const displayCount = segmentCount;
    const scrollHeight = displayCount * stride;
    const listRoot = createScrollRoot(0, 480, scrollHeight);
    document.body.appendChild(listRoot);

    const { result } = renderHook(() =>
      useTranscriptionLayerSelection({
        ctx,
        ctxRef,
        timeline: timeline as never,
        waveformShellRef: { current: null },
        segmentListRef: { current: listRoot },
        setSelectedIdxUi,
      }),
    );

    act(() => {
      for (let step = 1; step <= LIST_KEYBOARD_BURST_STEPS; step += 1) {
        const idx = step * 17;
        result.current.selectSegmentAt(idx, "listKeyboard", { burst: true });
      }
    });

    expect(setSelectedIdxUi).not.toHaveBeenCalled();

    const finalIdx = LIST_KEYBOARD_BURST_STEPS * 17;
    act(() => {
      result.current.commitListKeyboardBurst(finalIdx);
      selectionProfileFlush();
    });

    expect(setSelectedIdxUi).toHaveBeenCalledTimes(1);
    expect(setSelectedIdxUi).toHaveBeenCalledWith(finalIdx);

    const parsed = parseSelectionProfileLine(
      latestProfileLine((line) => line.includes(`listKeyboard commit idx=${finalIdx}`)),
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.spans.listCommit).not.toBeUndefined();
    expect(parsed!.spans.listCommit).toBeLessThanOrEqual(LIST_KEYBOARD_BURST_SC1_COMMIT_MAX_MS);
  });
});
