import { useCallback, useSyncExternalStore } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import { segmentUidOf } from "../utils/segmentUid";
import {
  appendProgrammaticLearnOp,
  applyBeforeInputToLearnEditState,
  applyInputEventToLearnEditState,
  emptyLearnEditState,
  finalizeLearnEditAfterComposition,
  liveAnchorToBaselineAnchor,
  projectLiveTextAfterBeforeInput,
  syncLearnEditStateToBaselineLive,
  type LearnEditState,
  type PendingCompositionSelection,
  type TextInputDomSnapshot,
} from "../services/learnEditDelta";

export function normalizeSegmentDraftText(text: string): string {
  return text.replace(/\r\n|\r|\n/g, " ");
}

/** uid + 数组下标，避免重复 uid 时草稿与 React 行错位。 */
export function segmentDraftKey(seg: SegmentDto, idx: number): string {
  const uid = segmentUidOf(seg);
  return uid ? `${uid}#${idx}` : `idx:${idx}`;
}

const drafts = new Map<string, string>();
/** 聚焦语段时的已提交正文，供 ⌘/Ctrl+Enter 在自动保存后仍能对比学习。 */
const learnFocusBaseline = new Map<string, string>();
const learnEditStateByKey = new Map<string, LearnEditState>();
const pendingImeSelectionByKey = new Map<string, PendingCompositionSelection>();
const composingKeys = new Set<string>();
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}

function clearLearnSessionForKey(key: string): boolean {
  let changed = learnFocusBaseline.delete(key);
  if (learnEditStateByKey.delete(key)) changed = true;
  if (pendingImeSelectionByKey.delete(key)) changed = true;
  return changed;
}

function clearAllLearnSessions(): void {
  learnFocusBaseline.clear();
  learnEditStateByKey.clear();
  pendingImeSelectionByKey.clear();
}

function ensureLearnFocusBaselineImpl(key: string, committedText: string): void {
  if (learnFocusBaseline.has(key)) return;
  const next = normalizeSegmentDraftText(committedText);
  learnFocusBaseline.set(key, next);
  learnEditStateByKey.set(key, emptyLearnEditState());
  emit();
}

/** 语段被选中时开启/续接 learn 会话（基线 = 当前可见正文）。 */
function beginSegmentLearnSessionImpl(key: string, anchorText: string): void {
  const existing = learnEditStateByKey.get(key);
  if (existing && existing.ops.length > 0) return;

  const next = normalizeSegmentDraftText(anchorText);
  const prevBase = learnFocusBaseline.get(key);
  if (prevBase === next && learnEditStateByKey.has(key)) return;
  learnFocusBaseline.set(key, next);
  learnEditStateByKey.set(key, emptyLearnEditState());
  emit();
}

function publishLearnEditState(
  key: string,
  prev: LearnEditState | undefined,
  focusBaseline: string,
  liveText: string,
  next: LearnEditState,
): void {
  const synced = syncLearnEditStateToBaselineLive(
    focusBaseline,
    normalizeSegmentDraftText(liveText),
    next,
  );
  if (prev && JSON.stringify(prev) === JSON.stringify(synced)) return;
  learnEditStateByKey.set(key, synced);
  emit();
}

export const segmentDraftStore = {
  getDraft(key: string): string | undefined {
    return drafts.get(key);
  },
  setDraft(key: string, text: string): void {
    const normalized = normalizeSegmentDraftText(text);
    if (drafts.get(key) === normalized) return;
    drafts.set(key, normalized);
    emit();
  },
  clearDraft(key: string): void {
    if (!drafts.delete(key)) return;
    emit();
  },
  resetAll(): void {
    if (
      drafts.size === 0 &&
      composingKeys.size === 0 &&
      learnFocusBaseline.size === 0 &&
      learnEditStateByKey.size === 0 &&
      pendingImeSelectionByKey.size === 0
    ) {
      return;
    }
    drafts.clear();
    clearAllLearnSessions();
    composingKeys.clear();
    emit();
  },
  /** 撤销/重做后丢弃未提交草稿与记忆追踪，避免与 segments 真源错位。 */
  discardEditingSession(): void {
    if (
      drafts.size === 0 &&
      composingKeys.size === 0 &&
      learnFocusBaseline.size === 0 &&
      learnEditStateByKey.size === 0 &&
      pendingImeSelectionByKey.size === 0
    ) {
      return;
    }
    drafts.clear();
    clearAllLearnSessions();
    composingKeys.clear();
    emit();
  },
  /** 聚焦修订基线；已存在则不覆盖。 */
  ensureLearnFocusBaseline: ensureLearnFocusBaselineImpl,
  setLearnFocusBaseline: ensureLearnFocusBaselineImpl,
  /** 选中语段时：基线对齐当前正文并清空 ops（同基线则保留 ops）。 */
  beginSegmentLearnSession: beginSegmentLearnSessionImpl,
  getLearnFocusBaseline(key: string): string | undefined {
    return learnFocusBaseline.get(key);
  },
  clearLearnFocusBaseline(key: string): void {
    if (!clearLearnSessionForKey(key)) return;
    emit();
  },
  getLearnEditState(key: string): LearnEditState | undefined {
    return learnEditStateByKey.get(key);
  },
  applyLearnEditBeforeInput(
    key: string,
    committedText: string,
    baseline: string,
    value: string,
    selectionStart: number,
    selectionEnd: number,
    inputType: string,
    data: string | null,
  ): void {
    ensureLearnFocusBaselineImpl(key, committedText);
    const effectiveBaseline = learnFocusBaseline.get(key) ?? baseline;
    const prev = learnEditStateByKey.get(key);
    const next = applyBeforeInputToLearnEditState(
      prev,
      effectiveBaseline,
      value,
      selectionStart,
      selectionEnd,
      inputType,
      data,
    );
    const liveAfter = projectLiveTextAfterBeforeInput(
      value,
      selectionStart,
      selectionEnd,
      inputType,
      data,
    );
    publishLearnEditState(key, prev, effectiveBaseline, liveAfter, next);
  },
  /** input 事件：用改前/改后 DOM 快照追踪（WebView beforeinput 常缺 inputType）。 */
  applyLearnEditFromDomInput(
    key: string,
    committedText: string,
    before: TextInputDomSnapshot,
    valueAfter: string,
  ): void {
    if (before.value === valueAfter) return;
    ensureLearnFocusBaselineImpl(key, committedText);
    const effectiveBaseline = learnFocusBaseline.get(key) ?? committedText;
    const prev = learnEditStateByKey.get(key);
    const next = applyInputEventToLearnEditState(
      prev,
      effectiveBaseline,
      before.value,
      before.start,
      before.end,
      valueAfter,
    );
    publishLearnEditState(key, prev, effectiveBaseline, valueAfter, next);
  },
  /** blur / 确认前 finalize 进行中的 op；勿在逐步 input 间调用（会破坏删→输同一 active op）。 */
  finalizeActiveLearnEditOp(key: string): void {
    const prev = learnEditStateByKey.get(key);
    if (!prev || prev.activeIndex === null) return;
    learnEditStateByKey.set(key, { ops: prev.ops, activeIndex: null });
    emit();
  },
  /** 程序改字路径：popover / 查找替换等，追加一条 removed→inserted op。 */
  recordProgrammaticLearnReplacement(
    key: string,
    committedText: string,
    liveTextBeforeEdit: string,
    liveAnchor: number,
    removed: string,
    inserted: string,
  ): void {
    const trimmedRemoved = removed.trim();
    const trimmedInserted = inserted.trim();
    if (!trimmedRemoved || !trimmedInserted || trimmedRemoved === trimmedInserted) return;

    ensureLearnFocusBaselineImpl(key, committedText);
    const prev = learnEditStateByKey.get(key);
    const baselineAnchor = liveAnchorToBaselineAnchor(prev, liveAnchor);
    const next = appendProgrammaticLearnOp(prev, {
      anchor: baselineAnchor,
      removed: liveTextBeforeEdit.slice(liveAnchor, liveAnchor + removed.length) || removed,
      inserted,
    });
    const liveAfter = drafts.get(key) ?? liveTextBeforeEdit.slice(0, liveAnchor) + inserted + liveTextBeforeEdit.slice(liveAnchor + removed.length);
    const baseline = learnFocusBaseline.get(key) ?? committedText;
    publishLearnEditState(key, prev, baseline, liveAfter, next);
  },
  resetLearnEditState(key: string): void {
    if (!learnEditStateByKey.has(key)) return;
    learnEditStateByKey.set(key, emptyLearnEditState());
    emit();
  },
  beginComposition(
    key: string,
    committedText: string,
    value: string,
    selectionStart: number,
    selectionEnd: number,
  ): void {
    ensureLearnFocusBaselineImpl(key, committedText);
    if (composingKeys.has(key)) return;
    composingKeys.add(key);
    if (selectionStart !== selectionEnd) {
      pendingImeSelectionByKey.set(key, {
        liveAnchor: selectionStart,
        removed: value.slice(selectionStart, selectionEnd),
      });
    }
    emit();
  },
  endComposition(key: string): void {
    if (!composingKeys.delete(key)) {
      pendingImeSelectionByKey.delete(key);
      return;
    }
    const pending = pendingImeSelectionByKey.get(key) ?? null;
    pendingImeSelectionByKey.delete(key);
    const prev = learnEditStateByKey.get(key);
    const next = finalizeLearnEditAfterComposition(prev, pending);
    if (prev !== next) {
      learnEditStateByKey.set(key, next);
    }
    emit();
  },
  setComposing(key: string, active: boolean): void {
    if (active) {
      if (composingKeys.has(key)) return;
      composingKeys.add(key);
      emit();
      return;
    }
    segmentDraftStore.endComposition(key);
  },
  isComposing(key: string): boolean {
    return composingKeys.has(key);
  },
  hasActiveComposition(): boolean {
    return composingKeys.size > 0;
  },
  pruneMissingKeys(validKeys: Set<string>): void {
    let changed = false;
    for (const key of drafts.keys()) {
      if (!validKeys.has(key)) {
        drafts.delete(key);
        changed = true;
      }
    }
    for (const key of learnFocusBaseline.keys()) {
      if (!validKeys.has(key)) {
        clearLearnSessionForKey(key);
        changed = true;
      }
    }
    for (const key of learnEditStateByKey.keys()) {
      if (!validKeys.has(key)) {
        if (learnEditStateByKey.delete(key)) changed = true;
      }
    }
    for (const key of pendingImeSelectionByKey.keys()) {
      if (!validKeys.has(key)) {
        if (pendingImeSelectionByKey.delete(key)) changed = true;
      }
    }
    if (changed) emit();
  },
};

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 订阅草稿变更（用于自动保存等）。 */
export function subscribeSegmentDraftStore(listener: () => void): () => void {
  return subscribe(listener);
}

/** 语段正文草稿（按 uid / idx 键）；未编辑时与 committed 一致。 */
export function useSegmentDraft(key: string, committedText: string): readonly [string, (text: string) => void] {
  const committed = normalizeSegmentDraftText(committedText ?? "");
  const getSnapshot = useCallback(() => drafts.get(key) ?? committed, [key, committed]);
  const draft = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const setDraft = useCallback((text: string) => {
    segmentDraftStore.setDraft(key, text);
  }, [key]);
  return [draft, setDraft];
}
