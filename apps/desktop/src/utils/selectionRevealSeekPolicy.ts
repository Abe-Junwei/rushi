import type { SegmentSelectSource } from "./waveformViewMode";

export type SelectionRevealSeekContext = {
  source: SegmentSelectSource;
  idxChanged: boolean;
};

/**
 * Seek when selecting a segment.
 * Waveform + list click/advance + listKeyboard all seek (industry listen-jump).
 * Burst mid-steps still skip seek in transport; finalize seeks once.
 */
export function shouldSeekOnSegmentSelect(source: SegmentSelectSource): boolean {
  return (
    source === "waveform" ||
    source === "waveformKeyboard" ||
    source === "list" ||
    source === "listAdvance" ||
    source === "listKeyboard"
  );
}

/**
 * Whether this select should move the playhead.
 * List clicks / keyboard often update CM6 projection *before* transport runs, so
 * idx vs projection looks unchanged — use React/ref primary as baseline for list sources.
 */
export function shouldSeekAfterSegmentSelect(input: {
  source: SegmentSelectSource;
  idx: number;
  projectionPrimaryIdx: number;
  reactPrimaryIdx: number;
  shiftKey?: boolean;
  toggle?: boolean;
}): boolean {
  if (input.shiftKey || input.toggle) return false;
  if (!shouldSeekOnSegmentSelect(input.source)) return false;
  const baseline =
    input.source === "list" ||
    input.source === "listAdvance" ||
    input.source === "listKeyboard"
      ? input.reactPrimaryIdx
      : input.projectionPrimaryIdx >= 0
        ? input.projectionPrimaryIdx
        : input.reactPrimaryIdx;
  return input.idx !== baseline;
}

export function shouldRevealOnSegmentSelect(ctx: SelectionRevealSeekContext): boolean {
  if (ctx.source === "contextMenu" || ctx.source === "multiSelect") return false;
  // Text/list selection may arrive after CM6 has already updated primary, making
  // idxChanged false. It must still reveal the corresponding waveform segment.
  if (ctx.source === "list" || ctx.source === "listAdvance") return true;
  // ↑↓ / Tab confirm — user-initiated; gate can false-negative when virtual list unmounts textarea.
  if (ctx.source === "listKeyboard") return true;
  if (!ctx.idxChanged) return false;
  if (ctx.source === "waveform" || ctx.source === "waveformKeyboard") return true;
  return false;
}
