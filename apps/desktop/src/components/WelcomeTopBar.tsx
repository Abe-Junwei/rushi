import type { AsrHealthCapabilities } from "../tauri/projectApi";
import type { AsrHealthState } from "../pages/useAsrBridgeController";
import { Bell, Search } from "lucide-react";
import { LUCIDE_ICON_SIZE_LG, LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

function StatusDot({ ok }: { ok: boolean }) {
  return <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${ok ? "bg-zen-success" : "bg-zen-cinnabar"}`} aria-hidden />;
}

function UserAvatar() {
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-notion-border bg-notion-sidebar-active text-[11px] font-semibold text-notion-text-muted">
      用
    </div>
  );
}

export interface WelcomeTopBarProps {
  asrHealth: AsrHealthState;
  asrCaps: AsrHealthCapabilities | null;
}

export function WelcomeTopBar({ asrHealth, asrCaps }: WelcomeTopBarProps) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-notion-divider bg-white px-10">
      <div className="flex items-center gap-6" />
      <div className="flex items-center gap-4">
        {/* Status indicators */}
        <div className="mr-2 flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <StatusDot ok={asrCaps?.ffmpeg_ok === true} />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-notion-text-muted">FFmpeg</span>
          </div>
          <div className="flex items-center gap-1.5">
            <StatusDot ok={asrHealth === "ok" && asrCaps?.funasr_ready === true} />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-notion-text-muted">FunASR</span>
          </div>
        </div>

        {/* Search (placeholder) */}
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-notion-text-light">
            <Search className={`block ${LUCIDE_ICON_SIZE_MD}`} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
          </span>
          <input
            type="text"
            className="w-64 rounded-md border border-notion-border bg-notion-bg py-1.5 pl-9 pr-4 text-sm text-notion-text placeholder:text-notion-text-light focus:border-zen-saffron focus:outline-none focus:ring-2 focus:ring-zen-saffron/30"
            placeholder="Search transcripts..."
            readOnly
          />
        </div>

        {/* Notification (placeholder) */}
        <button
          type="button"
          className="relative rounded-full border-0 bg-transparent p-2 text-notion-text-muted outline-none transition-colors hover:bg-notion-sidebar-hover focus:outline-none"
        >
          <Bell className={LUCIDE_ICON_SIZE_LG} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border border-white bg-zen-cinnabar" aria-hidden />
        </button>

        {/* User avatar (placeholder) */}
        <UserAvatar />
      </div>
    </header>
  );
}
