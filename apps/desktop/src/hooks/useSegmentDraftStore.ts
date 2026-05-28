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

const drafts = new Map<string, string>();
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
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
    if (drafts.size === 0) return;
    drafts.clear();
    emit();
  },
  pruneMissingKeys(validKeys: Set<string>): void {
    let changed = false;
    for (const key of drafts.keys()) {
      if (!validKeys.has(key)) {
        drafts.delete(key);
        changed = true;
      }
    }
    if (changed) emit();
  },
};

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
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
