import {
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import {
  clampContextMenuPosition,
  estimateContextMenuSize,
} from "../utils/clampContextMenuPosition";
import { blurActiveTranscriptTextarea, suspendTranscriptTextareasForContextMenu } from "../utils/transcriptSelection";

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

/** WebKit 在 textarea 聚焦时可能把 event.target 重定向到正文，坐标仍落在菜单上。 */
function pointerEventHitsMenu(event: PointerEvent, root: HTMLElement): boolean {
  if (eventPathIncludesNode(event, root)) return true;
  const rect = root.getBoundingClientRect();
  const { clientX: x, clientY: y } = event;
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
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

  const lastActivationRef = useRef<{ key: string; ts: number } | null>(null);
  const activateItemOnce = (it: ContextMenuItem) => {
    const now = performance.now();
    const last = lastActivationRef.current;
    if (last && last.key === it.key && now - last.ts < 400) return;
    lastActivationRef.current = { key: it.key, ts: now };
    activateItem(it);
  };

  const onItemPointerDown = (e: ReactPointerEvent<HTMLButtonElement>, it: ContextMenuItem) => {
    if (it.disabled) return;
    // 仅响应主键；忽略右键抬起等偶发 pointer 事件。
    if (e.button !== 0) return;
    // 避免 textarea 抢焦点导致首击无效（macOS / WebKit 常见）
    e.preventDefault();
    e.stopPropagation();
    activateItemOnce(it);
  };

  const onItemClick = (e: ReactMouseEvent<HTMLButtonElement>, it: ContextMenuItem) => {
    if (it.disabled) return;
    e.preventDefault();
    e.stopPropagation();
    activateItemOnce(it);
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
                // 移到无子菜单项：收起同级及更深 flyout（slice(0, depth+1) 会误留 depth=0 的 appearance）
                setOpenPath((prev) => prev.slice(0, depth));
              }}
              onPointerDown={(e) => onItemPointerDown(e, it)}
              onClick={(e) => onItemClick(e, it)}
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
  const suppressOutsideCloseUntilRef = useRef(0);
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
    // 不在 items 变化时重定位：父级 re-render（如 auto-save）会导致菜单跳动，首项尤其难点中。
  }, [x, y, openPath]);

  useLayoutEffect(() => {
    blurActiveTranscriptTextarea();
    suppressOutsideCloseUntilRef.current = performance.now() + 300;
    const resumeTextareas = suspendTranscriptTextareasForContextMenu();
    return resumeTextareas;
  }, [x, y]);

  useLayoutEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      if (performance.now() < suppressOutsideCloseUntilRef.current) return;
      const root = rootRef.current;
      if (!root) return;
      if (pointerEventHitsMenu(e as unknown as PointerEvent, root)) return;
      onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    let active = true;
    const raf = requestAnimationFrame(() => {
      if (!active) return;
      // 冒泡阶段：菜单项 pointerdown 先执行，再判定外部关闭（捕获阶段会抢在菜单项之前）。
      window.addEventListener("mousedown", onMouseDown);
      window.addEventListener("keydown", onKeyDown, true);
    });
    return () => {
      active = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }, [onClose]);

  const node = (
    <div
      ref={rootRef}
      className="fixed z-[150]"
      style={{ left: pos.left, top: pos.top }}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
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
