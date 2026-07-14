import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  IconChevronDown as ChevronDown,
} from "@tabler/icons-react";
import { CspLayout } from "../CspLayout";
import { LUCIDE_ICON_STROKE_WIDTH } from "../lucideIconSpec";
import { workbenchCompactMenuSummaryClass } from "./editorSegmentToolbarStyles";

export type WorkbenchOverflowMenuProps = {
  label: string;
  ariaLabel: string;
  engaged?: boolean;
  /** 菜单相对触发器水平对齐 */
  align?: "center" | "end";
  /** 下拉面板最小宽度（默认 max(176, 触发器宽)） */
  panelMinWidth?: number;
  className?: string;
  children: ReactNode | ((close: () => void) => ReactNode);
};

function resolvePortalStyle(
  anchorRect: DOMRect,
  align: "center" | "end",
  panelMinWidth?: number,
): { top: number; left: number; transform: string; minWidth: number } {
  const minWidth = panelMinWidth ?? Math.max(176, anchorRect.width);
  if (align === "end") {
    return {
      top: anchorRect.bottom + 4,
      left: anchorRect.right,
      transform: "translateX(-100%)",
      minWidth,
    };
  }
  return {
    top: anchorRect.bottom + 4,
    left: anchorRect.left + anchorRect.width / 2,
    transform: "translateX(-50%)",
    minWidth,
  };
}

/** 工作条紧凑 overflow 菜单：portal 到 body，避免 toolbar overflow 裁切与列重叠挡点击。 */
export function WorkbenchOverflowMenu({
  label,
  ariaLabel,
  engaged = false,
  align = "center",
  panelMinWidth,
  className = "",
  children,
}: WorkbenchOverflowMenuProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const portalRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);

  const close = useCallback(() => setOpen(false), []);

  const syncAnchorRect = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    setAnchorRect(rect ?? null);
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    syncAnchorRect();
  }, [open, syncAnchorRect]);

  useEffect(() => {
    if (!open) return;
    const onReposition = () => syncAnchorRect();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, { passive: true, capture: true });
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, { capture: true });
    };
  }, [open, syncAnchorRect]);

  useEffect(() => {
    if (!open) return;
    const onDocPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (portalRef.current?.contains(target)) return;
      close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onDocPointerDown, true);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onDocPointerDown, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [close, open]);

  const portalStyle = open && anchorRect ? resolvePortalStyle(anchorRect, align, panelMinWidth) : null;

  const portalNode =
    open && portalStyle && typeof document !== "undefined"
      ? createPortal(
          <CspLayout
            ref={portalRef}
            className="workbench-compact-menu-portal-host"
            layout={{
              position: "fixed",
              inset: 0,
              zIndex: 120,
              pointerEvents: "none",
            }}
          >
            <CspLayout
              className="dropdown-surface workbench-compact-menu-panel pointer-events-auto py-1"
              layout={{
                position: "fixed",
                top: portalStyle.top,
                left: portalStyle.left,
                transform: portalStyle.transform,
                minWidth: portalStyle.minWidth,
              }}
              role="menu"
            >
              {typeof children === "function" ? children(close) : children}
            </CspLayout>
          </CspLayout>,
          document.body,
        )
      : null;

  return (
    <>
      <div
        ref={rootRef}
        className={[
          "dropdown-anchor workbench-compact-menu",
          open ? "workbench-compact-menu-open" : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <button
          ref={triggerRef}
          type="button"
          className={workbenchCompactMenuSummaryClass(engaged || open)}
          aria-label={ariaLabel}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((prev) => !prev)}
        >
          <span>{label}</span>
          <ChevronDown
            className="workbench-compact-menu-chevron"
            size={14}
            strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
            aria-hidden
          />
        </button>
      </div>
      {portalNode}
    </>
  );
}
