import type { SegmentDto } from "../../tauri/projectApi";
import { selectionProfileMarkFirstPaint, selectionProfileTime } from "../ui/selectionLatencyProfile";
import { applySelectionChromeImperative } from "./applySelectionChromeImperative";
import {
  commitSelectionChrome,
  getSelectionChromeSnapshot,
  type SelectionChromeSnapshot,
} from "./selectionChromeStore";
import { requestWaveformSegmentBandPaint } from "../../utils/tierScrollFrameCoordinator";

export function publishSelectionChrome(input: {
  fileId: string | null;
  segments: readonly SegmentDto[];
  primaryIdx: number;
  selectedSet: ReadonlySet<number>;
  listRoot: ParentNode | null;
  overlayRoot: ParentNode | null;
  markFirstPaint?: boolean;
  /** Skip waveform band force-repaint (list keyboard / click path). */
  skipBandPaint?: boolean;
  /** Waveform keyboard burst: skip imperative list row chrome. */
  skipListRows?: boolean;
  /** Store + subscribers only — skip imperative DOM (waveform keyboard burst). */
  skipImperative?: boolean;
}): SelectionChromeSnapshot {
  const prevSnapshot = getSelectionChromeSnapshot();
  const nextSnapshot = commitSelectionChrome({
    fileId: input.fileId,
    primaryIdx: input.primaryIdx,
    selectedSet: input.selectedSet,
  });

  if (!input.skipImperative) {
    selectionProfileTime("listChrome", () => {
      applySelectionChromeImperative({
        overlayRoot: input.overlayRoot,
        listRoot: input.listRoot,
        segments: input.segments,
        prevSnapshot,
        nextSnapshot,
        skipListRows: input.skipListRows,
      });
    });
  }

  // Force band repaint so selection chrome is not dropped by scroll coalesce within 12ms.
  if (!input.skipBandPaint) {
    requestWaveformSegmentBandPaint({ force: true });
  }

  if (input.markFirstPaint) {
    selectionProfileMarkFirstPaint();
  }

  return nextSnapshot;
}
