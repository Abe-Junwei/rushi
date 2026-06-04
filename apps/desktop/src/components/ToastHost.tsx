import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";
import { dismissToast, getToastSnapshot, subscribeToasts, type ToastItem, type ToastVariant } from "../services/ui/toast";

const TOAST_SHELL =
  "pointer-events-auto flex max-w-[min(28rem,calc(100vw-2rem))] cursor-pointer items-start gap-2.5 rounded-md border border-notion-divider bg-notion-bg py-2.5 pl-3 pr-4 text-left font-sans text-sm font-normal leading-snug text-notion-text shadow-sm";

const VARIANT_ACCENT: Record<ToastVariant, string> = {
  info: "border-l-4 border-l-notion-text-light bg-notion-callout-bg",
  success: "border-l-4 border-l-zen-success",
  warning: "border-l-4 border-l-zen-saffron",
  error: "border-l-4 border-l-zen-cinnabar",
};

const VARIANT_ICON: Record<
  ToastVariant,
  { Icon: typeof Info; className: string }
> = {
  info: { Icon: Info, className: "text-notion-text-muted" },
  success: { Icon: CheckCircle2, className: "text-zen-success" },
  warning: { Icon: TriangleAlert, className: "text-zen-saffron" },
  error: { Icon: AlertCircle, className: "text-zen-cinnabar" },
};

function ToastCard({ item }: { item: ToastItem }) {
  const exiting = item.exiting === true;
  const { Icon, className: iconClass } = VARIANT_ICON[item.variant];

  return (
    <div
      role={item.variant === "error" ? "alert" : "status"}
      aria-live={item.variant === "error" ? "assertive" : "polite"}
      title="关闭"
      onClick={() => dismissToast(item.id)}
      className={[
        TOAST_SHELL,
        VARIANT_ACCENT[item.variant],
        exiting ? "opacity-0 translate-y-2 scale-[0.98] saturate-[0.92]" : "animate-toast-in opacity-100 translate-y-0 scale-100",
        "transition-[opacity,transform,filter] duration-[260ms] ease-out",
      ].join(" ")}
    >
      <Icon
        className={`mt-0.5 shrink-0 ${LUCIDE_ICON_SIZE_MD} ${iconClass}`}
        strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
        aria-hidden
      />
      <p className="min-w-0 flex-1">{item.message}</p>
    </div>
  );
}

export function ToastHost() {
  const items = useSyncExternalStore(subscribeToasts, getToastSnapshot, getToastSnapshot);
  const item = items[0];
  if (!item) return null;

  return createPortal(
    <div
      className="pointer-events-none fixed left-1/2 z-[200] flex -translate-x-1/2 flex-col items-center gap-1.5"
      style={{
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 5.25rem)",
      }}
      aria-label="通知"
    >
      <ToastCard item={item} />
    </div>,
    document.body,
  );
}
