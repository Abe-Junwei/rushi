import { useCallback, useSyncExternalStore } from "react";
import type { SegmentDto } from "../tauri/projectApi";
import { segmentUidOf } from "../utils/segmentUid";

export function normalizeSegmentDraftText(text: string): string {
  return text.replace(/\r\n|\r|\n/g, " ");
}

/** uid + 数组下标，避免重复 uid 时草稿与 React 行错位。 */
export function segmentDraftKey(seg: SegmentDto, idx: number): string {
  const uid = segmentUidOf(seg);
  return uid ? `${uid}#${idx}` : `idx:${idx}`;
}

/** 语段正文真源：草稿 store 优先，否则 committed（与 UI liveText 一致）。 */
export function resolveLiveSegmentText(seg: SegmentDto, idx: number): string {
  const key = segmentDraftKey(seg, idx);
  const draft = segmentDraftStore.getDraft(key);
  if (draft !== undefined) return draft;
  return normalizeSegmentDraftText(seg.text ?? "");
}

/** 将草稿 store 中的正文物化到 segments 数组副本（不修改 React state）。 */
export function materializeSegmentTextDrafts(segments: SegmentDto[]): SegmentDto[] {
  let next: SegmentDto[] | null = null;
  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i];
    if (!seg) continue;
    const text = resolveLiveSegmentText(seg, i);
    const committed = normalizeSegmentDraftText(seg.text ?? "");
    if (text === committed) continue;
    if (next === null) next = [...segments];
    next[i] = { ...seg, text };
  }
  return next ?? segments;
}

/** 清除已与 committed 一致的草稿；结构变更后调用以避免 uid#旧idx 残留。 */
export function clearCommittedDraftsForSegments(segments: SegmentDto[]): void {
  for (const [i, seg] of segments.entries()) {
    const key = segmentDraftKey(seg, i);
    const draft = segmentDraftStore.getDraft(key);
    if (draft === undefined) continue;
    if (draft === normalizeSegmentDraftText(seg.text ?? "")) {
      segmentDraftStore.clearDraft(key);
    }
  }
}

/** 丢弃不在当前 segments 列表中的草稿/composition 键（reindex 后清理 orphan）。 */
export function pruneDraftKeysForSegments(segments: SegmentDto[]): void {
  const validKeys = new Set<string>();
  segments.forEach((s, i) => {
    validKeys.add(segmentDraftKey(s, i));
  });
  segmentDraftStore.pruneMissingKeys(validKeys);
}

const drafts = new Map<string, string>();
const composingKeys = new Set<string>();
const listeners = new Set<() => void>();

let emitRafId: number | null = null;

function emit(): void {
  listeners.forEach((l) => l());
}

function scheduleEmit(): void {
  if (emitRafId != null) return;
  if (typeof requestAnimationFrame === "undefined") {
    emit();
    return;
  }
  emitRafId = requestAnimationFrame(() => {
    emitRafId = null;
    emit();
  });
}

/** Flush a pending rAF notify so subscribers see the latest draft map (blur / tests). */
function flushPendingEmit(): void {
  if (emitRafId != null) {
    cancelAnimationFrame(emitRafId);
    emitRafId = null;
  }
  emit();
}

export const segmentDraftStore = {
  getDraft(key: string): string | undefined {
    return drafts.get(key);
  },
  setDraft(key: string, text: string): void {
    const next = normalizeSegmentDraftText(text);
    if (drafts.get(key) === next) return;
    drafts.set(key, next);
    scheduleEmit();
  },
  clearDraft(key: string): void {
    if (!drafts.delete(key)) return;
    scheduleEmit();
  },
  resetAll(): void {
    if (drafts.size === 0 && composingKeys.size === 0) return;
    drafts.clear();
    composingKeys.clear();
    flushPendingEmit();
  },
  discardEditingSession(): void {
    if (drafts.size === 0 && composingKeys.size === 0) return;
    drafts.clear();
    composingKeys.clear();
    flushPendingEmit();
  },
  beginComposition(key: string): void {
    if (composingKeys.has(key)) return;
    composingKeys.add(key);
  },
  endComposition(key: string): void {
    if (!composingKeys.delete(key)) return;
    scheduleEmit();
  },
  setComposing(key: string, active: boolean): void {
    if (active) {
      segmentDraftStore.beginComposition(key);
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
    for (const key of composingKeys) {
      if (!validKeys.has(key)) {
        composingKeys.delete(key);
        changed = true;
      }
    }
    if (changed) scheduleEmit();
  },
  flushPendingEmit,
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
