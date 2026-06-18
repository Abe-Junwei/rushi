import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useTierScrollLayout } from "./useTierScrollLayout";

describe("useTierScrollLayout", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads initial scrollLeft and clientWidth from the tier element", () => {
    const el = document.createElement("div");
    Object.defineProperty(el, "scrollLeft", { value: 42, writable: true, configurable: true });
    Object.defineProperty(el, "clientWidth", { value: 320, configurable: true });
    const tierScrollRef = { current: el };

    const { result } = renderHook(() => useTierScrollLayout(tierScrollRef));

    expect(result.current.scrollLeftPx).toBe(42);
    expect(result.current.clientWidthPx).toBe(320);
    expect(typeof result.current.refreshLayout).toBe("function");
  });

  it("updates on scroll events after scroll burst settles", async () => {
    const el = document.createElement("div");
    let scrollLeft = 0;
    Object.defineProperty(el, "scrollLeft", {
      get: () => scrollLeft,
      set: (v: number) => {
        scrollLeft = v;
      },
      configurable: true,
    });
    Object.defineProperty(el, "clientWidth", { value: 400, configurable: true });
    const tierScrollRef = { current: el };

    const { result } = renderHook(() => useTierScrollLayout(tierScrollRef));

    act(() => {
      scrollLeft = 120;
      el.dispatchEvent(new Event("scroll"));
    });
    expect(result.current.liveScrollLeftRef.current).toBe(120);
    expect(result.current.scrollLeftPx).toBe(0);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 150));
    });

    expect(result.current.scrollLeftPx).toBe(120);
  });

  it("refreshLayout picks up scrollLeft after programmatic write", () => {
    const el = document.createElement("div");
    let scrollLeft = 10;
    Object.defineProperty(el, "scrollLeft", {
      get: () => scrollLeft,
      set: (v: number) => {
        scrollLeft = v;
      },
      configurable: true,
    });
    Object.defineProperty(el, "clientWidth", { value: 400, configurable: true });
    const tierScrollRef = { current: el };

    const { result } = renderHook(() => useTierScrollLayout(tierScrollRef));

    act(() => {
      scrollLeft = 88;
      result.current.refreshLayout();
    });

    expect(result.current.scrollLeftPx).toBe(88);
  });

  it("updates clientWidth via refreshLayout after viewport expand", () => {
    const el = document.createElement("div");
    Object.defineProperty(el, "scrollLeft", { value: 0, writable: true, configurable: true });
    Object.defineProperty(el, "clientWidth", { value: 400, configurable: true });
    const tierScrollRef = { current: el };

    const { result } = renderHook(() => useTierScrollLayout(tierScrollRef));
    expect(result.current.clientWidthPx).toBe(400);

    act(() => {
      Object.defineProperty(el, "clientWidth", { value: 900, configurable: true });
      result.current.refreshLayout();
    });

    expect(result.current.clientWidthPx).toBe(900);
  });
});
