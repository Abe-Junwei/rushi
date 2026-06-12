import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
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
  shortcutHint?: string;
  labelStyle?: CSSProperties;
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
              <span className="min-w-0 flex-1 truncate" style={it.labelStyle}>
                {it.label}
              </span>
              {it.shortcutHint ? (
                <span className="shrink-0 pl-3 font-sans text-[11px] font-normal tabular-nums text-notion-text-light">
                  {it.shortcutHint}
                </span>
              ) : null}
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
  const onCloseRef = useRef(onClose);
  const suppressOutsideCloseUntilRef = useRef(0);
  onCloseRef.current = onClose;
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
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, []);

  const dismissUnlessSuppressed = (event: ReactPointerEvent | ReactMouseEvent) => {
    if (event.button !== 0) return;
    if (performance.now() < suppressOutsideCloseUntilRef.current) return;
    onCloseRef.current();
  };

  const node = (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[149] cursor-default border-0 bg-transparent p-0"
        aria-label="关闭菜单"
        onPointerDown={dismissUnlessSuppressed}
        onMouseDown={dismissUnlessSuppressed}
      />
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
          onClose={() => onCloseRef.current()}
          openPath={openPath}
          setOpenPath={setOpenPath}
          depth={0}
        />
      </div>
    </>
  );

  return typeof document !== "undefined" ? createPortal(node, document.body) : null;
}
