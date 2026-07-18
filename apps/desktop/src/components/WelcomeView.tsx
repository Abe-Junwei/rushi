import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  IconDownload as Download,
  IconPlus as Plus,
} from "@tabler/icons-react";
import {
  CONTROL_BTN_PRIMARY_PROMINENT,
  CONTROL_BTN_SECONDARY_PROMINENT,
} from "../config/controlStyles";
import {
  WELCOME_HOME_STACK_GAP,
  WORKSPACE_HOME_SHELL_PURPOSE,
  WORKSPACE_PAGE_PANEL_CLASS,
} from "../config/workspaceShellLayout";
import type { ProjectControllerApi } from "../pages/useProjectController";
import { AsrErrorBanner, OnlineSttEnvBanner } from "./ProjectStatusFeedback";
import { useOnlineSttTopBarPresentation } from "../hooks/useOnlineSttTopBarPresentation";
import { resolveEffectiveTranscribeSource } from "../services/stt/transcribeSourcePresentation";
import { CreateProjectModal } from "./CreateProjectModal";
import { GlossaryPage } from "./GlossaryPage";
import { WelcomeFileLedger, type WelcomeLedgerTabId } from "./WelcomeFileLedger";
import { WelcomeSidebar } from "./WelcomeSidebar";
import { WelcomeTopBar } from "./WelcomeTopBar";
import { WorkspaceHomeMainStage } from "./WorkspaceHomeMainStage";
import { WorkspaceProjectLibrary } from "./WorkspaceProjectLibrary";
import { WorkspaceShellLayout } from "./WorkspaceShellLayout";
import { useWelcomeProjectTree } from "../hooks/useWelcomeProjectTree";
import {
  registerProjectFilesCacheInvalidator,
  registerRecentWorkspaceFilesRefresh,
} from "../services/projectFilesCacheBridge";
import { sortWelcomeProjects } from "./welcomeSidebarFormatters";

import type { GlossaryWorkspaceId } from "./glossary/glossaryWorkspaceTypes";
import type { WelcomePageId } from "./welcomeTypes";
import {
  hasScannableWorkspaceFiles,
  listRecentWorkspaceFiles,
  recentProjectIdsForScan,
  type RecentWorkspaceFile,
} from "../services/lastWorkspace";
import { LUCIDE_ICON_SIZE_LG, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";
import { useOnboardingChecklistController } from "../hooks/useOnboardingChecklistController";
import { useWelcomeSearchController } from "../hooks/useWelcomeSearchController";
import { WelcomeOnboardingChecklist } from "./WelcomeOnboardingChecklist";

export type { WelcomePageId } from "./welcomeTypes";

interface WelcomeViewProps {
  controller: ProjectControllerApi;
  onOpenSettings: () => void;
  onOpenAsrSettings?: () => void;
  onOpenOnlineSttSettings?: () => void;
  onOpenLlmSettings?: () => void;
  llmStatusRefreshSeq?: number;
  page: WelcomePageId;
  onPageChange: (page: WelcomePageId) => void;
  ledgerTab: WelcomeLedgerTabId;
  onLedgerTabChange: (tab: WelcomeLedgerTabId) => void;
  onGoProjectsLibrary: () => void;
  glossaryWorkspaceId: GlossaryWorkspaceId;
  onGlossaryWorkspaceChange: (id: GlossaryWorkspaceId) => void;
  /** Hub 旁路时转写进度条等（主列 TopBar 之上） */
  headerSlot?: ReactNode;
}


export function WelcomeView({
  controller: c,
  onOpenSettings,
  onOpenAsrSettings,
  onOpenOnlineSttSettings,
  onOpenLlmSettings,
  llmStatusRefreshSeq = 0,
  page,
  onPageChange,
  ledgerTab,
  onLedgerTabChange,
  onGoProjectsLibrary,
  glossaryWorkspaceId,
  onGlossaryWorkspaceChange,
  headerSlot,
}: WelcomeViewProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [recentFiles, setRecentFiles] = useState<RecentWorkspaceFile[]>([]);
  const [loadingRecentFiles, setLoadingRecentFiles] = useState(false);
  const onboarding = useOnboardingChecklistController();
  const welcomeSearch = useWelcomeSearchController(c);
  const onlineSttPresentation = useOnlineSttTopBarPresentation(c.sttOnlineRuntimeEpoch);
  const effectiveTranscribeSource = resolveEffectiveTranscribeSource(c.transcribeSource);
  const projects = useMemo(() => sortWelcomeProjects(c.projects), [c.projects]);
  const projectTree = useWelcomeProjectTree(c);

  useEffect(() => {
    registerProjectFilesCacheInvalidator(projectTree.invalidateProjectFilesCaches);
    return () => registerProjectFilesCacheInvalidator(null);
  }, [projectTree.invalidateProjectFilesCaches]);

  const welcomeEnvBanner = (() => {
    if (effectiveTranscribeSource === "online") {
      if (onlineSttPresentation.chipOk || onlineSttPresentation.tone === "idle") return null;
      if (onlineSttPresentation.tone !== "warn" && onlineSttPresentation.tone !== "error") return null;
      return (
        <div className="shrink-0 px-8 pt-4 sm:px-10">
          <OnlineSttEnvBanner
            title={onlineSttPresentation.bannerTitle}
            detail={onlineSttPresentation.bannerDetail}
            tone={onlineSttPresentation.tone}
            onOpenOnlineSttSettings={onOpenOnlineSttSettings ?? onOpenSettings}
          />
        </div>
      );
    }
    if (c.asrPresentation.health !== "error") return null;
    return (
      <div className="shrink-0 px-8 pt-4 sm:px-10">
        <AsrErrorBanner
          message={c.asrPresentation.errorBannerMessage}
          detail={c.asrPresentation.errorDetail}
          onOpenEnvironment={onOpenAsrSettings ?? onOpenSettings}
        />
      </div>
    );
  })();

  const recentProjectIds = useMemo(() => recentProjectIdsForScan(c.projects), [c.projects]);

  const shouldFetchRecentFiles = useMemo(
    () => recentProjectIds.length > 0 && hasScannableWorkspaceFiles(c.projects),
    [recentProjectIds, c.projects],
  );

  const [recentRefreshEpoch, setRecentRefreshEpoch] = useState(0);
  const recentFetchGenRef = useRef(0);

  const reloadRecentFiles = useCallback(() => {
    setRecentRefreshEpoch((n) => n + 1);
  }, []);

  useEffect(() => {
    registerRecentWorkspaceFilesRefresh(reloadRecentFiles);
    return () => registerRecentWorkspaceFilesRefresh(null);
  }, [reloadRecentFiles]);

  useEffect(() => {
    const gen = ++recentFetchGenRef.current;
    void (async () => {
      if (!shouldFetchRecentFiles) {
        if (gen === recentFetchGenRef.current) {
          setRecentFiles([]);
          setLoadingRecentFiles(false);
        }
        return;
      }
      setLoadingRecentFiles(true);
      try {
        const merged = await listRecentWorkspaceFiles(recentProjectIds, 8);
        if (gen === recentFetchGenRef.current) setRecentFiles(merged);
      } catch {
        if (gen === recentFetchGenRef.current) setRecentFiles([]);
      } finally {
        if (gen === recentFetchGenRef.current) setLoadingRecentFiles(false);
      }
    })();
  }, [recentProjectIds, shouldFetchRecentFiles, recentRefreshEpoch]);

  // Hub↔welcome 不卸载 WelcomeView：切回「最近」或离开项目时重刷 stage。
  const prevLedgerTabRef = useRef(ledgerTab);
  useEffect(() => {
    const prev = prevLedgerTabRef.current;
    prevLedgerTabRef.current = ledgerTab;
    if (prev !== "recent" && ledgerTab === "recent") {
      reloadRecentFiles();
    }
  }, [ledgerTab, reloadRecentFiles]);

  const prevCurrentIdRef = useRef(c.current?.id ?? null);
  useEffect(() => {
    const next = c.current?.id ?? null;
    const prev = prevCurrentIdRef.current;
    prevCurrentIdRef.current = next;
    if (prev && !next) {
      reloadRecentFiles();
    }
  }, [c.current?.id, reloadRecentFiles]);

  const handleOpenRecentFile = async (item: RecentWorkspaceFile) => {
    await c.openWorkspaceFile(item.projectId, item.fileId);
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
          onGoProjectsLibrary={onGoProjectsLibrary}
          glossaryWorkspaceId={glossaryWorkspaceId}
          onGlossaryWorkspaceChange={onGlossaryWorkspaceChange}
          onRestoreOnboardingChecklist={onboarding.restore}
          onboardingChecklistDismissed={!onboarding.visible}
        />
      }
    >
        {headerSlot}
        <WelcomeTopBar
          controller={c}
          asrPresentation={c.asrPresentation}
          llmStatusRefreshSeq={llmStatusRefreshSeq}
          onOpenAsrSettings={onOpenAsrSettings ?? onOpenSettings}
          onOpenOnlineSttSettings={onOpenOnlineSttSettings ?? onOpenSettings}
          onOpenLlmSettings={onOpenLlmSettings ?? onOpenSettings}
          onCreateProject={() => setShowCreateModal(true)}
          search={page === "glossary" ? welcomeSearch : null}
        />

        {page === "glossary" ? (
          <GlossaryPage busy={c.busy} workspaceId={glossaryWorkspaceId} />
        ) : (
          <WorkspaceHomeMainStage beforePage={welcomeEnvBanner}>
            <section
              className={`${WORKSPACE_PAGE_PANEL_CLASS} ${WELCOME_HOME_STACK_GAP} min-h-0 flex-1`}
              data-purpose="welcome-home-page"
            >
              <header className="flex shrink-0 flex-col items-center gap-4 text-center" data-purpose="hero-content">
                <div className="flex flex-col gap-2">
                  <h1 className="text-display font-semibold leading-[1.25] tracking-[-0.015em] text-notion-text">
                    欢迎回来
                  </h1>
                  <p className="text-sm leading-relaxed text-notion-text-muted">
                    继续您的转写，或从内容包恢复项目
                  </p>
                </div>
                <div
                  className="flex flex-wrap items-center justify-center gap-2"
                  data-purpose="welcome-cta-row"
                >
                  <button
                    type="button"
                    className={`${CONTROL_BTN_PRIMARY_PROMINENT} w-[12.5rem] gap-2`}
                    disabled={c.busy}
                    onClick={() => setShowCreateModal(true)}
                    data-purpose="welcome-actions"
                  >
                    <Plus className={LUCIDE_ICON_SIZE_LG} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
                    <span>新建项目</span>
                  </button>
                  <span className="text-sm text-notion-text-muted" aria-hidden>
                    或
                  </span>
                  <button
                    type="button"
                    className={`${CONTROL_BTN_SECONDARY_PROMINENT} w-[12.5rem] gap-2`}
                    disabled={c.busy}
                    onClick={() => {
                      void (async () => {
                        try {
                          await c.importProjectBundle();
                        } catch (e) {
                          c.setError(e instanceof Error ? e.message : String(e));
                        }
                      })();
                    }}
                    data-purpose="welcome-import-bundle"
                    aria-label="导入内容包"
                  >
                    <Download
                      className={LUCIDE_ICON_SIZE_LG}
                      strokeWidth={LUCIDE_ICON_STROKE_WIDTH}
                      aria-hidden
                    />
                    <span>导入内容包</span>
                  </button>
                </div>
              </header>

              {onboarding.visible ? (
                <div className="shrink-0">
                  <WelcomeOnboardingChecklist
                    progress={onboarding.progress}
                    onDismiss={onboarding.dismiss}
                    transcribeSource={effectiveTranscribeSource}
                    onOpenAsrSettings={onOpenAsrSettings ?? onOpenSettings}
                    onOpenOnlineSttSettings={onOpenOnlineSttSettings ?? onOpenSettings}
                    onCreateProject={() => setShowCreateModal(true)}
                    onOpenLastEditor={() => void c.openLastEditorWorkspace()}
                  />
                </div>
              ) : null}

              <WelcomeFileLedger
                activeTab={ledgerTab}
                onTabChange={onLedgerTabChange}
                files={recentFiles}
                loading={loadingRecentFiles}
                busy={c.busy}
                onOpenFile={(f) => void handleOpenRecentFile(f)}
                search={welcomeSearch}
                allFilesContent={
                  <WorkspaceProjectLibrary
                    controller={c}
                    projects={projects}
                    expandedProjectId={projectTree.expandedProjectId}
                    projectFilesById={projectTree.projectFilesById}
                    loadingFilesById={projectTree.loadingFilesById}
                    onOpenProjectFile={(projectId, fileId) =>
                      void projectTree.handleOpenProjectFile(projectId, fileId)
                    }
                    onToggleProjectExpanded={projectTree.toggleProjectExpanded}
                  />
                }
              />
            </section>
          </WorkspaceHomeMainStage>
        )}

      {showCreateModal && page === "home" ? (
        <CreateProjectModal controller={c} onClose={() => setShowCreateModal(false)} />
      ) : null}
    </WorkspaceShellLayout>
  );
}
