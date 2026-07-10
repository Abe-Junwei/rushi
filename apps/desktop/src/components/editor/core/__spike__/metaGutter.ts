import { gutter, GutterMarker } from "@codemirror/view";
import { spikeSegmentMetaField } from "./segmentMeta";

class SpikeTimeMarker extends GutterMarker {
  constructor(readonly label: string) {
    super();
  }

  eq(other: SpikeTimeMarker): boolean {
    return this.label === other.label;
  }

  toDOM(): HTMLElement {
    const el = document.createElement("span");
    el.className = "cm-spike-meta-time";
    el.textContent = this.label;
    el.title = this.label;
    return el;
  }
}

function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

/**
 * Meta gutter: timestamp per line, same DOM viewport as CM6 content.
 * Preferred P0 path over React side-rail.
 */
export const spikeMetaGutter = gutter({
  class: "cm-spike-meta-gutter",
  renderEmptyElements: true,
  lineMarker(view, line) {
    const meta = view.state.field(spikeSegmentMetaField);
    // line.from is a doc position; line number is 1-based.
    const lineNo = view.state.doc.lineAt(line.from).number;
    const m = meta[lineNo - 1];
    if (!m) return null;
    return new SpikeTimeMarker(formatTime(m.startSec));
  },
  lineMarkerChange(update) {
    return (
      update.docChanged ||
      update.startState.field(spikeSegmentMetaField) !==
        update.state.field(spikeSegmentMetaField)
    );
  },
  initialSpacer: () => new SpikeTimeMarker("0:00"),
});
