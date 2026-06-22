import { useCallback, useEffect, useRef } from "react";
import { selectionProfileFlush } from "../services/ui/selectionLatencyProfile";
import type { SegmentSelectAtOptions } from "../utils/waveformViewMode";

type PendingWaveformKeyboardCommit = {
  idx: number;
  opts?: SegmentSelectAtOptions;
};

export function useWaveformKeyboardSelectionCommit(
  setSelectedIdxUi: (idx: number, opts?: SegmentSelectAtOptions) => void,
  onFlush?: (idx: number) => void,
) {
  const pendingRef = useRef<PendingWaveformKeyboardCommit | null>(null);
  const onFlushRef = useRef(onFlush);
  onFlushRef.current = onFlush;

  const flush = useCallback(() => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    if (!pending) return;
    selectionProfileFlush();
    setSelectedIdxUi(pending.idx, pending.opts);
    onFlushRef.current?.(pending.idx);
  }, [setSelectedIdxUi]);

  const cancel = useCallback(() => {
    pendingRef.current = null;
  }, []);

  const queue = useCallback((idx: number, opts?: SegmentSelectAtOptions) => {
    pendingRef.current = { idx, opts };
  }, []);

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

  return { queue, cancel, flush };
}
