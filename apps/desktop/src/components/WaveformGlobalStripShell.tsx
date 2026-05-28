import { memo } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { LUCIDE_ICON_SIZE_LG, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";
import { WAVEFORM_GLOBAL_STRIP_COLLAPSED_HEIGHT_PX } from "../utils/waveformViewMode";

export type WaveformGlobalStripShellProps = {
  collapsed: boolean;
  disabled: boolean;
  onToggleCollapsed: () => void;
  children: React.ReactNode;
};

export const WaveformGlobalStripShell = memo(function WaveformGlobalStripShell({
  collapsed,
  disabled,
  onToggleCollapsed,
  children,
}: WaveformGlobalStripShellProps) {
  if (collapsed) {
    return (
      <div
        className="flex shrink-0 items-center justify-between gap-2 border-t border-notion-divider bg-notion-sidebar px-3"
        style={{ height: WAVEFORM_GLOBAL_STRIP_COLLAPSED_HEIGHT_PX }}
      >
        <span className="text-[10px] font-medium text-notion-text-muted">全局波形</span>
        <button
          type="button"
          className="inline-flex h-6 items-center gap-1 rounded-md border-0 bg-transparent px-2 text-[11px] font-semibold text-notion-text-muted hover:bg-notion-sidebar-hover hover:text-notion-text disabled:opacity-40"
          disabled={disabled}
          aria-expanded={false}
          onClick={onToggleCollapsed}
        >
          展开
          <ChevronUp className={LUCIDE_ICON_SIZE_LG} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 flex-col border-t border-notion-divider bg-notion-sidebar">
      <div className="flex h-7 shrink-0 items-center justify-between gap-2 px-3">
        <span className="text-[10px] font-medium text-notion-text-muted">全局波形</span>
        <button
          type="button"
          className="inline-flex h-6 items-center gap-1 rounded-md border-0 bg-transparent px-2 text-[11px] font-semibold text-notion-text-muted hover:bg-notion-sidebar-hover hover:text-notion-text disabled:opacity-40"
          disabled={disabled}
          aria-expanded
          onClick={onToggleCollapsed}
        >
          折叠
          <ChevronDown className={LUCIDE_ICON_SIZE_LG} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
        </button>
      </div>
      {children}
    </div>
  );
});
