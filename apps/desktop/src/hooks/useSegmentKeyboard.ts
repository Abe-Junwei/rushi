import { useCallback, useEffect, useRef } from "react";
import type { TranscriptionLayerInput } from "../pages/transcriptionLayerTypes";
import type { useProjectWaveform } from "./useProjectWaveform";
import type { SegmentSelectSource } from "../utils/waveformViewMode";
import { isFindReplacePanelOpen } from "../pages/findReplaceTypes";
import { segmentStartSec } from "../utils/formatMediaTime";
import { focusTranscriptSegmentTextarea } from "../utils/focusTranscriptSegmentTextarea";
import {
  querySegmentListScrollRoot,
} from "../utils/segmentListVirtualWindow";
import { resolveAdjacentVisibleSegmentIdx } from "../utils/segmentListKeyboardNav";
import type { SegmentListFilterNavState } from "../utils/segmentListFilterNav";
import { readSegmentListFilterNavIndices } from "../utils/segmentListFilterNav";
import {
  createListAdvanceCoalescedScheduler,
  createListAdvanceSegmentPlaybackScheduler,
} from "../utils/scheduleListAdvanceSegmentPlayback";

type WfApi = ReturnType<typeof useProjectWaveform>;

/** 正文 textarea 与全局快捷键共用 ↑↓ 切语段（失焦时由 editorShortcutDispatcher 触发）。 */
export function useSegmentKeyboard(args: {
  ctxRef: React.MutableRefObject<TranscriptionLayerInput>;
  wfApiRef: React.MutableRefObject<WfApi>;
  selectSegmentAtRef: React.MutableRefObject<
    (idx: number, source?: SegmentSelectSource, opts?: { shiftKey?: boolean }) => void
  >;
  segmentListRef: React.RefObject<HTMLDivElement | null>;
  segmentListFilterNavRef: React.MutableRefObject<SegmentListFilterNavState>;
}) {
  const argsRef = useRef(args);
  argsRef.current = args;

  const loopPlaySchedulerRef = useRef(
    createListAdvanceSegmentPlaybackScheduler(
      (idx, options) => {
        void argsRef.current.wfApiRef.current.playSegmentAtIndex(idx, options);
      },
      (timeSec) => {
        argsRef.current.wfApiRef.current.seek(timeSec);
      },
    ),
  );
  const focusSchedulerRef = useRef(
    createListAdvanceCoalescedScheduler<number>((segmentIdx) => {
      focusTranscriptSegmentTextarea(argsRef.current.segmentListRef.current, segmentIdx);
    }),
  );

  const pendingAdvanceIdxRef = useRef<number | null>(null);
  const advanceRafRef = useRef(0);

  useEffect(
    () => () => {
      loopPlaySchedulerRef.current.cancel();
      focusSchedulerRef.current.cancel();
      if (advanceRafRef.current) cancelAnimationFrame(advanceRafRef.current);
    },
    [],
  );

  const focusSegmentTextarea = useCallback((segmentIdx: number) => {
    focusSchedulerRef.current.schedule(segmentIdx);
  }, []);

  const focusSegmentTextareaImmediate = useCallback((segmentIdx: number) => {
    focusTranscriptSegmentTextarea(argsRef.current.segmentListRef.current, segmentIdx);
  }, []);

  const resolveAdvanceTarget = useCallback((fromIdx: number, direction: -1 | 1): number | null => {
    const c = argsRef.current.ctxRef.current;
    const root =
      argsRef.current.segmentListRef.current ?? querySegmentListScrollRoot();
    const filtered = readSegmentListFilterNavIndices(
      argsRef.current.segmentListFilterNavRef.current,
      c.segments.length,
      root,
    );
    return resolveAdjacentVisibleSegmentIdx(fromIdx, direction, c.segments.length, filtered);
  }, []);

  const resolveAdvanceAnchorIdx = useCallback((segmentIdx: number): number => {
    const pending = pendingAdvanceIdxRef.current;
    if (pending != null) return pending;
    const selectedIdx = argsRef.current.ctxRef.current.selectedIdx;
    return selectedIdx >= 0 ? selectedIdx : segmentIdx;
  }, []);

  const advanceToSegment = useCallback(
    (targetIdx: number) => {
      const a = argsRef.current;
      const c = a.ctxRef.current;
      const seg = c.segments[targetIdx];
      if (!seg) return;

      // ↑↓：选中 + coalesced 波形 reveal/seek/focus；不触发 Tab 听打 loop-play。
      a.selectSegmentAtRef.current(targetIdx, "listKeyboard");
      loopPlaySchedulerRef.current.scheduleSeek(segmentStartSec(seg));
      focusSegmentTextarea(targetIdx);
    },
    [focusSegmentTextarea],
  );

  const flushPendingAdvance = useCallback(() => {
    advanceRafRef.current = 0;
    const idx = pendingAdvanceIdxRef.current;
    pendingAdvanceIdxRef.current = null;
    if (idx == null) return;
    advanceToSegment(idx);
  }, [advanceToSegment]);

  const scheduleAdvanceToSegment = useCallback(
    (targetIdx: number) => {
      pendingAdvanceIdxRef.current = targetIdx;
      if (advanceRafRef.current) return;
      advanceRafRef.current = requestAnimationFrame(flushPendingAdvance);
    },
    [flushPendingAdvance],
  );

  const onSegmentTextareaKeyDown = useCallback(
    (segmentIdx: number, e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && isFindReplacePanelOpen()) return;

      const a = argsRef.current;
      const c = a.ctxRef.current;

      if (!c.busy && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        const el = e.currentTarget;
        const start = el.selectionStart ?? 0;
        const end = el.selectionEnd ?? 0;
        const collapsed = start === end;
        if (e.key === "Delete" && collapsed && end === el.value.length && segmentIdx < c.segments.length - 1) {
          e.preventDefault();
          c.mergeWithNextAt(segmentIdx);
          focusSegmentTextareaImmediate(segmentIdx);
          return;
        }
      }

      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      e.preventDefault();
      const direction = e.key === "ArrowUp" ? -1 : 1;
      const anchorIdx = resolveAdvanceAnchorIdx(segmentIdx);
      const targetIdx = resolveAdvanceTarget(anchorIdx, direction);
      if (targetIdx == null || targetIdx === anchorIdx || !c.segments[targetIdx]) return;
      scheduleAdvanceToSegment(targetIdx);
    },
    [focusSegmentTextareaImmediate, resolveAdvanceAnchorIdx, resolveAdvanceTarget, scheduleAdvanceToSegment],
  );

  return { onSegmentTextareaKeyDown, focusSegmentTextarea: focusSegmentTextareaImmediate, scheduleAdvanceToSegment };
}
