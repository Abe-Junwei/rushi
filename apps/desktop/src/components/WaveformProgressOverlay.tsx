import { memo, useEffect, useRef } from "react";
import { COLORS } from "../config/tokens";

type WaveformProgressOverlayProps = {
  isPlaying: boolean;
  durationSec: number;
  timelineWidthPx: number;
  currentTimeSec: number;
  getPlayheadTime: () => number;
};

/** Playback progress tint for peaks mode (ADR-0004 P2).
 *  Uses rAF while playing; syncs from `currentTimeSec` when paused/seeking.
 */
export const WaveformProgressOverlay = memo(function WaveformProgressOverlay({
  isPlaying,
  durationSec,
  timelineWidthPx,
  currentTimeSec,
  getPlayheadTime,
}: WaveformProgressOverlayProps) {
  const divRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef(0);

  const applyWidth = (timeSec: number) => {
    if (durationSec <= 0 || timelineWidthPx <= 0) return;
    const progress = Math.max(0, Math.min(1, timeSec / durationSec));
    const widthPx = progress * timelineWidthPx;
    const el = divRef.current;
    if (el) el.style.width = `${widthPx}px`;
  };

  useEffect(() => {
    if (!isPlaying || durationSec <= 0 || timelineWidthPx <= 0) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    const tick = () => {
      applyWidth(getPlayheadTime());
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [isPlaying, durationSec, timelineWidthPx, getPlayheadTime]);

  useEffect(() => {
    if (isPlaying) return;
    applyWidth(currentTimeSec);
  }, [isPlaying, currentTimeSec, durationSec, timelineWidthPx]);

  if (durationSec <= 0 || timelineWidthPx <= 0) return null;

  return (
    <div
      ref={divRef}
      className="pointer-events-none absolute left-0 top-0 z-[1] h-full"
      style={{
        backgroundColor: `${COLORS.saffron}26`,
      }}
      aria-hidden
    />
  );
});
