import type { RefObject } from "react";
import type { SegmentDto } from "../tauri/projectTypes";
import type { PeakCache } from "../services/waveform/PeakCache";
import type { TierScrollLayoutMetrics, TierScrollLiveRefs } from "../utils/waveformViewport";

/** Live tier metrics for pointer → time mapping (populated after tier scroll sync mounts). */
export type TierViewportMetricsRef = RefObject<{
  tierScrollLive: TierScrollLiveRefs;
  tierScrollLayout: TierScrollLayoutMetrics;
} | null>;

/** Options for `useProjectWaveform` (shared to break hook import cycle). */
export type UseProjectWaveformOptions = {
  mediaUrl: string | null;
  /** Raw on-disk path — parity probe only (`asset_fetch_parity`); load uses convertFileSrc. */
  mediaDiskPath?: string | null;
  segments: SegmentDto[];
  selectedIdx: number;
  disabled?: boolean;
  /** Live layout px/s — ws.zoom follows immediately. */
  layoutPxPerSec?: number;
  /** Debounced peaks-load px/s — ws.load quantum; defaults to layout when omitted. */
  drawPxPerSec?: number;
  /** Precomputed peaks (Tauri audiowaveform `.dat`). */
  peakCache?: PeakCache | null;
  /** After peaks resample / ws.zoom; return true if viewport fit handled scroll. */
  onZoomApplied?: (pxPerSec: number) => boolean | void;
  /** Waveform stage height (px). */
  waveformHeightPx?: number;
  /** After WaveSurfer redraw, ack committed height to outer preview layer. */
  onWaveformHeightApplied?: (heightPx: number) => void;
  /** Drag on blank waveform to create a segment. */
  onWaveformCreateRange?: (startSec: number, endSec: number) => void;
  /** Route C2: allow peaks hot-switch during playback. */
  hotSwitchWhilePlaying?: boolean;
  /** When true, defer decode mount until peaks bootstrap or failure (long-audio safe path). */
  deferDecodeMount?: boolean;
  /** Bumps zoom sync when in-place PeakCache gains LOD levels (e.g. L2). */
  peakCacheGeneration?: number;
  /** Layout duration (resolved media); click-to-time ratio. */
  layoutDurationSecRef?: React.MutableRefObject<number>;
  /** Resolved layout duration — re-syncs WaveSurfer zoom when decode duration settles. */
  layoutDurationSec?: number;
  /** Layout timeline width; click-to-time ratio. */
  layoutTimelineWidthPxRef?: React.MutableRefObject<number>;
  /** Tier scroll container for pointer → time mapping on overlay gestures. */
  tierScrollRef?: React.RefObject<HTMLDivElement | null>;
  /** Tier scroll live/layout metrics — same read path as band canvas / playhead. */
  tierViewportMetricsRef?: TierViewportMetricsRef;
  /** After reveal/flushTierScrollFrame, playback follow suppression window. */
  playbackFollowSuppressUntilRef?: React.MutableRefObject<number>;
  /** Sticky waveform clip shell — resize sync writes width imperatively. */
  stickyShellRef?: React.RefObject<HTMLDivElement | null>;
  /** Inner stretch wrapper — temporary scaleX during viewport resize. */
  stretchShellRef?: React.RefObject<HTMLDivElement | null>;
  /** Timeline width shell — imperative width sync on fit-all refit. */
  timelineShellRef?: React.RefObject<HTMLDivElement | null>;
  /** Peaks stage outer shell — imperative width sync on fit-all refit. */
  peaksStageShellRef?: React.RefObject<HTMLDivElement | null>;
  /** Called after viewport controller reads tier width (replaces duplicate tier RO). */
  onAfterViewportResizeRef?: React.MutableRefObject<(() => void) | undefined>;
  /** Refit fit-all px/s when tier viewport grows (e.g. fullscreen). */
  refitFitAllPxPerSec?: (viewportWidthPx: number) => number | null;
  onFitAllPxPerSecRefit?: (pxPerSec: number) => void;
  /** Ref to getDisplayPlayheadTimeSec — seek delta base reads single time source. */
  getDisplayPlayheadTimeSecRef?: React.MutableRefObject<(() => number) | null>;
  /** Peaks-order seek: imperative playhead before media (`ws.setTime`). */
  syncDisplayPlayheadAfterSeekRef?: React.MutableRefObject<((timeSec: number) => void) | null>;
  /** WS audioprocess → visual clock + unified viewport frame. */
  onWsAudioprocessRef?: React.MutableRefObject<((timeSec: number) => void) | null>;
};
