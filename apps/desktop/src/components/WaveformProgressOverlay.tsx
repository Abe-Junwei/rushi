import { memo, useEffect, useRef } from "react";
import { COLORS } from "../config/tokens";

type WaveformProgressOverlayProps = {
  isPlaying: boolean;
  durationSec: number;
  timelineWidthPx: number;
  getPlayheadTime: () => number;
};

/** Playback progress tint for peaks mode (ADR-0004 P2).
 *  Uses rAF to update CSS width directly — no React render per frame.
 */
export const WaveformProgressOverlay = memo(function WaveformProgressOverlay({
  isPlaying,
  durationSec,
  timelineWidthPx,
  getPlayheadTime,
}: WaveformProgressOverlayProps) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef(0);
  const lastTimeRef = useRef(0);

  useEffect(() => {
    if (!isPlaying || durationSec <= 0 || timelineWidthPx <= 0) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    const tick = () => {
      const t = getPlayheadTime();
      lastTimeRef.current = t;
      const progress = Math.max(0, Math.min(1, t / durationSec));
      const widthPx = progress * timelineWidthPx;
      const el = divRef.current;
      if (el) el.style.width = `${widthPx}px`;
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, durationSec, timelineWidthPx, getPlayheadTime]);

  if (durationSec <= 0 || timelineWidthPx <= 0) return null;

  const staticWidthPx =
    Math.max(0, Math.min(1, lastTimeRef.current / durationSec)) * timelineWidthPx;

  return (
    <div
      ref={divRef}
      className="pointer-events-none absolute left-0 top-0 z-[1] h-full"
      style={{
        width: isPlaying ? undefined : `${staticWidthPx}px`,
        backgroundColor: `${COLORS.saffron}26`, // 15% opacity
      }}
      aria-hidden
    />
  );
});
