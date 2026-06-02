import { useEffect, useMemo, useState } from "react";
import { Plus, Mic } from "lucide-react";
import { CONTROL_BTN_PRIMARY_PROMINENT } from "../config/controlStyles";
import type { ProjectControllerApi } from "../pages/useProjectController";
import { AsrErrorBanner } from "./ProjectStatusFeedback";
import { CreateProjectModal } from "./CreateProjectModal";
import { GlossaryPage } from "./GlossaryPage";
import { WelcomeSidebar } from "./WelcomeSidebar";
import { WelcomeTopBar } from "./WelcomeTopBar";

import type { WelcomePageId } from "./welcomeTypes";
import {
  listRecentWorkspaceFiles,
  recentProjectIdsForScan,
  type RecentWorkspaceFile,
} from "../services/lastWorkspace";
import { LUCIDE_ICON_SIZE_LG, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

export type { WelcomePageId } from "./welcomeTypes";

interface WelcomeViewProps {
  controller: ProjectControllerApi;
  onOpenSettings: () => void;
  page: WelcomePageId;
  onPageChange: (page: WelcomePageId) => void;
}

function formatProjectTime(ms: number) {
  return new Date(ms).toLocaleString();
}

function formatFileType(type: string) {
  if (type === "text") return "文本";
  if (type === "paired") return "音视频";
  if (type === "audio_only") return "音频";
  return type;
}

export function WelcomeView({ controller: c, onOpenSettings, page, onPageChange }: WelcomeViewProps) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [recentFiles, setRecentFiles] = useState<RecentWorkspaceFile[]>([]);
  const [loadingRecentFiles, setLoadingRecentFiles] = useState(false);

  const recentProjectIds = useMemo(() => recentProjectIdsForScan(c.projects), [c.projects]);

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
    <div className="grid h-full min-h-0 w-full grid-cols-[20rem_1fr]" data-purpose="welcome-view">
      <WelcomeSidebar
        controller={c}
        onOpenSettings={onOpenSettings}
        page={page}
        onPageChange={onPageChange}
      />

      <div className="flex min-h-0 min-w-0 flex-col bg-notion-bg">
        <WelcomeTopBar
          asrHealth={c.asrHealth}
          asrCaps={c.asrCaps}
          selectedHubModelId={c.localAsrModelCatalog.selectedHubModelId}
          catalogStatus={c.localAsrModelCatalog.catalogStatus}
        />

        {page === "glossary" ? (
          <GlossaryPage busy={c.busy} />
        ) : (
          <>
        {c.asrHealth === "error" ? (
          <div className="shrink-0 px-10 pt-4">
            <AsrErrorBanner onOpenEnvironment={onOpenSettings} />
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto bg-notion-bg p-10 pt-24">
          <div className="mx-auto flex w-full max-w-2xl flex-col items-center text-center">
            {/* Hero */}
            <section className="mb-12 text-center" data-purpose="hero-content">
              <h1 className="mb-2 font-serif text-[32px] font-medium leading-[1.3] tracking-[-0.01em] text-notion-text">
                欢迎回来
              </h1>
              <p className="text-sm text-notion-text-muted">继续您的转写任务或开始新的项目</p>
            </section>

            {/* Actions */}
            <div className="w-full max-w-sm space-y-4" data-purpose="welcome-actions">
              <button
                type="button"
                className={`${CONTROL_BTN_PRIMARY_PROMINENT} w-full gap-2`}
                disabled={c.busy}
                onClick={() => setShowCreateModal(true)}
              >
                <Plus className={LUCIDE_ICON_SIZE_LG} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
                <span>新建项目</span>
              </button>
            </div>

            <div className="mt-20 w-full rounded-md border border-notion-divider bg-notion-bg/70 p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-zen-saffron">
                    <Mic className={LUCIDE_ICON_SIZE_LG} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
                  </span>
                  <div className="text-left">
                    <h4 className="text-sm font-semibold text-notion-text">最近文件</h4>
                  </div>
                </div>
                <span className="text-[11px] text-notion-text-muted">{recentFiles.length} 个文件</span>
              </div>

              <div className="space-y-2">
                {loadingRecentFiles ? (
                  <p className="rounded-lg border border-dashed border-notion-divider bg-notion-bg px-3 py-6 text-center text-sm text-notion-text-muted">
                    正在加载最近文件...
                  </p>
                ) : recentFiles.length > 0 ? (
                  recentFiles.map((f) => (
                    <button
                      key={f.fileId}
                      type="button"
                      className="flex w-full items-center justify-between rounded-lg border border-notion-divider bg-notion-bg px-3 py-2 text-left transition-colors hover:bg-notion-sidebar-hover disabled:opacity-40"
                      disabled={c.busy}
                      onClick={() => void handleOpenRecentFile(f)}
                    >
                      <span className="min-w-0 flex-1 pr-3">
                        <span className="block truncate text-sm font-medium text-notion-text">{f.name}</span>
                        <span className="block text-[11px] text-notion-text-muted">
                          {formatFileType(f.fileType)} · {formatProjectTime(f.updatedAtMs)}
                        </span>
                      </span>
                      <span className="text-[11px] font-semibold text-zen-saffron">打开</span>
                    </button>
                  ))
                ) : (
                  <p className="rounded-lg border border-dashed border-notion-divider bg-notion-bg px-3 py-6 text-center text-sm text-notion-text-muted">
                    暂无最近文件，请先新建项目或导入文件。
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
          </>
        )}
      </div>

      {showCreateModal && page === "home" ? (
        <CreateProjectModal controller={c} onClose={() => setShowCreateModal(false)} />
      ) : null}
    </div>
  );
}
