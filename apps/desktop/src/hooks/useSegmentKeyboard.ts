import {
  useCallback,
  useEffect,
  useRef,
} from "react";
import type { TranscriptionLayerInput } from "../pages/transcriptionLayerTypes";
import type { useProjectWaveform } from "./useProjectWaveform";
import type { SegmentSelectAtOptions, SegmentSelectSource } from "../utils/waveformViewMode";
import { isFindReplacePanelOpen } from "../pages/findReplaceTypes";
import {
  cancelTranscriptSegmentFocusAttempts,
  focusTranscriptSegmentTextarea,
} from "../utils/focusTranscriptSegmentTextarea";
import {
  querySegmentListScrollRoot,
} from "../utils/segmentListVirtualWindow";
import { resolveAdjacentVisibleSegmentIdx } from "../utils/segmentListKeyboardNav";
import type { SegmentListFilterNavState } from "../utils/segmentListFilterNav";
import { readSegmentListFilterNavIndices } from "../utils/segmentListFilterNav";
import { getSelectionChromeSnapshot } from "../services/selection/selectionChromeStore";

type WfApi = ReturnType<typeof useProjectWaveform>;

const LIST_ARROW_KEYS = new Set(["ArrowUp", "ArrowDown"]);

function isListArrowKeyEvent(e: { key: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean }): boolean {
  return LIST_ARROW_KEYS.has(e.key) && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey;
}

/** 正文 textarea 与全局快捷键共用 ↑↓ 切语段（失焦时由 editorShortcutDispatcher 触发）。 */
export function useSegmentKeyboard(args: {
  ctxRef: React.MutableRefObject<TranscriptionLayerInput>;
  wfApiRef: React.MutableRefObject<WfApi>;
  selectSegmentAtRef: React.MutableRefObject<
    (idx: number, source?: SegmentSelectSource, opts?: SegmentSelectAtOptions) => void
  >;
  segmentListRef: React.RefObject<HTMLDivElement | null>;
  segmentListFilterNavRef: React.MutableRefObject<SegmentListFilterNavState>;
  cancelPendingSelectionRevealRef?: React.MutableRefObject<(() => void) | undefined>;
  finalizeListKeyboardViewportRef?: React.MutableRefObject<
    ((revealIdx?: number) => void) | undefined
  >;
  commitListKeyboardBurstRef?: React.MutableRefObject<((idx: number) => void) | undefined>;
}) {
  const argsRef = useRef(args);
  argsRef.current = args;

  const pendingAdvanceIdxRef = useRef<number | null>(null);
  const advanceRafRef = useRef(0);
  const listArrowKeyHeldRef = useRef(false);
  const immediateAdvanceIdxThisFrameRef = useRef<number | null>(null);
  const lastBurstTargetIdxRef = useRef<number | null>(null);

  const focusFinalSegmentTextarea = useCallback((segmentIdx: number) => {
    cancelTranscriptSegmentFocusAttempts();
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
    const chromePrimary = getSelectionChromeSnapshot().primaryIdx;
    if (chromePrimary >= 0) return chromePrimary;
    return segmentIdx;
  }, []);

  const advanceToSegment = useCallback((targetIdx: number, options?: { focus?: boolean }) => {
    const a = argsRef.current;
    const c = a.ctxRef.current;
    const seg = c.segments[targetIdx];
    if (!seg) return;

    a.selectSegmentAtRef.current(targetIdx, "listKeyboard", { burst: true });
    if (options?.focus !== false) {
      focusFinalSegmentTextarea(targetIdx);
    }
  }, [focusFinalSegmentTextarea]);

  const flushPendingAdvance = useCallback(() => {
    advanceRafRef.current = 0;
    const idx = pendingAdvanceIdxRef.current;
    pendingAdvanceIdxRef.current = null;
    const immediateIdx = immediateAdvanceIdxThisFrameRef.current;
    immediateAdvanceIdxThisFrameRef.current = null;
    if (idx == null || idx === immediateIdx) return;
    advanceToSegment(idx, { focus: false });
  }, [advanceToSegment]);

  const finalizeListKeyboardBurst = useCallback(() => {
    listArrowKeyHeldRef.current = false;

    if (advanceRafRef.current) {
      window.cancelAnimationFrame(advanceRafRef.current);
      advanceRafRef.current = 0;
      flushPendingAdvance();
    }

    argsRef.current.cancelPendingSelectionRevealRef?.current?.();

    const c = argsRef.current.ctxRef.current;
    const chromePrimary = getSelectionChromeSnapshot().primaryIdx;
    const idx =
      pendingAdvanceIdxRef.current ??
      lastBurstTargetIdxRef.current ??
      (chromePrimary >= 0 ? chromePrimary : c.selectedIdx);
    pendingAdvanceIdxRef.current = null;
    lastBurstTargetIdxRef.current = null;

    if (idx >= 0 && idx < c.segments.length) {
      argsRef.current.commitListKeyboardBurstRef?.current?.(idx);
      focusFinalSegmentTextarea(idx);
      return;
    }
    argsRef.current.finalizeListKeyboardViewportRef?.current?.();
  }, [flushPendingAdvance, focusFinalSegmentTextarea]);

  const scheduleAdvanceToSegment = useCallback(
    (targetIdx: number) => {
      pendingAdvanceIdxRef.current = targetIdx;
      lastBurstTargetIdxRef.current = targetIdx;
      if (advanceRafRef.current) return;
      immediateAdvanceIdxThisFrameRef.current = targetIdx;
      advanceToSegment(targetIdx, { focus: false });
      advanceRafRef.current = window.requestAnimationFrame(flushPendingAdvance);
    },
    [advanceToSegment, flushPendingAdvance],
  );

  useEffect(() => {
    const onKeyUp = (e: KeyboardEvent) => {
      if (!isListArrowKeyEvent(e)) return;
      finalizeListKeyboardBurst();
    };
    window.addEventListener("keyup", onKeyUp, true);
    return () => {
      window.removeEventListener("keyup", onKeyUp, true);
      pendingAdvanceIdxRef.current = null;
      if (advanceRafRef.current) {
        window.cancelAnimationFrame(advanceRafRef.current);
      }
      advanceRafRef.current = 0;
      listArrowKeyHeldRef.current = false;
      immediateAdvanceIdxThisFrameRef.current = null;
      lastBurstTargetIdxRef.current = null;
    };
  }, [finalizeListKeyboardBurst]);

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
          focusFinalSegmentTextarea(segmentIdx);
          return;
        }
      }

      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
      if (e.repeat && !listArrowKeyHeldRef.current) return;
      listArrowKeyHeldRef.current = true;
      e.preventDefault();
      const direction = e.key === "ArrowUp" ? -1 : 1;
      const anchorIdx = resolveAdvanceAnchorIdx(segmentIdx);
      const targetIdx = resolveAdvanceTarget(anchorIdx, direction);
      if (targetIdx == null || targetIdx === anchorIdx || !c.segments[targetIdx]) return;
      scheduleAdvanceToSegment(targetIdx);
    },
    [focusFinalSegmentTextarea, resolveAdvanceAnchorIdx, resolveAdvanceTarget, scheduleAdvanceToSegment],
  );

  return {
    onSegmentTextareaKeyDown,
    focusSegmentTextarea: focusFinalSegmentTextarea,
    scheduleAdvanceToSegment,
    finalizeListKeyboardBurst,
  };
}
