import { renderHook } from "@testing-library/react";
import type { MutableRefObject, RefObject } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetSelectionChromeStoreForTests } from "../../services/selection/selectionChromeStore";
import {
  SEGMENT_LIST_VIRTUALIZE_MIN_COUNT,
  segmentListItemStridePx,
  segmentListRowMinHeightPx,
} from "../../utils/segmentListVirtualWindow";
import type { SegmentListFilterNavState } from "../../utils/segmentListFilterNav";
import { useEditorSegmentListScroll } from "./useEditorSegmentListScroll";

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

describe("useEditorSegmentListScroll", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    );
  });

  afterEach(() => {
    document.body.innerHTML = "";
    resetSelectionChromeStoreForTests();
    vi.unstubAllGlobals();
  });

  it("includes selected row in virtual window on first frame after selection change (S5 projection)", () => {
    const rowMin = segmentListRowMinHeightPx(70);
    const stride = segmentListItemStridePx(rowMin);
    const displayCount = SEGMENT_LIST_VIRTUALIZE_MIN_COUNT + 20;
    const scrollHeight = displayCount * stride;
    const root = createScrollRoot(0, 400, scrollHeight);
    document.body.appendChild(root);

    const segmentListRef = { current: root } as RefObject<HTMLDivElement | null>;
    const filterNavRef = { current: { active: false, indices: [] } } as MutableRefObject<SegmentListFilterNavState>;
    const lastSegmentSelectSourceRef = { current: "list" as const };

    const baseProps = {
      segmentListRef,
      filterNavRef,
      filteredIndices: [] as number[],
      filterActive: false,
      displayCount,
      currentFileId: "file-a",
      transcriptRowHeightPx: 70,
      lastSegmentSelectSourceRef,
    };

    const { result, rerender } = renderHook(
      (props: { selectedDisplayIndex: number; selectedIdx: number }) =>
        useEditorSegmentListScroll({
          ...baseProps,
          selectedDisplayIndex: props.selectedDisplayIndex,
          selectedIdx: props.selectedIdx,
        }),
      { initialProps: { selectedDisplayIndex: 0, selectedIdx: 0 } },
    );

    rerender({ selectedDisplayIndex: 55, selectedIdx: 55 });

    const win = result.current.virtualWindow;
    expect(win.startIndex).toBeLessThanOrEqual(55);
    expect(win.endIndex).toBeGreaterThan(55);
  });

  it("keeps virtual window unchanged when waveform selects an in-viewport row (SCB-2 / P1)", () => {
    const rowMin = segmentListRowMinHeightPx(70);
    const stride = segmentListItemStridePx(rowMin);
    const displayCount = SEGMENT_LIST_VIRTUALIZE_MIN_COUNT + 20;
    const scrollHeight = displayCount * stride;
    const root = createScrollRoot(0, 400, scrollHeight);
    document.body.appendChild(root);

    const segmentListRef = { current: root } as RefObject<HTMLDivElement | null>;
    const filterNavRef = { current: { active: false, indices: [] } } as MutableRefObject<SegmentListFilterNavState>;
    const lastSegmentSelectSourceRef = { current: "waveform" as const };

    const baseProps = {
      segmentListRef,
      filterNavRef,
      filteredIndices: [] as number[],
      filterActive: false,
      displayCount,
      currentFileId: "file-a",
      transcriptRowHeightPx: 70,
      lastSegmentSelectSourceRef,
    };

    const { result, rerender } = renderHook(
      (props: { selectedDisplayIndex: number; selectedIdx: number }) =>
        useEditorSegmentListScroll({
          ...baseProps,
          selectedDisplayIndex: props.selectedDisplayIndex,
          selectedIdx: props.selectedIdx,
        }),
      { initialProps: { selectedDisplayIndex: 0, selectedIdx: 0 } },
    );

    const winBefore = result.current.virtualWindow;
    expect(winBefore.startIndex).toBeLessThanOrEqual(0);
    expect(winBefore.endIndex).toBeGreaterThan(0);

    rerender({ selectedDisplayIndex: 3, selectedIdx: 3 });

    const winAfter = result.current.virtualWindow;
    expect(winAfter.startIndex).toBe(winBefore.startIndex);
    expect(winAfter.endIndex).toBe(winBefore.endIndex);
    expect(winAfter.startIndex).toBeLessThanOrEqual(3);
    expect(winAfter.endIndex).toBeGreaterThan(3);
  });

  it("does not expand virtual window span for far waveform selection before scroll (SCB-2 / P1)", () => {
    const rowMin = segmentListRowMinHeightPx(70);
    const stride = segmentListItemStridePx(rowMin);
    const displayCount = SEGMENT_LIST_VIRTUALIZE_MIN_COUNT + 20;
    const scrollHeight = displayCount * stride;
    const root = createScrollRoot(0, 400, scrollHeight);
    document.body.appendChild(root);

    const segmentListRef = { current: root } as RefObject<HTMLDivElement | null>;
    const filterNavRef = { current: { active: false, indices: [] } } as MutableRefObject<SegmentListFilterNavState>;
    const lastSegmentSelectSourceRef = { current: "waveform" as const };

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

    rerender({ selectedDisplayIndex: 55, selectedIdx: 55 });

    const win = result.current.virtualWindow;
    expect(win.endIndex - win.startIndex).toBeLessThan(80);
    expect(win.endIndex).toBeLessThanOrEqual(55);
  });

  it("scrolls list keyboard selection into view on first frame (S5 projection)", () => {
    const rowMin = segmentListRowMinHeightPx(70);
    const stride = segmentListItemStridePx(rowMin);
    const displayCount = SEGMENT_LIST_VIRTUALIZE_MIN_COUNT + 20;
    const scrollHeight = displayCount * stride;
    const root = createScrollRoot(0, 400, scrollHeight);
    document.body.appendChild(root);

    const segmentListRef = { current: root } as RefObject<HTMLDivElement | null>;
    const filterNavRef = { current: { active: false, indices: [] } } as MutableRefObject<SegmentListFilterNavState>;
    const lastSegmentSelectSourceRef = { current: "listKeyboard" as const };

    const baseProps = {
      segmentListRef,
      filterNavRef,
      filteredIndices: [] as number[],
      filterActive: false,
      displayCount,
      currentFileId: "file-a",
      transcriptRowHeightPx: 70,
      lastSegmentSelectSourceRef,
    };

    const { result, rerender } = renderHook(
      (props: { selectedDisplayIndex: number; selectedIdx: number }) =>
        useEditorSegmentListScroll({
          ...baseProps,
          selectedDisplayIndex: props.selectedDisplayIndex,
          selectedIdx: props.selectedIdx,
        }),
      { initialProps: { selectedDisplayIndex: 0, selectedIdx: 0 } },
    );

    rerender({ selectedDisplayIndex: 55, selectedIdx: 55 });

    const win = result.current.virtualWindow;
    expect(win.startIndex).toBeLessThanOrEqual(55);
    expect(win.endIndex).toBeGreaterThan(55);
    expect(root.scrollTop).toBeGreaterThan(0);
  });

  it("skips stale rAF list correction after user scroll generation changes (S5/H11)", async () => {
    const source = await import("./useEditorSegmentListScroll.ts?raw");
    expect(source.default).toContain("scrollGenerationRef");
    expect(source.default).toMatch(
      /layoutScrollCorrectionRef\.current\?\.generation !== scrollGenerationRef\.current/,
    );
    expect(source.default).toMatch(
      /if \(Math\.abs\(corrected - root\.scrollTop\) < 1\) \{\s*selectionScrollProjectionRef\.current = false;/,
    );
  });
});
