import { useCallback, useEffect, useState } from "react";
import type { ProjectControllerApi } from "../pages/useProjectController";
import * as fileApi from "../tauri/fileApi";

export function useWelcomeSidebarProjectTree(
  c: ProjectControllerApi,
  options: {
    hubMode: boolean;
    editorMode: boolean;
    activeProjectId: string | null;
  },
) {
  const { hubMode, editorMode, activeProjectId } = options;
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [projectFilesById, setProjectFilesById] = useState<Record<string, fileApi.FileSummary[]>>({});
  const [loadingFilesById, setLoadingFilesById] = useState<Record<string, boolean>>({});

  const ensureProjectFilesLoaded = useCallback(async (projectId: string) => {
    if (projectFilesById[projectId] || loadingFilesById[projectId]) return;
    setLoadingFilesById((prev) => ({ ...prev, [projectId]: true }));
    try {
      const files = await fileApi.listFiles(projectId);
      setProjectFilesById((prev) => ({ ...prev, [projectId]: files }));
    } catch (e) {
      c.setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingFilesById((prev) => ({ ...prev, [projectId]: false }));
    }
  }, [c, loadingFilesById, projectFilesById]);

  const handleOpenProject = useCallback(
    (projectId: string) => {
      if (c.current?.id !== projectId) {
        void c.loadProject(projectId);
      }
    },
    [c],
  );

  const handleOpenProjectFile = useCallback(async (projectId: string, fileId: string) => {
    if (c.current?.id !== projectId) {
      await c.loadProject(projectId);
    }
    await c.openFile(fileId);
  }, [c]);

  const toggleProjectExpanded = useCallback(
    (projectId: string, isExpanded: boolean) => {
      setExpandedProjectId((prev) => (prev === projectId ? null : projectId));
      if (!isExpanded) void ensureProjectFilesLoaded(projectId);
    },
    [ensureProjectFilesLoaded],
  );

  useEffect(() => {
    if ((!hubMode && !editorMode) || !activeProjectId) return;
    setExpandedProjectId(activeProjectId);
    void ensureProjectFilesLoaded(activeProjectId);
  }, [activeProjectId, editorMode, ensureProjectFilesLoaded, hubMode]);

  return {
    expandedProjectId,
    projectFilesById,
    loadingFilesById,
    handleOpenProject,
    handleOpenProjectFile,
    toggleProjectExpanded,
  };
}
