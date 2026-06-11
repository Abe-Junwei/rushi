import type { ReactNode } from "react";
import type { ProjectControllerApi } from "../pages/useProjectController";
import type { WelcomePageId } from "./welcomeTypes";
import { EmptyProjectPanel } from "./EmptyProjectPanel";
import { ProjectFilesHubPanel } from "./ProjectFilesHubPanel";
import { WelcomeSidebar } from "./WelcomeSidebar";
import { WelcomeTopBar } from "./WelcomeTopBar";
import { WorkspaceHomeMainStage } from "./WorkspaceHomeMainStage";
import { WorkspaceShellLayout } from "./WorkspaceShellLayout";
import { WORKSPACE_HOME_SHELL_PURPOSE } from "../config/workspaceShellLayout";

interface ProjectHubViewProps {
  controller: ProjectControllerApi;
  onOpenSettings: () => void;
  onOpenAsrSettings?: () => void;
  onOpenLlmSettings?: () => void;
  llmStatusRefreshSeq?: number;
  onLeaveProjectForWelcome: (page: WelcomePageId) => void;
  /** 转写进度条等，仅渲染于右侧主列 TopBar 之上 */
  headerSlot?: ReactNode;
}

/** 项目 Hub — 壳层与 WelcomeView 完全一致，仅主区内容不同 */
export function ProjectHubView({
  controller: c,
  onOpenSettings,
  onOpenAsrSettings,
  onOpenLlmSettings,
  llmStatusRefreshSeq = 0,
  onLeaveProjectForWelcome,
  headerSlot,
}: ProjectHubViewProps) {
  const hasProjectFiles = (c.current?.files ?? []).length > 0;

  return (
    <WorkspaceShellLayout
      purpose={WORKSPACE_HOME_SHELL_PURPOSE}
      sidebar={
        <WelcomeSidebar
          controller={c}
          onOpenSettings={onOpenSettings}
          page="home"
          onPageChange={(page) => {
            if (page !== "home") onLeaveProjectForWelcome(page);
          }}
          hubMode
          activeProjectId={c.current?.id ?? null}
          onLeaveProjectForWelcome={onLeaveProjectForWelcome}
        />
      }
    >
      {headerSlot}
      <WelcomeTopBar
        asrPresentation={c.asrPresentation}
        llmStatusRefreshSeq={llmStatusRefreshSeq}
        onOpenAsrSettings={onOpenAsrSettings ?? onOpenSettings}
        onOpenLlmSettings={onOpenLlmSettings ?? onOpenSettings}
      />

      <WorkspaceHomeMainStage stagePurpose="project-files-hub">
        {hasProjectFiles ? (
          <ProjectFilesHubPanel controller={c} />
        ) : (
          <EmptyProjectPanel controller={c} />
        )}
      </WorkspaceHomeMainStage>
    </WorkspaceShellLayout>
  );
}
