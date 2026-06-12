import { scrollSegmentListIndexToView } from "./segmentListVirtualWindow";

const FOCUS_RETRY_DELAYS_MS = [0, 32, 96] as const;

let focusSessionGeneration = 0;
const pendingFocusTimeouts: number[] = [];

function querySegmentTextarea(segmentIdx: number, tierScrollRoot: HTMLElement | null): HTMLElement | null {
  const selector = `[data-seg-row="${segmentIdx}"] textarea.seg-text, [data-seg-row="${segmentIdx}"] input.seg-text`;
  return (
    tierScrollRoot?.querySelector<HTMLElement>(selector) ??
    document.querySelector<HTMLElement>(selector)
  );
}

function cancelPendingFocusAttempts(): void {
  for (const id of pendingFocusTimeouts) {
    window.clearTimeout(id);
  }
  pendingFocusTimeouts.length = 0;
}

export type FocusTranscriptSegmentTextareaOptions = {
  /** 默认 false：列表选中 scroll 由 EditorSegmentList layout 负责。 */
  scroll?: boolean;
};

/** 聚焦语段正文 textarea（虚拟列表：可选手动 scroll + 可取消的重试链）。 */
export function focusTranscriptSegmentTextarea(
  tierScrollRoot: HTMLElement | null,
  segmentIdx: number,
  options?: FocusTranscriptSegmentTextareaOptions,
): void {
  const session = ++focusSessionGeneration;
  cancelPendingFocusAttempts();

  const shouldScroll = options?.scroll === true;
  if (shouldScroll && !querySegmentTextarea(segmentIdx, tierScrollRoot)) {
    scrollSegmentListIndexToView(segmentIdx);
  }

  const tryFocus = (attempt: number) => {
    if (session !== focusSessionGeneration) return;
    const target = querySegmentTextarea(segmentIdx, tierScrollRoot);
    if (target) {
      try {
        target.focus({ preventScroll: true });
      } catch {
        target.focus();
      }
      return;
    }
    const nextDelay = FOCUS_RETRY_DELAYS_MS[attempt];
    if (nextDelay === undefined) return;
    const timeoutId = window.setTimeout(() => tryFocus(attempt + 1), nextDelay);
    pendingFocusTimeouts.push(timeoutId);
  };

  window.requestAnimationFrame(() => {
    if (session !== focusSessionGeneration) return;
    tryFocus(0);
  });
}

/** 测试 / 切文件时取消挂起的 focus 重试。 */
export function cancelTranscriptSegmentFocusAttempts(): void {
  focusSessionGeneration += 1;
  cancelPendingFocusAttempts();
}
