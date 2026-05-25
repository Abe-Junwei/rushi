import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDeferredRendererState } from "./useDeferredRendererState";

describe("useDeferredRendererState", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces visual into render", () => {
    const { result } = renderHook(() =>
      useDeferredRendererState({
        initial: 10,
        clamp: (v) => v,
        renderDelayMs: 90,
      }),
    );

    act(() => {
      result.current.setVisual(20);
    });
    expect(result.current.visual).toBe(20);
    expect(result.current.render).toBe(10);
    expect(result.current.previewActive).toBe(true);

    act(() => {
      vi.advanceTimersByTime(90);
    });
    expect(result.current.render).toBe(20);
    expect(result.current.previewActive).toBe(false);
  });

  it("flushRender commits immediately while dragging", () => {
    const { result } = renderHook(() =>
      useDeferredRendererState({
        initial: 80,
        clamp: (v) => v,
        renderDelayMs: 90,
        trackCommitted: true,
      }),
    );

    act(() => {
      result.current.setDragging(true);
      result.current.setVisual(120);
    });
    expect(result.current.render).toBe(80);

    act(() => {
      result.current.flushRender();
      result.current.setDragging(false);
    });
    expect(result.current.render).toBe(120);

    act(() => {
      result.current.markCommitted(120);
    });
    expect(result.current.committed).toBe(120);
  });
});
