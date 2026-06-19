// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TRANSCRIPT_FONT_DEFAULT } from "../utils/waveformPrefs";
import { useWaveformDisplay } from "./useWaveformDisplay";

function makePointerDown(clientY: number): React.PointerEvent {
  return {
    button: 0,
    clientY,
    pointerId: 1,
    preventDefault: () => {},
    currentTarget: {
      setPointerCapture: () => {},
      releasePointerCapture: () => {},
    },
  } as unknown as React.PointerEvent;
}

function dispatchPointer(type: "pointermove" | "pointerup", input: { clientY: number; buttons?: number }) {
  const ev = new Event(type) as PointerEvent;
  Object.defineProperty(ev, "clientY", { configurable: true, value: input.clientY });
  Object.defineProperty(ev, "buttons", { configurable: true, value: input.buttons ?? 0 });
  Object.defineProperty(ev, "pointerId", { configurable: true, value: 1 });
  window.dispatchEvent(ev);
}

describe("useWaveformDisplay transcript resize drags", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("does not resize transcript font for row-height handle clicks", () => {
    const { result } = renderHook(() => useWaveformDisplay({ busy: false }));

    act(() => {
      result.current.beginTranscriptRowHeightDrag(makePointerDown(100));
      dispatchPointer("pointermove", { clientY: 103, buttons: 1 });
      dispatchPointer("pointerup", { clientY: 103 });
    });

    expect(result.current.transcriptFontPx).toBe(TRANSCRIPT_FONT_DEFAULT);
  });

  it("ignores stale row-height pointer moves after the button is released", () => {
    const { result } = renderHook(() => useWaveformDisplay({ busy: false }));

    act(() => {
      result.current.beginTranscriptRowHeightDrag(makePointerDown(100));
      dispatchPointer("pointermove", { clientY: 1000, buttons: 0 });
      dispatchPointer("pointerup", { clientY: 1000 });
    });

    expect(result.current.transcriptFontPx).toBe(TRANSCRIPT_FONT_DEFAULT);
  });

  it("still resizes transcript font during an intentional row-height drag", () => {
    const { result } = renderHook(() => useWaveformDisplay({ busy: false }));

    act(() => {
      result.current.beginTranscriptRowHeightDrag(makePointerDown(100));
      dispatchPointer("pointermove", { clientY: 130, buttons: 1 });
      dispatchPointer("pointerup", { clientY: 130 });
    });

    expect(result.current.transcriptFontPx).toBeGreaterThan(TRANSCRIPT_FONT_DEFAULT);
  });
});
