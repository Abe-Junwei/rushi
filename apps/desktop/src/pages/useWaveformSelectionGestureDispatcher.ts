import { useCallback, type RefObject } from "react";
import {
  dispatchWaveformSelectionGestureDown,
  dispatchWaveformSelectionGestureUp,
  type WaveformSelectionGesture,
} from "../services/waveform/waveformSelectionGesture";
import { selectionProfileTime } from "../services/ui/selectionLatencyProfile";
import type { TranscriptionLayerInput } from "./transcriptionLayerTypes";
import type { SegmentSelectAtOptions, SegmentSelectSource } from "../utils/waveformViewMode";
import type { useWaveformTimelineController } from "../hooks/useWaveformTimelineController";

type TimelineApi = ReturnType<typeof useWaveformTimelineController>;

export function useWaveformSelectionGestureDispatcher(args: {
  ctxRef: RefObject<TranscriptionLayerInput>;
  timelineRef: RefObject<{ timeline: TimelineApi }>;
  paintSelectionChrome: (
    c: TranscriptionLayerInput,
    idx: number,
    opts: { shiftKey?: boolean; toggle?: boolean } | undefined,
    source: SegmentSelectSource,
    publishOpts?: { skipBandPaint?: boolean },
  ) => void;
  commitWaveformSelectPreviewSc1: (idx: number) => void;
  runWaveformSelectListScroll: (idx: number) => void;
  selectSegmentAt: (
    idx: number,
    source?: SegmentSelectSource,
    opts?: SegmentSelectAtOptions,
  ) => void;
  focusWaveformShell: () => void;
}): {
  dispatchWaveformSelectionGesture: (gesture: WaveformSelectionGesture) => boolean | void;
  previewWaveformSegmentChrome: (idx: number) => boolean;
} {
  const dispatchWaveformSelectionGesture = useCallback(
    (gesture: WaveformSelectionGesture): boolean | void => {
      const c = args.ctxRef.current;
      const tl = args.timelineRef.current.timeline;
      if (gesture.phase === "down") {
        return (
          selectionProfileTime("viewport", () =>
            dispatchWaveformSelectionGestureDown(
              c,
              tl,
              gesture.idx,
              {
                paintChrome: args.paintSelectionChrome,
                commitSelectedIdxRef: args.commitWaveformSelectPreviewSc1,
                runListScroll: args.runWaveformSelectListScroll,
              },
              gesture.sessionId,
            ),
          )?.viewportSyncedOnDown ?? false
        );
      }
      dispatchWaveformSelectionGestureUp(c, gesture, {
        selectSegmentAt: args.selectSegmentAt,
        seekToTime: (timeSec) => {
          tl.suppressPlaybackFollowForSelectionSeek();
          tl.wfApiRef.current.seek(timeSec);
          tl.syncDisplayPlayheadAfterSeek?.(timeSec);
        },
        focusWaveformShell: args.focusWaveformShell,
      });
    },
    [args],
  );

  const previewWaveformSegmentChrome = useCallback(
    (idx: number): boolean =>
      dispatchWaveformSelectionGesture({ phase: "down", idx }) === true,
    [dispatchWaveformSelectionGesture],
  );

  return { dispatchWaveformSelectionGesture, previewWaveformSegmentChrome };
}
