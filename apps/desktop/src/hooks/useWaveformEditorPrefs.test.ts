import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useWaveformEditorPrefs } from "./useWaveformEditorPrefs";

describe("useWaveformEditorPrefs", () => {
  const mem: Record<string, string> = {};

  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => (Object.prototype.hasOwnProperty.call(mem, k) ? mem[k] : null),
      setItem: (k: string, v: string) => {
        mem[k] = v;
      },
      removeItem: (k: string) => {
        delete mem[k];
      },
      clear: () => {
        for (const k of Object.keys(mem)) delete mem[k];
      },
      key: () => null,
      length: 0,
    });
    mem["rushi.p1.waveformGlobalStripCollapsed"] = "1";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    for (const k of Object.keys(mem)) delete mem[k];
  });

  it("keeps global strip collapsed state when mediaUrl changes", () => {
    const { result, rerender } = renderHook(
      ({ mediaUrl }: { mediaUrl: string | null }) => useWaveformEditorPrefs(mediaUrl),
      { initialProps: { mediaUrl: "asset://a.mp3" } },
    );

    expect(result.current.globalStripCollapsed).toBe(true);

    rerender({ mediaUrl: "asset://b.mp3" });

    expect(result.current.globalStripCollapsed).toBe(true);
  });
});
