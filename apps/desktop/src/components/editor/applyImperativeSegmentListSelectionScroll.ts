import {
  markListKeyboardImperativeScrollKey,
  notifyListKeyboardScrollEpoch,
  pinListKeyboardVirtualDisplayIndex,
} from "../../services/selection/listKeyboardBurstCoordinator";
import type { SegmentSelectSource } from "../../utils/waveformViewMode";
import { planEditorSegmentListSelectionScroll } from "./planEditorSegmentListSelectionScroll";

export type ApplyImperativeSegmentListSelectionScrollInput = {
  root: HTMLElement;
  selectedDisplayIndex: number;
  selectedIdx: number;
  rowMinHeightPx: number;
  itemStridePx: number;
  useVirtualList: boolean;
  source: SegmentSelectSource;
  scrollKey: string;
  /** listKeyboard burst only — virtual pin until React layout catches up. */
  pinVirtualDisplayIndex?: boolean;
};

/** Imperative list scroll on selection — same frame as SC2, before React layout effect. */
export function applyImperativeSegmentListSelectionScroll(
  input: ApplyImperativeSegmentListSelectionScrollInput,
): boolean {
  const {
    root,
    selectedDisplayIndex,
    selectedIdx,
    rowMinHeightPx,
    itemStridePx,
    useVirtualList,
    source,
    scrollKey,
    pinVirtualDisplayIndex = false,
  } = input;

  if (selectedDisplayIndex < 0) return false;

  if (pinVirtualDisplayIndex) {
    pinListKeyboardVirtualDisplayIndex(selectedDisplayIndex);
  }
  if (source === "listKeyboard" || source === "waveform" || source === "waveformKeyboard") {
    markListKeyboardImperativeScrollKey(scrollKey);
  }

  const plan = planEditorSegmentListSelectionScroll({
    root,
    selectedDisplayIndex,
    selectedIdx,
    rowMinHeightPx,
    itemStridePx,
    useVirtualList,
    source,
  });

  if (plan.kind === "skip") {
    notifyListKeyboardScrollEpoch({ sync: true, force: true });
    return false;
  }

  if (plan.kind === "fallback-dom-correct") {
    notifyListKeyboardScrollEpoch({ sync: true, force: true });
    return false;
  }

  const scrollTopBefore = root.scrollTop;
  root.scrollTop = plan.nextScrollTop;
  const scrollChanged = Math.abs(root.scrollTop - scrollTopBefore) >= 1;

  notifyListKeyboardScrollEpoch({ sync: true, force: true });
  return scrollChanged;
}
