import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  IconCheck as Check,
  IconChevronDown as ChevronDown,
} from "@tabler/icons-react";
import { CspLayout } from "./CspLayout";
import { PANEL_CONTROL_TYPOGRAPHY } from "../config/typography";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

export type EnvPanelSelectOption<T extends string = string> = {
  id: T;
  label: string;
};

type EnvPanelSelectProps<T extends string> = {
  id?: string;
  value: T;
  options: readonly EnvPanelSelectOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  "aria-label": string;
  renderPreview?: (option: EnvPanelSelectOption<T>, surface: "trigger" | "menu") => ReactNode;
};

const TRIGGER_CLASS = [
  "box-border flex h-8 min-h-[32px] w-full min-w-0 items-center justify-between gap-2 rounded-sm border border-notion-border bg-notion-bg px-3",
  PANEL_CONTROL_TYPOGRAPHY.compactInput,
  "font-medium text-notion-text shadow-none ring-0 transition-colors",
  "hover:border-notion-text-light hover:bg-notion-sidebar",
  "focus-visible:border-accent-action focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-accent-action/25",
  "disabled:cursor-not-allowed disabled:opacity-40",
].join(" ");

const MENU_ITEM_CLASS =
  "dropdown-item flex min-h-[32px] w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-body leading-snug text-notion-text transition-colors hover:bg-notion-sidebar-hover disabled:cursor-not-allowed disabled:text-notion-text-light";

const LISTBOX_CLASS =
  "dropdown-surface pointer-events-auto max-h-[min(16rem,50vh)] overflow-y-auto p-1";

const ENV_PANEL_SELECT_PORTAL_Z = 120;

/** 环境页自定义下拉（portal 到 body，避免设置页 scroll 容器裁切）。 */
export function EnvPanelSelect<T extends string>({
  id: idProp,
  value,
  options,
  onChange,
  disabled = false,
  "aria-label": ariaLabel,
  renderPreview,
}: EnvPanelSelectProps<T>) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const listboxId = `${id}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const portalRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const selected = options.find((option) => option.id === value) ?? options[0];

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
    const onDocumentPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (portalRef.current?.contains(target)) return;
      close();
    };
    const onDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onDocumentPointerDown, true);
    document.addEventListener("keydown", onDocumentKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onDocumentPointerDown, true);
      document.removeEventListener("keydown", onDocumentKeyDown);
    };
  }, [close, open]);

  if (!selected) return null;

  const portalNode =
    open && anchorRect && typeof document !== "undefined"
      ? createPortal(
          <CspLayout
            className="workspace"
            layout={{
              position: "fixed",
              inset: 0,
              zIndex: ENV_PANEL_SELECT_PORTAL_Z,
              pointerEvents: "none",
            }}
          >
            <CspLayout
              as="ul"
              ref={portalRef}
              id={listboxId}
              role="listbox"
              aria-label={ariaLabel}
              className={LISTBOX_CLASS}
              layout={{
                position: "fixed",
                top: anchorRect.bottom + 4,
                left: anchorRect.left,
                width: anchorRect.width,
              }}
            >
              {options.map((option) => {
                const active = option.id === value;
                return (
                  <li key={option.id} role="none">
                    <button
                      type="button"
                      role="option"
                      aria-selected={active}
                      className={[
                        MENU_ITEM_CLASS,
                        active ? "bg-notion-sidebar-active text-notion-text" : "",
                      ].join(" ")}
                      onClick={() => {
                        onChange(option.id);
                        close();
                      }}
                    >
                      {renderPreview?.(option, "menu")}
                      <span className="min-w-0 flex-1 truncate">{option.label}</span>
                      {active ? (
                        <Check
                          className={`${LUCIDE_ICON_SIZE_SM} shrink-0 text-accent-action-strong`}
                          strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
                          aria-hidden
                        />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </CspLayout>
          </CspLayout>,
          document.body,
        )
      : null;

  return (
    <>
      <div ref={rootRef} className="dropdown-anchor relative w-full">
        <button
          ref={triggerRef}
          type="button"
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-label={ariaLabel}
          disabled={disabled}
          className={TRIGGER_CLASS}
          onClick={() => setOpen((prev) => !prev)}
        >
          <span className="flex min-w-0 flex-1 items-center gap-2">
            {renderPreview?.(selected, "trigger")}
            <span className="truncate">{selected.label}</span>
          </span>
          <ChevronDown
            className={`${LUCIDE_ICON_SIZE_SM} shrink-0 text-notion-text-muted transition-transform ${open ? "rotate-180" : ""}`}
            strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
            aria-hidden
          />
        </button>
      </div>
      {portalNode}
    </>
  );
}
