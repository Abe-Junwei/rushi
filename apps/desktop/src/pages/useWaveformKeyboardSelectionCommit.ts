import { useCallback, useEffect, useRef } from "react";
import { selectionProfileFlush } from "../services/ui/selectionLatencyProfile";
import type { SegmentSelectAtOptions } from "../utils/waveformViewMode";

const WAVEFORM_KEYBOARD_COMMIT_DEBOUNCE_MS = 120;

type PendingWaveformKeyboardCommit = {
  idx: number;
  opts?: SegmentSelectAtOptions;
};

export function useWaveformKeyboardSelectionCommit(
  setSelectedIdxUi: (idx: number, opts?: SegmentSelectAtOptions) => void,
) {
  const pendingRef = useRef<PendingWaveformKeyboardCommit | null>(null);
  const timerRef = useRef(0);

  const clearTimer = useCallback(() => {
    window.clearTimeout(timerRef.current);
    timerRef.current = 0;
  }, []);

  const flush = useCallback(() => {
    clearTimer();
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (!pending) return;
    selectionProfileFlush();
    setSelectedIdxUi(pending.idx, pending.opts);
  }, [clearTimer, setSelectedIdxUi]);

  const cancel = useCallback(() => {
    clearTimer();
    pendingRef.current = null;
  }, [clearTimer]);

  const queue = useCallback(
    (idx: number, opts?: SegmentSelectAtOptions) => {
      pendingRef.current = { idx, opts };
      clearTimer();
      timerRef.current = window.setTimeout(flush, WAVEFORM_KEYBOARD_COMMIT_DEBOUNCE_MS);
    },
    [clearTimer, flush],
  );

  useEffect(() => {
    const onKeyUp = (event: KeyboardEvent) => {
      if (
        event.key === "ArrowLeft" ||
        event.key === "ArrowRight" ||
        event.key === "ArrowUp" ||
        event.key === "ArrowDown"
      ) {
        flush();
      }
    };
    window.addEventListener("keyup", onKeyUp, true);
    return () => {
      window.removeEventListener("keyup", onKeyUp, true);
      cancel();
    };
  }, [cancel, flush]);

  return { queue, cancel };
}
