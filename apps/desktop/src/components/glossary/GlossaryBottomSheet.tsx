import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { PANEL_TYPOGRAPHY } from "../../config/typography";
import { LUCIDE_ICON_SIZE_SM, LUCIDE_ICON_STROKE_WIDTH } from "../lucideIconSpec";

type Props = {
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function GlossaryBottomSheet({ title, onClose, children }: Props) {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const sheet = (
    <div className="fixed inset-0 z-30 flex flex-col justify-end" role="presentation">
      <button
        type="button"
        className="min-h-0 flex-1 border-0 bg-notion-bg/60 backdrop-blur-xs"
        aria-label="关闭检视器"
        onClick={onClose}
      />
      <div
        className="flex max-h-[85vh] min-h-[45vh] flex-col rounded-t-lg border-t border-notion-border bg-notion-sidebar shadow-[0_-4px_24px_rgba(0,0,0,0.08)]"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex shrink-0 justify-center py-2" aria-hidden>
          <div className="h-1 w-10 rounded-full bg-notion-border" />
        </div>
        <div className="flex shrink-0 items-center justify-between border-b border-notion-divider px-4 py-2.5">
          <h3 className={`m-0 ${PANEL_TYPOGRAPHY.sectionTitle} text-sm font-semibold text-notion-text`}>
            {title}
          </h3>
          <button
            type="button"
            className="rounded-sm border-0 bg-transparent p-1 text-notion-text-muted transition-colors hover:bg-notion-sidebar-hover hover:text-notion-text"
            aria-label="关闭检视器"
            onClick={onClose}
          >
            <X className={LUCIDE_ICON_SIZE_SM} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">{children}</div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return sheet;
  return createPortal(sheet, document.body);
}
