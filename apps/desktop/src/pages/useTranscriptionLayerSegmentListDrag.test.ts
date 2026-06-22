// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { TranscriptionLayerInput } from "./transcriptionLayerTypes";
import { useTranscriptionLayerSegmentListDrag } from "./useTranscriptionLayerSegmentListDrag";
import {
  annotateSegmentListScrollMetrics,
  SEGMENT_LIST_SCROLL_ATTR,
  segmentListRangeDragRequiresVerticalIntent,
} from "../utils/segmentListVirtualWindow";

function makeCtx(): TranscriptionLayerInput {
  return {
    busy: false,
    segments: Array.from({ length: 10 }, (_, idx) => ({
      uid: `s-${idx}`,
      idx,
      start_sec: idx,
      end_sec: idx + 1,
      text: `line ${idx}`,
    })),
    selectSegmentRange: vi.fn(),
    selectSegmentAt: vi.fn(),
  } as unknown as TranscriptionLayerInput;
}

describe("useTranscriptionLayerSegmentListDrag", () => {
  it("routes drag range updates through selectSegmentRangeRef (chrome-aware path)", () => {
    const ctx = makeCtx();
    const ctxRef = { current: ctx };
    const segmentListRef = { current: document.createElement("div") };
    const selectSegmentAtRef = { current: vi.fn() };
    const selectSegmentRangeRef = { current: vi.fn() };
    const lastSegmentSelectSourceRef = { current: "waveform" as const };

    const scrollRoot = segmentListRef.current;
    scrollRoot.setAttribute(SEGMENT_LIST_SCROLL_ATTR, "");
    annotateSegmentListScrollMetrics(scrollRoot, { rowMinHeightPx: 70, itemStridePx: 80 });
    Object.defineProperty(scrollRoot, "clientHeight", { value: 400, configurable: true });
    Object.defineProperty(scrollRoot, "scrollTop", { writable: true, value: 0, configurable: true });
    scrollRoot.getBoundingClientRect = () =>
      ({
        top: 100,
        bottom: 500,
        left: 0,
        right: 400,
        width: 400,
        height: 400,
        x: 0,
        y: 100,
        toJSON: () => ({}),
      }) as DOMRect;

    const row = document.createElement("div");
    row.setAttribute("data-seg-row", "5");
    scrollRoot.appendChild(row);
    document.body.appendChild(scrollRoot);

    document.elementFromPoint = () => row;

    const { result } = renderHook(() =>
      useTranscriptionLayerSegmentListDrag({
        ctxRef,
        segmentListRef,
        selectSegmentAtRef,
        selectSegmentRangeRef,
        lastSegmentSelectSourceRef,
      }),
    );

    act(() => {
      result.current.onSegmentListRangePointerDown(2, {
        button: 0,
        pointerId: 1,
        clientX: 10,
        clientY: 200,
        shiftKey: false,
        metaKey: false,
        ctrlKey: false,
        stopPropagation: vi.fn(),
        target: row,
      } as unknown as React.PointerEvent<HTMLElement>);
    });

    act(() => {
      window.dispatchEvent(
        new PointerEvent("pointermove", {
          pointerId: 1,
          clientX: 20,
          clientY: 250,
          bubbles: true,
        }),
      );
    });

    expect(selectSegmentRangeRef.current).toHaveBeenCalledWith(2, 5);
    expect(lastSegmentSelectSourceRef.current).toBe("multiSelect");
    expect(ctx.selectSegmentRange).not.toHaveBeenCalled();

    scrollRoot.remove();
  });

  it("does not treat horizontal-only timestamp drag as range multi-select", () => {
    const ctx = makeCtx();
    const ctxRef = { current: ctx };
    const segmentListRef = { current: document.createElement("div") };
    const selectSegmentAtRef = { current: vi.fn() };
    const selectSegmentRangeRef = { current: vi.fn() };
    const lastSegmentSelectSourceRef = { current: "waveform" as const };

    const timestamp = document.createElement("div");
    timestamp.className = "segment-row-meta-column-fallback";
    const scrollRoot = segmentListRef.current;
    scrollRoot.setAttribute(SEGMENT_LIST_SCROLL_ATTR, "");
    annotateSegmentListScrollMetrics(scrollRoot, { rowMinHeightPx: 70, itemStridePx: 80 });
    scrollRoot.appendChild(timestamp);
    document.body.appendChild(scrollRoot);

    expect(segmentListRangeDragRequiresVerticalIntent(timestamp)).toBe(true);

    const { result } = renderHook(() =>
      useTranscriptionLayerSegmentListDrag({
        ctxRef,
        segmentListRef,
        selectSegmentAtRef,
        selectSegmentRangeRef,
        lastSegmentSelectSourceRef,
      }),
    );

    act(() => {
      result.current.onSegmentListRangePointerDown(2, {
        button: 0,
        pointerId: 2,
        clientX: 10,
        clientY: 200,
        shiftKey: false,
        metaKey: false,
        ctrlKey: false,
        stopPropagation: vi.fn(),
        target: timestamp,
      } as unknown as React.PointerEvent<HTMLElement>);
    });

    act(() => {
      window.dispatchEvent(
        new PointerEvent("pointermove", {
          pointerId: 2,
          clientX: 40,
          clientY: 203,
          bubbles: true,
        }),
      );
    });

    expect(selectSegmentRangeRef.current).not.toHaveBeenCalled();

    scrollRoot.remove();
  });
});
