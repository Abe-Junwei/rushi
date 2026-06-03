import type { LearnEditState } from "./learnEditDelta";
import { normalizeSegmentDraftText, segmentDraftStore } from "../hooks/useSegmentDraftStore";

export function resolveLiveTextForLearn(draftKey: string, committedText: string): string {
  const draft = segmentDraftStore.getDraft(draftKey);
  return normalizeSegmentDraftText(draft ?? committedText);
}

/** 自动「纳入记忆」按钮已弃用；改用语段正文选区右键。 */
export function segmentLearnButtonVisible(
  _draftKey: string,
  _committedText: string,
  _selected: boolean,
  _learnState?: LearnEditState,
): boolean {
  return false;
}

/** blur 后仍保留草稿，供纳入记忆按钮读取 live 文本。 */
export function shouldRetainDraftForPendingLearn(
  _draftKey: string,
  _committedText: string,
  _liveText: string,
): boolean {
  return false;
}
