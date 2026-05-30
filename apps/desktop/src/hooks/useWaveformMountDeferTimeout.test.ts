import { describe, expect, it, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { WAVEFORM_MOUNT_DEFER_TIMEOUT_MS } from "../utils/waveformMountPolicy";
import { useWaveformMountDeferTimeout } from "../hooks/useWaveformMountDeferTimeout";

const SHORT_MEDIA_SEC = 120;

describe("useWaveformMountDeferTimeout", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns false until timeout elapses while defer is requested", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ defer }) => useWaveformMountDeferTimeout("asset://a.mp3", defer, SHORT_MEDIA_SEC),
      { initialProps: { defer: true } },
    );

    expect(result.current).toBe(false);
    act(() => {
      vi.advanceTimersByTime(WAVEFORM_MOUNT_DEFER_TIMEOUT_MS - 1);
    });
    expect(result.current).toBe(false);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(true);

    rerender({ defer: false });
    expect(result.current).toBe(false);
  });

  it("resets on mediaUrl change", () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(
      ({ url }) => useWaveformMountDeferTimeout(url, true, SHORT_MEDIA_SEC),
      { initialProps: { url: "asset://a.mp3" } },
    );

    act(() => {
      vi.advanceTimersByTime(WAVEFORM_MOUNT_DEFER_TIMEOUT_MS);
    });
    expect(result.current).toBe(true);

    rerender({ url: "asset://b.mp3" });
    expect(result.current).toBe(false);
  });
});
