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

  it("re-attaches when attachKey changes after late DOM mount (import → audioSrc)", () => {
    const tierScrollRef: { current: HTMLDivElement | null } = { current: null };

    const { result, rerender } = renderHook(
      ({ attachKey }: { attachKey: string | null }) =>
        useTierScrollLayout(tierScrollRef, { attachKey }),
      { initialProps: { attachKey: null as string | null } },
    );

    expect(result.current.clientWidthPx).toBe(0);

    const el = document.createElement("div");
    Object.defineProperty(el, "scrollLeft", { value: 0, writable: true, configurable: true });
    Object.defineProperty(el, "clientWidth", { value: 720, configurable: true });
    tierScrollRef.current = el;

    // Without attachKey change, refresh stays a no-op (first effect saw null el).
    act(() => {
      result.current.refreshLayout();
    });
    expect(result.current.clientWidthPx).toBe(0);

    rerender({ attachKey: "asset://audio.wav" });

    expect(result.current.clientWidthPx).toBe(720);
    expect(result.current.liveClientWidthRef.current).toBe(720);
  });

  it("updates clientWidth when ResizeObserver reports tier growth", () => {
    const el = document.createElement("div");
    Object.defineProperty(el, "scrollLeft", { value: 0, writable: true, configurable: true });
    Object.defineProperty(el, "clientWidth", { value: 0, configurable: true });
    const tierScrollRef = { current: el };

    let roCallback: (() => void) | null = null;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(cb: () => void) {
          roCallback = cb;
        }
        observe() {}
        disconnect() {}
      },
    );

    const { result } = renderHook(() => useTierScrollLayout(tierScrollRef));
    expect(result.current.clientWidthPx).toBe(0);

    act(() => {
      Object.defineProperty(el, "clientWidth", { value: 640, configurable: true });
      roCallback?.();
    });

    expect(result.current.clientWidthPx).toBe(640);
    expect(result.current.liveClientWidthRef.current).toBe(640);
  });
});
