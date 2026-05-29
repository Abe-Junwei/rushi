import { useCallback, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import {
  computeAlignScrollPxForTimeSec,
  overviewClientXToTimeSec,
} from "../utils/waveformOverviewGeometry";

type DragState = { pointerId: number; startX: number; startScrollPx: number };

export function useWaveformOverviewInteraction(args: {
  disabled: boolean;
  isReady: boolean;
  overviewRef: RefObject<HTMLElement | null>;
  durationSec: number;
  pxPerSec: number;
  timelineWidthPx: number;
  mainViewportWidthPx: number;
  scrollLeftPx: number;
  setTierScrollPx: (scrollLeftPx: number) => void;
  seekToTime: (timeSec: number) => void;
}) {
  const argsRef = useRef(args);
  argsRef.current = args;
  const dragRef = useRef<DragState | null>(null);

  const jumpMainViewportToClientX = useCallback((clientX: number) => {
    const a = argsRef.current;
    const el = a.overviewRef.current;
    if (!el || a.durationSec <= 0) return;
    const rect = el.getBoundingClientRect();
    const timeSec = overviewClientXToTimeSec(clientX, rect, a.durationSec);
    const targetSl = computeAlignScrollPxForTimeSec({
      timeSec,
      pxPerSec: a.pxPerSec,
      timelineWidthPx: a.timelineWidthPx,
      viewportWidthPx: a.mainViewportWidthPx,
    });
    a.setTierScrollPx(targetSl);
    if (a.isReady) {
      a.seekToTime(timeSec);
    }
  }, []);

  const onOverviewPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLElement>) => {
      const a = argsRef.current;
      if (a.disabled || a.durationSec <= 0) return;
      const target = e.target as HTMLElement;
      if (target.closest("[data-overview-segment]")) return;

      // 阻止默认触摸/滚动行为，确保自定义拖拽/跳转不受浏览器手势干扰
      e.preventDefault();

      if (target.closest("[data-overview-viewport]")) {
        dragRef.current = {
          pointerId: e.pointerId,
          startX: e.clientX,
          startScrollPx: a.scrollLeftPx,
        };
        (e.currentTarget).setPointerCapture(e.pointerId);
        return;
      }

      jumpMainViewportToClientX(e.clientX);
    },
    [jumpMainViewportToClientX],
  );

  const onOverviewPointerMove = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const a = argsRef.current;
    const el = a.overviewRef.current;
    const ow = el?.clientWidth ?? 1;
    const tw = Math.max(1, a.timelineWidthPx);
    const deltaScroll = ((e.clientX - drag.startX) / ow) * tw;
    const maxSl = Math.max(0, tw - Math.max(1, a.mainViewportWidthPx));
    const next = Math.max(0, Math.min(maxSl, drag.startScrollPx + deltaScroll));
    a.setTierScrollPx(next);
  }, []);

  const finishOverviewDrag = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    try {
      (e.currentTarget).releasePointerCapture(e.pointerId);
    } catch {
      /* noop */
    }
  }, []);

  const onOverviewPointerUp = finishOverviewDrag;
  const onOverviewPointerCancel = finishOverviewDrag;

  return {
    onOverviewPointerDown,
    onOverviewPointerMove,
    onOverviewPointerUp,
    onOverviewPointerCancel,
    jumpMainViewportToClientX,
  };
}
