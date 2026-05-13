import { flushSync } from "react-dom";
import type { SegmentDto } from "../tauri/p1Api";

/** 将语段卡正文输入框当前值写回 `segments`（与本地 draft 一致），供保存/合并等读最新正文。 */
export function flushSegmentTextDraftsFromDom(
  segmentsRef: React.MutableRefObject<SegmentDto[]>,
  setSegments: React.Dispatch<React.SetStateAction<SegmentDto[]>>,
): void {
  const prev = segmentsRef.current;
  const updates: { idx: number; text: string }[] = [];
  prev.forEach((s, i) => {
    const row = document.querySelector(`[data-p1-seg-row="${i}"]`);
    const ta = row?.querySelector<HTMLTextAreaElement | HTMLInputElement>("textarea, input.p1-seg-text");
    if (!ta || ta.value === s.text) return;
    updates.push({ idx: i, text: ta.value });
  });
  if (updates.length === 0) return;
  flushSync(() => {
    setSegments((cur) => {
      let next = cur;
      for (const { idx, text } of updates) {
        if (idx < 0 || idx >= cur.length) continue;
        const seg = cur[idx];
        if (!seg || seg.text === text) continue;
        if (next === cur) next = [...cur];
        next[idx] = { ...seg, text };
      }
      return next;
    });
  });
}
