import { useCallback, useEffect, useRef, useState } from "react";

export type UseWaveformTimeRulerInteractionArgs = {
  embedded: boolean;
  currentTimeSec: number;
  liveScrollLeftPx: number;
  disabled?: boolean;
  onSeekFromTierClientX: (clientX: number) => void;
  onSetScrollLeftPx: (px: number) => void;
};

export function useWaveformTimeRulerInteraction({
  embedded,
  currentTimeSec,
  liveScrollLeftPx,
  disabled,
  onSeekFromTierClientX,
  onSetScrollLeftPx,
}: UseWaveformTimeRulerInteractionArgs) {
  const rulerDragRef = useRef({ dragging: false, startX: 0, startScroll: 0 });
  const scrollLeftPxRef = useRef(liveScrollLeftPx);
  scrollLeftPxRef.current = liveScrollLeftPx;
  const prevCurrentTimeRef = useRef<number | null>(null);
  const interactionFadeTimeoutRef = useRef<number | null>(null);
  const [interactionActive, setInteractionActive] = useState(false);

  useEffect(() => {
    if (!embedded) return;
    const prev = prevCurrentTimeRef.current;
    prevCurrentTimeRef.current = currentTimeSec;
    if (prev == null || Math.abs(currentTimeSec - prev) < 1e-4) return;
    setInteractionActive(true);
    if (interactionFadeTimeoutRef.current != null) {
      window.clearTimeout(interactionFadeTimeoutRef.current);
    }
    interactionFadeTimeoutRef.current = window.setTimeout(() => {
      interactionFadeTimeoutRef.current = null;
      setInteractionActive(false);
    }, 260);
    return () => {
      if (interactionFadeTimeoutRef.current != null) {
        window.clearTimeout(interactionFadeTimeoutRef.current);
        interactionFadeTimeoutRef.current = null;
      }
    };
  }, [currentTimeSec, embedded]);

  const onRulerPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (disabled || e.button !== 0) return;
      rulerDragRef.current = {
        dragging: false,
        startX: e.clientX,
        startScroll: scrollLeftPxRef.current,
      };
      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - rulerDragRef.current.startX;
        if (Math.abs(dx) > 3) rulerDragRef.current.dragging = true;
        if (rulerDragRef.current.dragging) {
          onSetScrollLeftPx(rulerDragRef.current.startScroll - dx);
        }
      };
      const onUp = (ev: PointerEvent) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        window.removeEventListener("blur", onBlur);
        if (!rulerDragRef.current.dragging) {
          onSeekFromTierClientX(ev.clientX);
        }
        rulerDragRef.current.dragging = false;
      };
      const onBlur = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        window.removeEventListener("blur", onBlur);
        rulerDragRef.current.dragging = false;
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
      window.addEventListener("blur", onBlur);
    },
    [disabled, onSeekFromTierClientX, onSetScrollLeftPx],
  );

  return { interactionActive, onRulerPointerDown };
}
