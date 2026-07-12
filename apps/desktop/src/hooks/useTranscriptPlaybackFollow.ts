import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import {
  setTranscriptPlaybackFocusEffect,
  transcriptPlaybackFocusField,
} from "../components/editor/core/playbackFocusField";
import { getTranscriptEditorView } from "../components/editor/core/transcriptEditorViewHandle";
import { revealSegmentInScrollDOM } from "../components/editor/core/revealSegment";
import { effectiveTranscriptPrimaryIdx } from "../components/editor/core/projectionWaveformBridge";
import { resolveVisitedSegmentIndexAtPlayhead } from "../utils/segmentChrome";
import {
  shouldClearPlaybackSelectionDivert,
  shouldMarkPlaybackSelectionDivert,
  shouldRevealTranscriptPlaybackFocus,
} from "../utils/transcriptPlaybackFocus";
import {
  readStoredTranscriptPlaybackFollow,
  subscribeWaveformPrefs,
} from "../utils/waveformPrefs";

/** After waveform scroll-follow (0) and playhead paint (1). */
const PLAYHEAD_FRAME_PRIORITY_TRANSCRIPT = 2;

const USER_SCROLL_SUPPRESS_MS = 1800;
/** Ignore scroll events caused by our own playback-follow reveal. */
const PROGRAMMATIC_SCROLL_GUARD_MS = 120;

export function useTranscriptPlaybackFollow(args: {
  isPlaying: boolean;
  isReady: boolean;
  segments: readonly SegmentDto[];
  selectedIdx: number;
  subscribePlayheadFrame: (
    cb: (timeSec: number) => void,
    priority?: number,
  ) => () => void;
}): {
  notifyUserSegmentSelect: (selectedIdx: number) => void;
} {
  const { isPlaying, isReady, segments, selectedIdx, subscribePlayheadFrame } = args;

  const enabled = useSyncExternalStore(
    subscribeWaveformPrefs,
    readStoredTranscriptPlaybackFollow,
    readStoredTranscriptPlaybackFollow,
  );

  const segmentsRef = useRef(segments);
  segmentsRef.current = segments;
  const selectedIdxRef = useRef(selectedIdx);
  selectedIdxRef.current = selectedIdx;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const isPlayingRef = useRef(isPlaying);
  isPlayingRef.current = isPlaying;

  const focusIdxRef = useRef(-1);
  const userScrollSuppressUntilRef = useRef(0);
  const programmaticScrollUntilRef = useRef(0);
  const selectionDivertedRef = useRef(false);
  const scrollListenCleanupRef = useRef<(() => void) | null>(null);

  const ensureScrollListener = useCallback(() => {
    if (scrollListenCleanupRef.current) return;
    const view = getTranscriptEditorView();
    const scrollDom = view?.scrollDOM;
    if (!scrollDom) return;
    const onScroll = () => {
      if (performance.now() < programmaticScrollUntilRef.current) return;
      userScrollSuppressUntilRef.current = performance.now() + USER_SCROLL_SUPPRESS_MS;
    };
    scrollDom.addEventListener("scroll", onScroll, { passive: true });
    scrollListenCleanupRef.current = () => {
      scrollDom.removeEventListener("scroll", onScroll);
      scrollListenCleanupRef.current = null;
    };
  }, []);

  const applyFocusIdx = useCallback(
    (nextIdx: number) => {
      ensureScrollListener();
      const view = getTranscriptEditorView();
      const prev = focusIdxRef.current;
      const normalized = nextIdx < 0 ? null : nextIdx;
      const prevStored = prev < 0 ? null : prev;
      if (normalized === prevStored) {
        const primary = effectiveTranscriptPrimaryIdx(selectedIdxRef.current);
        if (
          shouldClearPlaybackSelectionDivert({
            isPlaying: isPlayingRef.current,
            selectionDiverted: selectionDivertedRef.current,
            primaryIdx: primary,
            focusIdx: nextIdx,
          })
        ) {
          selectionDivertedRef.current = false;
        }
        return;
      }

      focusIdxRef.current = nextIdx;

      if (view) {
        const cur = view.state.field(transcriptPlaybackFocusField);
        if (cur !== normalized) {
          view.dispatch({
            effects: setTranscriptPlaybackFocusEffect.of(normalized),
          });
        }
      }

      const primary = effectiveTranscriptPrimaryIdx(selectedIdxRef.current);
      if (
        shouldClearPlaybackSelectionDivert({
          isPlaying: isPlayingRef.current,
          selectionDiverted: selectionDivertedRef.current,
          primaryIdx: primary,
          focusIdx: nextIdx,
        })
      ) {
        selectionDivertedRef.current = false;
      }

      if (
        shouldRevealTranscriptPlaybackFocus({
          enabled: enabledRef.current,
          isPlaying: isPlayingRef.current,
          focusIdx: nextIdx,
          prevFocusIdx: prev,
          editorFocused: Boolean(view?.hasFocus),
          userScrollSuppressUntilMs: userScrollSuppressUntilRef.current,
          nowMs: performance.now(),
          selectionDiverted: selectionDivertedRef.current,
        })
      ) {
        if (view) {
          programmaticScrollUntilRef.current = performance.now() + PROGRAMMATIC_SCROLL_GUARD_MS;
          revealSegmentInScrollDOM(view, nextIdx, { y: "center" });
        }
      }
    },
    [ensureScrollListener],
  );

  const clearFocus = useCallback(() => {
    focusIdxRef.current = -1;
    selectionDivertedRef.current = false;
    scrollListenCleanupRef.current?.();
    const view = getTranscriptEditorView();
    if (!view) return;
    if (view.state.field(transcriptPlaybackFocusField) == null) return;
    view.dispatch({ effects: setTranscriptPlaybackFocusEffect.of(null) });
  }, []);

  const notifyUserSegmentSelect = useCallback((idx: number) => {
    if (
      shouldMarkPlaybackSelectionDivert({
        isPlaying: isPlayingRef.current,
        selectedIdx: idx,
        focusIdx: focusIdxRef.current,
      })
    ) {
      selectionDivertedRef.current = true;
    }
  }, []);

  useEffect(() => {
    if (!isPlaying || !isReady || !enabled) {
      clearFocus();
      return;
    }

    ensureScrollListener();
    const unsub = subscribePlayheadFrame((timeSec) => {
      const idx = resolveVisitedSegmentIndexAtPlayhead(segmentsRef.current, timeSec);
      applyFocusIdx(idx);
    }, PLAYHEAD_FRAME_PRIORITY_TRANSCRIPT);

    return () => {
      unsub();
    };
  }, [
    applyFocusIdx,
    clearFocus,
    enabled,
    ensureScrollListener,
    isPlaying,
    isReady,
    subscribePlayheadFrame,
  ]);

  useEffect(() => {
    return () => {
      scrollListenCleanupRef.current?.();
    };
  }, []);

  return { notifyUserSegmentSelect };
}
