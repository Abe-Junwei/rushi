import { describe, expect, it, vi } from "vitest";
import { dispatchSegmentLoopButtonClick } from "./dispatchSegmentLoopButtonClick";

describe("dispatchSegmentLoopButtonClick", () => {
  it("toggles loop when clicking the selected segment", () => {
    const toggleSelectedLoop = vi.fn();
    const preserveLoopForNextSegmentSelect = vi.fn();
    const selectSegment = vi.fn();
    const playSegmentAtIndex = vi.fn();

    dispatchSegmentLoopButtonClick({
      clickedIdx: 2,
      selectedIdx: 2,
      preserveLoopForNextSegmentSelect,
      selectSegment,
      playSegmentAtIndex,
      toggleSelectedLoop,
    });

    expect(toggleSelectedLoop).toHaveBeenCalledTimes(1);
    expect(preserveLoopForNextSegmentSelect).not.toHaveBeenCalled();
    expect(selectSegment).not.toHaveBeenCalled();
    expect(playSegmentAtIndex).not.toHaveBeenCalled();
  });

  it("selects and plays with loop when clicking another segment", () => {
    const toggleSelectedLoop = vi.fn();
    const preserveLoopForNextSegmentSelect = vi.fn();
    const selectSegment = vi.fn();
    const playSegmentAtIndex = vi.fn();

    dispatchSegmentLoopButtonClick({
      clickedIdx: 4,
      selectedIdx: 1,
      preserveLoopForNextSegmentSelect,
      selectSegment,
      playSegmentAtIndex,
      toggleSelectedLoop,
    });

    expect(preserveLoopForNextSegmentSelect).toHaveBeenCalledTimes(1);
    expect(selectSegment).toHaveBeenCalledWith(4);
    expect(playSegmentAtIndex).toHaveBeenCalledWith(4, { loop: true });
    expect(toggleSelectedLoop).not.toHaveBeenCalled();
  });
});
