const CONTROLLED_TIER_SMOOTH_DURATION_MS = 160;

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

export function animateTierScrollLeft(
  read: () => number,
  target: number,
  write: (scrollLeft: number, done: boolean) => void,
): () => void {
  let raf = 0;
  let cancelled = false;
  const start = read();
  const distance = target - start;
  const startAt = performance.now();

  const step = () => {
    raf = 0;
    if (cancelled) return;
    const elapsed = performance.now() - startAt;
    const progress = Math.min(1, elapsed / CONTROLLED_TIER_SMOOTH_DURATION_MS);
    if (progress >= 1) {
      write(target, true);
      return;
    }
    write(start + distance * easeOutCubic(progress), false);
    raf = requestAnimationFrame(step);
  };

  raf = requestAnimationFrame(step);
  return () => {
    cancelled = true;
    if (raf) cancelAnimationFrame(raf);
  };
}
