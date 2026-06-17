import { CONTROL_TEXT_INPUT } from "../config/controlStyles";
import type { AsrEnvPresentation } from "../services/asr/asrEnvStatus";
import { AsrTopStatusChips } from "./AsrTopStatusChips";
import { Bell, Search } from "lucide-react";
import { LlmTopStatusChip } from "./LlmTopStatusChip";
import { LUCIDE_ICON_SIZE_LG, LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

function UserAvatar() {
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full border border-notion-border bg-notion-sidebar-active text-label font-semibold text-notion-text-muted">
      用
    </div>
  );
}

export interface WelcomeTopBarProps {
  asrPresentation: AsrEnvPresentation;
  llmStatusRefreshSeq?: number;
  onOpenAsrSettings?: () => void;
  onOpenLlmSettings?: () => void;
}

export function WelcomeTopBar({
  asrPresentation,
  llmStatusRefreshSeq = 0,
  onOpenAsrSettings,
  onOpenLlmSettings,
}: WelcomeTopBarProps) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-notion-divider bg-notion-bg px-10">
      <div className="flex items-center gap-6" />
      <div className="flex items-center gap-4">
        <div className="mr-2 flex items-center gap-4">
          <AsrTopStatusChips
            presentation={asrPresentation}
            onOpenAsrSettings={onOpenAsrSettings}
          />
          {onOpenLlmSettings ? (
            <LlmTopStatusChip refreshSeq={llmStatusRefreshSeq} onOpenLlmSettings={onOpenLlmSettings} />
          ) : null}
        </div>

        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-notion-text-light">
            <Search className={`block ${LUCIDE_ICON_SIZE_MD}`} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
          </span>
          <input
            type="text"
            className={`w-64 pl-9 pr-4 ${CONTROL_TEXT_INPUT}`}
            placeholder="搜索转写内容..."
            readOnly
          />
        </div>

        <button
          type="button"
          className="relative rounded-full border-0 bg-transparent p-2 text-notion-text-muted outline-none transition-colors hover:bg-notion-sidebar-hover focus:outline-none"
        >
          <Bell className={LUCIDE_ICON_SIZE_LG} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border border-notion-bg bg-zen-cinnabar" aria-hidden />
        </button>

        <UserAvatar />
      </div>
    </header>
  );
}
