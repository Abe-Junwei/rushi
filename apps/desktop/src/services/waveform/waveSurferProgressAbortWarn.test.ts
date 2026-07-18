import { afterEach, describe, expect, it, vi } from "vitest";
import {
  installWaveSurferProgressAbortWarnFilter,
  isWaveSurferAbortError,
  resetWaveSurferProgressAbortWarnFilterForTests,
} from "./waveSurferProgressAbortWarn";

describe("waveSurferProgressAbortWarn", () => {
  afterEach(() => {
    resetWaveSurferProgressAbortWarnFilterForTests();
    vi.restoreAllMocks();
  });

  it("isWaveSurferAbortError detects DOMException AbortError", () => {
    expect(isWaveSurferAbortError(new DOMException("Aborted", "AbortError"))).toBe(true);
    expect(isWaveSurferAbortError(new Error("network"))).toBe(false);
  });

  it("installWaveSurferProgressAbortWarnFilter suppresses progress abort warn only", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    installWaveSurferProgressAbortWarnFilter();
    console.warn("Progress tracking error:", new DOMException("Fetch is aborted", "AbortError"));
    console.warn("Progress tracking error:", new Error("other"));
    console.warn("unrelated");
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls[0]?.[1]).toBeInstanceOf(Error);
    expect(warn.mock.calls[1]?.[0]).toBe("unrelated");
  });

  it("tags CodeMirror viewport stabilize warnings with [codemirror]", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    installWaveSurferProgressAbortWarnFilter();
    console.warn("Viewport failed to stabilize");
    console.warn("Measure loop restarted more than 5 times");
    expect(warn).toHaveBeenCalledWith("[codemirror] Viewport failed to stabilize");
    expect(warn).toHaveBeenCalledWith("[codemirror] Measure loop restarted more than 5 times");
  });
});
