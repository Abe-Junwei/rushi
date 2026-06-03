import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
export type ContextMenuItem = {
  key: string;
  label: string;
  disabled: boolean;
};
import {
  clampContextMenuPosition,
  estimateContextMenuSize,
} from "../utils/clampContextMenuPosition";

type Props = {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onSelect: (key: string) => void;
  onClose: () => void;
};

const menuShell =
  "fixed z-[100] min-w-[11rem] max-w-[min(16rem,calc(100vw-16px))] rounded-md border border-notion-border bg-notion-bg py-1 shadow-[0_8px_24px_color-mix(in_srgb,var(--zen-ink)_14%,transparent),0_0_0_1px_color-mix(in_srgb,var(--zen-ink)_4%,transparent)]";

const menuItem =
  "dropdown-item mx-1 flex min-h-[32px] w-[calc(100%-0.5rem)] items-center rounded-sm px-2.5 py-1.5 text-left font-sans text-sm leading-snug text-notion-text transition-colors hover:bg-notion-sidebar-hover focus-visible:bg-notion-sidebar-hover focus-visible:outline-none disabled:cursor-not-allowed disabled:text-notion-text-light";

export function SegmentContextMenu({ x, y, items, onSelect, onClose }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const estimate = estimateContextMenuSize(items.length);
  const [pos, setPos] = useState(() =>
    clampContextMenuPosition(x, y, estimate.width, estimate.height),
  );

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const next = clampContextMenuPosition(x, y, rect.width, rect.height);
    setPos((prev) => (prev.left === next.left && prev.top === next.top ? prev : next));
  }, [x, y, items]);

  useLayoutEffect(() => {
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
    <div ref={rootRef} role="menu" className={menuShell} style={{ left: pos.left, top: pos.top }}>
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          role="menuitem"
          disabled={it.disabled}
          className={menuItem}
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
