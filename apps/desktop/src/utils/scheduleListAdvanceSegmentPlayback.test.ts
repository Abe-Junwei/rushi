import { describe, expect, it, vi, afterEach } from "vitest";
import {
  LIST_ADVANCE_PLAY_COALESCE_MS,
  createListAdvanceCoalescedScheduler,
  createListAdvanceSegmentPlaybackScheduler,
} from "./scheduleListAdvanceSegmentPlayback";

describe("createListAdvanceSegmentPlaybackScheduler", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("coalesces rapid schedules to the last index", () => {
    vi.useFakeTimers();
    const play = vi.fn();
    const scheduler = createListAdvanceSegmentPlaybackScheduler(play);

    scheduler.schedule(1, true);
    scheduler.schedule(2, true);
    scheduler.schedule(5, true);
    expect(play).not.toHaveBeenCalled();

    vi.advanceTimersByTime(LIST_ADVANCE_PLAY_COALESCE_MS);
    expect(play).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledWith(5, { loop: true });
  });

  it("cancel clears pending play", () => {
    vi.useFakeTimers();
    const play = vi.fn();
    const scheduler = createListAdvanceSegmentPlaybackScheduler(play);

    scheduler.schedule(3, true);
    scheduler.cancel();
    vi.advanceTimersByTime(LIST_ADVANCE_PLAY_COALESCE_MS);
    expect(play).not.toHaveBeenCalled();
  });

  it("coalesces rapid seeks to the last time", () => {
    vi.useFakeTimers();
    const play = vi.fn();
    const seek = vi.fn();
    const scheduler = createListAdvanceSegmentPlaybackScheduler(play, seek);

    scheduler.scheduleSeek(1);
    scheduler.scheduleSeek(2);
    scheduler.scheduleSeek(8);
    expect(seek).not.toHaveBeenCalled();

    vi.advanceTimersByTime(LIST_ADVANCE_PLAY_COALESCE_MS);
    expect(play).not.toHaveBeenCalled();
    expect(seek).toHaveBeenCalledTimes(1);
    expect(seek).toHaveBeenCalledWith(8);
  });

  it("coalesces generic list-advance callbacks", () => {
    vi.useFakeTimers();
    const flush = vi.fn();
    const scheduler = createListAdvanceCoalescedScheduler(flush);

    scheduler.schedule({ start_sec: 1, end_sec: 2 });
    scheduler.schedule({ start_sec: 8, end_sec: 9 });
    expect(flush).not.toHaveBeenCalled();

    vi.advanceTimersByTime(LIST_ADVANCE_PLAY_COALESCE_MS);
    expect(flush).toHaveBeenCalledTimes(1);
    expect(flush).toHaveBeenCalledWith({ start_sec: 8, end_sec: 9 });
  });
});
