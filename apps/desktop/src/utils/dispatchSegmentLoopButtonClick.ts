/**
 * List/gutter loop button: same-row toggles; other-row must select+play with loop
 * (select alone clears loop unless preserved).
 */
export function dispatchSegmentLoopButtonClick(input: {
  clickedIdx: number;
  selectedIdx: number;
  preserveLoopForNextSegmentSelect: () => void;
  selectSegment: (idx: number) => void;
  playSegmentAtIndex: (idx: number, options?: { loop?: boolean }) => void | Promise<void>;
  toggleSelectedLoop: () => void | Promise<void>;
}): void {
  if (input.clickedIdx !== input.selectedIdx) {
    input.preserveLoopForNextSegmentSelect();
    input.selectSegment(input.clickedIdx);
    void input.playSegmentAtIndex(input.clickedIdx, { loop: true });
    return;
  }
  void input.toggleSelectedLoop();
}
