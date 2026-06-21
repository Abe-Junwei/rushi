import type { SegmentDto } from "../../tauri/projectApi";
import { selectionProfileMarkFirstPaint, selectionProfileTime } from "../ui/selectionLatencyProfile";
import { applySelectionChromeImperative } from "./applySelectionChromeImperative";
import {
  commitSelectionChrome,
  getSelectionChromeSnapshot,
  markUserSelectionChromePending,
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
}): SelectionChromeSnapshot {
  const prevSnapshot = getSelectionChromeSnapshot();
  const nextSnapshot = commitSelectionChrome({
    fileId: input.fileId,
    primaryIdx: input.primaryIdx,
    selectedSet: input.selectedSet,
  });
  markUserSelectionChromePending(nextSnapshot.version, input.segments.length);

  selectionProfileTime("listChrome", () => {
    applySelectionChromeImperative({
      overlayRoot: input.overlayRoot,
      listRoot: input.listRoot,
      segments: input.segments,
      prevSnapshot,
      nextSnapshot,
    });
  });

  // Force band repaint so selection chrome is not dropped by scroll coalesce within 12ms.
  requestWaveformSegmentBandPaint({ force: true });

  if (input.markFirstPaint) {
    selectionProfileMarkFirstPaint();
  }

  return nextSnapshot;
}
