import { CONTROL_TEXT_INPUT } from "../config/controlStyles";
import { MAIN_SHELL_SURFACE_CLASS } from "../config/shellVisualTokens";
import { useWelcomeSearchController } from "../hooks/useWelcomeSearchController";
import { requestCloseActivityInbox } from "../services/ui/activityInboxEvents";
import type { ProjectControllerApi } from "../pages/useProjectController";
import type { AsrEnvPresentation } from "../services/asr/asrEnvStatus";
import { TranscribeTopStatusChips } from "./TranscribeTopStatusChips";
import {
  IconSearch as Search,
} from "@tabler/icons-react";
import { LlmTopStatusChip } from "./LlmTopStatusChip";
import { LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";
import { WelcomeActivityBell } from "./WelcomeActivityBell";
import { WelcomeSearchResults } from "./WelcomeSearchResults";

export interface WelcomeTopBarProps {
  controller: ProjectControllerApi;
  asrPresentation: AsrEnvPresentation;
  llmStatusRefreshSeq?: number;
  onOpenAsrSettings?: () => void;
  onOpenOnlineSttSettings?: () => void;
  onOpenLlmSettings?: () => void;
  onCreateProject?: () => void;
}

export function WelcomeTopBar({
  controller,
  asrPresentation,
  llmStatusRefreshSeq = 0,
  onOpenAsrSettings,
  onOpenOnlineSttSettings,
  onOpenLlmSettings,
  onCreateProject,
}: WelcomeTopBarProps) {
  const search = useWelcomeSearchController(controller);
  const searchDisabled = controller.busy;

  return (
    <header className={`flex h-12 shrink-0 items-center justify-end border-b ${MAIN_SHELL_SURFACE_CLASS.border} ${MAIN_SHELL_SURFACE_CLASS.pageBg} px-10`}>
      <div className="flex items-center gap-4">
        <div className="mr-2 flex items-center gap-4">
          <TranscribeTopStatusChips
            transcribeSource={controller.transcribeSource}
            asrPresentation={asrPresentation}
            sttOnlineRefreshSeq={controller.sttOnlineRuntimeEpoch}
            onOpenAsrSettings={onOpenAsrSettings}
            onOpenOnlineSttSettings={onOpenOnlineSttSettings}
          />
          {onOpenLlmSettings ? (
            <LlmTopStatusChip refreshSeq={llmStatusRefreshSeq} onOpenLlmSettings={onOpenLlmSettings} />
          ) : null}
        </div>

        <div ref={search.searchRootRef} className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-notion-text-light">
            <Search className={`block ${LUCIDE_ICON_SIZE_MD}`} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
          </span>
          <input
            type="search"
            className={`w-64 pl-9 pr-4 ${CONTROL_TEXT_INPUT}`}
            placeholder="搜索文件与转写内容…"
            disabled={searchDisabled}
            value={search.query}
            aria-expanded={search.showPanel}
            aria-controls="welcome-search-panel"
            aria-activedescendant={
              search.activeIndex >= 0 ? `welcome-search-item-${search.activeIndex}` : undefined
            }
            onFocus={() => {
              requestCloseActivityInbox();
              search.setOpen(true);
            }}
            onChange={(e) => {
              search.setQuery(e.target.value);
              search.setOpen(true);
            }}
            onKeyDown={search.handleInputKeyDown}
          />
          {search.showPanel ? (
            <div id="welcome-search-panel">
              <WelcomeSearchResults
                scope={search.scope}
                queryEmpty={search.queryEmpty}
                scopeDisabled={searchDisabled}
                loading={search.loading}
                error={search.error}
                fileResults={search.fileResults}
                contentResults={search.contentResults}
                recentQueries={search.recentQueries}
                navItems={search.navItems}
                activeIndex={search.activeIndex}
                onScopeChange={search.setScope}
                onFileSelect={(hit) => void search.navigateToFileHub(hit)}
                onFileOpen={(hit) => void search.openFileFromSearch(hit)}
                onContentSelect={(hit) => void search.navigateToContentHit(hit)}
                onRecentQuerySelect={(q) => {
                  search.setQuery(q);
                  search.setOpen(true);
                }}
              />
            </div>
          ) : null}
        </div>

        <WelcomeActivityBell
          controller={controller}
          disabled={searchDisabled}
          onOpenAsrSettings={onOpenAsrSettings}
          onOpenOnlineSttSettings={onOpenOnlineSttSettings}
          onCreateProject={onCreateProject}
          onPanelOpen={search.closeSearch}
        />

      </div>
    </header>
  );
}
