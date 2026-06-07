import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { CONTROL_BTN_PRIMARY_PROMINENT } from "../config/controlStyles";
import { PANEL_TYPOGRAPHY } from "../config/typography";
import {
  WORKSPACE_HOME_SHELL_PURPOSE,
  WORKSPACE_PAGE_PANEL_CLASS,
} from "../config/workspaceShellLayout";
import type { ProjectControllerApi } from "../pages/useProjectController";
import { AsrErrorBanner } from "./ProjectStatusFeedback";
import { WorkspaceFileRow } from "./WorkspaceFileRow";
import { CreateProjectModal } from "./CreateProjectModal";
import { GlossaryPage } from "./GlossaryPage";
import { QualityPage } from "./QualityPage";
import { WelcomeSidebar } from "./WelcomeSidebar";
import { WelcomeTopBar } from "./WelcomeTopBar";
import { WorkspaceHomeMainStage } from "./WorkspaceHomeMainStage";
import { WorkspaceShellLayout } from "./WorkspaceShellLayout";

import type { WelcomePageId } from "./welcomeTypes";
import {
  listRecentWorkspaceFiles,
  recentProjectIdsForScan,
  type RecentWorkspaceFile,
} from "../services/lastWorkspace";
import { LUCIDE_ICON_SIZE_LG, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";
import { formatProjectFileType, formatWorkspaceFileTime } from "../utils/projectFileDisplay";

export type { WelcomePageId } from "./welcomeTypes";

interface WelcomeViewProps {
  controller: ProjectControllerApi;
  onOpenSettings: () => void;
  onOpenLlmSettings?: () => void;
  llmStatusRefreshSeq?: number;
  page: WelcomePageId;
  onPageChange: (page: WelcomePageId) => void;
}


export function WelcomeView({
  controller: c,
  onOpenSettings,
  onOpenLlmSettings,
  llmStatusRefreshSeq = 0,
  page,
  onPageChange,
}: WelcomeViewProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [recentFiles, setRecentFiles] = useState<RecentWorkspaceFile[]>([]);
  const [loadingRecentFiles, setLoadingRecentFiles] = useState(false);

  const recentProjectIds = useMemo(() => recentProjectIdsForScan(c.projects), [c.projects]);

  const projectNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of c.projects) {
      map.set(p.id, p.name);
    }
    return map;
  }, [c.projects]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (recentProjectIds.length === 0) {
        setRecentFiles([]);
        return;
      }
      setLoadingRecentFiles(true);
      try {
        const merged = await listRecentWorkspaceFiles(recentProjectIds, 8);
        if (!cancelled) setRecentFiles(merged);
      } catch {
        if (!cancelled) setRecentFiles([]);
      } finally {
        if (!cancelled) setLoadingRecentFiles(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [recentProjectIds]);

  const handleOpenRecentFile = async (item: RecentWorkspaceFile) => {
    if (c.current?.id !== item.projectId) {
      await c.loadProject(item.projectId);
    }
    await c.openFile(item.fileId);
  };

  return (
    <WorkspaceShellLayout
      purpose={WORKSPACE_HOME_SHELL_PURPOSE}
      sidebar={
        <WelcomeSidebar
          controller={c}
          onOpenSettings={onOpenSettings}
          page={page}
          onPageChange={onPageChange}
        />
      }
    >
        <WelcomeTopBar
          asrPresentation={c.asrPresentation}
          llmStatusRefreshSeq={llmStatusRefreshSeq}
          onOpenLlmSettings={onOpenLlmSettings ?? onOpenSettings}
        />

        {page === "glossary" ? (
          <GlossaryPage busy={c.busy} />
        ) : page === "quality" ? (
          <QualityPage busy={c.busy} />
        ) : (
          <WorkspaceHomeMainStage
            beforePage={
              c.asrPresentation.health === "error" ? (
                <div className="shrink-0 px-8 pt-4 sm:px-10">
                  <AsrErrorBanner
                    message={c.asrPresentation.errorBannerMessage}
                    detail={c.asrPresentation.errorDetail}
                    onOpenEnvironment={onOpenSettings}
                  />
                </div>
              ) : null
            }
          >
            <section
              className={`${WORKSPACE_PAGE_PANEL_CLASS} gap-6`}
              data-purpose="welcome-home-page"
            >
              <header className="flex flex-col items-center gap-4 text-center" data-purpose="hero-content">
                <div>
                  <h1 className="text-[28px] font-semibold leading-[1.25] tracking-[-0.015em] text-notion-text">
                    欢迎回来
                  </h1>
                  <p className="mt-2 text-sm leading-relaxed text-notion-text-muted">
                    继续您的转写任务或开始新的项目
                  </p>
                </div>
                <button
                  type="button"
                  className={`${CONTROL_BTN_PRIMARY_PROMINENT} w-full max-w-[320px] gap-2`}
                  disabled={c.busy}
                  onClick={() => setShowCreateModal(true)}
                  data-purpose="welcome-actions"
                >
                  <Plus className={LUCIDE_ICON_SIZE_LG} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
                  <span>新建项目</span>
                </button>
              </header>

              <section className="flex flex-col gap-2" aria-label="最近文件">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-[13px] font-medium text-notion-text-muted">最近文件</h2>
                  <span className={`${PANEL_TYPOGRAPHY.meta} tabular-nums text-notion-text-muted`}>
                    {loadingRecentFiles ? "…" : `${recentFiles.length} 个文件`}
                  </span>
                </div>

                <ul className="space-y-1">
                  {loadingRecentFiles ? (
                    <li>
                      <p className="rounded-md bg-notion-sidebar/55 px-2.5 py-4 text-sm text-notion-text-muted">
                        正在加载最近文件…
                      </p>
                    </li>
                  ) : recentFiles.length > 0 ? (
                    recentFiles.map((f) => (
                      <li key={f.fileId}>
                        <WorkspaceFileRow
                          name={f.name}
                          meta={`${formatProjectFileType(f.fileType)} · ${projectNameMap.get(f.projectId) ?? "未知项目"} · ${formatWorkspaceFileTime(f.updatedAtMs)}`}
                          fileType={f.fileType}
                          busy={c.busy}
                          onOpen={() => handleOpenRecentFile(f)}
                        />
                      </li>
                    ))
                  ) : (
                    <li>
                      <p className="rounded-md bg-notion-sidebar/55 px-2.5 py-4 text-sm text-notion-text-muted">
                        暂无最近文件，请先新建项目或导入文件。
                      </p>
                    </li>
                  )}
                </ul>
              </section>
            </section>
          </WorkspaceHomeMainStage>
        )}

      {showCreateModal && page === "home" ? (
        <CreateProjectModal controller={c} onClose={() => setShowCreateModal(false)} />
      ) : null}
    </WorkspaceShellLayout>
  );
}
