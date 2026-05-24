import { useCallback, useEffect, useRef, useState } from "react";

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

export function DraggableResizablePanel({
  id,
  title,
  defaultPosition,
  defaultSize,
  minWidth = 320,
  minHeight = 200,
  children,
  onClose,
}: DraggableResizablePanelProps) {
  const storageKey = `panel-state-${id}`;

  const saved = loadState(storageKey);
  const [position, setPosition] = useState<Position>(saved?.position ?? defaultPosition);
  const [size, setSize] = useState<Size>(saved?.size ?? defaultSize);

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
        setPosition({ x: d.startPos.x + dx, y: d.startPos.y + dy });
        return;
      }

      let nextX = d.startPos.x;
      let nextY = d.startPos.y;
      let nextW = d.startSize.width;
      let nextH = d.startSize.height;

      if (d.mode.includes("e")) {
        nextW = Math.max(minWidth, d.startSize.width + dx);
      }
      if (d.mode.includes("w")) {
        const newW = Math.max(minWidth, d.startSize.width - dx);
        nextX = d.startPos.x + (d.startSize.width - newW);
        nextW = newW;
      }
      if (d.mode.includes("s")) {
        nextH = Math.max(minHeight, d.startSize.height + dy);
      }
      if (d.mode.includes("n")) {
        const newH = Math.max(minHeight, d.startSize.height - dy);
        nextY = d.startPos.y + (d.startSize.height - newH);
        nextH = newH;
      }

      setPosition({ x: nextX, y: nextY });
      setSize({ width: nextW, height: nextH });
    };

    const onUp = () => {
      if (dragRef.current) {
        saveState(storageKey, { position, size });
        dragRef.current = null;
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [minWidth, minHeight, position, size, storageKey]);

  return (
    <div
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
      <div className="flex h-full w-full flex-col overflow-hidden rounded-2xl border border-zen-gray-300 bg-zen-paper shadow-xl">
        {/* Title bar (draggable) */}
        <div
          className="flex shrink-0 cursor-move items-center justify-between border-b border-zen-gray-300 bg-serene-surface-container-low px-5 py-3"
          onPointerDown={(e) => startDrag("move", e)}
        >
          <h2 className="select-none font-serif text-lg font-medium text-zen-ink">{title}</h2>
          <button
            type="button"
            className="rounded-lg border-0 bg-transparent p-1 text-zen-stone transition-colors hover:text-zen-ink"
            onClick={onClose}
            aria-label="关闭面板"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}
