import type { TranscriptionLayerInput } from "../../pages/transcriptionLayerTypes";
import {
  getSelectionChromeSnapshot,
  selectionSetsEqual,
} from "./selectionChromeStore";
import { resolveSelectionChromePreview } from "./resolveSelectionChromePreview";

/** True when store already reflects the selection that publish would apply. */
export function selectionChromeMatchesPreview(
  ctx: TranscriptionLayerInput,
  idx: number,
  opts?: { shiftKey?: boolean; toggle?: boolean },
): boolean {
  const preview = resolveSelectionChromePreview(ctx, idx, opts);
  const snap = getSelectionChromeSnapshot();
  if (snap.fileId !== ctx.fileId) return false;
  if (snap.primaryIdx !== preview.primaryIdx) return false;
  return selectionSetsEqual(snap.selectedSet, preview.selectedSet);
}
