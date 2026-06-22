import { applyImperativeSegmentListSelectionScroll } from "./applyImperativeSegmentListSelectionScroll";

export type ApplyListKeyboardBurstListScrollInput = {
  root: HTMLElement;
  selectedDisplayIndex: number;
  selectedIdx: number;
  rowMinHeightPx: number;
  itemStridePx: number;
  useVirtualList: boolean;
  scrollKey: string;
};

/** Imperative list scroll for listKeyboard burst — no React SC1 commit. */
export function applyListKeyboardBurstListScroll(input: ApplyListKeyboardBurstListScrollInput): boolean {
  return applyImperativeSegmentListSelectionScroll({
    ...input,
    source: "listKeyboard",
    pinVirtualDisplayIndex: true,
  });
}
