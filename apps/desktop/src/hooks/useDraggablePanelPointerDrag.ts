import { useCallback, useEffect, useRef } from "react";
import type { PanelPosition, PanelSize } from "../components/draggablePanelGeometry";
import {
  computeDragResizeState,
  resolveDragResizeViewportBounds,
} from "./draggablePanelDragResize";

type DragSession = {
  mode: string;
  startX: number;
  startY: number;
  startPos: PanelPosition;
  startSize: PanelSize;
};

type UseDraggablePanelPointerDragArgs = {
  position: PanelPosition;
  size: PanelSize;
  minWidth: number;
  minHeight: number;
  maxWidth?: number;
  viewportMargin: number;
  clampPanel: (nextPosition: PanelPosition, nextSize: PanelSize) => {
    position: PanelPosition;
    size: PanelSize;
  };
  setPosition: (position: PanelPosition) => void;
  setSize: (size: PanelSize) => void;
  setCenterMode: (centered: boolean) => void;
  persistSnapshot: (nextPosition: PanelPosition, nextSize: PanelSize, userSized: boolean) => void;
  persistState: boolean;
  panelStateRef: React.MutableRefObject<{ position: PanelPosition; size: PanelSize }>;
  userSizedRef: React.MutableRefObject<boolean>;
  userMovedRef: React.MutableRefObject<boolean>;
};

export function useDraggablePanelPointerDrag({
  position,
  size,
  minWidth,
  minHeight,
  maxWidth,
  viewportMargin,
  clampPanel,
  setPosition,
  setSize,
  setCenterMode,
  persistSnapshot,
  persistState,
  panelStateRef,
  userSizedRef,
  userMovedRef,
}: UseDraggablePanelPointerDragArgs) {
  const dragRef = useRef<DragSession | null>(null);
  const persistStateRef = useRef(persistState);
  persistStateRef.current = persistState;

  const finishDragSession = useCallback(() => {
    if (!dragRef.current) return;
    if (dragRef.current.mode === "move") {
      userMovedRef.current = true;
    }
    if (persistStateRef.current) {
      persistSnapshot(
        panelStateRef.current.position,
        panelStateRef.current.size,
        userSizedRef.current,
      );
    }
    dragRef.current = null;
    document.body.classList.remove("csp-drag-session");
  }, [panelStateRef, persistSnapshot, userMovedRef, userSizedRef]);

  const startDrag = useCallback(
    (mode: string, e: React.PointerEvent) => {
      e.preventDefault();
      setCenterMode(false);
      if (mode !== "move") userSizedRef.current = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = {
        mode,
        startX: e.clientX,
        startY: e.clientY,
        startPos: { ...position },
        startSize: { ...size },
      };
      document.body.classList.add("csp-drag-session");
    },
    [position, setCenterMode, size, userSizedRef],
  );

  useEffect(() => {
    const resolveBounds = () =>
      resolveDragResizeViewportBounds({ minWidth, minHeight, maxWidth, viewportMargin });

    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;

      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;

      if (d.mode === "move") {
        const clamped = clampPanel(
          { x: d.startPos.x + dx, y: d.startPos.y + dy },
          { width: d.startSize.width, height: d.startSize.height },
        );
        setPosition(clamped.position);
        return;
      }

      const next = computeDragResizeState(d.mode, dx, dy, d.startPos, d.startSize, resolveBounds());
      const clamped = clampPanel(next.position, next.size);
      setPosition(clamped.position);
      setSize(clamped.size);
    };

    const onUp = () => {
      finishDragSession();
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.body.classList.remove("csp-drag-session");
    };
  }, [clampPanel, finishDragSession, maxWidth, minHeight, minWidth, setPosition, setSize, viewportMargin]);

  return { startDrag };
}
