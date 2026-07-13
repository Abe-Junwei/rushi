import type WaveSurfer from "wavesurfer.js";
import type { SegmentDto } from "../tauri/projectApi";
import type { ActiveSegmentPlaybackBound } from "../utils/segmentPlaybackBound";
import type { PlaybackTransport } from "../services/waveform/transport";

export type PlaySegmentAtIndexOptions = {
  /** Tab 听打：切段后自动循环当前语段。 */
  loop?: boolean;
  /** 显式起播时刻（点击/双击）；钳在语段内。 */
  fromSec?: number;
};

export type WaveformSegmentPlayActionsArgs = {
  wsRef: React.MutableRefObject<WaveSurfer | null>;
  transportRef?: React.MutableRefObject<PlaybackTransport | null>;
  /** Native visual-only: block WaveSurfer media fallback until transport loads. */
  requireTransport?: boolean;
  isReady: boolean;
  latestSegmentsRef: React.MutableRefObject<SegmentDto[]>;
  getGlobalPlaybackRate: () => number;
  getAuthorityPlayheadTimeSec?: () => number;
  resolvePlayheadSec: () => number;
  resolveEffectiveSelectedIdx: () => number;
  resolveSelectedPlaybackRange: () => { start: number; end: number } | null;
  playGenerationRef: React.MutableRefObject<number>;
  segmentBoundStopInFlightRef: React.MutableRefObject<boolean>;
  playStartInFlightGenerationRef: React.MutableRefObject<number | null>;
  segmentPlaybackBoundRef: React.MutableRefObject<ActiveSegmentPlaybackBound | null>;
  unboundedSelectedPlayGenRef: React.MutableRefObject<number | null>;
  pausedResumeAnchorRef: React.MutableRefObject<{ idx: number; timeSec: number } | null>;
  autoStoppedSegmentIdxRef: React.MutableRefObject<number | null>;
  segmentLoopPlaybackRef: React.MutableRefObject<boolean>;
  clearSegmentPlaybackBound: () => void;
  cancelSegmentPlaybackBound: () => void;
  setSegmentLoopPlayback: (loop: boolean) => void;
  setIsSelectedSegmentPlaying: (playing: boolean) => void;
  /** Sticky Space session: arm scoped segment after successful segment play start. */
  armSegmentPlaybackSession: (idx: number) => void;
  layoutDurationSecRef?: React.MutableRefObject<number>;
  syncDisplayPlayheadAfterSeekRef?: React.MutableRefObject<((timeSec: number) => void) | null>;
  commitSeekUi?: (timeSec: number) => void;
};
