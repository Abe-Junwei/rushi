import { useCallback, useEffect, useRef } from "react";
import {
  readPanelRenderedRect,
  type PanelPosition,
  type PanelSize,
} from "../components/draggablePanelGeometry";
import {
  computeDragResizeState,
  panelResizeLocksAutoHeight,
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
  /** 壳层 DOM，用于 resize 起手读取实际渲染矩形（auto 高度 → px 基线）。 */
  panelElementRef: React.MutableRefObject<HTMLElement | null>;
  /** true：未手调高度时随内容贴合；仅 n/s/角点 resize 才切 manual。 */
  autoHeight?: boolean;
  /** resize 起手切换到 manual 高度模式（auto → manual）。 */
  onResizeStart: () => void;
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
  panelElementRef,
  autoHeight = false,
  onResizeStart,
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
      // 从渲染矩形取实际位置/尺寸，避免 transform 居中 / auto 高度切到 px 定位时跳动。
      const rendered = readPanelRenderedRect(panelElementRef.current, { position, size });
      setCenterMode(false);
      setPosition(rendered.position);
      if (mode !== "move") {
        const locksAutoHeight = !autoHeight || panelResizeLocksAutoHeight(mode);
        if (locksAutoHeight) {
          userSizedRef.current = true;
          onResizeStart();
        }
        setSize(rendered.size);
      }
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = {
        mode,
        startX: e.clientX,
        startY: e.clientY,
        startPos: { ...rendered.position },
        startSize: { ...rendered.size },
      };
      document.body.classList.add("csp-drag-session");
    },
    [autoHeight, onResizeStart, panelElementRef, position, setCenterMode, setPosition, setSize, size, userSizedRef],
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
