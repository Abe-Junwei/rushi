import { LIST_RAPID_SELECT_MS } from "./segmentListSelectSource";

/** Coalesce rapid ↑↓ side effects to the last target (WKWebView scroll/play/focus is costly). */
export const LIST_ADVANCE_PLAY_COALESCE_MS = Math.min(150, LIST_RAPID_SELECT_MS);

export function createListAdvanceCoalescedScheduler<T>(
  flush: (value: T) => void,
  delayMs: number = LIST_ADVANCE_PLAY_COALESCE_MS,
) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: T | null = null;

  const scheduleFlush = () => {
    if (timer != null) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      const value = pending;
      pending = null;
      if (value == null) return;
      flush(value);
    }, delayMs);
  };

  return {
    schedule(value: T) {
      pending = value;
      scheduleFlush();
    },
    cancel() {
      if (timer != null) clearTimeout(timer);
      timer = null;
      pending = null;
    },
  };
}

export type ListAdvancePlayFn = (idx: number, options?: { loop?: boolean }) => void;
export type ListAdvanceSeekFn = (timeSec: number) => void;

type PendingListAdvanceMediaSync =
  | { kind: "play"; idx: number; loop: boolean }
  | { kind: "seek"; timeSec: number };

export function createListAdvanceSegmentPlaybackScheduler(
  playAtIndex: ListAdvancePlayFn,
  seekToTimeSec?: ListAdvanceSeekFn,
) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: PendingListAdvanceMediaSync | null = null;

  const flush = () => {
    timer = null;
    const target = pending;
    pending = null;
    if (!target) return;
    if (target.kind === "seek") {
      seekToTimeSec?.(target.timeSec);
      return;
    }
    playAtIndex(target.idx, target.loop ? { loop: true } : undefined);
  };

  const scheduleFlush = () => {
    if (timer != null) clearTimeout(timer);
    timer = setTimeout(flush, LIST_ADVANCE_PLAY_COALESCE_MS);
  };

  return {
    schedule(idx: number, loop: boolean) {
      pending = { kind: "play", idx, loop };
      scheduleFlush();
    },
    scheduleSeek(timeSec: number) {
      pending = { kind: "seek", timeSec };
      scheduleFlush();
    },
    cancel() {
      if (timer != null) clearTimeout(timer);
      timer = null;
      pending = null;
    },
  };
}
