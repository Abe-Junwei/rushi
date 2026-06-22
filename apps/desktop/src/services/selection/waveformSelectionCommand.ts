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
    case "selectAndSeekStart":
      deps.selectSegmentAt(
        command.segmentIdx,
        command.source,
        command.sessionId ? { previewSessionId: command.sessionId } : undefined,
      );
      break;
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
