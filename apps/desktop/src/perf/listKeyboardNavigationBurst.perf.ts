// @vitest-environment jsdom

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTranscriptionLayerSelection } from "../pages/useTranscriptionLayerSelection";
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
import { resolveListKeyboardScrollMeta } from "../utils/listKeyboardListScrollIndex";
import { isPerfCiRunner } from "./perfCi";
import {
  createScrollRoot,
  latestProfileLine,
  makeCtx,
  makeTimeline,
} from "./listKeyboardNavigationBurst.fixtures";

/** Burst keyboard navigation: scroll meta + SC1 commit stay within CI budget. */
export const LIST_KEYBOARD_BURST_PLAN_MAX_MS = isPerfCiRunner ? 25 : 15;
export const LIST_KEYBOARD_BURST_STEPS = 10;
export const LIST_KEYBOARD_BURST_SEGMENT_COUNT = 5000;
export const LIST_KEYBOARD_BURST_SC1_COMMIT_MAX_MS = 120;

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

  it(`LKB-1: ${LIST_KEYBOARD_BURST_SEGMENT_COUNT}-seg scroll meta burst ≤ ${LIST_KEYBOARD_BURST_PLAN_MAX_MS}ms per step`, () => {
    const displayCount = LIST_KEYBOARD_BURST_SEGMENT_COUNT;

    let selectedDisplayIndex = 0;
    for (let step = 0; step < LIST_KEYBOARD_BURST_STEPS; step += 1) {
      selectedDisplayIndex += 17;
      const t0 = performance.now();
      const meta = resolveListKeyboardScrollMeta({
        idx: selectedDisplayIndex,
        fileId: "file-a",
        segmentCount: displayCount,
        filterActive: false,
        filteredIndices: [],
        transcriptRowHeightPx: 70,
        virtualizeMinCount: SEGMENT_LIST_VIRTUALIZE_MIN_COUNT,
        rowMinHeightPx: segmentListRowMinHeightPx,
        itemStridePx: segmentListItemStridePx,
      });
      const elapsed = performance.now() - t0;
      expect(elapsed).toBeLessThanOrEqual(LIST_KEYBOARD_BURST_PLAN_MAX_MS);
      expect(meta).not.toBeNull();
      expect(meta!.selectedDisplayIndex).toBe(selectedDisplayIndex);
    }
  });

  it(`LKB-1: ${SELECTION_PROFILE_BASELINE_SEGMENT_COUNT}-seg listKeyboard syncPathTotal ≤ ${SELECTION_PROFILE_CI_SYNC_PATH_MAX_MS}ms`, () => {
    const segmentCount = SELECTION_PROFILE_BASELINE_SEGMENT_COUNT;
    const targetIdx = 42;
    const ctx = makeCtx(segmentCount, 0);
    const selectedIdxRef = { current: 0 };
    ctx.selectedIdxRef = selectedIdxRef;
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
        selectedIdxRef,
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

  it("LKB-2: listKeyboard burst defers SC1 commit until keyup flush", () => {
    const segmentCount = SELECTION_PROFILE_BASELINE_SEGMENT_COUNT;
    const ctx = makeCtx(segmentCount, 0);
    const selectedIdxRef = { current: 0 };
    ctx.selectedIdxRef = selectedIdxRef;
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
        selectedIdxRef,
      }),
    );

    act(() => {
      for (let step = 1; step <= LIST_KEYBOARD_BURST_STEPS; step += 1) {
        const idx = step * 17;
        result.current.selectSegmentAt(idx, "listKeyboard", { burst: true });
      }
    });

    const finalIdx = LIST_KEYBOARD_BURST_STEPS * 17;
    expect(selectedIdxRef.current).toBe(finalIdx);

    const midBurstLines = readRecentSelectionLatencyProfileLines().filter((line) =>
      /\[selection-profile\] #\d+ listKeyboard idx=/.test(line),
    );
    expect(midBurstLines).toHaveLength(0);

    act(() => {
      result.current.commitListKeyboardBurst(finalIdx);
      selectionProfileFlush();
    });

    const commitLines = readRecentSelectionLatencyProfileLines().filter((line) =>
      line.includes(`listKeyboard commit idx=${finalIdx}`),
    );
    expect(commitLines.length).toBe(1);

    const parsed = parseSelectionProfileLine(
      latestProfileLine((line) => line.includes(`listKeyboard commit idx=${finalIdx}`)),
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.spans.listCommit).not.toBeUndefined();
    expect(parsed!.spans.listCommit).toBeLessThanOrEqual(LIST_KEYBOARD_BURST_SC1_COMMIT_MAX_MS);
  });
});
