import { PANEL_TYPOGRAPHY } from "../../config/typography";

export function EnvLocalAsrStatusRow({
  label,
  ok,
  text,
  last = false,
}: {
  label: string;
  ok: boolean;
  text: string;
  last?: boolean;
}) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 py-2 ${last ? "" : "border-b border-notion-divider"}`}>
      <span className={PANEL_TYPOGRAPHY.fieldLabel}>{label}</span>
      <div className="flex items-center gap-2.5">
        <span className={`h-2 w-2 rounded-full ${ok ? "bg-zen-success" : "bg-zen-cinnabar"}`} aria-hidden />
        <span className={PANEL_TYPOGRAPHY.meta}>{text}</span>
      </div>
    </div>
  );
}

export function EnvLocalAsrSmallButton({
  children,
  disabled,
  onClick,
  icon,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`flex items-center gap-1.5 rounded border border-notion-divider bg-notion-bg px-2.5 py-1 ${PANEL_TYPOGRAPHY.button} text-notion-text transition-colors hover:bg-notion-sidebar-hover disabled:opacity-40`}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
      {children}
    </button>
  );
}
