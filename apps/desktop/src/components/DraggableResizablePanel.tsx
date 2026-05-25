import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { PANEL_TYPOGRAPHY } from "../config/typography";
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
  children: React.ReactNode;
  onClose: () => void;
  variant?: "serene" | "notion";
  persistState?: boolean;
}

function loadState(key: string): { position: Position; size: Size } | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { position: Position; size: Size };
    if (parsed.position && parsed.size) return parsed;
  } catch {
    /* ignore corrupt storage */
  }
  return null;
}

function saveState(key: string, state: { position: Position; size: Size }) {
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
  children,
  onClose,
  variant = "serene",
  persistState = true,
}: DraggableResizablePanelProps) {
  const storageKey = `panel-state-${id}`;

  const saved = persistState ? loadState(storageKey) : null;
  const [position, setPosition] = useState<Position>(saved?.position ?? defaultPosition);
  const [size, setSize] = useState<Size>(saved?.size ?? defaultSize);

  const resolveViewportBounds = useCallback(() => {
    const margin = 16;
    const viewportWidth = Math.floor(window.visualViewport?.width ?? window.innerWidth);
    const viewportHeight = Math.floor(window.visualViewport?.height ?? window.innerHeight);
    const maxWidth = Math.max(240, viewportWidth - margin * 2);
    const maxHeight = Math.max(180, viewportHeight - margin * 2);
    const effectiveMinWidth = Math.min(minWidth, maxWidth);
    const effectiveMinHeight = Math.min(minHeight, maxHeight);
    return {
      margin,
      maxWidth,
      maxHeight,
      effectiveMinWidth,
      effectiveMinHeight,
    };
  }, [minHeight, minWidth]);

  const clampToViewport = useCallback((nextPosition: Position, nextSize: Size) => {
    const { margin, maxWidth, maxHeight, effectiveMinWidth, effectiveMinHeight } = resolveViewportBounds();
    const clampedSize = {
      width: Math.min(Math.max(nextSize.width, effectiveMinWidth), maxWidth),
      height: Math.min(Math.max(nextSize.height, effectiveMinHeight), maxHeight),
    };
    const viewportWidth = Math.floor(window.visualViewport?.width ?? window.innerWidth);
    const viewportHeight = Math.floor(window.visualViewport?.height ?? window.innerHeight);
    const maxX = Math.max(margin, viewportWidth - clampedSize.width - margin);
    const maxY = Math.max(margin, viewportHeight - clampedSize.height - margin);
    return {
      position: {
        x: Math.min(Math.max(nextPosition.x, margin), maxX),
        y: Math.min(Math.max(nextPosition.y, margin), maxY),
      },
      size: clampedSize,
    };
  }, [resolveViewportBounds]);

  const dragRef = useRef<{
    mode: string;
    startX: number;
    startY: number;
    startPos: Position;
    startSize: Size;
  } | null>(null);

  const startDrag = useCallback(
    (mode: string, e: React.PointerEvent) => {
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
          saveState(storageKey, { position, size });
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
  }, [clampToViewport, persistState, position, resolveViewportBounds, size, storageKey]);

  useEffect(() => {
    const clamp = () => {
      const next = clampToViewport(position, size);
      if (!samePosition(position, next.position)) setPosition(next.position);
      if (!sameSize(size, next.size)) setSize(next.size);
    };
    clamp();
    const vv = window.visualViewport;
    window.addEventListener("resize", clamp);
    vv?.addEventListener("resize", clamp);
    vv?.addEventListener("scroll", clamp);
    return () => {
      window.removeEventListener("resize", clamp);
      vv?.removeEventListener("resize", clamp);
      vv?.removeEventListener("scroll", clamp);
    };
  }, [clampToViewport, position, size]);

  return (
    <div
      data-panel-id={id}
      className="fixed z-50"
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
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
      <div
        className={[
          "flex h-full w-full flex-col overflow-hidden border shadow-xl",
          variant === "notion"
            ? "rounded-lg border-notion-divider bg-notion-bg shadow-2xl"
            : "rounded-2xl border-zen-gray-300 bg-zen-paper",
        ].join(" ")}
      >
        {/* Title bar (draggable) */}
        <div
          className={[
            "flex shrink-0 cursor-move items-center justify-between border-b select-none",
            variant === "notion"
              ? "border-notion-divider bg-notion-sidebar px-6 py-4"
              : "border-zen-gray-300 bg-serene-surface-container-low px-5 py-3",
          ].join(" ")}
          onPointerDown={(e) => startDrag("move", e)}
        >
          <h2
            className={[
              "m-0 select-none",
              variant === "notion"
                ? PANEL_TYPOGRAPHY.dialogTitle
                : "font-serif text-lg font-medium text-zen-ink",
            ].join(" ")}
          >
            {title}
          </h2>
          <button
            type="button"
            className={[
              "border-0 bg-transparent p-1 transition-colors",
              variant === "notion"
                ? "rounded text-notion-text-muted hover:bg-notion-sidebar-hover hover:text-notion-text"
                : "rounded-lg text-zen-stone hover:text-zen-ink",
            ].join(" ")}
            onClick={onClose}
            aria-label="关闭面板"
          >
            <X className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
          </button>
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}
