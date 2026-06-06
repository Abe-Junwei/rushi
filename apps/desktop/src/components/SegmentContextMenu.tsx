import {
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import {
  clampContextMenuPosition,
  estimateContextMenuSize,
} from "../utils/clampContextMenuPosition";

export type ContextMenuItem = {
  key: string;
  label: string;
  disabled: boolean;
  checked?: boolean;
  children?: ContextMenuItem[];
};

type Props = {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onSelect: (key: string) => void;
  onClose: () => void;
};

const menuShellRoot =
  "relative z-[100] min-w-[11rem] max-w-[min(16rem,calc(100vw-16px))] rounded-md border border-notion-border bg-notion-bg py-1 shadow-[0_8px_24px_color-mix(in_srgb,var(--zen-ink)_14%,transparent),0_0_0_1px_color-mix(in_srgb,var(--zen-ink)_4%,transparent)]";

const menuShellFlyout =
  "relative z-[101] min-w-[11rem] max-w-[min(16rem,calc(100vw-16px))] rounded-md border border-notion-border bg-notion-bg py-1 shadow-[0_8px_24px_color-mix(in_srgb,var(--zen-ink)_14%,transparent),0_0_0_1px_color-mix(in_srgb,var(--zen-ink)_4%,transparent)]";

const menuItemBase =
  "dropdown-item mx-1 flex min-h-[32px] w-[calc(100%-0.5rem)] items-center gap-2 rounded-sm px-2.5 py-1.5 text-left font-sans text-sm leading-snug text-notion-text transition-colors focus-visible:outline-none disabled:cursor-not-allowed disabled:text-notion-text-light";

function countLeafItems(items: ContextMenuItem[]): number {
  let count = 0;
  for (const item of items) {
    if (item.children?.length) count += 1;
    else count += 1;
  }
  return count;
}

function eventPathIncludesNode(event: Event, node: Node): boolean {
  if (typeof event.composedPath === "function") {
    return event.composedPath().includes(node);
  }
  return node.contains(event.target as Node);
}

function ContextMenuPanel({
  items,
  onSelect,
  onClose,
  openPath,
  setOpenPath,
  depth,
}: {
  items: ContextMenuItem[];
  onSelect: (key: string) => void;
  onClose: () => void;
  openPath: string[];
  setOpenPath: Dispatch<SetStateAction<string[]>>;
  depth: number;
}) {
  const menuItemClass = (active: boolean, disabled: boolean) =>
    [
      menuItemBase,
      disabled ? "" : active ? "bg-notion-sidebar-hover" : "hover:bg-notion-sidebar-hover",
    ].join(" ");

  const activateItem = (it: ContextMenuItem) => {
    if (it.disabled) return;
    if (it.children?.length) {
      setOpenPath((prev) => [...prev.slice(0, depth), it.key]);
      return;
    }
    onSelect(it.key);
    onClose();
  };

  const onItemPointerDown = (e: ReactPointerEvent<HTMLButtonElement>, it: ContextMenuItem) => {
    if (it.disabled) return;
    // 避免 textarea 抢焦点导致首击无效（macOS / WebKit 常见）
    e.preventDefault();
    e.stopPropagation();
    activateItem(it);
  };

  return (
    <div
      role={depth === 0 ? "menu" : "group"}
      className={depth === 0 ? menuShellRoot : menuShellFlyout}
    >
      {items.map((it) => {
        const hasChildren = Boolean(it.children?.length);
        const isOpen = hasChildren && openPath[depth] === it.key;
        const flyoutScrollable = it.key === "fontMenu";
        return (
          <div key={it.key} className="relative">
            <button
              type="button"
              role="menuitem"
              disabled={it.disabled}
              aria-haspopup={hasChildren ? "menu" : undefined}
              aria-expanded={hasChildren ? isOpen : undefined}
              className={menuItemClass(isOpen, it.disabled)}
              onMouseEnter={() => {
                if (it.disabled) return;
                if (hasChildren) {
                  setOpenPath((prev) => [...prev.slice(0, depth), it.key]);
                  return;
                }
                setOpenPath((prev) => prev.slice(0, depth + 1));
              }}
              onPointerDown={(e) => onItemPointerDown(e, it)}
            >
              <span className="min-w-0 flex-1 truncate">{it.label}</span>
              {it.checked ? (
                <span className="shrink-0 text-[11px] font-semibold text-zen-saffron-mid" aria-hidden>
                  ✓
                </span>
              ) : null}
              {hasChildren ? (
                <span className="shrink-0 text-notion-text-light" aria-hidden>
                  ▸
                </span>
              ) : null}
            </button>
            {hasChildren && isOpen ? (
              <div
                className={[
                  "absolute left-full top-0 z-[102] ml-0.5 overflow-visible",
                  flyoutScrollable ? "max-h-64 overflow-y-auto" : "",
                ].join(" ")}
                onMouseEnter={() => setOpenPath((prev) => [...prev.slice(0, depth), it.key])}
              >
                <ContextMenuPanel
                  items={it.children!}
                  onSelect={onSelect}
                  onClose={onClose}
                  openPath={openPath}
                  setOpenPath={setOpenPath}
                  depth={depth + 1}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function SegmentContextMenu({ x, y, items, onSelect, onClose }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const estimate = estimateContextMenuSize(countLeafItems(items));
  const [pos, setPos] = useState(() =>
    clampContextMenuPosition(x, y, estimate.width, estimate.height),
  );
  const [openPath, setOpenPath] = useState<string[]>([]);

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const next = clampContextMenuPosition(x, y, rect.width, rect.height);
    setPos((prev) => (prev.left === next.left && prev.top === next.top ? prev : next));
  }, [x, y, items, openPath]);

  useLayoutEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const root = rootRef.current;
      if (!root) return;
      if (eventPathIncludesNode(e, root)) return;
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
    <div ref={rootRef} className="fixed" style={{ left: pos.left, top: pos.top }}>
      <ContextMenuPanel
        items={items}
        onSelect={onSelect}
        onClose={onClose}
        openPath={openPath}
        setOpenPath={setOpenPath}
        depth={0}
      />
    </div>
  );

  return typeof document !== "undefined" ? createPortal(node, document.body) : null;
}
