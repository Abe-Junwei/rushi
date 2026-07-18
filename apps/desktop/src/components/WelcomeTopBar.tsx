import { CONTROL_BTN_ICON_GHOST } from "../config/controlStyles";
import { MAIN_SHELL_SURFACE_CLASS } from "../config/shellVisualTokens";
import type { ProjectControllerApi } from "../pages/useProjectController";
import type { AsrEnvPresentation } from "../services/asr/asrEnvStatus";
import { TranscribeTopStatusChips } from "./TranscribeTopStatusChips";
import { IconArrowLeft as ArrowLeft } from "@tabler/icons-react";
import { LlmTopStatusChip } from "./LlmTopStatusChip";
import { LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";
import { WelcomeActivityBell } from "./WelcomeActivityBell";
import {
  WelcomeSearchField,
  type WelcomeSearchController,
} from "./WelcomeSearchField";

export interface WelcomeTopBarProps {
  controller: ProjectControllerApi;
  asrPresentation: AsrEnvPresentation;
  llmStatusRefreshSeq?: number;
  onOpenAsrSettings?: () => void;
  onOpenOnlineSttSettings?: () => void;
  onOpenLlmSettings?: () => void;
  onCreateProject?: () => void;
  /** Hub：关闭当前项目并回到欢迎主页（所有项目）。 */
  onGoHome?: () => void;
  /** 首页 ledger 已挂搜索时传 null；热词页等仍用顶栏搜索。 */
  search?: WelcomeSearchController | null;
}

export function WelcomeTopBar({
  controller,
  asrPresentation,
  llmStatusRefreshSeq = 0,
  onOpenAsrSettings,
  onOpenOnlineSttSettings,
  onOpenLlmSettings,
  onCreateProject,
  onGoHome,
  search = null,
}: WelcomeTopBarProps) {
  const barDisabled = controller.busy;

  return (
    <header
      className={`flex h-12 shrink-0 items-center border-b ${MAIN_SHELL_SURFACE_CLASS.border} ${MAIN_SHELL_SURFACE_CLASS.pageBg} px-10 ${
        onGoHome ? "justify-between gap-4" : "justify-end"
      }`}
    >
      {onGoHome ? (
        <button
          type="button"
          className={`${CONTROL_BTN_ICON_GHOST} shadow-none`}
          disabled={barDisabled}
          onClick={onGoHome}
          title="关闭当前项目，返回主页"
          aria-label="关闭当前项目，返回主页"
          data-purpose="topbar-go-home"
        >
          <ArrowLeft className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
        </button>
      ) : null}
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

        {search ? <WelcomeSearchField search={search} disabled={barDisabled} /> : null}

        <WelcomeActivityBell
          controller={controller}
          disabled={barDisabled}
          onOpenAsrSettings={onOpenAsrSettings}
          onOpenOnlineSttSettings={onOpenOnlineSttSettings}
          onCreateProject={onCreateProject}
          onPanelOpen={search?.closeSearch}
        />
      </div>
    </header>
  );
}
