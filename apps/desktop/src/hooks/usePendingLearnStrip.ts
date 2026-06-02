import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import { partitionPendingLearnChanges } from "../services/pendingLearnRevision";
import {
  normalizeSegmentDraftText,
  segmentDraftKey,
  segmentDraftStore,
  subscribeSegmentDraftStore,
  useSegmentDraft,
} from "./useSegmentDraftStore";

const DEBOUNCE_MS = 220;

export function usePendingLearnStrip(segment: SegmentDto, segmentIdx: number, selected: boolean) {
  const draftKey = segmentDraftKey(segment, segmentIdx);
  const committedText = normalizeSegmentDraftText(segment.text ?? "");
  const [liveText] = useSegmentDraft(draftKey, committedText);
  const learnBaseline = useSyncExternalStore(
    subscribeSegmentDraftStore,
    () => segmentDraftStore.getLearnFocusBaseline(draftKey) ?? committedText,
    () => segmentDraftStore.getLearnFocusBaseline(draftKey) ?? committedText,
  );
  const isComposing = useSyncExternalStore(
    subscribeSegmentDraftStore,
    () => segmentDraftStore.isComposing(draftKey),
    () => segmentDraftStore.isComposing(draftKey),
  );
  const learnState = useSyncExternalStore(
    subscribeSegmentDraftStore,
    () => segmentDraftStore.getLearnEditState(draftKey),
    () => segmentDraftStore.getLearnEditState(draftKey),
  );

  const [debouncedLive, setDebouncedLive] = useState(liveText);
  const wasComposingRef = useRef(isComposing);

  useEffect(() => {
    if (!selected) {
      setDebouncedLive(liveText);
      wasComposingRef.current = isComposing;
      return;
    }
    if (isComposing) {
      wasComposingRef.current = true;
      return;
    }
    if (wasComposingRef.current) {
      wasComposingRef.current = false;
      setDebouncedLive(liveText);
      return;
    }
    const timer = window.setTimeout(() => setDebouncedLive(liveText), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [selected, liveText, isComposing]);

  const { learnablePairs, skipped } = useMemo(
    () =>
      selected
        ? partitionPendingLearnChanges(learnBaseline, debouncedLive, learnState)
        : { learnablePairs: [], skipped: [] },
    [selected, learnBaseline, debouncedLive, learnState],
  );

  const visible = selected && learnablePairs.length > 0;

  return { visible, learnablePairs, skipped, isComposing };
}
