import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import {
  centerFloatingPanelPosition,
  clampFloatingPanelToViewport,
  readFloatingPanelViewport,
  resolveFloatingPanelInitialState,
  snapshotFloatingPanelViewport,
  type FloatingPanelPersistedState,
} from "./floatingPanelViewport";
import { LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

interface Position {
  x: number;
  y: number;
}

interface Size {
  width: number;
  height: number;
}

interface DraggableResizablePanelProps {
  id: string;
  title: string;
  defaultPosition: Position;
  defaultSize: Size;
  minWidth?: number;
  minHeight?: number;
  maxHeight?: number;
  children: React.ReactNode;
  onClose: () => void;
  persistState?: boolean;
  zIndex?: number;
  /** 随语段条数等内容变化自动调整面板高度；用户本会话内拖放改高后不再覆盖。 */
  contentFitHeight?: number;
}

function loadState(key: string): FloatingPanelPersistedState | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FloatingPanelPersistedState;
    if (parsed.position && parsed.size) return parsed;
  } catch {
    /* ignore corrupt storage */
  }
  return null;
}

function saveState(key: string, state: FloatingPanelPersistedState) {
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    /* ignore storage errors */
  }
}

function samePosition(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}

function sameSize(a: Size, b: Size): boolean {
  return a.width === b.width && a.height === b.height;
}

export function DraggableResizablePanel({
  id,
  title,
  defaultPosition,
  defaultSize,
  minWidth = 320,
  minHeight = 200,
  maxHeight,
  children,
  onClose,
  persistState = true,
  zIndex = 50,
  contentFitHeight,
}: DraggableResizablePanelProps) {
  const storageKey = `panel-state-${id}`;
  const viewportMargin = 16;

  const saved = persistState ? loadState(storageKey) : null;

  const clampPanel = useCallback(
    (nextPosition: Position, nextSize: Size) =>
      clampFloatingPanelToViewport(nextPosition, nextSize, {
        minWidth,
        minHeight,
        margin: viewportMargin,
      }),
    [minHeight, minWidth],
  );

  const initialState = resolveFloatingPanelInitialState({
    saved,
    defaultPosition,
    defaultSize,
    margin: viewportMargin,
    clamp: clampPanel,
  });

  const [position, setPosition] = useState<Position>(initialState.position);
  const [size, setSize] = useState<Size>(initialState.size);
  const panelStateRef = useRef(initialState);
  const userResizedRef = useRef(false);

  useEffect(() => {
    panelStateRef.current = { position, size };
  }, [position, size]);

  const resolveViewportBounds = useCallback(() => {
    const margin = viewportMargin;
    const viewport = readFloatingPanelViewport();
    const maxWidth = Math.max(240, viewport.width - margin * 2);
    const maxHeight = Math.max(180, viewport.height - margin * 2);
    return {
      effectiveMinWidth: Math.min(minWidth, maxWidth),
      effectiveMinHeight: Math.min(minHeight, maxHeight),
    };
  }, [minHeight, minWidth]);

  const clampToViewport = clampPanel;

  const dragRef = useRef<{
    mode: string;
    startX: number;
    startY: number;
    startPos: Position;
    startSize: Size;
  } | null>(null);

  const startDrag = useCallback(
    (mode: string, e: React.PointerEvent) => {
      if (mode !== "move") userResizedRef.current = true;
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      dragRef.current = {
        mode,
        startX: e.clientX,
        startY: e.clientY,
        startPos: { ...position },
        startSize: { ...size },
      };
    },
    [position, size]
  );

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;

      const dx = e.clientX - d.startX;
      const dy = e.clientY - d.startY;

      if (d.mode === "move") {
        const clamped = clampToViewport(
          { x: d.startPos.x + dx, y: d.startPos.y + dy },
          { width: d.startSize.width, height: d.startSize.height },
        );
        setPosition(clamped.position);
        return;
      }

      let nextX = d.startPos.x;
      let nextY = d.startPos.y;
      let nextW = d.startSize.width;
      let nextH = d.startSize.height;
      const { effectiveMinWidth, effectiveMinHeight } = resolveViewportBounds();

      if (d.mode.includes("e")) {
        nextW = Math.max(effectiveMinWidth, d.startSize.width + dx);
      }
      if (d.mode.includes("w")) {
        const newW = Math.max(effectiveMinWidth, d.startSize.width - dx);
        nextX = d.startPos.x + (d.startSize.width - newW);
        nextW = newW;
      }
      if (d.mode.includes("s")) {
        nextH = Math.max(effectiveMinHeight, d.startSize.height + dy);
      }
      if (d.mode.includes("n")) {
        const newH = Math.max(effectiveMinHeight, d.startSize.height - dy);
        nextY = d.startPos.y + (d.startSize.height - newH);
        nextH = newH;
      }

      const clamped = clampToViewport({ x: nextX, y: nextY }, { width: nextW, height: nextH });
      setPosition(clamped.position);
      setSize(clamped.size);
    };

    const onUp = () => {
      if (dragRef.current) {
        if (persistState) {
          saveState(storageKey, {
            ...panelStateRef.current,
            viewport: snapshotFloatingPanelViewport(),
          });
        }
        dragRef.current = null;
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [clampToViewport, persistState, resolveViewportBounds, storageKey]);

  const trackedViewportRef = useRef(readFloatingPanelViewport());

  useEffect(() => {
    if (contentFitHeight == null || userResizedRef.current) return;

    const viewport = readFloatingPanelViewport();
    const viewportMaxHeight = Math.max(180, viewport.height - viewportMargin * 2);
    const { effectiveMinHeight } = resolveViewportBounds();
    const cap = maxHeight != null ? Math.min(maxHeight, viewportMaxHeight) : viewportMaxHeight;
    const targetHeight = Math.min(cap, Math.max(effectiveMinHeight, contentFitHeight));

    setSize((prev) => {
      if (prev.height === targetHeight) return prev;
      const clamped = clampToViewport(position, { ...prev, height: targetHeight });
      setPosition(clamped.position);
      if (persistState) {
        saveState(storageKey, {
          position: clamped.position,
          size: clamped.size,
          viewport: snapshotFloatingPanelViewport(viewport),
        });
      }
      return clamped.size;
    });
  }, [
    clampToViewport,
    contentFitHeight,
    maxHeight,
    persistState,
    position,
    resolveViewportBounds,
    storageKey,
  ]);

  useEffect(() => {
    const reconcile = () => {
      const viewport = readFloatingPanelViewport();
      const tracked = trackedViewportRef.current;
      const viewportChanged =
        Math.abs(tracked.width - viewport.width) >= 48 ||
        Math.abs(tracked.height - viewport.height) >= 48;

      if (viewportChanged) {
        trackedViewportRef.current = viewport;
        const centered = centerFloatingPanelPosition(size, viewportMargin, viewport);
        const next = clampToViewport(centered, size);
        setPosition(next.position);
        if (!sameSize(size, next.size)) setSize(next.size);
        if (persistState) {
          saveState(storageKey, {
            position: next.position,
            size: next.size,
            viewport: snapshotFloatingPanelViewport(viewport),
          });
        }
        return;
      }

      const next = clampToViewport(position, size);
      if (!samePosition(position, next.position)) setPosition(next.position);
      if (!sameSize(size, next.size)) setSize(next.size);
    };
    reconcile();
    const vv = window.visualViewport;
    window.addEventListener("resize", reconcile);
    vv?.addEventListener("resize", reconcile);
    vv?.addEventListener("scroll", reconcile);
    return () => {
      window.removeEventListener("resize", reconcile);
      vv?.removeEventListener("resize", reconcile);
      vv?.removeEventListener("scroll", reconcile);
    };
  }, [clampToViewport, persistState, position, size, storageKey]);

  return (
    <div
      id={id}
      data-panel-id={id}
      className="fixed"
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        zIndex,
      }}
    >
      {/* Resize handles — negative margins extend hit area outside the panel */}
      <div className="absolute -top-1 left-5 right-5 h-2 cursor-n-resize" onPointerDown={(e) => startDrag("n", e)} />
      <div className="absolute -bottom-1 left-5 right-5 h-2 cursor-s-resize" onPointerDown={(e) => startDrag("s", e)} />
      <div className="absolute -left-1 top-5 bottom-5 w-2 cursor-w-resize" onPointerDown={(e) => startDrag("w", e)} />
      <div className="absolute -right-1 top-5 bottom-5 w-2 cursor-e-resize" onPointerDown={(e) => startDrag("e", e)} />
      <div className="absolute -top-1 -left-1 h-5 w-5 cursor-nw-resize" onPointerDown={(e) => startDrag("nw", e)} />
      <div className="absolute -top-1 -right-1 h-5 w-5 cursor-ne-resize" onPointerDown={(e) => startDrag("ne", e)} />
      <div className="absolute -bottom-1 -left-1 h-5 w-5 cursor-sw-resize" onPointerDown={(e) => startDrag("sw", e)} />
      <div className="absolute -bottom-1 -right-1 h-5 w-5 cursor-se-resize" onPointerDown={(e) => startDrag("se", e)} />

      {/* Panel */}
      <div className="flex h-full w-full flex-col overflow-hidden rounded-lg border border-notion-divider bg-notion-bg font-sans antialiased text-notion-text shadow-2xl">
        {/* Title bar (draggable) — Notion/Zen */}
        <div
          className="flex shrink-0 cursor-move items-center justify-between border-b border-notion-divider bg-notion-sidebar px-6 py-4 select-none"
          onPointerDown={(e) => startDrag("move", e)}
        >
          <h2 className={`m-0 select-none ${PANEL_TYPOGRAPHY.dialogTitle}`}>{title}</h2>
          <button
            type="button"
            className="rounded border-0 bg-transparent p-1 text-notion-text-muted transition-colors hover:bg-notion-sidebar-hover hover:text-notion-text"
            onClick={onClose}
            aria-label="关闭面板"
          >
            <X className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
          </button>
        </div>

        {/* Content：壳层可滚动 + 可见滚动条；子面板内列表仍可用局部 overflow */}
        <div className="floating-panel-body-scroll flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  );
}
