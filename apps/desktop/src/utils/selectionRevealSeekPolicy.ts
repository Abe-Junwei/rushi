import type { SegmentSelectSource } from "./waveformViewMode";

export type SelectionRevealSeekContext = {
  source: SegmentSelectSource;
  idxChanged: boolean;
};

export function shouldSeekOnSegmentSelect(source: SegmentSelectSource): boolean {
  return source === "waveform" || source === "waveformKeyboard";
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
