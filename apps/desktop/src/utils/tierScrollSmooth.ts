function supportsScrollEndEvent(): boolean {
  return "onscrollend" in document.createElement("div");
}

/** 在 CSS smooth scroll 结束后回调最终 scrollLeft（优先 scrollend，否则防抖 scroll）。 */
export function afterSmoothScrollEnd(
  el: HTMLElement,
  onSettled: (scrollLeft: number) => void,
): () => void {
  if (supportsScrollEndEvent()) {
    const onEnd = () => {
      onSettled(el.scrollLeft);
    };
    el.addEventListener("scrollend", onEnd, { once: true });
    return () => el.removeEventListener("scrollend", onEnd);
  }

  let timer = 0;
  const onScroll = () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => {
      el.removeEventListener("scroll", onScroll);
      onSettled(el.scrollLeft);
    }, 120);
  };
  el.addEventListener("scroll", onScroll, { passive: true });
  return () => {
    el.removeEventListener("scroll", onScroll);
    window.clearTimeout(timer);
  };
}
