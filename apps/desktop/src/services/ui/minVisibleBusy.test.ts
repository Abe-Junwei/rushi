import { describe, expect, it, vi, afterEach } from "vitest";
import { MIN_VISIBLE_BUSY_MS, waitMinVisibleBusy } from "./minVisibleBusy";

describe("minVisibleBusy", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("waits until minimum elapsed", async () => {
    vi.useFakeTimers();
    const startedAt = Date.now();
    const promise = waitMinVisibleBusy(startedAt);
    await vi.advanceTimersByTimeAsync(MIN_VISIBLE_BUSY_MS - 1);
    let settled = false;
    void promise.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await promise;
    expect(settled).toBe(true);
  });
});
