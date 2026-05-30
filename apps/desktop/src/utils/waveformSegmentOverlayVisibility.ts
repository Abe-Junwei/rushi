import type { SegmentDto } from "../tauri/projectApi";

/**
 * Overlay render set = all segments minus dominant-span placeholders.
 *
 * No scroll/viewport virtualization (intentional): segment regions live inside
 * the natively-scrolling tier content (absolute `timeToTimelinePx` positions),
 * so the rendered set MUST NOT depend on scroll position. Coupling the set to a
 * JS-read scroll value was the root cause of the recurring "segments don't
 * refresh after viewport scroll" regression — the overlay re-renders on prop
 * changes (selection / playhead), not reliably on scroll, so a windowed set went
 * stale. Off-screen paint cost is handled by `content-visibility: auto` on
 * `.waveform-segment-region` (platform-level virtualization), which is always
 * correct because the browser drives it from real scroll.
 *
 * Dominant placeholders (整轨 span) are still excluded: rendered as an
 * interactive region they would blanket the whole waveform and block blank-area
 * box-create / seek (`onShellPointerDown` bails on `[data-waveform-segment]`).
 */
export function selectOverlayRenderedSegmentIndices(input: {
  segments: SegmentDto[];
  dominantSpanIndices?: readonly number[];
}): number[] {
  const dominant = new Set(input.dominantSpanIndices ?? []);
  const out: number[] = [];
  for (let idx = 0; idx < input.segments.length; idx += 1) {
    if (!dominant.has(idx)) out.push(idx);
  }
  return out;
}
