import type { SegmentDto } from "../tauri/projectApi";

/** 语段正文写回统一入口（自动标点、改正 popover 等）。 */
export function applySegmentTextChange(
  _seg: SegmentDto,
  idx: number,
  nextText: string,
  updateSegmentText: (idx: number, text: string, options?: { fromLlm?: boolean }) => void,
  options?: { fromLlm?: boolean },
): void {
  updateSegmentText(idx, nextText, options);
}
