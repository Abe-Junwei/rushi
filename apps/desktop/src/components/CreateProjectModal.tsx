import { useState, useCallback } from "react";
import { FileAudio, FileText } from "lucide-react";
import { PANEL_CONTROL_TYPOGRAPHY, PANEL_TYPOGRAPHY } from "../config/typography";
import type { ProjectControllerApi } from "../pages/useProjectController";
import * as fileApi from "../tauri/fileApi";
import { FloatingPanelTemplate } from "./PanelTemplate";
import { LUCIDE_ICON_SIZE_MD, LUCIDE_ICON_STROKE_WIDTH } from "./lucideIconSpec";

interface CreateProjectModalProps {
  controller: ProjectControllerApi;
  onClose: () => void;
}

export function CreateProjectModal({ controller: c, onClose }: CreateProjectModalProps) {
  const [name, setName] = useState(c.newName);
  const [busy, setBusy] = useState(false);
  const isBusy = busy || c.busy;
  const projectName = name.trim() || "未命名项目";

  const runCreate = useCallback(async (action: () => Promise<boolean>) => {
    setBusy(true);
    c.setNewName(name);
    try {
      const created = await action();
      if (created) onClose();
    } catch (e) {
      c.setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [c, name, onClose]);

  const createEmpty = useCallback(async () => {
    await runCreate(async () => {
      const raw = await fileApi.createEmptyProject(projectName);
      const detail = await fileApi.adaptToLegacyProjectDetail(raw);
      c.applyDetail(detail);
      await c.refreshProjects();
      return true;
    });
  }, [c, projectName, runCreate]);

  const createFromAudio = useCallback(async () => {
    await runCreate(async () => {
      const srcPath = await fileApi.pickAudioPath();
      if (!srcPath) return false;
      const raw = await fileApi.createProjectFromAudio(projectName, srcPath);
      const detail = await fileApi.adaptToLegacyProjectDetail(raw);
      c.applyDetail(detail);
      await c.refreshProjects();
      return true;
    });
  }, [c, projectName, runCreate]);

  const createFromText = useCallback(async () => {
    await runCreate(async () => {
      const srcPath = await fileApi.pickTextPath();
      if (!srcPath) return false;
      const raw = await fileApi.createProjectFromText(projectName, srcPath);
      const detail = await fileApi.adaptToLegacyProjectDetail(raw);
      c.applyDetail(detail);
      await c.refreshProjects();
      return true;
    });
  }, [c, projectName, runCreate]);

  return (
    <FloatingPanelTemplate id="create-project-modal-v1" title="新建项目" preset="createProject" onClose={onClose}>
      <div className="px-6 py-5">
          <form className="space-y-6" onSubmit={(e) => {
            e.preventDefault();
            void createEmpty();
          }}>
            <label className="block">
              <span className={`mb-1.5 block ${PANEL_TYPOGRAPHY.fieldLabel}`}>
              项目名称
              </span>
              <input
                type="text"
                className={`w-full rounded-lg border border-notion-border bg-notion-bg px-3 py-2 ${PANEL_CONTROL_TYPOGRAPHY.compactInput} shadow-none outline-none transition-colors focus:border-zen-saffron focus:ring-2 focus:ring-zen-saffron/30 disabled:opacity-40`}
                placeholder="未命名项目"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isBusy}
                autoComplete="off"
              />
            </label>

            <button
              type="submit"
              className={`flex w-full items-center justify-center rounded-lg border border-transparent bg-zen-saffron px-4 py-2 ${PANEL_TYPOGRAPHY.button} text-notion-bg transition-colors hover:bg-zen-saffron-mid focus:outline-none focus:ring-2 focus:ring-zen-saffron/50 focus:ring-offset-1 disabled:opacity-40`}
              disabled={isBusy}
            >
              {busy ? "创建中…" : "创建项目"}
            </button>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center" aria-hidden>
                <div className="w-full border-t border-notion-divider" />
              </div>
              <div className="relative flex justify-center">
                <span className={`bg-notion-bg px-2 ${PANEL_TYPOGRAPHY.meta}`}>或同时导入文件</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                className={`flex items-center justify-center gap-2 rounded-lg border border-notion-border bg-notion-sidebar px-3 py-2 ${PANEL_TYPOGRAPHY.button} text-notion-text transition-colors hover:bg-notion-sidebar-hover focus:outline-none focus:ring-2 focus:ring-zen-saffron/30 disabled:opacity-40`}
                disabled={isBusy}
                onClick={() => void createFromAudio()}
              >
                <FileAudio className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
                <span>导入音频</span>
              </button>
              <button
                type="button"
                className={`flex items-center justify-center gap-2 rounded-lg border border-notion-border bg-notion-sidebar px-3 py-2 ${PANEL_TYPOGRAPHY.button} text-notion-text transition-colors hover:bg-notion-sidebar-hover focus:outline-none focus:ring-2 focus:ring-zen-saffron/30 disabled:opacity-40`}
                disabled={isBusy}
                onClick={() => void createFromText()}
              >
                <FileText className={LUCIDE_ICON_SIZE_MD} strokeWidth={LUCIDE_ICON_STROKE_WIDTH} aria-hidden />
                <span>导入文本文件</span>
              </button>
            </div>
          </form>

          <div className="mt-8 flex justify-end">
            <button
              type="button"
              className={`border-0 bg-transparent ${PANEL_TYPOGRAPHY.button} text-notion-text-muted transition-colors hover:text-notion-text focus:outline-none disabled:opacity-40`}
              onClick={onClose}
              disabled={isBusy}
            >
              取消
            </button>
          </div>
        </div>
    </FloatingPanelTemplate>
  );
}
