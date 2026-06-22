import type { SegmentSelectSource } from "./waveformViewMode";

export type SelectionRevealSeekContext = {
  source: SegmentSelectSource;
  idxChanged: boolean;
  editorFocusGateOpen: boolean;
};

export function shouldSeekOnSegmentSelect(source: SegmentSelectSource): boolean {
  return source === "waveform";
}

export function shouldRevealOnSegmentSelect(ctx: SelectionRevealSeekContext): boolean {
  if (!ctx.idxChanged) return false;
  if (ctx.source === "contextMenu" || ctx.source === "multiSelect") return false;
  if (ctx.source === "list" || ctx.source === "listAdvance") return true;
  if (ctx.source === "listKeyboard") return ctx.editorFocusGateOpen;
  if (ctx.source === "waveform") return true;
  return false;
}
