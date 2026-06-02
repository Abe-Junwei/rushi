import {
  collectLearnablePairsForSession,
  type LearnEditState,
} from "./learnEditDelta";
import {
  normalizeSegmentDraftText,
  segmentDraftStore,
} from "../hooks/useSegmentDraftStore";

export function resolveLiveTextForLearn(draftKey: string, committedText: string): string {
  const draft = segmentDraftStore.getDraft(draftKey);
  return normalizeSegmentDraftText(draft ?? committedText);
}

export function segmentLearnButtonVisible(
  draftKey: string,
  committedText: string,
  selected: boolean,
  learnState?: LearnEditState,
): boolean {
  if (!selected) return false;
  const focusBase = segmentDraftStore.getLearnFocusBaseline(draftKey);
  if (focusBase === undefined) return false;
  const liveText = resolveLiveTextForLearn(draftKey, committedText);
  if (liveText === focusBase) return false;
  const state = learnState ?? segmentDraftStore.getLearnEditState(draftKey);
  return collectLearnablePairsForSession(state, focusBase, liveText).length > 0;
}

/** blur 后仍保留草稿，供纳入记忆按钮读取 live 文本。 */
export function shouldRetainDraftForPendingLearn(
  draftKey: string,
  committedText: string,
  liveText: string,
): boolean {
  const focusBase = segmentDraftStore.getLearnFocusBaseline(draftKey);
  if (focusBase === undefined) return false;
  const normalizedLive = normalizeSegmentDraftText(liveText);
  const normalizedCommitted = normalizeSegmentDraftText(committedText);
  if (normalizedLive === normalizedCommitted && normalizedLive === focusBase) return false;
  const learnState = segmentDraftStore.getLearnEditState(draftKey);
  return (
    collectLearnablePairsForSession(learnState, focusBase, normalizedLive).length > 0
  );
}
