import { flushSync } from "react-dom";
import type { SegmentDto } from "../tauri/projectApi";
import {
  clearCommittedDraftsForSegments,
  materializeSegmentTextDrafts,
  normalizeSegmentDraftText,
  pruneDraftKeysForSegments,
  segmentDraftKey,
  segmentDraftStore,
} from "../hooks/useSegmentDraftStore";

export const TRANSCRIPT_TEXTAREA_SELECTOR = 'textarea[aria-label="语段正文"]';

/** 焦点在语段正文 textarea 时返回行 index，否则 null。 */
export function readFocusedSegmentTextareaIdx(segmentsLength: number): number | null {
  if (typeof document === "undefined") return null;
  const active = document.activeElement;
  if (!(active instanceof HTMLTextAreaElement)) return null;
  if (!active.matches(TRANSCRIPT_TEXTAREA_SELECTOR)) return null;
  const row = active.closest("[data-seg-row]");
  if (!(row instanceof HTMLElement)) return null;
  const idx = Number(row.getAttribute("data-seg-row"));
  if (!Number.isFinite(idx) || idx < 0 || idx >= segmentsLength) return null;
  return idx;
}

/** 焦点在语段正文 textarea 时返回选区文本（无选区则空串）。 */
export function readFocusedTranscriptTextareaSelection(): string {
  if (typeof document === "undefined") return "";
  const active = document.activeElement;
  if (!(active instanceof HTMLTextAreaElement)) return "";
  if (!active.matches(TRANSCRIPT_TEXTAREA_SELECTOR)) return "";
  const start = active.selectionStart ?? 0;
  const end = active.selectionEnd ?? 0;
  if (start === end) return "";
  return active.value.slice(Math.min(start, end), Math.max(start, end));
}

/** 结构变更前：将焦点 textarea（含 IME 组字中）正文写回 segmentsRef。 */
export function syncFocusedDomTextIntoSegments(
  segmentsRef: React.MutableRefObject<SegmentDto[]>,
): void {
  if (typeof document === "undefined") return;
  const active = document.activeElement;
  if (!(active instanceof HTMLTextAreaElement)) return;
  if (!active.matches(TRANSCRIPT_TEXTAREA_SELECTOR)) return;
  const row = active.closest("[data-seg-row]");
  if (!(row instanceof HTMLElement)) return;
  const idx = Number(row.getAttribute("data-seg-row"));
  const base = segmentsRef.current;
  if (!Number.isFinite(idx) || idx < 0 || idx >= base.length) return;
  const seg = base[idx];
  if (!seg) return;
  const key = segmentDraftKey(seg, idx);
  segmentDraftStore.endComposition(key);
  const liveText = normalizeSegmentDraftText(active.value);
  const committed = normalizeSegmentDraftText(seg.text ?? "");
  if (liveText === committed) return;
  const out = [...base];
  out[idx] = { ...seg, text: liveText };
  segmentsRef.current = out;
}

/** undo/redo 前：以 segments 为准刷新仍挂载的 textarea，避免 DOM 旧值被 flush 写回。 */
export function syncDomTextareasFromSegments(segments: SegmentDto[]): void {
  if (typeof document === "undefined") return;
  for (const el of document.querySelectorAll<HTMLTextAreaElement>(TRANSCRIPT_TEXTAREA_SELECTOR)) {
    const row = el.closest("[data-seg-row]");
    if (!(row instanceof HTMLElement)) continue;
    const idx = Number(row.getAttribute("data-seg-row"));
    if (!Number.isFinite(idx) || idx < 0 || idx >= segments.length) continue;
    const seg = segments[idx];
    if (!seg) continue;
    const committed = normalizeSegmentDraftText(seg.text ?? "");
    if (el.value !== committed) {
      el.value = committed;
    }
  }
}

export {
  materializeSegmentTextDrafts,
  resolveLiveSegmentText,
} from "../hooks/useSegmentDraftStore";

/** 合并/保存前：把仍挂在 DOM 上的 textarea 正文同步进草稿 store（含 IME 组字中）。 */
export function syncDomTextareaDraftsIntoStore(segments: SegmentDto[]): void {
  if (typeof document === "undefined") return;
  for (const el of document.querySelectorAll<HTMLTextAreaElement>(TRANSCRIPT_TEXTAREA_SELECTOR)) {
    const row = el.closest("[data-seg-row]");
    if (!(row instanceof HTMLElement)) continue;
    const idx = Number(row.getAttribute("data-seg-row"));
    if (!Number.isFinite(idx) || idx < 0 || idx >= segments.length) continue;
    const seg = segments[idx];
    if (!seg) continue;
    const key = segmentDraftKey(seg, idx);
    segmentDraftStore.endComposition(key);
    segmentDraftStore.setDraft(key, el.value);
  }
}

type SegmentTextDraftFlushUpdate = { idx: number; text: string };

function endAllSegmentCompositions(segments: SegmentDto[]): void {
  segmentDraftStore.flushPendingEmit();
  for (const [i, s] of segments.entries()) {
    segmentDraftStore.endComposition(segmentDraftKey(s, i));
  }
}

/** 结构变更前：结束 IME，以 segments 刷新 DOM（S1 下行模型真源在 segmentsRef，不回写 stale DOM→draft）。 */
export function prepareSegmentTextDraftsForMutation(segments: SegmentDto[]): void {
  endAllSegmentCompositions(segments);
  syncDomTextareasFromSegments(segments);
}

/** 保存/导出前：结束 IME、DOM→draft（兼容离屏 draft / 未走 S1 的路径）。 */
function prepareSegmentTextDraftsForFlush(segments: SegmentDto[]): void {
  endAllSegmentCompositions(segments);
  syncDomTextareaDraftsIntoStore(segments);
}

/** 收集将把草稿写回 `segments` 的语段索引（不修改 state）。 */
function collectSegmentTextDraftFlushUpdates(
  segments: SegmentDto[],
): SegmentTextDraftFlushUpdate[] {
  const updates: SegmentTextDraftFlushUpdate[] = [];
  segments.forEach((s, i) => {
    const key = segmentDraftKey(s, i);
    if (segmentDraftStore.isComposing(key)) return;
    const draft = segmentDraftStore.getDraft(key);
    if (draft === undefined) return;
    const committed = normalizeSegmentDraftText(s.text ?? "");
    if (draft === committed) return;
    updates.push({ idx: i, text: draft });
  });
  return updates;
}

export type FlushSegmentTextDraftsOptions = {
  /** REV-LOC A1：在写回 `segments` 前为每个将变更语段入撤销栈。 */
  beforeApplyUpdates?: (updates: SegmentTextDraftFlushUpdate[]) => void;
};

function applySegmentTextDraftUpdates(
  base: SegmentDto[],
  updates: SegmentTextDraftFlushUpdate[],
): SegmentDto[] {
  if (updates.length === 0) return base;
  let next = base;
  for (const { idx, text } of updates) {
    if (idx < 0 || idx >= base.length) continue;
    const seg = next[idx];
    if (!seg || seg.text === text) continue;
    if (next === base) next = [...base];
    next[idx] = { ...seg, text };
  }
  return next;
}

/** 将草稿 store 中未提交的语段正文写回 `segments`（保存/合并/导出等前调用）。 */
export function flushSegmentTextDrafts(
  segmentsRef: React.MutableRefObject<SegmentDto[]>,
  setSegments: React.Dispatch<React.SetStateAction<SegmentDto[]>>,
  options?: FlushSegmentTextDraftsOptions,
): void {
  prepareSegmentTextDraftsForFlush(segmentsRef.current);
  const prev = segmentsRef.current;
  const validKeys = new Set<string>();
  prev.forEach((s, i) => {
    validKeys.add(segmentDraftKey(s, i));
  });
  const updates = collectSegmentTextDraftFlushUpdates(prev);
  segmentDraftStore.pruneMissingKeys(validKeys);
  if (updates.length === 0) return;
  options?.beforeApplyUpdates?.(updates);
  const next = applySegmentTextDraftUpdates(segmentsRef.current, updates);
  segmentsRef.current = next;
  flushSync(() => {
    setSegments(next);
  });
  for (const { idx, text } of updates) {
    const seg = segmentsRef.current[idx];
    if (!seg) continue;
    const key = segmentDraftKey(seg, idx);
    if (segmentDraftStore.getDraft(key) === text) {
      segmentDraftStore.clearDraft(key);
    }
  }
}

/** 结构变更（合并/拆分/删除/插入）前：物化全部草稿、写回 state，并清理 orphan draft 键。 */
export function commitSegmentTextDraftsForStructureMutation(
  segmentsRef: React.MutableRefObject<SegmentDto[]>,
  setSegments: React.Dispatch<React.SetStateAction<SegmentDto[]>>,
): void {
  syncFocusedDomTextIntoSegments(segmentsRef);
  prepareSegmentTextDraftsForMutation(segmentsRef.current);
  const materialized = materializeSegmentTextDrafts(segmentsRef.current);
  segmentsRef.current = materialized;
  flushSync(() => {
    setSegments(materialized);
  });
  clearCommittedDraftsForSegments(materialized);
  pruneDraftKeysForSegments(materialized);
}

type SegmentListSetter =
  | React.Dispatch<React.SetStateAction<SegmentDto[]>>
  | ((next: SegmentDto[]) => void);

/** 结构变更后：同步 segmentsRef 与 React state（S1 下 ref 可能领先 state）。 */
export function publishSegmentStructureMutation(
  segmentsRef: React.MutableRefObject<SegmentDto[]>,
  setSegments: SegmentListSetter,
  next: SegmentDto[],
): void {
  segmentsRef.current = next;
  flushSync(() => {
    setSegments(next);
  });
}

/** 批量写回语段正文后：刷新 state，并清除 stale draft / DOM，避免后续 flush 把旧字写回。 */
export function publishSegmentTextBulkMutation(
  segmentsRef: React.MutableRefObject<SegmentDto[]>,
  setSegments: SegmentListSetter,
  next: SegmentDto[],
): void {
  segmentsRef.current = next;
  flushSync(() => {
    setSegments(next);
  });
  for (const [i, seg] of next.entries()) {
    const key = segmentDraftKey(seg, i);
    segmentDraftStore.endComposition(key);
    segmentDraftStore.clearDraft(key);
  }
  syncDomTextareasFromSegments(next);
  pruneDraftKeysForSegments(next);
}

/** 转写开始前清空语段：丢弃 draft/DOM，避免旧 uid 污染新结果。 */
export function publishTranscribeSegmentClear(
  segmentsRef: React.MutableRefObject<SegmentDto[]>,
  setSegments: SegmentListSetter,
): void {
  segmentDraftStore.resetAll();
  publishSegmentStructureMutation(segmentsRef, setSegments, []);
}

/** 转写失败回滚：恢复语段并同步 draft/DOM。 */
export function publishTranscribeSegmentRestore(
  segmentsRef: React.MutableRefObject<SegmentDto[]>,
  setSegments: SegmentListSetter,
  next: SegmentDto[],
): void {
  segmentDraftStore.resetAll();
  publishSegmentTextBulkMutation(segmentsRef, setSegments, next);
}
