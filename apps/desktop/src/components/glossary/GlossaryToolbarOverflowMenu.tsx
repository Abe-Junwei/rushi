import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  IconDownload as Download,
  IconList as ListPlus,
  IconDots as MoreHorizontal,
  IconUpload as Upload,
} from "@tabler/icons-react";
import { CONTROL_BTN_ICON } from "../../config/controlStyles";
import { CspLayout } from "../CspLayout";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "../lucideIconSpec";
import { workbenchDropdownItem } from "../editor/editorSegmentToolbarStyles";

type Props = {
  disabled?: boolean;
  exportDisabled?: boolean;
  onBulkAdd: () => void;
  onImportFromFile: () => void;
  onExportCsv: () => void;
};

export function GlossaryToolbarOverflowMenu({
  disabled,
  exportDisabled,
  onBulkAdd,
  onImportFromFile,
  onExportCsv,
}: Props) {
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

  const portalStyle =
    open && anchorRect
      ? {
          top: anchorRect.bottom + 4,
          left: anchorRect.right,
          transform: "translateX(-100%)",
          minWidth: Math.max(176, anchorRect.width),
        }
      : null;

  const portalNode =
    open && portalStyle && typeof document !== "undefined"
      ? createPortal(
          <div ref={portalRef} className="pointer-events-none fixed inset-0 z-[120]">
            <CspLayout
              className="dropdown-surface pointer-events-auto py-1"
              layout={{
                position: "fixed",
                top: portalStyle.top,
                left: portalStyle.left,
                transform: portalStyle.transform,
                minWidth: portalStyle.minWidth,
              }}
              role="menu"
            >
              <button
                type="button"
                role="menuitem"
                className={workbenchDropdownItem}
                disabled={disabled}
                onClick={() => {
                  close();
                  onBulkAdd();
                }}
              >
                <ListPlus className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
                批量添加…
              </button>
              <button
                type="button"
                role="menuitem"
                className={workbenchDropdownItem}
                disabled={disabled}
                onClick={() => {
                  close();
                  onImportFromFile();
                }}
              >
                <Upload className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
                从表格导入…
              </button>
              <button
                type="button"
                role="menuitem"
                className={workbenchDropdownItem}
                disabled={disabled || exportDisabled}
                onClick={() => {
                  close();
                  onExportCsv();
                }}
              >
                <Download className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
                导出 CSV
              </button>
            </CspLayout>
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div ref={rootRef} className="dropdown-anchor">
        <button
          ref={triggerRef}
          type="button"
          className={CONTROL_BTN_ICON}
          aria-label="更多操作"
          aria-haspopup="menu"
          aria-expanded={open}
          disabled={disabled}
          onClick={() => setOpen((prev) => !prev)}
        >
          <MoreHorizontal className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
        </button>
      </div>
      {portalNode}
    </>
  );
}
