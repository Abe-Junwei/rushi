import type { SegmentDto, SegmentKind } from "../tauri/projectApi";
import { roundSec3 } from "./boundsSignature";

export const WAVEFORM_SEGMENT_MIN_SPAN_SEC = 0.05;

/** Span ratio above which a segment is treated as whole-track placeholder for waveform UI. */
export const WAVEFORM_DOMINANT_SPAN_RATIO = 0.85;

function isDominantWaveformSpanSegment(
  startSec: number,
  endSec: number,
  durationSec: number,
): boolean {
  if (!(durationSec > 0)) return false;
  const lo = Math.min(startSec, endSec);
  const hi = Math.max(startSec, endSec);
  const span = hi - lo;
  if (span <= 0) return false;
  return span / durationSec >= WAVEFORM_DOMINANT_SPAN_RATIO;
}

type PlaceholderProbe = Pick<SegmentDto, "start_sec" | "end_sec"> & {
  kind?: SegmentKind | null;
};

/**
 * 是否为整轨占位语段（波形上不渲染）。**显式 `kind` 优先**：`placeholder` 即占位、
 * `speech` 即非占位（即便跨度很大也不隐藏，消除短片段长单段的假阳性）；缺省时回退
 * 0.85 跨度启发式（兼容旧数据 / 未标记语段）。
 */
export function isPlaceholderSegment(seg: PlaceholderProbe, durationSec: number): boolean {
  const kind = seg.kind === "placeholder" || seg.kind === "speech" ? seg.kind : undefined;
  if (kind === "placeholder") return true;
  if (kind === "speech") return false;
  return isDominantWaveformSpanSegment(seg.start_sec, seg.end_sec, durationSec);
}

export type PackableSegmentPartition = {
  /** Source indices kept for waveform UI (render / lane packing / hit-test / create-overlap). */
  packableIndices: number[];
  /** Source indices treated as whole-track placeholders, hidden from the waveform UI. */
  dominantSpanIndices: number[];
};

/**
 * Single authority for "which segments participate in the waveform UI" (TRUTH).
 *
 * Whole-track placeholder spans (e.g. the pre-segmentation ASR span) are excluded so
 * that rendering, lane packing, pointer hit-test and create-range overlap all agree on
 * the exact same working set. Routing every consumer through this selector prevents the
 * class of bug where the overlay hides a placeholder yet editing logic still counts it.
 *
 * Pass durationSec <= 0 (unknown duration) to keep every segment packable.
 */
export function selectPackableSegmentIndices(
  segments: ReadonlyArray<PlaceholderProbe>,
  durationSec: number,
): PackableSegmentPartition {
  const packableIndices: number[] = [];
  const dominantSpanIndices: number[] = [];
  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i];
    if (!seg) continue;
    if (isPlaceholderSegment(seg, durationSec)) {
      dominantSpanIndices.push(i);
    } else {
      packableIndices.push(i);
    }
  }
  return { packableIndices, dominantSpanIndices };
}

/** Packable segments (identity-preserving) derived from {@link selectPackableSegmentIndices}. */
export function selectPackableSegments<T extends PlaceholderProbe>(
  segments: ReadonlyArray<T>,
  durationSec: number,
): T[] {
  const { packableIndices } = selectPackableSegmentIndices(segments, durationSec);
  return packableIndices.map((i) => segments[i]);
}

/** Packable segment time spans for long-media median default zoom. */
export function collectPackableSegmentSpansSec(
  segments: ReadonlyArray<PlaceholderProbe>,
  durationSec: number,
): number[] {
  const packable = selectPackableSegments(segments, durationSec);
  const spans: number[] = [];
  for (const seg of packable) {
    const span = Math.abs(seg.end_sec - seg.start_sec);
    if (Number.isFinite(span) && span > 0) spans.push(span);
  }
  return spans;
}

export function clampSegmentTimeBounds(
  startSec: number,
  endSec: number,
  durationSec: number,
): { startSec: number; endSec: number } {
  const lo = Math.min(startSec, endSec);
  const hi = Math.max(startSec, endSec);
  const dur = Math.max(durationSec, WAVEFORM_SEGMENT_MIN_SPAN_SEC);
  const clampedStart = roundSec3(Math.max(0, lo));
  const clampedEnd = roundSec3(Math.min(Math.max(clampedStart + WAVEFORM_SEGMENT_MIN_SPAN_SEC, hi), dur));
  return { startSec: clampedStart, endSec: clampedEnd };
}
