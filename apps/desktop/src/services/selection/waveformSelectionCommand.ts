import type { TranscriptionLayerInput } from "../../pages/transcriptionLayerTypes";
import type { SegmentOverlayTapGesture } from "../../utils/waveformSegmentOverlayActions";
import { resolveSegmentOverlayTap } from "../../utils/waveformSegmentOverlayActions";
import type { SegmentSelectAtOptions, SegmentSelectSource } from "../../utils/waveformViewMode";

export type WaveformSelectionCommand =
  | {
      kind: "selectAndSeekStart";
      segmentIdx: number;
      source: Extract<SegmentSelectSource, "waveform">;
      sessionId?: string;
      /** Playing-defer: seek was skipped on pointerdown — pointerup must force it. */
      forceSeek?: boolean;
    }
  | { kind: "seekWithinSegment"; timeSec: number }
  | {
      kind: "selectOnly";
      segmentIdx: number;
      source: SegmentSelectSource;
      opts?: SegmentSelectAtOptions;
    }
  | { kind: "noop" };

export function resolveWaveformSelectionTapCommand(input: {
  ctx: TranscriptionLayerInput;
  segmentIdx: number;
  pointerTimeSec: number;
  tapGesture: SegmentOverlayTapGesture;
}): WaveformSelectionCommand {
  const segment = input.ctx.segments[input.segmentIdx];
  if (input.ctx.busy || !segment) return { kind: "noop" };

  const resolved = resolveSegmentOverlayTap({
    selectedIdx: input.ctx.selectedIdx,
    selectedIdxAtPointerDown: input.tapGesture.selectedIdxAtPointerDown,
    viewportSyncedOnDown: input.tapGesture.viewportSyncedOnDown === true,
    segmentIdx: input.segmentIdx,
    pointerTimeSec: input.pointerTimeSec,
    segment,
  });

  if (resolved.kind === "seek-within") {
    return { kind: "seekWithinSegment", timeSec: resolved.timeSec };
  }

  return {
    kind: "selectAndSeekStart",
    segmentIdx: resolved.segmentIdx,
    source: "waveform",
    sessionId: input.tapGesture.sessionId,
    // Playing-defer: down already moved CM6 primary without seek — up must not chrome-match-skip.
    ...(input.tapGesture.viewportSyncedOnDown !== true ? { forceSeek: true as const } : {}),
  };
}

export function applyWaveformSelectionCommand(
  command: WaveformSelectionCommand,
  deps: {
    selectSegmentAt: (
      idx: number,
      source?: SegmentSelectSource,
      opts?: SegmentSelectAtOptions,
    ) => void;
    seekToTime: (timeSec: number) => void;
    focusWaveformShell?: () => void;
  },
): void {
  switch (command.kind) {
    case "selectAndSeekStart": {
      const opts: SegmentSelectAtOptions | undefined =
        command.sessionId || command.forceSeek
          ? {
              ...(command.sessionId ? { previewSessionId: command.sessionId } : {}),
              ...(command.forceSeek ? { forceSeek: true } : {}),
            }
          : undefined;
      deps.selectSegmentAt(command.segmentIdx, command.source, opts);
      break;
    }
    case "selectOnly":
      deps.selectSegmentAt(command.segmentIdx, command.source, command.opts);
      break;
    case "seekWithinSegment":
      deps.focusWaveformShell?.();
      deps.seekToTime(command.timeSec);
      break;
    default:
      break;
  }
}
