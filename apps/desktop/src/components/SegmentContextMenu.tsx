import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import type { SegmentContextMenuItem } from "../utils/segmentContextMenuModel";

type Props = {
  x: number;
  y: number;
  items: SegmentContextMenuItem[];
  onSelect: (key: SegmentContextMenuItem["key"]) => void;
  onClose: () => void;
};

function clampMenuPosition(clientX: number, clientY: number): { left: number; top: number } {
  const pad = 8;
  const estW = 240;
  const estH = 320;
  if (typeof window === "undefined") {
    return { left: clientX, top: clientY };
  }
  return {
    left: Math.min(Math.max(pad, clientX), Math.max(pad, window.innerWidth - estW - pad)),
    top: Math.min(Math.max(pad, clientY), Math.max(pad, window.innerHeight - estH - pad)),
  };
}

export function SegmentContextMenu({ x, y, items, onSelect, onClose }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const pos = useMemo(() => clampMenuPosition(x, y), [x, y]);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current?.contains(e.target as Node)) return;
      onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [onClose]);

  const node = (
    <div
      ref={rootRef}
      role="menu"
      className="dropdown-surface fixed z-[100] min-w-[10rem] py-1 text-[12px] text-zen-ink"
      style={{ left: pos.left, top: pos.top }}
    >
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          role="menuitem"
          disabled={it.disabled}
          className="dropdown-item w-full px-3 py-1.5 text-left transition-colors hover:bg-app-highlight disabled:cursor-not-allowed disabled:text-notion-text-light"
          onClick={() => {
            if (it.disabled) return;
            onSelect(it.key);
            onClose();
          }}
        >
          {it.label}
        </button>
      ))}
    </div>
  );

  return typeof document !== "undefined" ? createPortal(node, document.body) : null;
}
