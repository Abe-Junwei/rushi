import type { AsrHealthCapabilities } from "../tauri/projectApi";
import type { AsrHealthState } from "../pages/useAsrBridgeController";
import type { LocalAsrCatalogStatusItem } from "../services/asr/localAsrModelCatalog";
import { computeLocalAsrTranscribeReady } from "../services/asr/localAsrModelCatalog";
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
  selectedHubModelId?: string;
  catalogStatus?: LocalAsrCatalogStatusItem[] | null;
}

export function WelcomeTopBar({ asrHealth, asrCaps, selectedHubModelId, catalogStatus }: WelcomeTopBarProps) {
  const { ready: transcribeReady } = computeLocalAsrTranscribeReady({
    asrHealth,
    asrCaps,
    selectedHubModelId,
    catalogStatus,
  });
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-notion-divider bg-notion-bg px-10">
      <div className="flex items-center gap-6" />
      <div className="flex items-center gap-4">
        {/* Status indicators */}
        <div className="mr-2 flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <StatusDot ok={asrCaps?.ffmpeg_ok === true} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-notion-text-muted">FFmpeg</span>
          </div>
          <div className="flex items-center gap-1.5">
            <StatusDot ok={transcribeReady} />
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-notion-text-muted">ASR Ready</span>
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
            placeholder="搜索转写内容..."
            readOnly
          />
        </div>

        {/* Notification (placeholder) */}
        <button
          type="button"
          className="relative rounded-full border-0 bg-transparent p-2 text-notion-text-muted outline-none transition-colors hover:bg-notion-sidebar-hover focus:outline-none"
        >
          <Bell className={LUCIDE_ICON_SIZE_LG} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border border-notion-bg bg-zen-cinnabar" aria-hidden />
        </button>

        {/* User avatar (placeholder) */}
        <UserAvatar />
      </div>
    </header>
  );
}
