/** 聚焦语段正文 textarea（虚拟列表兼容）。 */
export function focusTranscriptSegmentTextarea(
  tierScrollRoot: HTMLElement | null,
  segmentIdx: number,
): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const selector = `[data-seg-row="${segmentIdx}"] textarea.seg-text, [data-seg-row="${segmentIdx}"] input.seg-text`;
      const target =
        tierScrollRoot?.querySelector<HTMLElement>(selector) ??
        document.querySelector<HTMLElement>(selector);
      target?.focus();
    });
  });
}
