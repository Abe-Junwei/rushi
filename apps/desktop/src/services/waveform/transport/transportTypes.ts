/** Transport Authority — intent types for waveform seek/play (Peaks-ordered pipeline). */

export type TransportSource =
  | "segmentTap"
  | "blankTap"
  | "minimap"
  | "keyboardFrame"
  | "keyboardSegment"
  | "list"
  | "doubleClick"
  | "toolbar"
  | "shortcut"
  | "boundLoop"
  | "peaksReload"
  | "seekWithin"
  | "segmentSelect";

export type SelectSegmentSeekPolicy = "segmentStart" | "none" | "pointerTime";

export type TransportIntent =
  | {
      kind: "seek";
      timeSec: number;
      source: TransportSource;
      suppressFollow?: boolean;
    }
  | {
      kind: "playSegment";
      idx: number;
      fromSec?: number;
      loop?: boolean;
    }
  | { kind: "toggleSegmentPlay" }
  | { kind: "pause" }
  | {
      kind: "selectSegmentTransport";
      idx: number;
      /** SegmentSelectSource string — kept loose to avoid circular imports. */
      source: string;
      seekPolicy: SelectSegmentSeekPolicy;
      pointerTimeSec?: number;
    };

/** When play-from resolves to null, media is already at the resume point — skip setTime. */
export type SegmentPlayFromResolution =
  | { kind: "seek"; timeSec: number }
  | { kind: "resumeSkipSeek" };

export const TRANSPORT_RAW_DISPLAY_RESUME_EPSILON_SEC = 0.08;
