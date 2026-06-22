/** Scroll metrics helpers for EditorSegmentList virtualization. */

export const SEGMENT_LIST_FALLBACK_VIEWPORT_HEIGHT_PX = 480;
const SCROLL_METRICS_EPSILON_PX = 0.5;

export function readEditorSegmentListScrollMetrics(root: HTMLElement | null): {
  scrollTop: number;
  viewportHeight: number;
} {
  if (!root) {
    return { scrollTop: 0, viewportHeight: SEGMENT_LIST_FALLBACK_VIEWPORT_HEIGHT_PX };
  }
  return {
    scrollTop: root.scrollTop,
    viewportHeight:
      root.clientHeight > 0 ? root.clientHeight : SEGMENT_LIST_FALLBACK_VIEWPORT_HEIGHT_PX,
  };
}

export function editorSegmentListScrollMetricsEqual(
  a: { scrollTop: number; viewportHeight: number },
  b: { scrollTop: number; viewportHeight: number },
): boolean {
  return (
    Math.abs(a.scrollTop - b.scrollTop) < SCROLL_METRICS_EPSILON_PX &&
    Math.abs(a.viewportHeight - b.viewportHeight) < SCROLL_METRICS_EPSILON_PX
  );
}
