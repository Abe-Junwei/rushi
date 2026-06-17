import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import { LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";
import {
  dismissToast,
  getToastSnapshot,
  runToastAction,
  subscribeToasts,
  type ToastItem,
  type ToastVariant,
} from "../services/ui/toast";
import { toastBottomInsetCssVar } from "../services/ui/toastLayout";
import { CONTROL_BTN_SECONDARY } from "../config/controlStyles";

const TOAST_SHELL =
  "pointer-events-auto flex max-w-[min(24rem,calc(100vw-2rem))] cursor-pointer items-start gap-2.5 rounded-md border py-2.5 pl-3 pr-4 text-left font-sans text-sm font-normal leading-snug shadow-none";

/** 语义底色 + 边框；避免与 notion-bg 主舞台融为一体。 */
const VARIANT_SURFACE: Record<ToastVariant, string> = {
  info: "border-notion-callout-border bg-notion-callout-bg text-notion-text",
  success: "border-zen-success-border bg-zen-success-surface text-zen-success",
  warning: "border-zen-saffron-border bg-zen-saffron-surface text-notion-text",
  error: "border-zen-cinnabar-border bg-zen-cinnabar-surface text-zen-cinnabar",
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
  const actionLabel = item.actionLabel?.trim();

  return (
    <div
      role={item.variant === "error" ? "alert" : "status"}
      aria-live={item.variant === "error" ? "assertive" : "polite"}
      title="关闭"
      onClick={() => dismissToast(item.id)}
      className={[
        TOAST_SHELL,
        VARIANT_SURFACE[item.variant],
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
      {actionLabel ? (
        <button
          type="button"
          className={`${CONTROL_BTN_SECONDARY} shrink-0 py-1 text-xs`}
          onClick={(e) => {
            e.stopPropagation();
            runToastAction(item.id);
          }}
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function ToastHost() {
  const items = useSyncExternalStore(subscribeToasts, getToastSnapshot, getToastSnapshot);
  const item = items[0];
  if (!item) return null;

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 z-[200] flex justify-center px-4"
      style={{
        bottom: toastBottomInsetCssVar(),
      }}
      aria-label="通知"
    >
      <ToastCard item={item} />
    </div>,
    document.body,
  );
}
