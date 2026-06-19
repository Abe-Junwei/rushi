import { useRef, type MutableRefObject } from "react";

export type PendingProgrammaticScrollWrite = {
  scrollLeftPx: number;
  deferLayoutCommit: boolean;
};

export type TierScrollProgrammaticWrites = {
  programmaticScrollUntilRef: MutableRefObject<number>;
  /** Playback-follow writes — block scroll-event suppress only, not user wheel/scrub. */
  playbackFollowScrollWriteUntilRef: MutableRefObject<number>;
  deferredLayoutCommitUntilRef: MutableRefObject<number>;
  programmaticScrollRafRef: MutableRefObject<number>;
  pendingProgrammaticScrollRef: MutableRefObject<PendingProgrammaticScrollWrite | null>;
  markProgrammaticScroll: () => void;
  markPlaybackFollowScrollWrite: () => void;
  markDeferredLayoutCommit: () => void;
  isRecentProgrammaticScroll: () => boolean;
  isRecentPlaybackFollowScrollWrite: () => boolean;
  hasPendingProgrammaticScroll: () => boolean;
  queueProgrammaticScroll: (
    scrollLeftPx: number,
    deferLayoutCommit: boolean,
    commit: (pending: PendingProgrammaticScrollWrite) => void,
  ) => void;
  flushPendingProgrammaticScroll: (
    commit: (pending: PendingProgrammaticScrollWrite) => void,
  ) => void;
  cancelPending: () => void;
  resetOnMediaUrlChange: (tier: HTMLElement | null) => void;
};

export function createTierScrollProgrammaticWrites(): TierScrollProgrammaticWrites {
  const programmaticScrollUntilRef = { current: 0 };
  const playbackFollowScrollWriteUntilRef = { current: 0 };
  const deferredLayoutCommitUntilRef = { current: 0 };
  const programmaticScrollRafRef = { current: 0 };
  const pendingProgrammaticScrollRef: MutableRefObject<PendingProgrammaticScrollWrite | null> = {
    current: null,
  };

  const markProgrammaticScroll = () => {
    programmaticScrollUntilRef.current = performance.now() + 80;
  };

  const markPlaybackFollowScrollWrite = () => {
    playbackFollowScrollWriteUntilRef.current = performance.now() + 32;
  };

  const markDeferredLayoutCommit = () => {
    deferredLayoutCommitUntilRef.current = performance.now() + 120;
  };

  const isRecentProgrammaticScroll = () => performance.now() < programmaticScrollUntilRef.current;

  const isRecentPlaybackFollowScrollWrite = () =>
    performance.now() < playbackFollowScrollWriteUntilRef.current;

  const hasPendingProgrammaticScroll = () => pendingProgrammaticScrollRef.current != null;

  const flushPendingProgrammaticScroll = (
    commit: (pending: PendingProgrammaticScrollWrite) => void,
  ) => {
    programmaticScrollRafRef.current = 0;
    const pending = pendingProgrammaticScrollRef.current;
    pendingProgrammaticScrollRef.current = null;
    if (!pending) return;
    commit(pending);
  };

  const queueProgrammaticScroll = (
    scrollLeftPx: number,
    deferLayoutCommit: boolean,
    commit: (pending: PendingProgrammaticScrollWrite) => void,
  ) => {
    pendingProgrammaticScrollRef.current = { scrollLeftPx, deferLayoutCommit };
    if (programmaticScrollRafRef.current) return;
    programmaticScrollRafRef.current = requestAnimationFrame(() => {
      flushPendingProgrammaticScroll(commit);
    });
  };

  const cancelPending = () => {
    pendingProgrammaticScrollRef.current = null;
    if (programmaticScrollRafRef.current) {
      cancelAnimationFrame(programmaticScrollRafRef.current);
      programmaticScrollRafRef.current = 0;
    }
  };

  const resetOnMediaUrlChange = (tier: HTMLElement | null) => {
    pendingProgrammaticScrollRef.current = null;
    if (programmaticScrollRafRef.current) {
      cancelAnimationFrame(programmaticScrollRafRef.current);
      programmaticScrollRafRef.current = 0;
    }
    if (tier) {
      markProgrammaticScroll();
      tier.scrollLeft = 0;
    }
  };

  return {
    programmaticScrollUntilRef,
    playbackFollowScrollWriteUntilRef,
    deferredLayoutCommitUntilRef,
    programmaticScrollRafRef,
    pendingProgrammaticScrollRef,
    markProgrammaticScroll,
    markPlaybackFollowScrollWrite,
    markDeferredLayoutCommit,
    isRecentProgrammaticScroll,
    isRecentPlaybackFollowScrollWrite,
    hasPendingProgrammaticScroll,
    queueProgrammaticScroll,
    flushPendingProgrammaticScroll,
    cancelPending,
    resetOnMediaUrlChange,
  };
}

/** Stable programmatic-scroll refs for hook lifetime. */
export function useTierScrollProgrammaticWrites(): TierScrollProgrammaticWrites {
  const writesRef = useRef<TierScrollProgrammaticWrites | null>(null);
  if (!writesRef.current) {
    writesRef.current = createTierScrollProgrammaticWrites();
  }
  return writesRef.current;
}
